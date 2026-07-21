import { marked } from "marked";
import { render } from "render-tag";

import { getCanvasFont } from "@/editor/fonts";
import type { TextElement } from "@/editor/types";

const MAX_CANVAS_CACHE_PIXELS = 16 * 1024 * 1024;
const canvasCache = new Map<string, HTMLCanvasElement>();
let canvasCachePixels = 0;
const PLATE_COLOR_SPAN_RE =
  /^<span style="color: #[\da-f]{6};(?: text-decoration: line-through;)?">$|^<\/span>$/i;

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const inlineRenderer = new marked.Renderer();
inlineRenderer.html = ({ text }) => {
  if (!PLATE_COLOR_SPAN_RE.test(text)) return escapeHtml(text);
  if (text.startsWith("</")) return text;

  return text.replace("<span ", '<span class="canvas-text-color" ');
};
inlineRenderer.link = function ({ tokens }) {
  return this.parser.parseInline(tokens);
};
inlineRenderer.image = ({ text }) => escapeHtml(text);
inlineRenderer.codespan = ({ text }) => escapeHtml(text);

function collectTextNodes(node: Node, textNodes: Text[]) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) {
      if (child.textContent) textNodes.push(child as Text);
      continue;
    }

    collectTextNodes(child, textNodes);
  }
}

function moveColoredStrikethroughsToTextLeaves(html: string): string {
  if (typeof DOMParser === "undefined") return html;

  const parsedDocument = new DOMParser().parseFromString(html, "text/html");

  for (const coloredText of Array.from(
    parsedDocument.body.querySelectorAll<HTMLElement>(".canvas-text-color"),
  )) {
    if (!coloredText.style.textDecoration.includes("line-through")) continue;

    coloredText.style.removeProperty("text-decoration");
    const textNodes: Text[] = [];
    collectTextNodes(coloredText, textNodes);

    for (const textNode of textNodes) {
      const leafStrike = parsedDocument.createElement("del");
      textNode.parentNode?.insertBefore(leafStrike, textNode);
      leafStrike.append(textNode);
    }
  }

  const coloredStrikethroughs = Array.from(parsedDocument.body.querySelectorAll("del"))
    .filter((strike) => strike.querySelector(".canvas-text-color"))
    .reverse();

  for (const strike of coloredStrikethroughs) {
    const textNodes: Text[] = [];
    collectTextNodes(strike, textNodes);

    for (const textNode of textNodes) {
      const leafStrike = parsedDocument.createElement("del");
      textNode.parentNode?.insertBefore(leafStrike, textNode);
      leafStrike.append(textNode);
    }

    const parent = strike.parentNode;
    if (!parent) continue;
    while (strike.firstChild) parent.insertBefore(strike.firstChild, strike);
    strike.remove();
  }

  return parsedDocument.body.innerHTML;
}

export function markdownToPlainText(markdown: string): string {
  return markdownToDisplayText(markdown).replace(/\s+/g, " ").trim();
}

export function markdownToDisplayText(markdown: string): string {
  if (typeof DOMParser === "undefined") return markdown;

  const parsedDocument = new DOMParser().parseFromString(
    markdownToInlineHtml(markdown).replaceAll("<br>", "\n"),
    "text/html",
  );
  return parsedDocument.body.textContent ?? "";
}

export function markdownToInlineHtml(markdown: string): string {
  return moveColoredStrikethroughsToTextLeaves(
    marked.parseInline(markdown, {
      async: false,
      breaks: true,
      gfm: true,
      renderer: inlineRenderer,
    }),
  );
}

function getCanvasCacheKey(
  element: TextElement,
  pixelRatio: number,
  renderRevision: number,
): string {
  return JSON.stringify([
    element.text,
    element.width,
    element.height,
    element.fill,
    element.fontFamily,
    element.fontSize,
    element.fontWeight,
    element.align,
    pixelRatio,
    renderRevision,
  ]);
}

function cacheCanvas(key: string, canvas: HTMLCanvasElement) {
  const canvasPixels = canvas.width * canvas.height;
  if (canvasPixels > MAX_CANVAS_CACHE_PIXELS) return;

  canvasCache.set(key, canvas);
  canvasCachePixels += canvasPixels;

  while (canvasCachePixels > MAX_CANVAS_CACHE_PIXELS && canvasCache.size > 1) {
    const oldestKey = canvasCache.keys().next().value;
    if (!oldestKey) break;

    const oldestCanvas = canvasCache.get(oldestKey);
    if (oldestCanvas) canvasCachePixels -= oldestCanvas.width * oldestCanvas.height;
    canvasCache.delete(oldestKey);
  }
}

export function invalidateMarkdownCanvasCache() {
  canvasCache.clear();
  canvasCachePixels = 0;
}

export function renderMarkdownToCanvas(
  element: TextElement,
  renderRevision = 0,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;

  const pixelRatio = Math.max(1, globalThis.devicePixelRatio ?? 1);
  const cacheKey = getCanvasCacheKey(element, pixelRatio, renderRevision);
  const cachedCanvas = canvasCache.get(cacheKey);
  if (cachedCanvas) {
    canvasCache.delete(cacheKey);
    canvasCache.set(cacheKey, cachedCanvas);
    return cachedCanvas;
  }

  const boldWeight = Math.max(700, Number(element.fontWeight));
  const fontFamily = getCanvasFont(element.fontFamily).cssFamily;
  const html = `
    <style>
      .canvas-text {
        width: ${element.width}px;
        margin: 0;
        color: ${element.fill};
        font-family: ${fontFamily};
        font-size: ${element.fontSize}px;
        font-weight: ${element.fontWeight};
        font-synthesis: weight style;
        line-height: 1.04;
        overflow-wrap: break-word;
        text-align: ${element.align};
        white-space: pre-wrap;
      }
      .canvas-text strong { font-weight: ${boldWeight}; }
      .canvas-text em { font-style: italic; }
      .canvas-text del {
        text-decoration: line-through;
      }
    </style>
    <div class="canvas-text">${markdownToInlineHtml(element.text)}</div>
  `;

  try {
    const source = render({ html, width: element.width, pixelRatio });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(element.width * pixelRatio));
    canvas.height = Math.max(1, Math.ceil(element.height * pixelRatio));
    const context = canvas.getContext("2d");
    if (!context) return null;

    const offsetY = Math.max(0, (element.height - source.height) / 2) * pixelRatio;
    context.drawImage(source.canvas, 0, offsetY);
    cacheCanvas(cacheKey, canvas);
    return canvas;
  } catch {
    return null;
  }
}
