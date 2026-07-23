import type { CanvasFontFamily } from "@/editor/fonts";

export type ElementId = string;
export type CanvasDocumentType = "longform" | "pptx";

interface ElementMeta {
  id: ElementId;
  name: string;
  visible: boolean;
  locked: boolean;
}

interface TransformableElement extends ElementMeta {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
}

interface StrokedElement extends TransformableElement {
  stroke: string;
  strokeWidth: number;
}

interface FilledStrokedElement extends StrokedElement {
  fill: string;
}

export interface TextElement extends TransformableElement {
  type: "text";
  /** Restricted inline Markdown: bold, italic, strikethrough, line breaks, and color spans. */
  text: string;
  fontFamily: CanvasFontFamily;
  fontSize: number;
  fontWeight: "400" | "500" | "600" | "700" | "800";
  /** Unitless multiplier applied to each line box. */
  lineHeight: number;
  align: "left" | "center" | "right";
  fill: string;
}

export interface RectElement extends FilledStrokedElement {
  type: "rect";
  cornerRadius: number;
}

export interface CircleElement extends FilledStrokedElement {
  type: "circle";
}

export interface EllipseElement extends FilledStrokedElement {
  type: "ellipse";
}

export interface LineElement extends StrokedElement {
  type: "line";
  /** Points are local to the element's top-left bounding box. */
  points: number[];
  lineCap: "butt" | "round" | "square";
}

export interface ArrowElement extends Omit<LineElement, "type"> {
  type: "arrow";
  pointerLength: number;
  pointerWidth: number;
}

export interface PolygonElement extends FilledStrokedElement {
  type: "polygon";
  sides: number;
  cornerRadius: number;
}

export interface StarElement extends FilledStrokedElement {
  type: "star";
  numPoints: number;
  innerRadius: number;
  outerRadius: number;
}

export interface ImageElement extends TransformableElement {
  type: "image";
  src: string;
  fit: "cover" | "contain";
  cornerRadius: number;
}

export interface GroupElement extends ElementMeta {
  type: "group";
  children: CanvasElement[];
}

export type CanvasLeafElement =
  | TextElement
  | RectElement
  | CircleElement
  | EllipseElement
  | LineElement
  | ArrowElement
  | PolygonElement
  | StarElement
  | ImageElement;
export type CanvasElement = CanvasLeafElement | GroupElement;
export type CanvasTransformPatch = Pick<
  CanvasLeafElement,
  "x" | "y" | "width" | "height" | "rotation"
>;

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface CanvasDocument {
  id: string;
  name: string;
  description: string;
  documentType: CanvasDocumentType;
  width: number;
  height: number;
  elements: CanvasElement[];
}

export interface TextEditingSession {
  elementId: ElementId;
  initialText: string;
  sessionId: number;
}

export type CanvasElementPatch = CanvasLeafElement extends infer Element
  ? Element extends CanvasLeafElement
    ? Partial<Omit<Element, "id" | "type">>
    : never
  : never;

export function isGroupElement(element: CanvasElement): element is GroupElement {
  return element.type === "group";
}

export function isLeafElement(element: CanvasElement): element is CanvasLeafElement {
  return element.type !== "group";
}
