import type {
  ArrowElement,
  CanvasElement,
  ChartElement,
  GroupElement,
  RectElement,
  TableCellStyle,
  TableElement,
  TextElement,
} from "@/editor/types";

type Frame = { x: number; y: number; width: number; height: number };

type RectOptions = Partial<
  Pick<RectElement, "cornerRadius" | "locked" | "opacity" | "stroke" | "strokeWidth">
>;

type TextOptions = Partial<
  Pick<
    TextElement,
    | "align"
    | "fill"
    | "fontFamily"
    | "fontSize"
    | "fontWeight"
    | "lineHeight"
    | "locked"
    | "opacity"
  >
>;

export function createCanvasRect(
  id: string,
  name: string,
  frame: Frame,
  fill: string,
  options: RectOptions = {},
): RectElement {
  return {
    cornerRadius: options.cornerRadius ?? 0,
    fill,
    ...frame,
    id,
    locked: options.locked ?? false,
    name,
    opacity: options.opacity ?? 1,
    rotation: 0,
    stroke: options.stroke ?? "transparent",
    strokeWidth: options.strokeWidth ?? 0,
    type: "rect",
    visible: true,
  };
}

export function createCanvasText(
  id: string,
  name: string,
  value: string,
  frame: Frame,
  options: TextOptions = {},
): TextElement {
  return {
    align: options.align ?? "left",
    fill: options.fill ?? "#111827",
    fontFamily: options.fontFamily ?? "noto-sans-sc",
    fontSize: options.fontSize ?? 28,
    fontWeight: options.fontWeight ?? "400",
    ...frame,
    id,
    lineHeight: options.lineHeight ?? 1.35,
    locked: options.locked ?? false,
    name,
    opacity: options.opacity ?? 1,
    rotation: 0,
    text: value,
    type: "text",
    visible: true,
  };
}

export function createCanvasArrow(
  id: string,
  name: string,
  frame: Frame,
  stroke: string,
): ArrowElement {
  return {
    ...frame,
    id,
    lineCap: "round",
    locked: false,
    name,
    opacity: 1,
    pointerLength: 16,
    pointerWidth: 14,
    points: [0, 0, frame.width, frame.height],
    rotation: 0,
    stroke,
    strokeWidth: 4,
    type: "arrow",
    visible: true,
  };
}

export function createCanvasTable(
  id: string,
  name: string,
  frame: Frame,
  columns: TableElement["columns"],
  rows: TableElement["rows"],
  headerStyle: TableCellStyle,
  cellStyle: TableCellStyle,
): TableElement {
  return {
    cellStyle,
    columns,
    headerStyle,
    ...frame,
    id,
    locked: false,
    name,
    opacity: 1,
    rotation: 0,
    rows,
    type: "table",
    visible: true,
  };
}

export function createCanvasChart(
  id: string,
  name: string,
  frame: Frame,
  chartType: ChartElement["chartType"],
  series: ChartElement["series"],
  colors: string[],
  options: Partial<Pick<ChartElement, "showLegend" | "showValue" | "title">> = {},
): ChartElement {
  return {
    chartType,
    colors,
    ...frame,
    id,
    locked: false,
    name,
    opacity: 1,
    rotation: 0,
    series,
    showLegend: options.showLegend ?? series.length > 1,
    showValue: options.showValue ?? true,
    title: options.title ?? "",
    type: "chart",
    visible: true,
  };
}

export function createCanvasGroup(
  id: string,
  name: string,
  children: CanvasElement[],
): GroupElement {
  return {
    children,
    id,
    locked: false,
    name,
    type: "group",
    visible: true,
  };
}
