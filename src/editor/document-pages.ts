import {
  isGroupElement,
  type CanvasDocument,
  type CanvasElement,
  type GroupElement,
} from "@/editor/types";

export interface CanvasPage {
  id: string;
  name: string;
  width: number;
  height: number;
  elements: CanvasElement[];
}

export function getDocumentPages(document: CanvasDocument): CanvasPage[] {
  if (document.documentType === "longform") {
    return [
      {
        elements: document.elements,
        height: document.height,
        id: document.id,
        name: document.name,
        width: document.width,
      },
    ];
  }

  return document.elements
    .filter((element): element is GroupElement => isGroupElement(element))
    .map((page) => ({
      elements: page.children,
      height: document.height,
      id: page.id,
      name: page.name,
      width: document.width,
    }));
}

export function getFirstPageId(document: CanvasDocument): string {
  return getDocumentPages(document)[0]?.id ?? document.id;
}

export function getDocumentPage(document: CanvasDocument, pageId: string): CanvasPage {
  const pages = getDocumentPages(document);
  return pages.find((page) => page.id === pageId) ?? pages[0];
}

export function createPageDocument(document: CanvasDocument, pageId: string): CanvasDocument {
  if (document.documentType === "longform") return document;

  const page = getDocumentPage(document, pageId);
  return {
    ...document,
    description: `${document.description} 当前编辑页面：${page.name}。`,
    elements: page.elements,
    height: page.height,
    id: `${document.id}::${page.id}`,
    name: `${document.name} / ${page.name}`,
    width: page.width,
  };
}
