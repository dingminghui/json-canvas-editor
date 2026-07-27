import { getCanvasElementBounds, type CanvasBounds } from "@/editor/canvas-viewport";
import {
  getNativeChartSeries,
  isChartDataValid,
  renderChartToDataUrl,
} from "@/editor/chart-renderer";
import { getExportFileName } from "@/editor/export-file";
import { markdownToDisplayText } from "@/editor/markdown";
import { isTableDataValid } from "@/editor/table-layout";
import { renderTableToDataUrl } from "@/editor/table-renderer";
import {
  isGroupElement,
  type ArrowElement,
  type CanvasDocument,
  type CanvasElement,
  type CanvasLeafElement,
  type ChartElement,
  type GroupElement,
  type ImageElement,
  type LineElement,
  type RectElement,
  type TableCellStyle,
  type TableElement,
} from "@/editor/types";
import pptxgen from "pptxgenjs";

const WIDE_LAYOUT = {
  height: 7.5,
  name: "CANVAS_WIDE",
  width: 13.333333,
} as const;

interface SlideCoordinateSystem {
  offsetX: number;
  offsetY: number;
  scale: number;
  source: CanvasBounds;
}

type PptxImageSource = { data: string } | { path: string };
type PptxImageSourceCache = Map<string, Promise<PptxImageSource>>;

const PPTX_FONT_FACES = {
  inter: "Arial",
  "jetbrains-mono": "Consolas",
  "noto-sans-sc": "Microsoft YaHei",
  "noto-serif-sc": "SimSun",
} as const;

function normalizeHexColor(color: string): string | null {
  if (color.toLowerCase() === "transparent") return null;

  const value = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.slice(1).toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return value
      .slice(1)
      .split("")
      .map((part) => part + part)
      .join("")
      .toUpperCase();
  }

  return null;
}

function getTransparency(opacity: number): number {
  return Math.min(100, Math.max(0, Math.round((1 - opacity) * 100)));
}

function getFill(color: string, opacity: number) {
  const hex = normalizeHexColor(color);
  return {
    color: hex ?? "FFFFFF",
    transparency: hex ? getTransparency(opacity) : 100,
  };
}

function getLine(color: string, width: number, opacity: number, scale: number) {
  const hex = normalizeHexColor(color);
  return {
    color: hex ?? "FFFFFF",
    transparency: hex && width > 0 ? getTransparency(opacity) : 100,
    width: Math.max(0, width * scale * 72),
  };
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function getSlideCoordinateSystem(bounds: CanvasBounds): SlideCoordinateSystem {
  const sourceWidth = Math.max(1, bounds.right - bounds.left);
  const sourceHeight = Math.max(1, bounds.bottom - bounds.top);
  const scale = Math.min(WIDE_LAYOUT.width / sourceWidth, WIDE_LAYOUT.height / sourceHeight);

  return {
    offsetX: (WIDE_LAYOUT.width - sourceWidth * scale) / 2,
    offsetY: (WIDE_LAYOUT.height - sourceHeight * scale) / 2,
    scale,
    source: bounds,
  };
}

function toSlideX(value: number, coordinates: SlideCoordinateSystem): number {
  return round(coordinates.offsetX + (value - coordinates.source.left) * coordinates.scale);
}

function toSlideY(value: number, coordinates: SlideCoordinateSystem): number {
  return round(coordinates.offsetY + (value - coordinates.source.top) * coordinates.scale);
}

function toSlideRect(
  element: Pick<CanvasLeafElement, "height" | "rotation" | "width" | "x" | "y">,
  coordinates: SlideCoordinateSystem,
) {
  return {
    h: round(element.height * coordinates.scale),
    rotate: round(element.rotation),
    w: round(element.width * coordinates.scale),
    x: toSlideX(element.x, coordinates),
    y: toSlideY(element.y, coordinates),
  };
}

function collectLeaves(elements: CanvasElement[], inheritedVisible = true): CanvasLeafElement[] {
  const leaves: CanvasLeafElement[] = [];

  for (const element of elements) {
    const visible = inheritedVisible && element.visible;
    if (!visible) continue;

    if (isGroupElement(element)) {
      leaves.push(...collectLeaves(element.children, visible));
    } else {
      leaves.push(element);
    }
  }

  return leaves;
}

function getSlideGroups(document: CanvasDocument): GroupElement[] {
  return document.elements.filter(
    (element): element is GroupElement => element.type === "group" && element.visible,
  );
}

function mergeBounds(bounds: CanvasBounds[]): CanvasBounds | null {
  if (bounds.length === 0) return null;

  return {
    bottom: Math.max(...bounds.map((entry) => entry.bottom)),
    left: Math.min(...bounds.map((entry) => entry.left)),
    right: Math.max(...bounds.map((entry) => entry.right)),
    top: Math.min(...bounds.map((entry) => entry.top)),
  };
}

function getVisibleLeavesBounds(leaves: CanvasLeafElement[]): CanvasBounds | null {
  return mergeBounds(
    leaves
      .map((element) => getCanvasElementBounds(element))
      .filter((bounds): bounds is CanvasBounds => bounds !== null),
  );
}

function getShapeName(element: RectElement | CanvasLeafElement, pptx: pptxgen) {
  switch (element.type) {
    case "rect":
      return element.cornerRadius > 0 ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;
    case "circle":
    case "ellipse":
      return pptx.ShapeType.ellipse;
    case "polygon":
      if (element.sides === 3) return pptx.ShapeType.triangle;
      if (element.sides === 5) return pptx.ShapeType.pentagon;
      if (element.sides === 6) return pptx.ShapeType.hexagon;
      return pptx.ShapeType.rect;
    case "star":
      if (element.numPoints === 4) return pptx.ShapeType.star4;
      if (element.numPoints === 6) return pptx.ShapeType.star6;
      if (element.numPoints === 8) return pptx.ShapeType.star8;
      return pptx.ShapeType.star5;
    default:
      return pptx.ShapeType.rect;
  }
}

function addTextElement(
  slide: pptxgen.Slide,
  element: Extract<CanvasLeafElement, { type: "text" }>,
  coordinates: SlideCoordinateSystem,
) {
  const rect = toSlideRect(element, coordinates);
  const fontSize = Math.max(1, round(element.fontSize * coordinates.scale * 72));

  slide.addText(markdownToDisplayText(element.text), {
    ...rect,
    align: element.align,
    bold: Number(element.fontWeight) >= 600,
    color: normalizeHexColor(element.fill) ?? "000000",
    fit: "shrink",
    fontFace: PPTX_FONT_FACES[element.fontFamily],
    fontSize,
    isTextBox: true,
    lang: "zh-CN",
    lineSpacingMultiple: element.lineHeight,
    margin: 0,
    objectName: element.name,
    transparency: getTransparency(element.opacity),
    valign: "middle",
  });
}

function getLineEndpoints(element: LineElement | ArrowElement) {
  const points =
    element.points.length >= 4 ? element.points : [0, 0, element.width, element.height];
  return {
    end: {
      x: element.x + points[points.length - 2],
      y: element.y + points[points.length - 1],
    },
    start: {
      x: element.x + points[0],
      y: element.y + points[1],
    },
  };
}

function addLineElement(
  pptx: pptxgen,
  slide: pptxgen.Slide,
  element: LineElement | ArrowElement,
  coordinates: SlideCoordinateSystem,
) {
  const { end, start } = getLineEndpoints(element);
  const reverseX = end.x < start.x;
  const reverseY = end.y < start.y;

  slide.addShape(pptx.ShapeType.line, {
    flipH: reverseX,
    flipV: reverseY,
    h: round(Math.abs(end.y - start.y) * coordinates.scale),
    line: {
      ...getLine(element.stroke, element.strokeWidth, element.opacity, coordinates.scale),
      endArrowType: element.type === "arrow" ? "triangle" : "none",
    },
    objectName: element.name,
    rotate: round(element.rotation),
    w: round(Math.abs(end.x - start.x) * coordinates.scale),
    x: toSlideX(Math.min(start.x, end.x), coordinates),
    y: toSlideY(Math.min(start.y, end.y), coordinates),
  });
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new globalThis.Image();
    if (!src.startsWith("data:")) image.crossOrigin = "anonymous";
    image.onerror = () => reject(new Error("image-load-failed"));
    image.onload = () => resolve(image);
    image.src = src;
  });
}

async function createPngImageSource(src: string): Promise<PptxImageSource> {
  try {
    const image = await loadImageElement(src);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, image.naturalWidth || image.width);
    canvas.height = Math.max(1, image.naturalHeight || image.height);
    const context = canvas.getContext("2d");
    if (!context) return { path: src };

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL("image/png") };
  } catch {
    return { path: src };
  }
}

function getImageSource(src: string, cache: PptxImageSourceCache): Promise<PptxImageSource> {
  const cached = cache.get(src);
  if (cached) return cached;

  const source = createPngImageSource(src);
  cache.set(src, source);
  return source;
}

async function addImageElement(
  slide: pptxgen.Slide,
  element: ImageElement,
  coordinates: SlideCoordinateSystem,
  imageSourceCache: PptxImageSourceCache,
) {
  const rect = toSlideRect(element, coordinates);
  const source = await getImageSource(element.src, imageSourceCache);

  slide.addImage({
    ...source,
    ...rect,
    altText: element.name,
    objectName: element.name,
    sizing: {
      h: rect.h,
      type: element.fit,
      w: rect.w,
    },
    transparency: getTransparency(element.opacity),
  });
}

function addFallbackImage(
  slide: pptxgen.Slide,
  data: string | null,
  element: CanvasLeafElement,
  coordinates: SlideCoordinateSystem,
) {
  if (!data) return;
  slide.addImage({
    data,
    ...toSlideRect(element, coordinates),
    altText: element.name,
    objectName: element.name,
    transparency: getTransparency(element.opacity),
  });
}

function getChartType(pptx: pptxgen, element: ChartElement) {
  switch (element.chartType) {
    case "bar":
      return pptx.ChartType.bar;
    case "line":
      return pptx.ChartType.line;
    case "pie":
      return pptx.ChartType.pie;
    default: {
      const exhaustiveType: never = element.chartType;
      return exhaustiveType;
    }
  }
}

async function addChartElement(
  pptx: pptxgen,
  slide: pptxgen.Slide,
  element: ChartElement,
  coordinates: SlideCoordinateSystem,
) {
  if (!isChartDataValid(element) || element.rotation !== 0) {
    addFallbackImage(slide, renderChartToDataUrl(element), element, coordinates);
    return;
  }

  const rect = toSlideRect(element, coordinates);
  const data = getNativeChartSeries(element).map((series) => ({
    labels: series.labels,
    name: series.name,
    values: series.values,
  }));

  try {
    slide.addChart(getChartType(pptx, element), data, {
      ...rect,
      altText: element.name,
      barDir: element.chartType === "bar" ? "col" : undefined,
      chartColors: element.colors.map((color) => normalizeHexColor(color) ?? "4F46E5"),
      showLegend: element.showLegend,
      showTitle: element.title.trim() !== "",
      showValue: element.showValue,
      title: element.title,
    });
  } catch {
    addFallbackImage(slide, renderChartToDataUrl(element), element, coordinates);
  }
}

function getTableCellOptions(style: TableCellStyle, opacity: number, scale: number) {
  return {
    align: style.align,
    bold: Number(style.fontWeight) >= 600,
    border: {
      color: normalizeHexColor(style.borderColor) ?? "CBD5E1",
      pt: Math.max(0, style.borderWidth * scale * 72),
      type: style.borderWidth > 0 ? ("solid" as const) : ("none" as const),
    },
    color: normalizeHexColor(style.color) ?? "000000",
    fill: { color: normalizeHexColor(style.fill) ?? "FFFFFF" },
    fontFace: PPTX_FONT_FACES[style.fontFamily],
    fontSize: Math.max(1, round(style.fontSize * scale * 72)),
    margin: 0.06,
    transparency: getTransparency(opacity),
    valign: style.valign,
  };
}

async function addTableElement(
  slide: pptxgen.Slide,
  element: TableElement,
  coordinates: SlideCoordinateSystem,
) {
  if (element.rotation !== 0 || !isTableDataValid(element)) {
    addFallbackImage(slide, renderTableToDataUrl(element), element, coordinates);
    return;
  }

  const rect = toSlideRect(element, coordinates);
  const headerOptions = getTableCellOptions(
    element.headerStyle,
    element.opacity,
    coordinates.scale,
  );
  const cellOptions = getTableCellOptions(element.cellStyle, element.opacity, coordinates.scale);
  const headerRow = element.columns.map((column) => ({
    options: headerOptions,
    text: column.name,
  }));
  const rows = element.rows.map((row) =>
    element.columns.map((column) => ({
      options: cellOptions,
      text: row.cells[column.id] ?? "",
    })),
  );

  try {
    slide.addTable([headerRow, ...rows], {
      ...rect,
      colW: element.columns.map((column) => round(column.width * coordinates.scale)),
      rowH: [
        round(
          (element.rows[0]?.height ?? element.height / (element.rows.length + 1)) *
            coordinates.scale,
        ),
        ...element.rows.map((row) => round(row.height * coordinates.scale)),
      ],
    });
  } catch {
    addFallbackImage(slide, renderTableToDataUrl(element), element, coordinates);
  }
}

async function addShapeElement(
  pptx: pptxgen,
  slide: pptxgen.Slide,
  element: Exclude<
    CanvasLeafElement,
    ImageElement | LineElement | ArrowElement | ChartElement | TableElement
  >,
  coordinates: SlideCoordinateSystem,
) {
  switch (element.type) {
    case "text":
      addTextElement(slide, element, coordinates);
      return;
    case "rect":
    case "circle":
    case "ellipse":
    case "polygon":
    case "star":
      slide.addShape(getShapeName(element, pptx), {
        ...toSlideRect(element, coordinates),
        fill: "fill" in element ? getFill(element.fill, element.opacity) : undefined,
        line:
          "stroke" in element
            ? getLine(element.stroke, element.strokeWidth, element.opacity, coordinates.scale)
            : undefined,
        objectName: element.name,
        rectRadius:
          element.type === "rect" && element.cornerRadius > 0
            ? Math.min(
                1,
                element.cornerRadius / Math.max(1, Math.min(element.width, element.height)),
              )
            : undefined,
      });
      return;
    default: {
      const exhaustiveElement: never = element;
      return exhaustiveElement;
    }
  }
}

async function addCanvasElementToSlide(
  pptx: pptxgen,
  slide: pptxgen.Slide,
  element: CanvasLeafElement,
  coordinates: SlideCoordinateSystem,
  imageSourceCache: PptxImageSourceCache,
) {
  switch (element.type) {
    case "line":
    case "arrow":
      addLineElement(pptx, slide, element, coordinates);
      return;
    case "image":
      await addImageElement(slide, element, coordinates, imageSourceCache);
      return;
    case "chart":
      await addChartElement(pptx, slide, element, coordinates);
      return;
    case "table":
      await addTableElement(slide, element, coordinates);
      return;
    default:
      await addShapeElement(pptx, slide, element, coordinates);
  }
}

export async function createCanvasDocumentPresentation(document: CanvasDocument): Promise<pptxgen> {
  const pptx = new pptxgen();
  pptx.author = "json-canvas-editor";
  pptx.company = "json-canvas-editor";
  pptx.subject = document.description;
  pptx.title = document.name;
  pptx.defineLayout(WIDE_LAYOUT);
  pptx.layout = WIDE_LAYOUT.name;
  pptx.theme = {
    headFontFace: PPTX_FONT_FACES["noto-sans-sc"],
    bodyFontFace: PPTX_FONT_FACES["noto-sans-sc"],
  };

  const imageSourceCache: PptxImageSourceCache = new Map();
  let slideCount = 0;

  for (const group of getSlideGroups(document)) {
    const leaves = collectLeaves(group.children);
    const bounds = getVisibleLeavesBounds(leaves);
    if (!bounds || leaves.length === 0) continue;

    const slide = pptx.addSlide();
    slideCount += 1;
    const coordinates = getSlideCoordinateSystem(bounds);

    for (const element of leaves) {
      await addCanvasElementToSlide(pptx, slide, element, coordinates, imageSourceCache);
    }
  }

  if (slideCount === 0) {
    throw new Error("The PPT document does not contain any visible slide groups.");
  }

  return pptx;
}

export async function exportCanvasDocumentToPptx(document: CanvasDocument): Promise<void> {
  const pptx = await createCanvasDocumentPresentation(document);
  await pptx.writeFile({ fileName: getExportFileName(document) });
}
