import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { findCanvasElementBounds, getViewportPositionToReveal } from "@/editor/canvas-viewport";
import { CanvasStage, type CanvasStageHandle } from "@/editor/components/CanvasStage";
import { DocumentJsonPreviewDialog } from "@/editor/components/DocumentJsonPreviewDialog";
import { EditorIconButton } from "@/editor/components/EditorIconButton";
import { findElement } from "@/editor/editor-state";
import {
  ACCEPTED_IMAGE_TYPES,
  createChartElement,
  createElementFromDrag,
  createImageElement,
  createTableElement,
  isPointInsideDocument,
  MAX_IMAGE_BYTES,
  type CreationTool,
  type ShapeCreationTool,
} from "@/editor/element-creation";
import { getExportFileName } from "@/editor/export-file";
import { isInteractiveTarget } from "@/editor/interaction";
import type {
  CanvasDocument,
  CanvasElementPatch,
  CanvasLeafElement,
  CanvasPoint,
  CanvasTransformPatch,
  TextEditingSession,
} from "@/editor/types";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  Circle,
  Download,
  ImagePlus,
  LayoutGrid,
  Loader2,
  Minus,
  Plus,
  Redo2,
  Scan,
  Square,
  Star,
  Table,
  Triangle,
  Type,
  Undo2,
} from "lucide-react";
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from "react";

const RichTextEditorOverlay = lazy(() => import("@/editor/components/RichTextEditorOverlay"));
const MAX_CANVAS_PREVIEW_WIDTH = 890;

interface EditorWorkspaceProps {
  document: CanvasDocument;
  exportDocument?: CanvasDocument;
  readOnly?: boolean;
  hoveredId: string | null;
  selectedId: string | null;
  editingText: TextEditingSession | null;
  isSelectedLocked: boolean;
  manualZoom: number;
  fitMode: boolean;
  canUndo: boolean;
  canRedo: boolean;
  workspaceHandleRef: Ref<EditorWorkspaceHandle>;
  onSelect: (elementId: string | null) => void;
  onEditText: (elementId: string) => void;
  onCancelTextEdit: () => void;
  onCommitTextEdit: (sessionId: number, elementId: string, markdown: string) => void;
  onElementChange: (elementId: string, patch: CanvasElementPatch) => void;
  onElementPreview: (elementId: string, patch: Partial<CanvasTransformPatch> | null) => void;
  onAddElement: (element: CanvasLeafElement, editText?: boolean) => void;
  onSetZoom: (zoom: number) => void;
  onSetFitMode: (enabled: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenOverview?: () => void;
  onExport?: (document: CanvasDocument) => void | Promise<void>;
}

export interface EditorWorkspaceHandle {
  cancelCreation: () => void;
  revealElement: (elementId: string) => void;
}

interface ContainerSize {
  width: number;
  height: number;
}

interface PanSession {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPosition: CanvasPoint;
}

interface DrawSession {
  documentId: string;
  pointerId: number;
  start: CanvasPoint;
  tool: CreationTool;
}

const SHAPE_TOOLS: Array<{
  icon: typeof Square;
  label: string;
  tool: ShapeCreationTool;
}> = [
  { icon: Square, label: "矩形", tool: "rect" },
  { icon: Minus, label: "直线", tool: "line" },
  { icon: ArrowUpRight, label: "箭头", tool: "arrow" },
  { icon: Circle, label: "椭圆", tool: "ellipse" },
  { icon: Triangle, label: "多边形", tool: "polygon" },
  { icon: Star, label: "星形", tool: "star" },
];

function createElementId(tool: CreationTool | "image" | "chart" | "table") {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${tool}-${suffix}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read-failed"));
    reader.onload = () =>
      typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("read-failed"));
    reader.readAsDataURL(file);
  });
}

function decodeImage(src: string): Promise<{ height: number; width: number }> {
  return new Promise((resolve, reject) => {
    const image = new globalThis.Image();
    image.onerror = () => reject(new Error("decode-failed"));
    image.onload = () => resolve({ height: image.naturalHeight, width: image.naturalWidth });
    image.src = src;
  });
}

function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = globalThis.document.createElement("a");
  link.download = fileName;
  link.href = dataUrl;
  globalThis.document.body.appendChild(link);
  link.click();
  link.remove();
}

function useContainerSize(containerRef: React.RefObject<HTMLDivElement | null>): ContainerSize {
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  return size;
}

function clampZoom(zoom: number) {
  return Math.min(2, Math.max(0.25, zoom));
}

function getCenteredPosition(
  viewport: ContainerSize,
  document: CanvasDocument,
  zoom: number,
): CanvasPoint {
  const scaledHeight = document.height * zoom;
  return {
    x: (viewport.width - document.width * zoom) / 2,
    y: scaledHeight > viewport.height ? 48 : (viewport.height - scaledHeight) / 2,
  };
}

export const EditorWorkspace = memo(function EditorWorkspace({
  document,
  exportDocument = document,
  readOnly = false,
  hoveredId,
  selectedId,
  editingText,
  isSelectedLocked,
  manualZoom,
  fitMode,
  canUndo,
  canRedo,
  workspaceHandleRef,
  onSelect,
  onEditText,
  onCancelTextEdit,
  onCommitTextEdit,
  onElementChange,
  onElementPreview,
  onAddElement,
  onSetZoom,
  onSetFitMode,
  onUndo,
  onRedo,
  onOpenOverview,
  onExport,
}: EditorWorkspaceProps) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasStageRef = useRef<CanvasStageHandle>(null);
  const panSessionRef = useRef<PanSession | null>(null);
  const drawSessionRef = useRef<DrawSession | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<number | null>(null);
  const shapeMenuCloseTimerRef = useRef<number | null>(null);
  const viewportHoveredRef = useRef(false);
  const size = useContainerSize(workspaceRef);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [viewportPositions, setViewportPositions] = useState<Record<string, CanvasPoint>>({});
  const [readyEditingSessionId, setReadyEditingSessionId] = useState<number | null>(null);
  const [creationTool, setCreationTool] = useState<{
    documentId: string;
    tool: CreationTool;
  } | null>(null);
  const [draft, setDraft] = useState<{ documentId: string; element: CanvasLeafElement } | null>(
    null,
  );
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [lastShapeTool, setLastShapeTool] = useState<ShapeCreationTool>("rect");
  const [operationError, setOperationError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const availableWidth = Math.max(1, Math.min(MAX_CANVAS_PREVIEW_WIDTH, size.width - 112));
  const availableHeight = Math.max(1, size.height - 174);
  const widthFitZoom = availableWidth / document.width;
  const heightFitZoom = availableHeight / document.height;
  const isLongDocument = document.height / document.width > availableHeight / availableWidth;
  const fitZoom = clampZoom(isLongDocument ? widthFitZoom : Math.min(widthFitZoom, heightFitZoom));
  const zoom = fitMode && size.width > 0 ? fitZoom : manualZoom;
  const zoomPercent = Math.round(zoom * 100);
  const centeredPosition = getCenteredPosition(size, document, zoom);
  const centeredPositionX = centeredPosition.x;
  const centeredPositionY = centeredPosition.y;
  const viewportPosition = fitMode
    ? centeredPosition
    : (viewportPositions[document.id] ?? centeredPosition);
  const editingElement = editingText ? findElement(document.elements, editingText.elementId) : null;
  const visibleEditingElementId =
    editingText?.sessionId === readyEditingSessionId ? editingText.elementId : null;
  const activeTool = creationTool?.documentId === document.id ? creationTool.tool : null;
  const activeShapeTool = activeTool !== null && activeTool !== "text" ? activeTool : null;
  const selectedShape = SHAPE_TOOLS.find(({ tool }) => tool === lastShapeTool) ?? SHAPE_TOOLS[0];
  const SelectedShapeIcon = selectedShape.icon;
  const draftElement = draft?.documentId === document.id ? draft.element : null;
  const exportLabel = exportDocument.documentType === "pptx" ? "导出 PPT" : "导出图片";

  useEffect(
    () => () => {
      if (errorTimerRef.current !== null) window.clearTimeout(errorTimerRef.current);
      if (shapeMenuCloseTimerRef.current !== null) {
        window.clearTimeout(shapeMenuCloseTimerRef.current);
      }
    },
    [],
  );

  const cancelCreation = useCallback(() => {
    drawSessionRef.current = null;
    setDraft(null);
    setCreationTool(null);
    setShapeMenuOpen(false);
  }, []);

  function showOperationError(message: string) {
    setOperationError(message);
    if (errorTimerRef.current !== null) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => setOperationError(null), 3600);
  }

  function cancelShapeMenuClose() {
    if (shapeMenuCloseTimerRef.current === null) return;
    window.clearTimeout(shapeMenuCloseTimerRef.current);
    shapeMenuCloseTimerRef.current = null;
  }

  function openShapeMenu() {
    cancelShapeMenuClose();
    setShapeMenuOpen(true);
  }

  function scheduleShapeMenuClose() {
    cancelShapeMenuClose();
    shapeMenuCloseTimerRef.current = window.setTimeout(() => {
      setShapeMenuOpen(false);
      shapeMenuCloseTimerRef.current = null;
    }, 120);
  }

  const handleTextEditorReady = useCallback(
    (elementId: string) => {
      if (editingText?.elementId === elementId) {
        setReadyEditingSessionId(editingText.sessionId);
      }
    },
    [editingText],
  );
  const handleTextEditorCommit = useCallback(
    (elementId: string, markdown: string) => {
      if (!editingText) return;
      onCommitTextEdit(editingText.sessionId, elementId, markdown);
    },
    [editingText, onCommitTextEdit],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.code !== "Space" ||
        !viewportHoveredRef.current ||
        isInteractiveTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      setIsSpacePressed(true);
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") setIsSpacePressed(false);
    }

    function handleWindowBlur() {
      setIsSpacePressed(false);
      setIsPanning(false);
      panSessionRef.current = null;
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  const updateViewportPosition = useCallback(
    (position: CanvasPoint) => {
      setViewportPositions((positions) => ({ ...positions, [document.id]: position }));
    },
    [document.id],
  );

  useImperativeHandle(
    workspaceHandleRef,
    () => ({
      cancelCreation,
      revealElement(elementId: string) {
        if (size.width <= 0 || size.height <= 0) return;

        const bounds = findCanvasElementBounds(document.elements, elementId);
        if (!bounds) return;

        const nextPosition = getViewportPositionToReveal(bounds, size, viewportPosition, zoom);
        if (!nextPosition) return;

        updateViewportPosition(nextPosition);
        if (fitMode) onSetZoom(zoom);
      },
    }),
    [
      cancelCreation,
      document.elements,
      fitMode,
      onSetZoom,
      size,
      updateViewportPosition,
      viewportPosition,
      zoom,
    ],
  );

  function setZoomAroundPoint(nextZoom: number, point: CanvasPoint) {
    const clampedZoom = clampZoom(nextZoom);
    const worldPoint = {
      x: (point.x - viewportPosition.x) / zoom,
      y: (point.y - viewportPosition.y) / zoom,
    };

    updateViewportPosition({
      x: point.x - worldPoint.x * clampedZoom,
      y: point.y - worldPoint.y * clampedZoom,
    });
    onSetZoom(clampedZoom);
  }

  const panViewportBy = useCallback(
    (delta: CanvasPoint) => {
      setViewportPositions((positions) => {
        const fallbackPosition = { x: centeredPositionX, y: centeredPositionY };
        const currentPosition = fitMode
          ? fallbackPosition
          : (positions[document.id] ?? fallbackPosition);

        return {
          ...positions,
          [document.id]: {
            x: currentPosition.x + delta.x,
            y: currentPosition.y + delta.y,
          },
        };
      });
      if (fitMode) onSetZoom(zoom);
    },
    [centeredPositionX, centeredPositionY, document.id, fitMode, onSetZoom, zoom],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      panViewportBy({ x: -event.deltaX, y: -event.deltaY });
    }

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [panViewportBy]);

  function createPanSession(pointerId: number, point: CanvasPoint): PanSession {
    return {
      pointerId,
      startClientX: point.x,
      startClientY: point.y,
      startPosition: viewportPosition,
    };
  }

  function activatePanning(session: PanSession) {
    const viewport = viewportRef.current;
    if (!viewport || panSessionRef.current) return false;

    viewport.setPointerCapture(session.pointerId);
    panSessionRef.current = session;
    updateViewportPosition(session.startPosition);
    if (fitMode) onSetZoom(zoom);
    setIsPanning(true);
    return true;
  }

  function startPanning(pointerId: number, point: CanvasPoint) {
    activatePanning(createPanSession(pointerId, point));
  }

  function getWorldPoint(event: ReactPointerEvent<HTMLDivElement>): CanvasPoint {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left - viewportPosition.x) / zoom,
      y: (event.clientY - bounds.top - viewportPosition.y) / zoom,
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!readOnly && activeTool && event.button === 0 && !isSpacePressed) {
      const start = getWorldPoint(event);
      if (!isPointInsideDocument(start, document)) return;

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      drawSessionRef.current = {
        documentId: document.id,
        pointerId: event.pointerId,
        start,
        tool: activeTool,
      };
      const element = createElementFromDrag(
        activeTool,
        start,
        start,
        document,
        `${document.id}-draft`,
      );
      setDraft(
        element ? { documentId: document.id, element: { ...element, opacity: 0.58 } } : null,
      );
      return;
    }

    const shouldPan = event.button === 1 || (event.button === 0 && isSpacePressed);
    if (!shouldPan) return;

    event.preventDefault();
    event.stopPropagation();
    startPanning(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drawSession = drawSessionRef.current;
    if (drawSession?.pointerId === event.pointerId && drawSession.documentId === document.id) {
      event.preventDefault();
      event.stopPropagation();
      const element = createElementFromDrag(
        drawSession.tool,
        drawSession.start,
        getWorldPoint(event),
        document,
        `${document.id}-draft`,
      );
      setDraft(
        element ? { documentId: document.id, element: { ...element, opacity: 0.58 } } : null,
      );
      return;
    }

    const session = panSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    event.preventDefault();
    updateViewportPosition({
      x: session.startPosition.x + event.clientX - session.startClientX,
      y: session.startPosition.y + event.clientY - session.startClientY,
    });
  }

  function finishPanning(event: ReactPointerEvent<HTMLDivElement>) {
    if (panSessionRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    panSessionRef.current = null;
    setIsPanning(false);
  }

  function finishDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    const session = drawSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return false;

    event.preventDefault();
    event.stopPropagation();
    const element = createElementFromDrag(
      session.tool,
      session.start,
      getWorldPoint(event),
      document,
      createElementId(session.tool),
    );
    drawSessionRef.current = null;
    setDraft(null);
    setCreationTool(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (element) onAddElement(element, element.type === "text");
    return true;
  }

  function cancelDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    if (drawSessionRef.current?.pointerId !== event.pointerId) return;
    drawSessionRef.current = null;
    setDraft(null);
  }

  function toggleCreationTool(tool: CreationTool) {
    setDraft(null);
    drawSessionRef.current = null;
    setCreationTool((current) =>
      current?.documentId === document.id && current.tool === tool
        ? null
        : { documentId: document.id, tool },
    );
  }

  async function handleImageFile(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      showOperationError("仅支持 PNG、JPEG 或 WebP 图片");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showOperationError("图片不能超过 10MB");
      return;
    }

    try {
      const src = await readFileAsDataUrl(file);
      const imageSize = await decodeImage(src);
      const visibleArea = {
        bottom: (size.height - viewportPosition.y) / zoom,
        left: -viewportPosition.x / zoom,
        right: (size.width - viewportPosition.x) / zoom,
        top: -viewportPosition.y / zoom,
      };
      onAddElement(
        createImageElement(createElementId("image"), src, imageSize, document, visibleArea),
      );
      setOperationError(null);
    } catch {
      showOperationError("图片读取失败，请重试");
    }
  }

  function getVisibleDocumentArea() {
    return {
      bottom: (size.height - viewportPosition.y) / zoom,
      left: -viewportPosition.x / zoom,
      right: (size.width - viewportPosition.x) / zoom,
      top: -viewportPosition.y / zoom,
    };
  }

  function insertChartElement() {
    cancelCreation();
    onAddElement(createChartElement(createElementId("chart"), document, getVisibleDocumentArea()));
  }

  function insertTableElement() {
    cancelCreation();
    onAddElement(createTableElement(createElementId("table"), document, getVisibleDocumentArea()));
  }

  async function handleExport() {
    if (exporting) return;

    setExporting(true);
    try {
      if (onExport) {
        await onExport(exportDocument);
      } else if (exportDocument.documentType === "pptx") {
        const { exportCanvasDocumentToPptx } = await import("@/editor/pptx-export");
        await exportCanvasDocumentToPptx(exportDocument);
      } else {
        const dataUrl = canvasStageRef.current?.exportImage({ pixelRatio: 2 });
        if (!dataUrl) throw new Error("image-export-failed");
        downloadDataUrl(dataUrl, getExportFileName(document));
      }
      setOperationError(null);
    } catch {
      showOperationError(
        exportDocument.documentType === "pptx" ? "PPT 导出失败，请重试" : "图片导出失败，请重试",
      );
    } finally {
      setExporting(false);
    }
  }

  const viewportCenter = { x: size.width / 2, y: size.height / 2 };

  return (
    <main
      className="relative h-full min-h-0 min-w-0 overflow-hidden bg-[color-mix(in_oklch,var(--background)_94%,var(--muted))]"
      ref={workspaceRef}
    >
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[5] flex h-12 items-center justify-between border-b border-[color-mix(in_oklch,var(--border)_65%,transparent)] bg-[color-mix(in_oklch,var(--background)_86%,transparent)] px-2.5 backdrop-blur-[10px]">
        <div
          aria-label="当前页面信息"
          className="flex min-w-0 max-w-[min(420px,calc(100%-20px))] items-center gap-[7px] px-2"
          role="group"
        >
          <span className="overflow-hidden text-xs text-ellipsis whitespace-nowrap">
            {document.name}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {document.width} × {document.height}
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1">
          {exportDocument.documentType === "pptx" && onOpenOverview ? (
            <Button
              aria-label="幻灯片总览"
              className="h-7 gap-1.5 rounded-sm px-2 text-xs text-muted-foreground hover:text-foreground"
              size="sm"
              type="button"
              variant="ghost"
              onClick={onOpenOverview}
            >
              <LayoutGrid aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
              <span>总览</span>
            </Button>
          ) : null}
          <Button
            aria-label={exportLabel}
            className="h-7 gap-1.5 rounded-sm px-2 text-xs"
            disabled={exporting}
            size="sm"
            type="button"
            onClick={() => void handleExport()}
          >
            {exporting ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" strokeWidth={1.75} />
            ) : (
              <Download aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
            )}
            <span>{exporting ? "导出中" : exportLabel}</span>
          </Button>
          <DocumentJsonPreviewDialog document={exportDocument} />
        </div>
      </header>

      <div
        className="absolute inset-0 cursor-default touch-none overflow-hidden select-none data-[creation-active=true]:cursor-crosshair data-[pan-ready=true]:cursor-grab data-[panning=true]:cursor-grabbing [&_canvas]:block"
        data-creation-active={Boolean(activeTool)}
        data-pan-ready={isSpacePressed}
        data-panning={isPanning}
        ref={viewportRef}
        onLostPointerCapture={(event) => {
          cancelDrawing(event);
          finishPanning(event);
        }}
        onPointerCancelCapture={(event) => {
          cancelDrawing(event);
          finishPanning(event);
        }}
        onPointerEnter={() => {
          viewportHoveredRef.current = true;
        }}
        onPointerLeave={() => {
          viewportHoveredRef.current = false;
        }}
        onPointerDownCapture={handlePointerDown}
        onPointerMoveCapture={handlePointerMove}
        onPointerUpCapture={(event) => {
          if (!finishDrawing(event)) finishPanning(event);
        }}
      >
        <CanvasStage
          document={document}
          draftElement={draftElement}
          editingElementId={visibleEditingElementId}
          hoveredId={hoveredId}
          isCreating={Boolean(activeTool)}
          isSelectedLocked={isSelectedLocked}
          selectedId={selectedId}
          stageHandleRef={canvasStageRef}
          viewportHeight={Math.max(1, size.height)}
          viewportPosition={viewportPosition}
          viewportWidth={Math.max(1, size.width)}
          zoom={zoom}
          onEditText={onEditText}
          onElementChange={onElementChange}
          onElementPreview={onElementPreview}
          onSelect={onSelect}
        />

        {editingText && editingElement?.type === "text" ? (
          <Suspense fallback={null}>
            <RichTextEditorOverlay
              key={editingText.sessionId}
              element={editingElement}
              initialText={editingText.initialText}
              viewportPosition={viewportPosition}
              zoom={zoom}
              onCancel={onCancelTextEdit}
              onCommit={handleTextEditorCommit}
              onReady={handleTextEditorReady}
            />
          </Suspense>
        ) : null}
      </div>

      <input
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        aria-hidden="true"
        className="sr-only"
        ref={imageInputRef}
        tabIndex={-1}
        type="file"
        onChange={(event) => {
          void handleImageFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />

      {operationError ? (
        <div
          className="absolute bottom-[62px] left-1/2 z-[9] -translate-x-1/2 rounded-sm border border-destructive/25 bg-popover px-3 py-2 text-xs text-destructive shadow-md"
          role="alert"
        >
          {operationError}
        </div>
      ) : null}

      <div
        aria-label="画布操作"
        className="absolute bottom-4 left-1/2 z-[8] flex h-[38px] max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-[3px] rounded-sm border border-[color-mix(in_oklch,var(--border)_82%,transparent)] bg-popover p-1 shadow-[0_8px_24px_color-mix(in_oklch,var(--foreground)_5%,transparent)]"
        role="toolbar"
      >
        <EditorIconButton disabled={!canUndo} label="撤销" onPress={onUndo}>
          <Undo2 aria-hidden="true" strokeWidth={1.75} />
        </EditorIconButton>

        <EditorIconButton disabled={!canRedo} label="重做" onPress={onRedo}>
          <Redo2 aria-hidden="true" strokeWidth={1.75} />
        </EditorIconButton>

        {readOnly ? null : (
          <>
            <Separator className="mx-0.5 h-5 w-px" orientation="vertical" />

            <Popover open={shapeMenuOpen} onOpenChange={setShapeMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  aria-label="图形"
                  aria-pressed={activeShapeTool !== null}
                  className={cn(
                    "gap-0.5 px-1.5",
                    activeShapeTool !== null && "bg-accent text-primary",
                  )}
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => toggleCreationTool(lastShapeTool)}
                  onMouseEnter={openShapeMenu}
                  onMouseLeave={scheduleShapeMenuClose}
                >
                  <SelectedShapeIcon aria-hidden="true" className="size-4" strokeWidth={1.75} />
                  <ChevronDown
                    aria-hidden="true"
                    className="size-3 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="center"
                className="w-[152px] gap-0 rounded-md p-1 shadow-[0_12px_32px_color-mix(in_oklch,var(--foreground)_10%,transparent)]"
                side="top"
                sideOffset={8}
                onCloseAutoFocus={(event) => event.preventDefault()}
                onMouseEnter={cancelShapeMenuClose}
                onMouseLeave={scheduleShapeMenuClose}
                onOpenAutoFocus={(event) => event.preventDefault()}
              >
                {SHAPE_TOOLS.map(({ icon: Icon, label, tool }) => {
                  const selected = activeTool === tool;
                  return (
                    <button
                      aria-pressed={selected}
                      className={cn(
                        "relative flex h-7 w-full items-center gap-1.5 rounded-sm px-1.5 pr-7 text-left text-xs transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none",
                        selected && "bg-accent/70 text-foreground",
                      )}
                      key={tool}
                      type="button"
                      onClick={() => {
                        setLastShapeTool(tool);
                        toggleCreationTool(tool);
                        setShapeMenuOpen(false);
                      }}
                    >
                      <Icon
                        aria-hidden="true"
                        className={cn(
                          "size-3.5 shrink-0 text-muted-foreground",
                          selected && "text-primary",
                        )}
                        strokeWidth={1.75}
                      />
                      <span className="truncate">{label}</span>
                      {selected ? (
                        <Check
                          aria-hidden="true"
                          className="absolute right-1.5 size-3 text-primary"
                          strokeWidth={2}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>

            <EditorIconButton
              label="文本"
              pressed={activeTool === "text"}
              onPress={() => toggleCreationTool("text")}
            >
              <Type aria-hidden="true" strokeWidth={1.75} />
            </EditorIconButton>

            <EditorIconButton label="上传图片" onPress={() => imageInputRef.current?.click()}>
              <ImagePlus aria-hidden="true" strokeWidth={1.75} />
            </EditorIconButton>

            <EditorIconButton label="图表" onPress={insertChartElement}>
              <BarChart3 aria-hidden="true" strokeWidth={1.75} />
            </EditorIconButton>

            <EditorIconButton label="表格" onPress={insertTableElement}>
              <Table aria-hidden="true" strokeWidth={1.75} />
            </EditorIconButton>

            <Separator className="mx-0.5 h-5 w-px" orientation="vertical" />
          </>
        )}

        <EditorIconButton
          label="缩小"
          onPress={() => setZoomAroundPoint(zoom - 0.05, viewportCenter)}
        >
          <Minus aria-hidden="true" strokeWidth={1.75} />
        </EditorIconButton>

        <Slider
          aria-label="画布缩放"
          className="mx-1 w-[72px]"
          max={200}
          min={25}
          step={5}
          value={[zoomPercent]}
          onValueChange={([value]) => setZoomAroundPoint(value / 100, viewportCenter)}
        />

        <EditorIconButton
          label="放大"
          onPress={() => setZoomAroundPoint(zoom + 0.05, viewportCenter)}
        >
          <Plus aria-hidden="true" strokeWidth={1.75} />
        </EditorIconButton>

        <span className="flex h-7 min-w-[34px] items-center justify-center font-mono text-xs leading-none text-muted-foreground">
          {zoomPercent}%
        </span>

        <EditorIconButton label="适应画布" onPress={() => onSetFitMode(true)}>
          <Scan aria-hidden="true" strokeWidth={1.75} />
        </EditorIconButton>
      </div>
    </main>
  );
});
