import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LayerTree } from "@/editor/components/LayerTree";
import { getDocumentPages, type CanvasPage } from "@/editor/document-pages";
import type { CanvasDocument, RectElement } from "@/editor/types";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, LayoutGrid } from "lucide-react";
import { memo, useState } from "react";

interface LayerSidebarProps {
  document: CanvasDocument;
  pageDocument: CanvasDocument;
  documents: CanvasDocument[];
  activePageId: string;
  readOnly?: boolean;
  selectedId: string | null;
  onHover: (elementId: string | null) => void;
  onSelect: (elementId: string) => void;
  onSelectDocument: (documentId: string) => void;
  onSelectPage: (documentId: string, pageId: string) => void;
  onOpenOverview: () => void;
  onToggleVisible: (elementId: string) => void;
  onToggleLocked: (elementId: string) => void;
  onReorder: (elements: CanvasDocument["elements"]) => void;
}

interface PagePreviewSize {
  height: number;
  width: number;
}

const PAGE_PREVIEW_MAX_SIZE = 32;

function getPagePreviewSize(page: Pick<CanvasPage, "height" | "width">): PagePreviewSize {
  const scale = Math.min(PAGE_PREVIEW_MAX_SIZE / page.width, PAGE_PREVIEW_MAX_SIZE / page.height);
  return {
    height: Math.round(page.height * scale),
    width: Math.round(page.width * scale),
  };
}

function getPageBackground(elements: CanvasDocument["elements"]): string {
  const background = elements.find(
    (element): element is RectElement =>
      element.type === "rect" && element.x === 0 && element.y === 0,
  );
  return background?.fill ?? "var(--muted)";
}

interface PageListProps {
  activeDocument: CanvasDocument;
  activePageId: string;
  documents: CanvasDocument[];
  onSelectDocument: (documentId: string) => void;
  onSelectPage: (documentId: string, pageId: string) => void;
  onOpenOverview: () => void;
}

function PageThumbnail({
  elements,
  height,
  width,
}: Pick<CanvasPage, "elements" | "height" | "width">) {
  const previewSize = getPagePreviewSize({ height, width });

  return (
    <span
      aria-hidden="true"
      className="grid size-9 place-items-center rounded-[3px] bg-[color-mix(in_oklch,var(--muted)_76%,var(--card))] shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--border)_78%,transparent)]"
    >
      <span
        className="relative block overflow-hidden rounded-[1px] shadow-[0_1px_3px_color-mix(in_oklch,var(--foreground)_16%,transparent)]"
        style={{
          backgroundColor: getPageBackground(elements),
          height: previewSize.height,
          width: previewSize.width,
        }}
      >
        <span className="absolute inset-x-[18%] top-[18%] h-px bg-white/55" />
        <span className="absolute inset-x-[18%] bottom-[18%] h-[2px] bg-white/70" />
      </span>
    </span>
  );
}

function PageList({
  activeDocument,
  activePageId,
  documents,
  onSelectDocument,
  onSelectPage,
  onOpenOverview,
}: PageListProps) {
  const [expandedDocumentIds, setExpandedDocumentIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const doc of documents) {
      if (doc.documentType === "pptx") initial.add(doc.id);
    }
    return initial;
  });

  function selectDocument(document: CanvasDocument) {
    onSelectDocument(document.id);
    if (document.documentType === "pptx") {
      setExpandedDocumentIds((current) => {
        if (current.has(document.id)) return current;
        const next = new Set(current);
        next.add(document.id);
        return next;
      });
    }
  }

  function toggleDocument(documentId: string) {
    setExpandedDocumentIds((current) => {
      const next = new Set(current);
      if (next.has(documentId)) next.delete(documentId);
      else next.add(documentId);
      return next;
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-12 items-center px-3.5">
        <h2 className="m-0 text-xs">页面</h2>
      </header>
      <ScrollArea className="min-h-0 flex-1 px-2 pb-2">
        <div className="flex flex-col gap-px">
          {documents.map((document) => {
            const active = document.id === activeDocument.id;
            const pages = getDocumentPages(document);
            const isPresentation = document.documentType === "pptx";
            const expanded = active && expandedDocumentIds.has(document.id);
            return (
              <div className="flex flex-col gap-px" key={document.id}>
                <div className="relative">
                  <button
                    aria-current={active && !isPresentation ? "page" : undefined}
                    aria-expanded={isPresentation ? expanded : undefined}
                    aria-label={`打开页面 ${document.name}`}
                    className={cn(
                      "group/page grid min-h-12 w-full cursor-pointer grid-cols-[42px_minmax(0,1fr)] items-center gap-2 rounded-[calc(var(--radius-sm)-2px)] border-0 bg-transparent px-1.5 py-1 text-left text-foreground transition-[background-color,box-shadow] duration-100 hover:bg-[color-mix(in_oklch,var(--muted)_82%,var(--card))]",
                      active &&
                        "bg-[var(--selection-background)] shadow-[inset_2px_0_0_var(--primary)]",
                    )}
                    data-active={active}
                    type="button"
                    onClick={() => selectDocument(document)}
                  >
                    <PageThumbnail
                      elements={pages[0]?.elements ?? []}
                      height={document.height}
                      width={document.width}
                    />
                    <span className="flex min-w-0 flex-col gap-0.5 pr-5">
                      <span
                        className={cn(
                          "overflow-hidden text-xs text-ellipsis whitespace-nowrap",
                          active && "text-primary",
                        )}
                      >
                        {document.name}
                      </span>
                      <span className="overflow-hidden text-[10px] leading-none text-ellipsis whitespace-nowrap text-muted-foreground">
                        {isPresentation ? `${pages.length} 页 · ` : ""}
                        {document.width} × {document.height}
                      </span>
                    </span>
                  </button>
                  {isPresentation ? (
                    <button
                      aria-label={expanded ? `折叠 ${document.name}` : `展开 ${document.name}`}
                      className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      type="button"
                      onClick={() => {
                        if (!active) selectDocument(document);
                        else toggleDocument(document.id);
                      }}
                    >
                      {expanded ? (
                        <ChevronDown aria-hidden="true" size={14} strokeWidth={1.75} />
                      ) : (
                        <ChevronRight aria-hidden="true" size={14} strokeWidth={1.75} />
                      )}
                    </button>
                  ) : null}
                </div>

                {expanded ? (
                  <div
                    aria-label={`${document.name} 幻灯片`}
                    className="ml-4 flex flex-col gap-px border-l border-border/70 pl-1.5"
                  >
                    {pages.map((page, pageIndex) => {
                      const pageActive = page.id === activePageId;
                      return (
                        <button
                          aria-current={pageActive ? "page" : undefined}
                          aria-label={`打开幻灯片 ${page.name}`}
                          className={cn(
                            "grid min-h-10 w-full grid-cols-[36px_minmax(0,1fr)] items-center gap-1.5 rounded-sm px-1.5 py-1 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            pageActive && "bg-accent text-primary",
                          )}
                          key={page.id}
                          type="button"
                          onClick={() => onSelectPage(document.id, page.id)}
                        >
                          <PageThumbnail {...page} />
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="w-4 flex-none font-mono text-[10px] text-muted-foreground">
                              {String(pageIndex + 1).padStart(2, "0")}
                            </span>
                            <span className="overflow-hidden text-xs text-ellipsis whitespace-nowrap">
                              {page.name.replace(/^\d+\s*/, "")}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                    <button
                      className="mt-0.5 flex h-8 items-center gap-1.5 rounded-sm px-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      type="button"
                      onClick={onOpenOverview}
                    >
                      <LayoutGrid aria-hidden="true" size={14} strokeWidth={1.75} />
                      幻灯片总览
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export const LayerSidebar = memo(function LayerSidebar({
  document,
  pageDocument,
  documents,
  activePageId,
  readOnly = false,
  selectedId,
  onHover,
  onSelect,
  onSelectDocument,
  onSelectPage,
  onOpenOverview,
  onToggleVisible,
  onToggleLocked,
  onReorder,
}: LayerSidebarProps) {
  return (
    <ResizablePanelGroup className="h-full min-h-0" orientation="vertical">
      <ResizablePanel
        className="min-h-0"
        defaultSize={348}
        groupResizeBehavior="preserve-pixel-size"
        id="pages-panel"
        minSize={152}
      >
        <PageList
          activeDocument={document}
          activePageId={activePageId}
          documents={documents}
          onOpenOverview={onOpenOverview}
          onSelectDocument={onSelectDocument}
          onSelectPage={onSelectPage}
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
            elements={pageDocument.elements}
            key={pageDocument.id}
            readOnly={readOnly}
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
