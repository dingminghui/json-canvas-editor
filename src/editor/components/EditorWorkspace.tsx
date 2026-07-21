import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { CanvasStage } from "@/editor/components/CanvasStage";
import { EditorIconButton } from "@/editor/components/EditorIconButton";
import { TemplateSwitcher } from "@/editor/components/TemplateSwitcher";
import { findElement } from "@/editor/editor-state";
import { isInteractiveTarget } from "@/editor/interaction";
import type {
  CanvasDocument,
  CanvasElementPatch,
  CanvasPoint,
  CanvasTransformPatch,
  TextEditingSession,
} from "@/editor/types";
import { Minus, Plus, Redo2, Scan, Undo2 } from "lucide-react";
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

const RichTextEditorOverlay = lazy(() => import("@/editor/components/RichTextEditorOverlay"));

interface EditorWorkspaceProps {
  document: CanvasDocument;
  documents: CanvasDocument[];
  hoveredId: string | null;
  selectedId: string | null;
  editingText: TextEditingSession | null;
  isSelectedLocked: boolean;
  manualZoom: number;
  fitMode: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onSelect: (elementId: string | null) => void;
  onEditText: (elementId: string) => void;
  onCancelTextEdit: () => void;
  onCommitTextEdit: (sessionId: number, elementId: string, markdown: string) => void;
  onElementChange: (elementId: string, patch: CanvasElementPatch) => void;
  onElementPreview: (elementId: string, patch: Partial<CanvasTransformPatch> | null) => void;
  onSetZoom: (zoom: number) => void;
  onSetFitMode: (enabled: boolean) => void;
  onSelectTemplate: (templateId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
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
  return {
    x: (viewport.width - document.width * zoom) / 2,
    y: (viewport.height - document.height * zoom) / 2,
  };
}

export const EditorWorkspace = memo(function EditorWorkspace({
  document,
  documents,
  hoveredId,
  selectedId,
  editingText,
  isSelectedLocked,
  manualZoom,
  fitMode,
  canUndo,
  canRedo,
  onSelect,
  onEditText,
  onCancelTextEdit,
  onCommitTextEdit,
  onElementChange,
  onElementPreview,
  onSetZoom,
  onSetFitMode,
  onSelectTemplate,
  onUndo,
  onRedo,
}: EditorWorkspaceProps) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const panSessionRef = useRef<PanSession | null>(null);
  const viewportHoveredRef = useRef(false);
  const size = useContainerSize(workspaceRef);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [viewportPositions, setViewportPositions] = useState<Record<string, CanvasPoint>>({});
  const [readyEditingSessionId, setReadyEditingSessionId] = useState<number | null>(null);
  const fitZoom = clampZoom(
    Math.min((size.width - 112) / document.width, (size.height - 174) / document.height),
  );
  const zoom = fitMode && size.width > 0 ? fitZoom : manualZoom;
  const zoomPercent = Math.round(zoom * 100);
  const centeredPosition = getCenteredPosition(size, document, zoom);
  const viewportPosition = fitMode
    ? centeredPosition
    : (viewportPositions[document.id] ?? centeredPosition);
  const editingElement = editingText ? findElement(document.elements, editingText.elementId) : null;
  const visibleEditingElementId =
    editingText?.sessionId === readyEditingSessionId ? editingText.elementId : null;

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

  function updateViewportPosition(position: CanvasPoint) {
    setViewportPositions((positions) => ({ ...positions, [document.id]: position }));
  }

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

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const shouldPan = event.button === 1 || (event.button === 0 && isSpacePressed);
    if (!shouldPan) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    panSessionRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: viewportPosition,
    };
    updateViewportPosition(viewportPosition);
    if (fitMode) onSetZoom(zoom);
    setIsPanning(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
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

  const viewportCenter = { x: size.width / 2, y: size.height / 2 };

  return (
    <main
      className="relative h-full min-h-0 min-w-0 overflow-hidden bg-[color-mix(in_oklch,var(--background)_94%,var(--muted))]"
      ref={workspaceRef}
    >
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[5] flex h-12 items-center justify-start border-b border-[color-mix(in_oklch,var(--border)_65%,transparent)] bg-[color-mix(in_oklch,var(--background)_86%,transparent)] px-2.5 backdrop-blur-[10px]">
        <TemplateSwitcher
          activeDocument={document}
          documents={documents}
          onSelectTemplate={onSelectTemplate}
        />
      </header>

      <div
        className="absolute inset-0 cursor-default touch-none overflow-hidden select-none data-[pan-ready=true]:cursor-grab data-[panning=true]:cursor-grabbing [&_canvas]:block"
        data-pan-ready={isSpacePressed}
        data-panning={isPanning}
        onLostPointerCapture={finishPanning}
        onPointerEnter={() => {
          viewportHoveredRef.current = true;
        }}
        onPointerLeave={() => {
          viewportHoveredRef.current = false;
        }}
        onPointerDownCapture={handlePointerDown}
        onPointerMoveCapture={handlePointerMove}
        onPointerUpCapture={finishPanning}
      >
        <CanvasStage
          document={document}
          editingElementId={visibleEditingElementId}
          hoveredId={hoveredId}
          isSelectedLocked={isSelectedLocked}
          selectedId={selectedId}
          viewportHeight={Math.max(1, size.height)}
          viewportPosition={viewportPosition}
          viewportWidth={Math.max(1, size.width)}
          zoom={zoom}
          onEditText={onEditText}
          onElementChange={onElementChange}
          onElementPreview={onElementPreview}
          onSelect={onSelect}
          onZoomAtPoint={setZoomAroundPoint}
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

      <div className="absolute bottom-4 left-4 z-[8] flex h-[38px] items-center gap-[3px] rounded-sm border border-[color-mix(in_oklch,var(--border)_82%,transparent)] bg-popover p-1 shadow-[0_8px_24px_color-mix(in_oklch,var(--foreground)_5%,transparent)]">
        <EditorIconButton disabled={!canUndo} label="撤销" onPress={onUndo}>
          <Undo2 aria-hidden="true" strokeWidth={1.75} />
        </EditorIconButton>

        <EditorIconButton disabled={!canRedo} label="重做" onPress={onRedo}>
          <Redo2 aria-hidden="true" strokeWidth={1.75} />
        </EditorIconButton>

        <Separator className="mx-0.5 h-5 w-px" orientation="vertical" />

        <EditorIconButton
          label="缩小"
          onPress={() => setZoomAroundPoint(zoom - 0.05, viewportCenter)}
        >
          <Minus aria-hidden="true" strokeWidth={1.75} />
        </EditorIconButton>

        <Slider
          aria-label="画布缩放"
          className="mx-1 w-[94px]"
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
