import { Button } from "@/components/ui/button";
import { CanvasStage } from "@/editor/components/CanvasStage";
import { createPageDocument, getDocumentPages, type CanvasPage } from "@/editor/document-pages";
import type { CanvasDocument } from "@/editor/types";
import { cn } from "@/lib/utils";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Download, GripVertical, Loader2, X } from "lucide-react";
import { useState } from "react";

const THUMBNAIL_WIDTH = 288;
const THUMBNAIL_HEIGHT = 162;

interface SlideOverviewProps {
  document: CanvasDocument;
  activePageId: string;
  onClose: () => void;
  onReorderPages: (pageIds: string[]) => void;
  onSelectPage: (pageId: string) => void;
}

function SortableSlideCard({
  active,
  document,
  index,
  page,
  onSelect,
}: {
  active: boolean;
  document: CanvasDocument;
  index: number;
  page: CanvasPage;
  onSelect: () => void;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: page.id });
  const pageDocument = createPageDocument(document, page.id);
  const thumbnailZoom = Math.min(THUMBNAIL_WIDTH / page.width, THUMBNAIL_HEIGHT / page.height);
  const thumbnailPosition = {
    x: (THUMBNAIL_WIDTH - page.width * thumbnailZoom) / 2,
    y: (THUMBNAIL_HEIGHT - page.height * thumbnailZoom) / 2,
  };

  return (
    <article
      className={cn(
        "overflow-hidden rounded-md border bg-card shadow-sm transition-[border-color,box-shadow,opacity]",
        active && "border-primary shadow-[0_0_0_1px_var(--primary)]",
        isDragging && "z-10 opacity-70 shadow-xl",
      )}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <button
        aria-label={`编辑幻灯片 ${page.name}`}
        className="block bg-[color-mix(in_oklch,var(--muted)_62%,var(--background))] p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        type="button"
        onClick={onSelect}
      >
        <span
          aria-hidden="true"
          className="block overflow-hidden bg-white shadow-[0_3px_12px_rgba(24,35,40,0.12)] [&_canvas]:pointer-events-none"
        >
          <CanvasStage
            readOnly
            document={pageDocument}
            editingElementId={null}
            hoveredId={null}
            isSelectedLocked
            selectedId={null}
            viewportHeight={THUMBNAIL_HEIGHT}
            viewportPosition={thumbnailPosition}
            viewportWidth={THUMBNAIL_WIDTH}
            zoom={thumbnailZoom}
            onEditText={() => undefined}
            onElementChange={() => undefined}
            onElementPreview={() => undefined}
            onSelect={() => undefined}
          />
        </span>
      </button>

      <footer className="flex h-12 items-center gap-2 border-t px-2.5">
        <span className="w-6 flex-none font-mono text-[11px] text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {page.name.replace(/^\d+\s*/, "")}
        </span>
        <button
          aria-label={`移动幻灯片 ${page.name}`}
          className="grid size-7 flex-none cursor-grab touch-none place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" size={15} strokeWidth={1.75} />
        </button>
      </footer>
    </article>
  );
}

export function SlideOverview({
  activePageId,
  document,
  onClose,
  onReorderPages,
  onSelectPage,
}: SlideOverviewProps) {
  const pages = getDocumentPages(document);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;

    const pageIds = pages.map((page) => page.id);
    const oldIndex = pageIds.indexOf(String(event.active.id));
    const newIndex = pageIds.indexOf(String(event.over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderPages(arrayMove(pageIds, oldIndex, newIndex));
  }

  async function exportPresentation() {
    if (exporting) return;

    setExporting(true);
    setExportError(null);
    try {
      const { exportCanvasDocumentToPptx } = await import("@/editor/pptx-export");
      await exportCanvasDocumentToPptx(document);
    } catch {
      setExportError("PPT 导出失败，请重试");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="relative flex h-full min-h-0 flex-col bg-[color-mix(in_oklch,var(--background)_94%,var(--muted))]">
      <header className="flex h-12 flex-none items-center justify-between border-b bg-background/90 px-3 backdrop-blur">
        <div className="min-w-0">
          <span className="block truncate text-xs">{document.name}</span>
          <span className="block text-[10px] text-muted-foreground">
            幻灯片总览 · {pages.length} 页
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            className="h-7 gap-1.5 px-2 text-xs"
            disabled={exporting}
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => void exportPresentation()}
          >
            {exporting ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <Download aria-hidden="true" className="size-3.5" />
            )}
            {exporting ? "导出中" : "导出 PPT"}
          </Button>
          <Button
            aria-label="返回当前幻灯片"
            className="size-7"
            size="icon"
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            <X aria-hidden="true" size={15} strokeWidth={1.75} />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {exportError ? (
          <div
            className="mx-auto mb-4 max-w-5xl rounded-sm border border-destructive/25 bg-popover px-3 py-2 text-xs text-destructive"
            role="alert"
          >
            {exportError}
          </div>
        ) : null}
        <DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={pages.map((page) => page.id)} strategy={rectSortingStrategy}>
            <div className="mx-auto grid max-w-5xl grid-cols-[repeat(auto-fill,304px)] justify-center gap-5">
              {pages.map((page, index) => (
                <SortableSlideCard
                  active={page.id === activePageId}
                  document={document}
                  index={index}
                  key={page.id}
                  page={page}
                  onSelect={() => onSelectPage(page.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </main>
  );
}
