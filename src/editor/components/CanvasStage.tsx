import {
  mergeAlignmentBounds,
  resolveAlignmentSnap,
  type AlignmentBounds,
  type AlignmentGuide,
  type AlignmentReference,
} from "@/editor/alignment-guides";
import { renderChartToDataUrl } from "@/editor/chart-renderer";
import { findElementContext } from "@/editor/editor-state";
import { getCanvasFont, loadCanvasFont, type CanvasFontFamily } from "@/editor/fonts";
import { getCoverImageCrop } from "@/editor/image-layout";
import {
  invalidateMarkdownCanvasCache,
  markdownToDisplayText,
  renderMarkdownToCanvas,
} from "@/editor/markdown";
import { getTableLayout } from "@/editor/table-layout";
import {
  isGroupElement,
  isLeafElement,
  type ArrowElement,
  type CanvasDocument,
  type CanvasElement,
  type CanvasElementPatch,
  type CanvasLeafElement,
  type CanvasPoint,
  type CanvasTransformPatch,
  type ChartElement,
  type ImageElement,
  type LineElement,
  type TableCellStyle,
  type TableElement,
} from "@/editor/types";
import { resolveAssetObjectUrl } from "@/features/content-studio/asset-resolver";
import Konva from "konva";
import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import { flushSync } from "react-dom";
import {
  Arrow,
  Ellipse,
  Group,
  Image,
  Layer,
  Line,
  Rect,
  RegularPolygon,
  Stage,
  Star,
  Text,
  Transformer,
} from "react-konva";
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
  draftElement?: CanvasLeafElement | null;
  isCreating?: boolean;
  readOnly?: boolean;
  stageHandleRef?: Ref<CanvasStageHandle>;
  onEditText: (elementId: string) => void;
  onHover?: (elementId: string | null) => void;
  onSelect: (elementId: string | null) => void;
  onElementChange: (elementId: string, patch: CanvasElementPatch) => void;
  onElementPreview: (elementId: string, patch: Partial<CanvasTransformPatch> | null) => void;
}

export interface CanvasStageHandle {
  exportImage: (options?: { pixelRatio?: number }) => string | null;
}

interface RenderElementProps {
  element: CanvasElement;
  fontRevision: number;
  inheritedLocked: boolean;
  editingElementId: string | null;
  selectedId: string | null;
  onEditText: (elementId: string) => void;
  onElementDragEnd: (elementId: string, node: Konva.Node) => void;
  onElementDragMove: (elementId: string, node: Konva.Node) => void;
  onElementDragStart: (elementId: string, node: Konva.Node) => void;
  onHover: (elementId: string | null) => void;
  onSelect: (elementId: string) => void;
  onElementChange: (elementId: string, patch: CanvasElementPatch) => void;
  onElementPreview: (elementId: string, patch: Partial<CanvasTransformPatch> | null) => void;
  setNodeRef: (elementId: string, node: Konva.Node | null) => void;
}

interface ElementDragCallbacks {
  onElementDragEnd: (elementId: string, node: Konva.Node) => void;
  onElementDragMove: (elementId: string, node: Konva.Node) => void;
  onElementDragStart: (elementId: string, node: Konva.Node) => void;
}

interface ElementHoverCallbacks {
  onHover: (elementId: string | null) => void;
}

interface AlignmentLeafEntry {
  ancestorGroupIds: string[];
  id: string;
  parentGroupId: string | null;
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

const ignoreElementHover = () => undefined;

function collectVisibleLeafEntries(
  elements: CanvasElement[],
  ancestorGroupIds: string[] = [],
  inheritedVisible = true,
): AlignmentLeafEntry[] {
  const entries: AlignmentLeafEntry[] = [];

  for (const element of elements) {
    const effectivelyVisible = inheritedVisible && element.visible;
    if (!effectivelyVisible) continue;

    if (isGroupElement(element)) {
      entries.push(
        ...collectVisibleLeafEntries(
          element.children,
          [...ancestorGroupIds, element.id],
          effectivelyVisible,
        ),
      );
      continue;
    }

    entries.push({
      ancestorGroupIds,
      id: element.id,
      parentGroupId: ancestorGroupIds.at(-1) ?? null,
    });
  }

  return entries;
}

function getNodeAlignmentBounds(
  node: Konva.Node | undefined,
  relativeTo: Konva.Group,
): AlignmentBounds | null {
  if (!node || typeof node.getClientRect !== "function") return null;

  const bounds = node.getClientRect({
    relativeTo,
    skipShadow: true,
  });
  return {
    bottom: bounds.y + bounds.height,
    left: bounds.x,
    right: bounds.x + bounds.width,
    top: bounds.y,
  };
}

function createAlignmentReferences({
  document,
  draggedElementId,
  documentGroup,
  nodes,
}: {
  document: CanvasDocument;
  documentGroup: Konva.Group;
  draggedElementId: string;
  nodes: Map<string, Konva.Node>;
}): AlignmentReference[] {
  const entries = collectVisibleLeafEntries(document.elements);
  const draggedEntry = entries.find((entry) => entry.id === draggedElementId);
  const boundsById = new Map<string, AlignmentBounds>();

  for (const entry of entries) {
    if (entry.id === draggedElementId) continue;
    const bounds = getNodeAlignmentBounds(nodes.get(entry.id), documentGroup);
    if (bounds) boundsById.set(entry.id, bounds);
  }

  const elementReferences = entries.flatMap((entry): AlignmentReference[] => {
    if (entry.id === draggedElementId) return [];
    const bounds = boundsById.get(entry.id);
    if (!bounds) return [];

    return [
      {
        bounds,
        id: entry.id,
        priority: entry.parentGroupId === draggedEntry?.parentGroupId ? 0 : 2,
      },
    ];
  });
  const parentGroupId = draggedEntry?.parentGroupId;
  let parentReference: AlignmentReference | null = null;

  if (parentGroupId) {
    const parentBounds = mergeAlignmentBounds(
      entries.flatMap((entry): AlignmentBounds[] => {
        if (entry.id === draggedElementId || !entry.ancestorGroupIds.includes(parentGroupId)) {
          return [];
        }
        const bounds = boundsById.get(entry.id);
        return bounds ? [bounds] : [];
      }),
    );
    if (parentBounds) {
      parentReference = {
        bounds: parentBounds,
        id: parentGroupId,
        priority: 1,
      };
    }
  }

  return [
    ...elementReferences,
    ...(parentReference ? [parentReference] : []),
    {
      bounds: {
        bottom: document.height,
        left: 0,
        right: document.width,
        top: 0,
      },
      id: document.id,
      priority: 1,
    },
  ];
}

function getDocumentFontLoadRequests(elements: CanvasElement[]): FontLoadRequest[] {
  const requests = new Map<string, FontLoadRequest>();

  function visit(element: CanvasElement) {
    if (isGroupElement(element)) {
      element.children.forEach(visit);
      return;
    }
    if (element.type === "table") {
      const text = [
        ...element.columns.map((column) => column.name),
        ...element.rows.flatMap((row) =>
          element.columns.map((column) => row.cells[column.id] ?? ""),
        ),
      ].join("\n");

      for (const style of [element.headerStyle, element.cellStyle]) {
        const key = `${style.fontFamily}:${style.fontWeight}`;
        const currentRequest = requests.get(key);
        if (currentRequest) {
          currentRequest.text += `\n${text}`;
        } else {
          requests.set(key, {
            fontFamily: style.fontFamily,
            fontWeight: style.fontWeight,
            text,
          });
        }
      }
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

  const crop = getCoverImageCrop(
    image,
    element,
    element.focalPointX ?? 0.5,
    element.focalPointY ?? 0.5,
  );

  return {
    crop: crop ?? undefined,
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
  onElementDragEnd,
  onElementDragMove,
  onElementDragStart,
  onHover,
  onElementChange,
  onElementPreview,
  setNodeRef,
}: ElementDragCallbacks &
  ElementHoverCallbacks & {
    element: ImageElement;
    draggable: boolean;
    onSelect: (elementId: string) => void;
    onElementChange: (elementId: string, patch: CanvasElementPatch) => void;
    onElementPreview: (elementId: string, patch: Partial<CanvasTransformPatch> | null) => void;
    setNodeRef: (elementId: string, node: Konva.Node | null) => void;
  }) {
  const [resolvedSource, setResolvedSource] = useState(element.src);
  useEffect(() => {
    let active = true;
    void resolveAssetObjectUrl(element.src)
      .then((source) => {
        if (active) setResolvedSource(source);
      })
      .catch(() => {
        if (active) setResolvedSource("");
      });
    return () => {
      active = false;
    };
  }, [element.src]);
  const [image] = useImage(resolvedSource);
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
      onDragEnd={(event) => onElementDragEnd(element.id, event.target)}
      onDragMove={(event) => onElementDragMove(element.id, event.target)}
      onDragStart={(event) => onElementDragStart(element.id, event.target)}
      onMouseEnter={() => onHover(element.id)}
      onMouseLeave={() => onHover(null)}
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

function CanvasChart({
  element,
  draggable,
  onSelect,
  onElementDragEnd,
  onElementDragMove,
  onElementDragStart,
  onHover,
  onElementChange,
  onElementPreview,
  setNodeRef,
}: ElementDragCallbacks &
  ElementHoverCallbacks & {
    element: ChartElement;
    draggable: boolean;
    onSelect: (elementId: string) => void;
    onElementChange: (elementId: string, patch: CanvasElementPatch) => void;
    onElementPreview: (elementId: string, patch: Partial<CanvasTransformPatch> | null) => void;
    setNodeRef: (elementId: string, node: Konva.Node | null) => void;
  }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [chartImage] = useImage(dataUrl ?? "");

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      const nextDataUrl = renderChartToDataUrl(element);
      if (!cancelled) setDataUrl(nextDataUrl);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [element]);

  return (
    <Group
      ref={(node) => setNodeRef(element.id, node)}
      draggable={draggable}
      height={element.height}
      name={element.id}
      opacity={element.opacity}
      rotation={0}
      visible={element.visible}
      width={element.width}
      x={element.x}
      y={element.y}
      onClick={(event) => {
        event.cancelBubble = true;
        onSelect(element.id);
      }}
      onDragEnd={(event) => onElementDragEnd(element.id, event.target)}
      onDragMove={(event) => onElementDragMove(element.id, event.target)}
      onDragStart={(event) => onElementDragStart(element.id, event.target)}
      onMouseEnter={() => onHover(element.id)}
      onMouseLeave={() => onHover(null)}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect(element.id);
      }}
      onTransform={(event) =>
        onElementPreview(element.id, { ...getTransformPatch(element, event.target), rotation: 0 })
      }
      onTransformEnd={(event) =>
        commitTransform(element, event.target, onElementChange, onElementPreview)
      }
    >
      <Rect
        fill="#ffffff"
        height={element.height}
        listening
        stroke="#E2E8F0"
        strokeWidth={1}
        width={element.width}
      />
      {chartImage ? (
        <Image height={element.height} image={chartImage} listening={false} width={element.width} />
      ) : null}
    </Group>
  );
}

function getTableTextY(rowY: number, rowHeight: number, fontSize: number) {
  return rowY + Math.max(0, (rowHeight - fontSize * 1.28) / 2);
}

function CanvasTableCell({
  height,
  style,
  text,
  width,
  x,
  y,
}: {
  height: number;
  style: TableCellStyle;
  text: string;
  width: number;
  x: number;
  y: number;
}) {
  return (
    <Group x={x} y={y}>
      <Rect
        fill={style.fill}
        height={height}
        listening={false}
        stroke={style.borderColor}
        strokeWidth={style.borderWidth}
        width={width}
      />
      <Text
        align={style.align}
        fill={style.color}
        fontFamily={getCanvasFont(style.fontFamily).cssFamily}
        fontSize={style.fontSize}
        fontStyle={style.fontWeight}
        height={Math.max(1, height - 8)}
        listening={false}
        text={text}
        verticalAlign={style.valign}
        width={Math.max(1, width - 16)}
        x={8}
        y={getTableTextY(0, height, style.fontSize)}
      />
    </Group>
  );
}

function CanvasTable({
  element,
  draggable,
  onSelect,
  onElementDragEnd,
  onElementDragMove,
  onElementDragStart,
  onHover,
  onElementChange,
  onElementPreview,
  setNodeRef,
}: ElementDragCallbacks &
  ElementHoverCallbacks & {
    element: TableElement;
    draggable: boolean;
    onSelect: (elementId: string) => void;
    onElementChange: (elementId: string, patch: CanvasElementPatch) => void;
    onElementPreview: (elementId: string, patch: Partial<CanvasTransformPatch> | null) => void;
    setNodeRef: (elementId: string, node: Konva.Node | null) => void;
  }) {
  const layout = getTableLayout(element);

  return (
    <Group
      ref={(node) => setNodeRef(element.id, node)}
      draggable={draggable}
      height={element.height}
      name={element.id}
      opacity={element.opacity}
      rotation={0}
      visible={element.visible}
      width={element.width}
      x={element.x}
      y={element.y}
      onClick={(event) => {
        event.cancelBubble = true;
        onSelect(element.id);
      }}
      onDragEnd={(event) => onElementDragEnd(element.id, event.target)}
      onDragMove={(event) => onElementDragMove(element.id, event.target)}
      onDragStart={(event) => onElementDragStart(element.id, event.target)}
      onMouseEnter={() => onHover(element.id)}
      onMouseLeave={() => onHover(null)}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect(element.id);
      }}
      onTransform={(event) =>
        onElementPreview(element.id, { ...getTransformPatch(element, event.target), rotation: 0 })
      }
      onTransformEnd={(event) =>
        commitTransform(element, event.target, onElementChange, onElementPreview)
      }
    >
      <Rect
        fill="transparent"
        height={element.height}
        listening
        name={`${element.id}-hit-area`}
        width={element.width}
      />
      {element.columns.map((column, index) => (
        <CanvasTableCell
          height={layout.headerHeight}
          key={column.id}
          style={element.headerStyle}
          text={column.name}
          width={layout.columnWidths[index]}
          x={layout.columnX[index]}
          y={0}
        />
      ))}
      {element.rows.flatMap((row, rowIndex) => {
        return element.columns.map((column, columnIndex) => {
          return (
            <CanvasTableCell
              height={layout.rowHeights[rowIndex]}
              key={`${row.id}-${column.id}`}
              style={element.cellStyle}
              text={row.cells[column.id] ?? ""}
              width={layout.columnWidths[columnIndex]}
              x={layout.columnX[columnIndex]}
              y={layout.rowY[rowIndex]}
            />
          );
        });
      })}
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

function getLineTransformPatch(
  element: LineElement | ArrowElement,
  node: Konva.Node,
): CanvasElementPatch {
  const scaleX = Math.abs(node.scaleX());
  const scaleY = Math.abs(node.scaleY());
  return {
    ...getTransformPatch(element, node),
    points: element.points.map((point, index) => point * (index % 2 === 0 ? scaleX : scaleY)),
  };
}

function normalizeTextTransform(
  element: Extract<CanvasLeafElement, { type: "text" }>,
  node: Konva.Shape,
): CanvasTransformPatch {
  const width = Math.max(8, node.width() * Math.abs(node.scaleX()));

  // Konva Transformer changes scale values. Text boxes intentionally resize only
  // horizontally, so their font size and line box height remain stable while reflowing.
  node.width(width);
  node.height(element.height);
  node.scaleX(1);
  node.scaleY(1);

  return {
    x: node.x(),
    y: node.y(),
    width,
    height: element.height,
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
  const patch =
    element.type === "line" || element.type === "arrow"
      ? getLineTransformPatch(element, node)
      : {
          ...getTransformPatch(element, node),
          ...(element.type === "chart" || element.type === "table" ? { rotation: 0 } : {}),
        };

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
  element: Extract<CanvasLeafElement, { type: "text" }>,
  node: Konva.Shape,
  onElementChange: (elementId: string, patch: CanvasElementPatch) => void,
  onElementPreview: (elementId: string, patch: Partial<CanvasTransformPatch> | null) => void,
) {
  const patch = normalizeTextTransform(element, node);

  flushSync(() => {
    onElementChange(element.id, patch);
  });
  onElementPreview(element.id, null);
}

const RenderElement = memo(function RenderElement({
  element,
  fontRevision,
  inheritedLocked,
  editingElementId,
  selectedId,
  onEditText,
  onElementDragEnd,
  onElementDragMove,
  onElementDragStart,
  onHover,
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
            selectedId={selectedId}
            setNodeRef={setNodeRef}
            onEditText={onEditText}
            onElementDragEnd={onElementDragEnd}
            onElementDragMove={onElementDragMove}
            onElementDragStart={onElementDragStart}
            onElementChange={onElementChange}
            onElementPreview={onElementPreview}
            onHover={onHover}
            onSelect={onSelect}
          />
        ))}
      </Group>
    );
  }

  const isEditing = editingElementId === element.id;
  const commonProps = {
    draggable: selectedId === element.id && !locked && !isEditing,
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
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) =>
      onElementDragEnd(element.id, event.target),
    onDragMove: (event: Konva.KonvaEventObject<DragEvent>) =>
      onElementDragMove(element.id, event.target),
    onDragStart: (event: Konva.KonvaEventObject<DragEvent>) =>
      onElementDragStart(element.id, event.target),
    onMouseEnter: () => onHover(element.id),
    onMouseLeave: () => onHover(null),
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
          shadowBlur={element.shadow?.blur}
          shadowColor={element.shadow?.color}
          shadowOffsetX={element.shadow?.offsetX}
          shadowOffsetY={element.shadow?.offsetY}
          shadowOpacity={element.shadow?.opacity}
          stroke={element.stroke}
          strokeWidth={element.strokeWidth}
        />
      );
    case "circle":
      return (
        <Rect
          ref={(node) => setNodeRef(element.id, node)}
          {...commonProps}
          cornerRadius={Math.min(element.width, element.height) / 2}
          fill={element.fill}
          stroke={element.stroke}
          strokeWidth={element.strokeWidth}
        />
      );
    case "ellipse":
      return (
        <Group ref={(node) => setNodeRef(element.id, node)} {...commonProps}>
          <Ellipse
            fill={element.fill}
            radiusX={element.width / 2}
            radiusY={element.height / 2}
            stroke={element.stroke}
            strokeWidth={element.strokeWidth}
            x={element.width / 2}
            y={element.height / 2}
          />
        </Group>
      );
    case "line":
      return (
        <Group ref={(node) => setNodeRef(element.id, node)} {...commonProps}>
          <Line
            hitStrokeWidth={Math.max(12, element.strokeWidth)}
            lineCap={element.lineCap}
            points={element.points}
            stroke={element.stroke}
            strokeWidth={element.strokeWidth}
          />
        </Group>
      );
    case "arrow":
      return (
        <Group ref={(node) => setNodeRef(element.id, node)} {...commonProps}>
          <Arrow
            fill={element.stroke}
            hitStrokeWidth={Math.max(12, element.strokeWidth)}
            lineCap={element.lineCap}
            pointerLength={element.pointerLength}
            pointerWidth={element.pointerWidth}
            points={element.points}
            stroke={element.stroke}
            strokeWidth={element.strokeWidth}
          />
        </Group>
      );
    case "polygon":
      return (
        <Group ref={(node) => setNodeRef(element.id, node)} {...commonProps}>
          <RegularPolygon
            cornerRadius={element.cornerRadius}
            fill={element.fill}
            radius={Math.min(element.width, element.height) / 2}
            sides={element.sides}
            stroke={element.stroke}
            strokeWidth={element.strokeWidth}
            x={element.width / 2}
            y={element.height / 2}
          />
        </Group>
      );
    case "star": {
      const radius = Math.min(element.width, element.height) / 2;
      const radiusRatio =
        element.outerRadius > 0 ? element.innerRadius / element.outerRadius : 0.42;
      return (
        <Group ref={(node) => setNodeRef(element.id, node)} {...commonProps}>
          <Star
            fill={element.fill}
            innerRadius={radius * radiusRatio}
            numPoints={element.numPoints}
            outerRadius={radius}
            stroke={element.stroke}
            strokeWidth={element.strokeWidth}
            x={element.width / 2}
            y={element.height / 2}
          />
        </Group>
      );
    }
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
            onElementPreview(
              element.id,
              normalizeTextTransform(element, event.target as Konva.Image),
            )
          }
          onTransformEnd={(event) =>
            commitTextTransform(
              element,
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
          lineHeight={element.lineHeight}
          text={markdownToDisplayText(element.text)}
          verticalAlign="middle"
          visible={element.visible && !isEditing}
          onDblClick={(event) => {
            event.cancelBubble = true;
            if (!locked) onEditText(element.id);
          }}
          onTransform={(event) =>
            onElementPreview(
              element.id,
              normalizeTextTransform(element, event.target as Konva.Text),
            )
          }
          onTransformEnd={(event) =>
            commitTextTransform(
              element,
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
          draggable={selectedId === element.id && !locked}
          element={element}
          setNodeRef={setNodeRef}
          onElementDragEnd={onElementDragEnd}
          onElementDragMove={onElementDragMove}
          onElementDragStart={onElementDragStart}
          onElementChange={onElementChange}
          onElementPreview={onElementPreview}
          onHover={onHover}
          onSelect={onSelect}
        />
      );
    case "chart":
      return (
        <CanvasChart
          draggable={selectedId === element.id && !locked}
          element={element}
          setNodeRef={setNodeRef}
          onElementDragEnd={onElementDragEnd}
          onElementDragMove={onElementDragMove}
          onElementDragStart={onElementDragStart}
          onElementChange={onElementChange}
          onElementPreview={onElementPreview}
          onHover={onHover}
          onSelect={onSelect}
        />
      );
    case "table":
      return (
        <CanvasTable
          draggable={selectedId === element.id && !locked}
          element={element}
          setNodeRef={setNodeRef}
          onElementDragEnd={onElementDragEnd}
          onElementDragMove={onElementDragMove}
          onElementDragStart={onElementDragStart}
          onElementChange={onElementChange}
          onElementPreview={onElementPreview}
          onHover={onHover}
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
  draftElement = null,
  isCreating = false,
  readOnly = false,
  stageHandleRef,
  onEditText,
  onHover = ignoreElementHover,
  onSelect,
  onElementChange,
  onElementPreview,
}: CanvasStageProps) {
  const documentGroupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const hoverTransformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef(new Map<string, Konva.Node>());
  const alignmentReferencesRef = useRef<AlignmentReference[]>([]);
  const fontLoadRequests = useMemo(
    () => getDocumentFontLoadRequests(document.elements),
    [document.elements],
  );
  const selectedContext = useMemo(
    () => findElementContext(document.elements, selectedId),
    [document.elements, selectedId],
  );
  const selectedLinearElement =
    selectedContext &&
    isLeafElement(selectedContext.element) &&
    (selectedContext.element.type === "line" || selectedContext.element.type === "arrow") &&
    selectedContext.effectivelyVisible &&
    !isSelectedLocked &&
    selectedId !== editingElementId &&
    !readOnly
      ? selectedContext.element
      : null;
  const [fontRevision, setFontRevision] = useState(0);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);

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

  const collectAlignmentReferences = useCallback(
    (draggedElementId: string) => {
      const documentGroup = documentGroupRef.current;
      if (!documentGroup) return [];

      return createAlignmentReferences({
        document,
        documentGroup,
        draggedElementId,
        nodes: nodeRefs.current,
      });
    },
    [document],
  );

  const handleElementDragStart = useCallback(
    (elementId: string) => {
      alignmentReferencesRef.current = collectAlignmentReferences(elementId);
      setAlignmentGuides([]);
      onHover(null);
    },
    [collectAlignmentReferences, onHover],
  );

  const handleElementDragMove = useCallback(
    (elementId: string, node: Konva.Node) => {
      const documentGroup = documentGroupRef.current;
      const bounds = documentGroup ? getNodeAlignmentBounds(node, documentGroup) : null;

      if (!documentGroup || !bounds) {
        onElementPreview(elementId, { x: node.x(), y: node.y() });
        return;
      }

      if (alignmentReferencesRef.current.length === 0) {
        alignmentReferencesRef.current = collectAlignmentReferences(elementId);
      }
      const snap = resolveAlignmentSnap({
        bounds,
        references: alignmentReferencesRef.current,
        threshold: 5 / zoom,
        x: node.x(),
        y: node.y(),
      });

      if (snap.x !== node.x() || snap.y !== node.y()) {
        node.position({ x: snap.x, y: snap.y });
      }
      setAlignmentGuides(snap.guides);
      onElementPreview(elementId, { x: snap.x, y: snap.y });
    },
    [collectAlignmentReferences, onElementPreview, zoom],
  );

  const handleElementDragEnd = useCallback(
    (elementId: string, node: Konva.Node) => {
      alignmentReferencesRef.current = [];
      setAlignmentGuides([]);
      commitDrag(elementId, node, onElementChange, onElementPreview);
    },
    [onElementChange, onElementPreview],
  );

  const handleLinearProxyDragMove = useCallback(
    (elementId: string, proxyNode: Konva.Node) => {
      const selectedNode = nodeRefs.current.get(elementId);
      if (!selectedNode) return;

      selectedNode.position(proxyNode.position());
      handleElementDragMove(elementId, selectedNode);
      proxyNode.position(selectedNode.position());
    },
    [handleElementDragMove],
  );

  const handleLinearProxyDragEnd = useCallback(
    (elementId: string, proxyNode: Konva.Node) => {
      const selectedNode = nodeRefs.current.get(elementId);
      if (!selectedNode) return;

      selectedNode.position(proxyNode.position());
      handleElementDragEnd(elementId, selectedNode);
    },
    [handleElementDragEnd],
  );

  useImperativeHandle(
    stageHandleRef,
    () => ({
      exportImage(options) {
        return (
          documentGroupRef.current?.toDataURL({
            height: document.height,
            mimeType: "image/png",
            pixelRatio: options?.pixelRatio ?? 2,
            width: document.width,
            x: 0,
            y: 0,
          }) ?? null
        );
      },
    }),
    [document.height, document.width],
  );

  return (
    <Stage
      height={viewportHeight}
      width={viewportWidth}
      onMouseDown={(event) => {
        if (event.target === event.target.getStage()) onSelect(null);
      }}
      onMouseLeave={() => onHover(null)}
      onTouchStart={(event) => {
        if (event.target === event.target.getStage()) onSelect(null);
      }}
    >
      <Layer
        listening={!isCreating && !readOnly}
        scaleX={zoom}
        scaleY={zoom}
        x={viewportPosition.x}
        y={viewportPosition.y}
      >
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
        <Group ref={documentGroupRef}>
          <Rect fill="#ffffff" height={document.height} listening={false} width={document.width} />
          {document.elements.map((element) => (
            <RenderElement
              element={element}
              fontRevision={fontRevision}
              editingElementId={editingElementId}
              inheritedLocked={false}
              key={element.id}
              selectedId={selectedId}
              setNodeRef={setNodeRef}
              onEditText={onEditText}
              onElementDragEnd={handleElementDragEnd}
              onElementDragMove={handleElementDragMove}
              onElementDragStart={handleElementDragStart}
              onElementChange={onElementChange}
              onElementPreview={onElementPreview}
              onHover={onHover}
              onSelect={onSelect}
            />
          ))}
        </Group>
        {draftElement ? (
          <RenderElement
            element={draftElement}
            fontRevision={fontRevision}
            editingElementId={null}
            inheritedLocked
            selectedId={null}
            setNodeRef={() => undefined}
            onEditText={() => undefined}
            onElementDragEnd={() => undefined}
            onElementDragMove={() => undefined}
            onElementDragStart={() => undefined}
            onElementChange={() => undefined}
            onElementPreview={() => undefined}
            onHover={ignoreElementHover}
            onSelect={() => undefined}
          />
        ) : null}
        <Group listening={false}>
          {alignmentGuides.map((guide, index) => (
            <Line
              dash={[6 / zoom, 4 / zoom]}
              key={`${guide.orientation}-${guide.sourceId}-${index}`}
              lineCap="round"
              listening={false}
              name="alignment-guide"
              opacity={0.58}
              points={
                guide.orientation === "vertical"
                  ? [guide.position, guide.start, guide.position, guide.end]
                  : [guide.start, guide.position, guide.end, guide.position]
              }
              stroke="#6d5fd4"
              strokeWidth={1 / zoom}
            />
          ))}
        </Group>
        {selectedLinearElement ? (
          <Line
            draggable
            hitStrokeWidth={Math.max(12 / zoom, selectedLinearElement.strokeWidth)}
            lineCap={selectedLinearElement.lineCap}
            name="selected-linear-drag-proxy"
            points={selectedLinearElement.points}
            rotation={selectedLinearElement.rotation}
            stroke="rgba(0, 0, 0, 0.001)"
            strokeWidth={Math.max(1 / zoom, selectedLinearElement.strokeWidth)}
            x={selectedLinearElement.x}
            y={selectedLinearElement.y}
            onDragEnd={(event) => handleLinearProxyDragEnd(selectedLinearElement.id, event.target)}
            onDragMove={(event) =>
              handleLinearProxyDragMove(selectedLinearElement.id, event.target)
            }
            onDragStart={() => handleElementDragStart(selectedLinearElement.id)}
            onMouseEnter={() => onHover(selectedLinearElement.id)}
            onMouseLeave={() => onHover(null)}
          />
        ) : null}
        {readOnly ? null : (
          <>
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
              enabledAnchors={
                selectedContext?.element.type === "text"
                  ? ["middle-left", "middle-right"]
                  : undefined
              }
              flipEnabled={false}
              keepRatio={
                selectedContext?.element.type !== "image" &&
                selectedContext?.element.type !== "line" &&
                selectedContext?.element.type !== "arrow" &&
                selectedContext?.element.type !== "text" &&
                selectedContext?.element.type !== "chart" &&
                selectedContext?.element.type !== "table"
              }
              rotateAnchorOffset={28}
              rotateEnabled={
                selectedContext?.element.type !== "chart" &&
                selectedContext?.element.type !== "table"
              }
              shouldOverdrawWholeArea={
                Boolean(selectedContext && isLeafElement(selectedContext.element)) &&
                selectedContext?.element.type !== "line" &&
                selectedContext?.element.type !== "arrow"
              }
              onDblClick={(event) => {
                const selectedElement = selectedContext?.element;
                if (!selectedElement || selectedElement.type !== "text" || isSelectedLocked) {
                  return;
                }
                event.cancelBubble = true;
                onEditText(selectedElement.id);
              }}
              onDragStart={() => onHover(null)}
              boundBoxFunc={(oldBox, newBox) => {
                const isLinear =
                  selectedContext?.element.type === "line" ||
                  selectedContext?.element.type === "arrow";
                const isTooSmall = isLinear
                  ? Math.hypot(newBox.width, newBox.height) < 8 * zoom
                  : Math.abs(newBox.width) < 8 * zoom || Math.abs(newBox.height) < 8 * zoom;
                return isTooSmall ? oldBox : newBox;
              }}
            />
          </>
        )}
      </Layer>
    </Stage>
  );
}
