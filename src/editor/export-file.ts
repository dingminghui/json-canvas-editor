import type { CanvasDocument } from "@/editor/types";

function getFileStem(document: CanvasDocument): string {
  return document.name
    .trim()
    .replace(/[\\/:*?"<>|：“”]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/g, "");
}

export function getExportFileName(document: CanvasDocument): string {
  const extension = document.documentType === "pptx" ? "pptx" : "png";
  return `${getFileStem(document) || document.id}.${extension}`;
}
