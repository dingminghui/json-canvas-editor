import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { CanvasDocument } from "@/editor/types";
import { Check, ChevronDown } from "lucide-react";
import { memo, useState } from "react";

interface TemplateSwitcherProps {
  activeDocument: CanvasDocument;
  documents: CanvasDocument[];
  onSelectTemplate: (templateId: string) => void;
}

export const TemplateSwitcher = memo(function TemplateSwitcher({
  activeDocument,
  documents,
  onSelectTemplate,
}: TemplateSwitcherProps) {
  const [open, setOpen] = useState(false);

  return (
    <HoverCard closeDelay={180} open={open} openDelay={120} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>
        <Button
          aria-label="切换模板"
          className="pointer-events-auto max-w-[min(420px,calc(100%-20px))] gap-[7px] px-2"
          variant="ghost"
        >
          <strong className="overflow-hidden text-xs font-[650] text-ellipsis whitespace-nowrap">
            {activeDocument.name}
          </strong>
          <span className="font-mono text-xs text-muted-foreground">
            {activeDocument.width} × {activeDocument.height}
          </span>
          <ChevronDown aria-hidden="true" data-icon="inline-end" strokeWidth={1.75} />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        className="w-[286px] rounded-sm p-[5px]"
        side="bottom"
        sideOffset={8}
      >
        <div className="flex flex-col gap-px">
          {documents.map((document) => {
            const isActive = document.id === activeDocument.id;
            return (
              <Button
                aria-label={`切换到模板 ${document.name}`}
                className="grid h-auto min-h-12 w-full grid-cols-[minmax(0,1fr)_16px] rounded-[calc(var(--radius-sm)-2px)] px-[7px] py-1.5 text-left data-[active=true]:bg-[var(--selection-background)] data-[active=true]:shadow-[0_3px_10px_color-mix(in_oklch,var(--foreground)_4%,transparent)]"
                data-active={isActive}
                key={document.id}
                variant="ghost"
                onClick={() => {
                  onSelectTemplate(document.id);
                  setOpen(false);
                }}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <strong className="overflow-hidden text-xs font-[650] text-ellipsis whitespace-nowrap">
                    {document.name}
                  </strong>
                  <small className="overflow-hidden text-xs font-[450] text-ellipsis whitespace-nowrap text-muted-foreground">
                    {document.description} · {document.width} × {document.height}
                  </small>
                </span>
                {isActive ? (
                  <Check aria-hidden="true" className="text-primary" strokeWidth={1.75} />
                ) : null}
              </Button>
            );
          })}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
});
