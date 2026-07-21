import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CanvasDocument } from "@/editor/types";
import { Braces, CircleHelp } from "lucide-react";
import type { ReactNode } from "react";

interface DocumentJsonPreviewDialogProps {
  document: CanvasDocument;
}

const JSON_TOKEN_PATTERN =
  /("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;

function highlightJsonLine(line: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of line.matchAll(JSON_TOKEN_PATTERN)) {
    const index = match.index ?? cursor;
    if (index > cursor) nodes.push(line.slice(cursor, index));

    const [token, key, value, number] = match;
    const className = key
      ? "text-[#5f55a5]"
      : value
        ? "text-[#28745a]"
        : number
          ? "text-[#a35f22]"
          : "text-[#b0446a]";

    nodes.push(
      <span className={className} key={`${index}-${token}`}>
        {token}
      </span>,
    );
    cursor = index + token.length;
  }

  if (cursor < line.length) nodes.push(line.slice(cursor));
  return nodes;
}

export function DocumentJsonPreviewDialog({ document }: DocumentJsonPreviewDialogProps) {
  const json = JSON.stringify(document, null, 2);
  const lines = json.split("\n");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          aria-label="查看页面结构 JSON"
          className="pointer-events-auto text-muted-foreground hover:text-foreground"
          size="icon-sm"
          title="查看页面结构 JSON"
          variant="ghost"
        >
          <CircleHelp aria-hidden="true" className="size-[16px]" strokeWidth={1.75} />
        </Button>
      </DialogTrigger>

      <DialogContent className="h-[min(680px,calc(100vh-48px))] w-[720px] max-w-[calc(100vw-48px)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl p-0 shadow-[0_24px_70px_-28px_color-mix(in_oklch,var(--foreground)_42%,transparent)]">
        <DialogHeader className="border-b bg-card px-5 py-4 pr-12">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md border bg-muted/60 text-muted-foreground">
              <Braces aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
            </span>
            <DialogTitle>页面结构</DialogTitle>
            <span className="rounded-full border bg-muted/45 px-2 py-0.5 text-[10px] font-medium leading-none tracking-wide text-muted-foreground">
              只读预览
            </span>
          </div>
          <DialogDescription>
            {document.name} · {document.width} × {document.height}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 grid-rows-[36px_minmax(0,1fr)] bg-[#f8f8f6]">
          <div className="flex items-center border-b border-border/70 bg-[#f4f4f1] px-4">
            <span className="flex h-full items-center gap-1.5 border-b-2 border-primary px-1 font-mono text-[11px] font-medium text-foreground/80">
              <Braces aria-hidden="true" className="size-3 text-primary" strokeWidth={1.75} />
              page.json
            </span>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {lines.length} lines
            </span>
          </div>

          <ScrollArea className="min-h-0" scrollbars="both">
            <pre
              aria-label="当前页面 JSON"
              className="min-w-max py-3 pr-6 font-mono text-[12px] leading-[1.7] text-[#4d5260] selection:bg-primary/15"
            >
              <code>
                {lines.map((line, index) => (
                  <span
                    className="before:sticky before:left-0 before:inline-block before:w-11 before:bg-[#f8f8f6] before:pr-3 before:text-right before:text-[10px] before:text-[#b0b3ba] before:content-[attr(data-line)]"
                    data-line={index + 1}
                    key={`${index}:${line}`}
                  >
                    {highlightJsonLine(line)}
                    {index < lines.length - 1 ? "\n" : null}
                  </span>
                ))}
              </code>
            </pre>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
