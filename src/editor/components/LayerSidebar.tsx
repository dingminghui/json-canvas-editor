import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LayerTree } from "@/editor/components/LayerTree";
import type { CanvasDocument, RectElement } from "@/editor/types";
import { cn } from "@/lib/utils";
import { memo } from "react";

interface LayerSidebarProps {
  document: CanvasDocument;
  documents: CanvasDocument[];
  selectedId: string | null;
  onHover: (elementId: string | null) => void;
  onSelect: (elementId: string) => void;
  onSelectDocument: (documentId: string) => void;
  onToggleVisible: (elementId: string) => void;
  onToggleLocked: (elementId: string) => void;
  onReorder: (elements: CanvasDocument["elements"]) => void;
}

interface PagePreviewSize {
  height: number;
  width: number;
}

const PAGE_PREVIEW_MAX_SIZE = 32;

function getPagePreviewSize(document: CanvasDocument): PagePreviewSize {
  const scale = Math.min(
    PAGE_PREVIEW_MAX_SIZE / document.width,
    PAGE_PREVIEW_MAX_SIZE / document.height,
  );
  return {
    height: Math.round(document.height * scale),
    width: Math.round(document.width * scale),
  };
}

function getPageBackground(document: CanvasDocument): string {
  const background = document.elements.find(
    (element): element is RectElement =>
      element.type === "rect" && element.x === 0 && element.y === 0,
  );
  return background?.fill ?? "var(--muted)";
}

interface PageListProps {
  activeDocument: CanvasDocument;
  documents: CanvasDocument[];
  onSelectDocument: (documentId: string) => void;
}

function PageList({ activeDocument, documents, onSelectDocument }: PageListProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-12 items-center px-3.5">
        <h2 className="m-0 text-xs">页面</h2>
      </header>
      <ScrollArea className="min-h-0 flex-1 px-2 pb-2">
        <div className="flex flex-col gap-px">
          {documents.map((page) => {
            const active = page.id === activeDocument.id;
            const previewSize = getPagePreviewSize(page);
            return (
              <button
                aria-current={active ? "page" : undefined}
                aria-label={`打开页面 ${page.name}`}
                className={cn(
                  "group/page grid min-h-12 w-full cursor-pointer grid-cols-[42px_minmax(0,1fr)] items-center gap-2 rounded-[calc(var(--radius-sm)-2px)] border-0 bg-transparent px-1.5 py-1 text-left text-foreground transition-[background-color,box-shadow] duration-100 hover:bg-[color-mix(in_oklch,var(--muted)_82%,var(--card))]",
                  active &&
                    "bg-[var(--selection-background)] shadow-[inset_2px_0_0_var(--primary)]",
                )}
                data-active={active}
                key={page.id}
                type="button"
                onClick={() => onSelectDocument(page.id)}
              >
                <span
                  aria-hidden="true"
                  className="grid size-9 place-items-center rounded-[3px] bg-[color-mix(in_oklch,var(--muted)_76%,var(--card))] shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--border)_78%,transparent)]"
                >
                  <span
                    className="relative block overflow-hidden rounded-[1px] shadow-[0_1px_3px_color-mix(in_oklch,var(--foreground)_16%,transparent)]"
                    style={{
                      backgroundColor: getPageBackground(page),
                      height: previewSize.height,
                      width: previewSize.width,
                    }}
                  >
                    <span className="absolute inset-x-[18%] top-[18%] h-px bg-white/55" />
                    <span className="absolute inset-x-[18%] bottom-[18%] h-[2px] bg-white/70" />
                  </span>
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={cn(
                      "overflow-hidden text-xs text-ellipsis whitespace-nowrap",
                      active && "text-primary",
                    )}
                  >
                    {page.name}
                  </span>
                  <span className="overflow-hidden text-[10px] leading-none text-ellipsis whitespace-nowrap text-muted-foreground">
                    {page.width} × {page.height}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export const LayerSidebar = memo(function LayerSidebar({
  document,
  documents,
  selectedId,
  onHover,
  onSelect,
  onSelectDocument,
  onToggleVisible,
  onToggleLocked,
  onReorder,
}: LayerSidebarProps) {
  return (
    <ResizablePanelGroup className="h-full min-h-0" orientation="vertical">
      <ResizablePanel
        className="min-h-0"
        defaultSize={248}
        groupResizeBehavior="preserve-pixel-size"
        id="pages-panel"
        minSize={152}
      >
        <PageList
          activeDocument={document}
          documents={documents}
          onSelectDocument={onSelectDocument}
        />
      </ResizablePanel>

      <ResizableHandle
        aria-label="调整页面与图层区域高度"
        className="transition-colors duration-150 hover:bg-primary/25 focus-visible:bg-primary/25 data-[resize-handle-active]:bg-primary/25"
      />

      <ResizablePanel className="min-h-0" id="layer-list-panel" minSize={176}>
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex min-h-12 items-center px-3.5">
            <h2 className="m-0 text-xs">图层</h2>
          </header>
          <LayerTree
            elements={document.elements}
            key={document.id}
            selectedId={selectedId}
            onHover={onHover}
            onReorder={onReorder}
            onSelect={onSelect}
            onToggleLocked={onToggleLocked}
            onToggleVisible={onToggleVisible}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
});
