import type {
  ArrowElement,
  CanvasDocument,
  CanvasLeafElement,
  CanvasPoint,
  ChartElement,
  EllipseElement,
  ImageElement,
  LineElement,
  PolygonElement,
  RectElement,
  StarElement,
  TableCellStyle,
  TableElement,
  TextElement,
} from "@/editor/types";

export const MIN_DRAW_DISTANCE = 8;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type ShapeCreationTool = "rect" | "line" | "arrow" | "ellipse" | "polygon" | "star";
export type CreationTool = ShapeCreationTool | "text";
export type InsertableElementTool = "chart" | "table";

const FILLED_SHAPE_STYLE = {
  fill: "#E5E7EB",
  stroke: "#6B7280",
  strokeWidth: 2,
} as const;

const LINE_STYLE = {
  lineCap: "round",
  stroke: "#4B5563",
  strokeWidth: 3,
} as const;

function baseElement(
  id: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  return {
    height,
    id,
    locked: false,
    name,
    opacity: 1,
    rotation: 0,
    visible: true,
    width,
    x,
    y,
  } as const;
}

export function clampPointToDocument(point: CanvasPoint, document: CanvasDocument): CanvasPoint {
  return {
    x: Math.min(document.width, Math.max(0, point.x)),
    y: Math.min(document.height, Math.max(0, point.y)),
  };
}

export function isPointInsideDocument(point: CanvasPoint, document: CanvasDocument): boolean {
  return point.x >= 0 && point.y >= 0 && point.x <= document.width && point.y <= document.height;
}

function getCornerBounds(start: CanvasPoint, end: CanvasPoint) {
  return {
    height: Math.abs(end.y - start.y),
    width: Math.abs(end.x - start.x),
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
  };
}

function getLineGeometry(start: CanvasPoint, end: CanvasPoint) {
  const bounds = getCornerBounds(start, end);
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  const startX = bounds.width === 0 ? width / 2 : start.x - bounds.x;
  const endX = bounds.width === 0 ? width / 2 : end.x - bounds.x;
  const startY = bounds.height === 0 ? height / 2 : start.y - bounds.y;
  const endY = bounds.height === 0 ? height / 2 : end.y - bounds.y;

  return { ...bounds, height, points: [startX, startY, endX, endY], width };
}

function getRadialBounds(start: CanvasPoint, end: CanvasPoint, document: CanvasDocument) {
  const requestedRadius = Math.hypot(end.x - start.x, end.y - start.y);
  const radius = Math.min(
    requestedRadius,
    start.x,
    start.y,
    document.width - start.x,
    document.height - start.y,
  );
  return {
    height: radius * 2,
    radius,
    width: radius * 2,
    x: start.x - radius,
    y: start.y - radius,
  };
}

export function createElementFromDrag(
  tool: CreationTool,
  start: CanvasPoint,
  requestedEnd: CanvasPoint,
  document: CanvasDocument,
  id: string,
): CanvasLeafElement | null {
  const end = clampPointToDocument(requestedEnd, document);
  const distance = Math.hypot(end.x - start.x, end.y - start.y);

  if (tool !== "text" && distance < MIN_DRAW_DISTANCE) return null;

  if (tool === "text") {
    if (distance < MIN_DRAW_DISTANCE) {
      const width = Math.min(320, document.width);
      const height = Math.min(56, document.height);
      return {
        ...baseElement(
          id,
          "新建文本",
          Math.min(start.x, document.width - width),
          Math.min(start.y, document.height - height),
          width,
          height,
        ),
        align: "left",
        fill: "#24382F",
        fontFamily: "noto-sans-sc",
        fontSize: 24,
        fontWeight: "400",
        lineHeight: 1.04,
        text: "新建文本",
        type: "text",
      } satisfies TextElement;
    }

    const bounds = getCornerBounds(start, end);
    return {
      ...baseElement(id, "新建文本", bounds.x, bounds.y, bounds.width, bounds.height),
      align: "left",
      fill: "#24382F",
      fontFamily: "noto-sans-sc",
      fontSize: 24,
      fontWeight: "400",
      lineHeight: 1.04,
      text: "新建文本",
      type: "text",
    } satisfies TextElement;
  }

  if (tool === "line" || tool === "arrow") {
    const geometry = getLineGeometry(start, end);
    const common = {
      ...baseElement(
        id,
        tool === "line" ? "直线" : "箭头",
        geometry.x,
        geometry.y,
        geometry.width,
        geometry.height,
      ),
      ...LINE_STYLE,
      points: geometry.points,
    };
    return tool === "line"
      ? ({ ...common, type: "line" } satisfies LineElement)
      : ({ ...common, pointerLength: 14, pointerWidth: 12, type: "arrow" } satisfies ArrowElement);
  }

  if (tool === "polygon" || tool === "star") {
    const bounds = getRadialBounds(start, end, document);
    if (bounds.radius < MIN_DRAW_DISTANCE) return null;
    const common = {
      ...baseElement(
        id,
        tool === "polygon" ? "多边形" : "星形",
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
      ),
      ...FILLED_SHAPE_STYLE,
    };
    return tool === "polygon"
      ? ({ ...common, cornerRadius: 0, sides: 3, type: "polygon" } satisfies PolygonElement)
      : ({
          ...common,
          innerRadius: bounds.radius * 0.42,
          numPoints: 5,
          outerRadius: bounds.radius,
          type: "star",
        } satisfies StarElement);
  }

  const bounds = getCornerBounds(start, end);
  const common = {
    ...baseElement(
      id,
      tool === "rect" ? "矩形" : "椭圆",
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
    ),
    ...FILLED_SHAPE_STYLE,
  };
  return tool === "rect"
    ? ({ ...common, cornerRadius: 0, type: "rect" } satisfies RectElement)
    : ({ ...common, type: "ellipse" } satisfies EllipseElement);
}

export interface VisibleDocumentArea {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export function getImagePlacement(
  imageSize: { height: number; width: number },
  document: CanvasDocument,
  visibleArea: VisibleDocumentArea,
) {
  const scale = Math.min(
    1,
    480 / imageSize.width,
    360 / imageSize.height,
    document.width / imageSize.width,
    document.height / imageSize.height,
  );
  const width = imageSize.width * scale;
  const height = imageSize.height * scale;
  const visibleLeft = Math.max(0, visibleArea.left);
  const visibleRight = Math.min(document.width, visibleArea.right);
  const visibleTop = Math.max(0, visibleArea.top);
  const visibleBottom = Math.min(document.height, visibleArea.bottom);
  const centerX =
    visibleLeft <= visibleRight ? (visibleLeft + visibleRight) / 2 : document.width / 2;
  const centerY =
    visibleTop <= visibleBottom ? (visibleTop + visibleBottom) / 2 : document.height / 2;

  return {
    height,
    width,
    x: Math.min(document.width - width, Math.max(0, centerX - width / 2)),
    y: Math.min(document.height - height, Math.max(0, centerY - height / 2)),
  };
}

function getCenteredElementPlacement(
  requestedSize: { height: number; width: number },
  document: CanvasDocument,
  visibleArea: VisibleDocumentArea,
) {
  const width = Math.min(requestedSize.width, document.width);
  const height = Math.min(requestedSize.height, document.height);
  const visibleLeft = Math.max(0, visibleArea.left);
  const visibleRight = Math.min(document.width, visibleArea.right);
  const visibleTop = Math.max(0, visibleArea.top);
  const visibleBottom = Math.min(document.height, visibleArea.bottom);
  const centerX =
    visibleLeft <= visibleRight ? (visibleLeft + visibleRight) / 2 : document.width / 2;
  const centerY =
    visibleTop <= visibleBottom ? (visibleTop + visibleBottom) / 2 : document.height / 2;

  return {
    height,
    width,
    x: Math.min(document.width - width, Math.max(0, centerX - width / 2)),
    y: Math.min(document.height - height, Math.max(0, centerY - height / 2)),
  };
}

export function createImageElement(
  id: string,
  src: string,
  imageSize: { height: number; width: number },
  document: CanvasDocument,
  visibleArea: VisibleDocumentArea,
): ImageElement {
  const placement = getImagePlacement(imageSize, document, visibleArea);
  return {
    ...baseElement(id, "图片", placement.x, placement.y, placement.width, placement.height),
    cornerRadius: 0,
    fit: "contain",
    focalPointX: 0.5,
    focalPointY: 0.5,
    src,
    type: "image",
  };
}

export function createChartElement(
  id: string,
  document: CanvasDocument,
  visibleArea: VisibleDocumentArea,
): ChartElement {
  const placement = getCenteredElementPlacement({ height: 320, width: 520 }, document, visibleArea);
  return {
    ...baseElement(id, "图表", placement.x, placement.y, placement.width, placement.height),
    chartType: "bar",
    colors: ["#4F46E5", "#059669", "#F59E0B"],
    series: [
      {
        labels: ["Q1", "Q2", "Q3", "Q4"],
        name: "销售额",
        values: [120, 180, 150, 220],
      },
    ],
    showLegend: true,
    showValue: true,
    title: "季度销售趋势",
    type: "chart",
  };
}

const DEFAULT_TABLE_HEADER_STYLE: TableCellStyle = {
  align: "center",
  borderColor: "#CBD5E1",
  borderWidth: 1,
  color: "#0F172A",
  fill: "#E2E8F0",
  fontFamily: "noto-sans-sc",
  fontSize: 18,
  fontWeight: "700",
  valign: "middle",
};

const DEFAULT_TABLE_CELL_STYLE: TableCellStyle = {
  align: "center",
  borderColor: "#CBD5E1",
  borderWidth: 1,
  color: "#334155",
  fill: "#FFFFFF",
  fontFamily: "noto-sans-sc",
  fontSize: 16,
  fontWeight: "400",
  valign: "middle",
};

export function createTableElement(
  id: string,
  document: CanvasDocument,
  visibleArea: VisibleDocumentArea,
): TableElement {
  const placement = getCenteredElementPlacement({ height: 260, width: 520 }, document, visibleArea);
  const columnWidth = placement.width / 3;
  const rowHeight = placement.height / 4;
  const columns = [
    { id: `${id}-col-1`, name: "指标", width: columnWidth },
    { id: `${id}-col-2`, name: "当前值", width: columnWidth },
    { id: `${id}-col-3`, name: "变化", width: columnWidth },
  ];
  const rows = [
    { label: "转化率", value: "24%", change: "+3.2%" },
    { label: "访问量", value: "18,420", change: "+8.7%" },
    { label: "客单价", value: "¥326", change: "-1.4%" },
  ].map((row, index) => ({
    cells: {
      [columns[0].id]: row.label,
      [columns[1].id]: row.value,
      [columns[2].id]: row.change,
    },
    height: rowHeight,
    id: `${id}-row-${index + 1}`,
  }));

  return {
    ...baseElement(id, "表格", placement.x, placement.y, placement.width, placement.height),
    cellStyle: DEFAULT_TABLE_CELL_STYLE,
    columns,
    headerStyle: DEFAULT_TABLE_HEADER_STYLE,
    rows,
    type: "table",
  };
}
