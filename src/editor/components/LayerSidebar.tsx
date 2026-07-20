import { LayerTree } from "@/editor/components/LayerTree";
import type { CanvasDocument } from "@/editor/types";
import { memo } from "react";

interface LayerSidebarProps {
  document: CanvasDocument;
  selectedId: string | null;
  onHover: (elementId: string | null) => void;
  onSelect: (elementId: string) => void;
  onToggleVisible: (elementId: string) => void;
  onToggleLocked: (elementId: string) => void;
  onReorder: (elements: CanvasDocument["elements"]) => void;
}

export const LayerSidebar = memo(function LayerSidebar({
  document,
  selectedId,
  onHover,
  onSelect,
  onToggleVisible,
  onToggleLocked,
  onReorder,
}: LayerSidebarProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-12 items-center justify-between border-b border-border py-0 pr-3 pl-3.5">
        <h2 className="m-0 text-xs font-[650]">图层</h2>
        <span className="text-xs text-muted-foreground">{document.elements.length} 个根图层</span>
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
  );
});
