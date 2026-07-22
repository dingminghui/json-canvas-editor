import { findElementContext } from "@/editor/editor-state";
import { getCanvasFont, loadCanvasFont, type CanvasFontFamily } from "@/editor/fonts";
import {
  invalidateMarkdownCanvasCache,
  markdownToDisplayText,
  renderMarkdownToCanvas,
} from "@/editor/markdown";
import {
  isGroupElement,
  isLeafElement,
  type CanvasDocument,
  type CanvasElement,
  type CanvasElementPatch,
  type CanvasLeafElement,
  type CanvasPoint,
  type CanvasTransformPatch,
  type ImageElement,
} from "@/editor/types";
import Konva from "konva";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { Group, Image, Layer, Rect, Stage, Text, Transformer } from "react-konva";
import useImage from "use-image";

interface CanvasStageProps {
  document: CanvasDocument;
  hoveredId: string | null;
  selectedId: string | null;
  zoom: number;
  viewportHeight: number;
  viewportPosition: CanvasPoint;
  viewportWidth: number;
  editingElementId: string | null;
  isSelectedLocked: boolean;
  onEditText: (elementId: string) => void;
  onSelect: (elementId: string | null) => void;
  onElementChange: (elementId: string, patch: CanvasElementPatch) => void;
  onElementPreview: (elementId: string, patch: Partial<CanvasTransformPatch> | null) => void;
  onPanReadyChange?: (ready: boolean) => void;
  onPanStart?: (pointerId: number, point: CanvasPoint) => void;
}

interface RenderElementProps {
  element: CanvasElement;
  fontRevision: number;
  inheritedLocked: boolean;
  editingElementId: string | null;
  onEditText: (elementId: string) => void;
  onSelect: (elementId: string) => void;
  onElementChange: (elementId: string, patch: CanvasElementPatch) => void;
  onElementPreview: (elementId: string, patch: Partial<CanvasTransformPatch> | null) => void;
  setNodeRef: (elementId: string, node: Konva.Node | null) => void;
}

interface FontLoadRequest {
  fontFamily: CanvasFontFamily;
  fontWeight: string;
  text: string;
}

interface ImageRenderGeometry {
  crop?: { height: number; width: number; x: number; y: number };
  height: number;
  width: number;
  x: number;
  y: number;
}

function getDocumentFontLoadRequests(elements: CanvasElement[]): FontLoadRequest[] {
  const requests = new Map<string, FontLoadRequest>();

  function visit(element: CanvasElement) {
    if (isGroupElement(element)) {
      element.children.forEach(visit);
      return;
    }
    if (element.type !== "text") return;

    const key = `${element.fontFamily}:${element.fontWeight}`;
    const currentRequest = requests.get(key);
    if (currentRequest) {
      currentRequest.text += `\n${element.text}`;
      return;
    }

    requests.set(key, {
      fontFamily: element.fontFamily,
      fontWeight: element.fontWeight,
      text: element.text,
    });
  }

  elements.forEach(visit);
  return Array.from(requests.values());
}

function getImageRenderGeometry(
  image: { height: number; width: number } | undefined,
  element: ImageElement,
): ImageRenderGeometry {
  if (!image || image.width <= 0 || image.height <= 0) {
    return { height: element.height, width: element.width, x: 0, y: 0 };
  }

  if (element.fit === "contain") {
    const scale = Math.min(element.width / image.width, element.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;

    return {
      height,
      width,
      x: (element.width - width) / 2,
      y: (element.height - height) / 2,
    };
  }

  const frameAspectRatio = element.width / element.height;
  const imageAspectRatio = image.width / image.height;
  const cropWidth =
    imageAspectRatio > frameAspectRatio ? image.height * frameAspectRatio : image.width;
  const cropHeight =
    imageAspectRatio > frameAspectRatio ? image.height : image.width / frameAspectRatio;

  return {
    crop: {
      height: cropHeight,
      width: cropWidth,
      x: (image.width - cropWidth) / 2,
      y: (image.height - cropHeight) / 2,
    },
    height: element.height,
    width: element.width,
    x: 0,
    y: 0,
  };
}

function CanvasImage({
  element,
  draggable,
  onSelect,
  onElementChange,
  onElementPreview,
  setNodeRef,
}: {
  element: ImageElement;
  draggable: boolean;
  onSelect: (elementId: string) => void;
  onElementChange: (elementId: string, patch: CanvasElementPatch) => void;
  onElementPreview: (elementId: string, patch: Partial<CanvasTransformPatch> | null) => void;
  setNodeRef: (elementId: string, node: Konva.Node | null) => void;
}) {
  const [image] = useImage(element.src);
  const imageGeometry = getImageRenderGeometry(image, element);

  return (
    <Group
      ref={(node) => setNodeRef(element.id, node)}
      clipFunc={(context) => {
        context.beginPath();
        context.roundRect(0, 0, element.width, element.height, element.cornerRadius);
        context.closePath();
      }}
      draggable={draggable}
      height={element.height}
      name={element.id}
      opacity={element.opacity}
      rotation={element.rotation}
      visible={element.visible}
      width={element.width}
      x={element.x}
      y={element.y}
      onClick={(event) => {
        event.cancelBubble = true;
        onSelect(element.id);
      }}
      onDragMove={(event) =>
        onElementPreview(element.id, { x: event.target.x(), y: event.target.y() })
      }
      onDragEnd={(event) => commitDrag(element.id, event.target, onElementChange, onElementPreview)}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect(element.id);
      }}
      onTransform={(event) =>
        onElementPreview(element.id, getTransformPatch(element, event.target))
      }
      onTransformEnd={(event) =>
        commitTransform(element, event.target, onElementChange, onElementPreview)
      }
    >
      <Rect
        cornerRadius={element.cornerRadius}
        fill="#e5e3dd"
        height={element.height}
        listening
        width={element.width}
      />
      <Image
        crop={imageGeometry.crop}
        height={imageGeometry.height}
        image={image}
        listening={false}
        width={imageGeometry.width}
        x={imageGeometry.x}
        y={imageGeometry.y}
      />
    </Group>
  );
}

function getTransformPatch(element: CanvasLeafElement, node: Konva.Node): CanvasTransformPatch {
  return {
    x: node.x(),
    y: node.y(),
    width: Math.max(8, element.width * Math.abs(node.scaleX())),
    height: Math.max(8, element.height * Math.abs(node.scaleY())),
    rotation: node.rotation(),
  };
}

function normalizeTextTransform(node: Konva.Shape): CanvasTransformPatch {
  const width = Math.max(8, node.width() * Math.abs(node.scaleX()));
  const height = Math.max(8, node.height() * Math.abs(node.scaleY()));

  // Text needs real dimensions during the gesture so Konva can reflow it instead of
  // stretching the already-rendered glyphs with scaleX/scaleY.
  node.width(width);
  node.height(height);
  node.scaleX(1);
  node.scaleY(1);

  return {
    x: node.x(),
    y: node.y(),
    width,
    height,
    rotation: node.rotation(),
  };
}

function commitDrag(
  elementId: string,
  node: Konva.Node,
  onElementChange: (elementId: string, patch: CanvasElementPatch) => void,
  onElementPreview: (elementId: string, patch: Partial<CanvasTransformPatch> | null) => void,
) {
  flushSync(() => {
    onElementChange(elementId, { x: node.x(), y: node.y() });
  });
  onElementPreview(elementId, null);
}

function commitTransform(
  element: CanvasLeafElement,
  node: Konva.Node,
  onElementChange: (elementId: string, patch: CanvasElementPatch) => void,
  onElementPreview: (elementId: string, patch: Partial<CanvasTransformPatch> | null) => void,
) {
  const patch = getTransformPatch(element, node);

  // Normalize the temporary Transformer scale before committing real dimensions so the
  // selection frame never observes both the new size and the old scale in the same frame.
  node.scaleX(1);
  node.scaleY(1);
  flushSync(() => {
    onElementChange(element.id, patch);
  });
  onElementPreview(element.id, null);
}

function commitTextTransform(
  elementId: string,
  node: Konva.Shape,
  onElementChange: (elementId: string, patch: CanvasElementPatch) => void,
  onElementPreview: (elementId: string, patch: Partial<CanvasTransformPatch> | null) => void,
) {
  const patch = normalizeTextTransform(node);

  flushSync(() => {
    onElementChange(elementId, patch);
  });
  onElementPreview(elementId, null);
}

function canStartViewportPan(target: Konva.Node): boolean {
  const stage = target.getStage();
  if (!stage) return false;

  let node: Konva.Node | null = target;
  while (node && node !== stage) {
    if (node.draggable()) return false;
    node = node.getParent();
  }

  return true;
}

const RenderElement = memo(function RenderElement({
  element,
  fontRevision,
  inheritedLocked,
  editingElementId,
  onEditText,
  onSelect,
  onElementChange,
  onElementPreview,
  setNodeRef,
}: RenderElementProps) {
  const locked = inheritedLocked || element.locked;
  const richTextCanvas = useMemo(
    () => (element.type === "text" ? renderMarkdownToCanvas(element, fontRevision) : null),
    [element, fontRevision],
  );

  if (isGroupElement(element)) {
    return (
      <Group
        ref={(node) => setNodeRef(element.id, node)}
        listening={element.visible}
        name={element.id}
        visible={element.visible}
      >
        {element.children.map((child) => (
          <RenderElement
            element={child}
            fontRevision={fontRevision}
            editingElementId={editingElementId}
            inheritedLocked={locked}
            key={child.id}
            setNodeRef={setNodeRef}
            onEditText={onEditText}
            onElementChange={onElementChange}
            onElementPreview={onElementPreview}
            onSelect={onSelect}
          />
        ))}
      </Group>
    );
  }

  const isEditing = editingElementId === element.id;
  const commonProps = {
    draggable: !locked && !isEditing,
    height: element.height,
    name: element.id,
    opacity: element.opacity,
    rotation: element.rotation,
    visible: element.visible,
    width: element.width,
    x: element.x,
    y: element.y,
    onClick: (event: Konva.KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      onSelect(element.id);
    },
    onTap: (event: Konva.KonvaEventObject<TouchEvent>) => {
      event.cancelBubble = true;
      onSelect(element.id);
    },
    onDragMove: (event: Konva.KonvaEventObject<DragEvent>) =>
      onElementPreview(element.id, { x: event.target.x(), y: event.target.y() }),
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) =>
      commitDrag(element.id, event.target, onElementChange, onElementPreview),
    onTransform: (event: Konva.KonvaEventObject<Event>) =>
      onElementPreview(element.id, getTransformPatch(element, event.target)),
    onTransformEnd: (event: Konva.KonvaEventObject<Event>) =>
      commitTransform(element, event.target, onElementChange, onElementPreview),
  };

  switch (element.type) {
    case "rect":
      return (
        <Rect
          ref={(node) => setNodeRef(element.id, node)}
          {...commonProps}
          cornerRadius={element.cornerRadius}
          fill={element.fill}
        />
      );
    case "circle":
      return (
        <Rect
          ref={(node) => setNodeRef(element.id, node)}
          {...commonProps}
          cornerRadius={Math.min(element.width, element.height) / 2}
          fill={element.fill}
        />
      );
    case "text":
      return richTextCanvas ? (
        <Image
          ref={(node) => setNodeRef(element.id, node)}
          {...commonProps}
          image={richTextCanvas}
          visible={element.visible && !isEditing}
          onDblClick={(event) => {
            event.cancelBubble = true;
            if (!locked) onEditText(element.id);
          }}
          onTransform={(event) =>
            onElementPreview(element.id, normalizeTextTransform(event.target as Konva.Image))
          }
          onTransformEnd={(event) =>
            commitTextTransform(
              element.id,
              event.target as Konva.Image,
              onElementChange,
              onElementPreview,
            )
          }
        />
      ) : (
        <Text
          ref={(node) => setNodeRef(element.id, node)}
          {...commonProps}
          align={element.align}
          fill={element.fill}
          fontFamily={getCanvasFont(element.fontFamily).cssFamily}
          fontSize={element.fontSize}
          fontStyle={element.fontWeight}
          lineHeight={1.04}
          text={markdownToDisplayText(element.text)}
          verticalAlign="middle"
          visible={element.visible && !isEditing}
          onDblClick={(event) => {
            event.cancelBubble = true;
            if (!locked) onEditText(element.id);
          }}
          onTransform={(event) =>
            onElementPreview(element.id, normalizeTextTransform(event.target as Konva.Text))
          }
          onTransformEnd={(event) =>
            commitTextTransform(
              element.id,
              event.target as Konva.Text,
              onElementChange,
              onElementPreview,
            )
          }
        />
      );
    case "image":
      return (
        <CanvasImage
          draggable={!locked}
          element={element}
          setNodeRef={setNodeRef}
          onElementChange={onElementChange}
          onElementPreview={onElementPreview}
          onSelect={onSelect}
        />
      );
    default: {
      const exhaustiveElement: never = element;
      return exhaustiveElement;
    }
  }
});

export function CanvasStage({
  document,
  hoveredId,
  selectedId,
  zoom,
  viewportHeight,
  viewportPosition,
  viewportWidth,
  editingElementId,
  isSelectedLocked,
  onEditText,
  onSelect,
  onElementChange,
  onElementPreview,
  onPanReadyChange,
  onPanStart,
}: CanvasStageProps) {
  const transformerRef = useRef<Konva.Transformer>(null);
  const hoverTransformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef(new Map<string, Konva.Node>());
  const fontLoadRequests = useMemo(
    () => getDocumentFontLoadRequests(document.elements),
    [document.elements],
  );
  const selectedContext = useMemo(
    () => findElementContext(document.elements, selectedId),
    [document.elements, selectedId],
  );
  const [fontRevision, setFontRevision] = useState(0);

  useEffect(() => {
    if (fontLoadRequests.length === 0 || !globalThis.document.fonts?.load) return;

    let cancelled = false;

    void Promise.all(
      fontLoadRequests.map((request) =>
        loadCanvasFont(request.fontFamily, request.fontWeight, request.text),
      ),
    ).then(() => {
      if (cancelled) return;
      invalidateMarkdownCanvasCache();
      setFontRevision((revision) => revision + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [fontLoadRequests]);

  useEffect(() => {
    const transformer = hoverTransformerRef.current;
    if (!transformer) return;

    const hoveredContext = findElementContext(document.elements, hoveredId);
    const hoveredNode =
      hoveredId &&
      hoveredId !== selectedId &&
      hoveredId !== editingElementId &&
      hoveredContext?.effectivelyVisible
        ? nodeRefs.current.get(hoveredId)
        : undefined;
    transformer.nodes(hoveredNode ? [hoveredNode] : []);
    transformer.getLayer()?.batchDraw();
  }, [document, editingElementId, hoveredId, selectedId]);

  useLayoutEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    const selectedNode =
      selectedId &&
      selectedContext &&
      isLeafElement(selectedContext.element) &&
      selectedContext.effectivelyVisible
        ? nodeRefs.current.get(selectedId)
        : undefined;
    transformer.nodes(
      selectedNode && !isSelectedLocked && selectedId !== editingElementId ? [selectedNode] : [],
    );
    transformer.getLayer()?.batchDraw();
  }, [editingElementId, isSelectedLocked, selectedContext, selectedId]);

  const setNodeRef = useCallback((elementId: string, node: Konva.Node | null) => {
    if (node) nodeRefs.current.set(elementId, node);
    else nodeRefs.current.delete(elementId);
  }, []);

  return (
    <Stage
      height={viewportHeight}
      width={viewportWidth}
      onMouseDown={(event) => {
        if (event.target === event.target.getStage()) onSelect(null);
      }}
      onPointerDown={(event) => {
        if (!canStartViewportPan(event.target) || event.evt.button !== 0) return;

        onPanReadyChange?.(true);
        onPanStart?.(event.pointerId, { x: event.evt.clientX, y: event.evt.clientY });
      }}
      onPointerLeave={() => onPanReadyChange?.(false)}
      onPointerMove={(event) => {
        onPanReadyChange?.(canStartViewportPan(event.target));
      }}
      onTouchStart={(event) => {
        if (event.target === event.target.getStage()) onSelect(null);
      }}
    >
      <Layer scaleX={zoom} scaleY={zoom} x={viewportPosition.x} y={viewportPosition.y}>
        <Rect
          fill="#ffffff"
          height={document.height}
          listening={false}
          shadowBlur={24 / zoom}
          shadowColor="rgba(30, 29, 35, 0.12)"
          shadowOffsetY={8 / zoom}
          shadowOpacity={0.7}
          stroke="rgba(30, 29, 35, 0.06)"
          strokeWidth={1 / zoom}
          width={document.width}
        />
        {document.elements.map((element) => (
          <RenderElement
            element={element}
            fontRevision={fontRevision}
            editingElementId={editingElementId}
            inheritedLocked={false}
            key={element.id}
            setNodeRef={setNodeRef}
            onEditText={onEditText}
            onElementChange={onElementChange}
            onElementPreview={onElementPreview}
            onSelect={onSelect}
          />
        ))}
        <Transformer
          ref={hoverTransformerRef}
          borderDash={[]}
          borderStroke="rgba(109, 95, 212, 0.72)"
          borderStrokeWidth={1.25}
          enabledAnchors={[]}
          listening={false}
          padding={2}
          resizeEnabled={false}
          rotateEnabled={false}
        />
        <Transformer
          ref={transformerRef}
          anchorCornerRadius={4}
          anchorFill="#ffffff"
          anchorSize={12}
          anchorStroke="#6d5fd4"
          anchorStrokeWidth={1}
          borderDash={[]}
          borderStroke="#6d5fd4"
          borderStrokeWidth={1.5}
          flipEnabled={false}
          keepRatio={selectedContext?.element.type !== "image"}
          rotateAnchorOffset={28}
          rotateEnabled
          boundBoxFunc={(oldBox, newBox) =>
            Math.abs(newBox.width) < 8 * zoom || Math.abs(newBox.height) < 8 * zoom
              ? oldBox
              : newBox
          }
        />
      </Layer>
    </Stage>
  );
}
