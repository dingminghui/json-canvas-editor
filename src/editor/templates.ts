import { isCanvasFontFamily, type CanvasFontFamily } from "@/editor/fonts";
import { PPT_TEMPLATE_DOCUMENT } from "@/editor/ppt-template";
import type {
  CanvasDocument,
  CanvasElement,
  CircleElement,
  GroupElement,
  LineElement,
  RectElement,
  TextElement,
} from "@/editor/types";
import symbicortHeroUrl from "../../mock/assets/11-symbicort-hero.webp";
import airwayMechanismUrl from "../../mock/assets/12-airway-mechanism.webp";
import ginaProtectionUrl from "../../mock/assets/13-gina-protection.webp";
import icsLabaDuoUrl from "../../mock/assets/14-ics-laba-duo.webp";
import inhalerStepsUrl from "../../mock/assets/15-inhaler-steps.webp";
import followupReviewUrl from "../../mock/assets/16-followup-review.webp";
import urgentCareUrl from "../../mock/assets/17-urgent-care.webp";
import rawSymbicortLongform from "../../mock/symbicort-longform.json";

type SourceTextElement = Omit<TextElement, "fontFamily"> & { fontFamily: string };
type SourceRectElement = Omit<RectElement, "stroke" | "strokeWidth"> &
  Partial<Pick<RectElement, "stroke" | "strokeWidth">>;
type SourceCircleElement = Omit<CircleElement, "stroke" | "strokeWidth"> &
  Partial<Pick<CircleElement, "stroke" | "strokeWidth">>;
type SourceLineElement = Omit<LineElement, "lineCap"> & {
  closed?: boolean;
  fill?: string;
  lineCap?: LineElement["lineCap"];
};
type SourceGroupElement = Omit<GroupElement, "children"> & {
  children: SourceCanvasElement[];
};
type SourceCanvasElement =
  | Exclude<CanvasElement, CircleElement | GroupElement | LineElement | RectElement | TextElement>
  | SourceCircleElement
  | SourceGroupElement
  | SourceLineElement
  | SourceRectElement
  | SourceTextElement;
interface SourceCanvasDocument extends Omit<CanvasDocument, "documentType" | "elements"> {
  documentType?: CanvasDocument["documentType"];
  elements: SourceCanvasElement[];
}

const sourceDocument = rawSymbicortLongform as unknown as SourceCanvasDocument;

const SOURCE_ASSET_URLS: Record<string, string> = {
  "/assets/medical-comic/hero-real.webp": symbicortHeroUrl,
  "/assets/medical-comic/mechanism-real.webp": airwayMechanismUrl,
  "/assets/medical-comic/gina-protection-real.webp": ginaProtectionUrl,
  "/assets/medical-comic/ics-laba-duo-real.webp": icsLabaDuoUrl,
  "/assets/medical-comic/inhaler-steps-real.webp": inhalerStepsUrl,
  "/assets/medical-comic/followup-warning-real.webp": followupReviewUrl,
  "/assets/medical-comic/urgent-care-real.webp": urgentCareUrl,
};

const SOURCE_FONT_FAMILIES: Record<string, CanvasFontFamily> = {
  Arial: "inter",
  "Microsoft YaHei": "noto-sans-sc",
};

function resolveFontFamily(fontFamily: string): CanvasFontFamily {
  if (isCanvasFontFamily(fontFamily)) return fontFamily;

  const mappedFontFamily = SOURCE_FONT_FAMILIES[fontFamily];
  if (!mappedFontFamily) throw new Error(`Unsupported source font: ${fontFamily}`);
  return mappedFontFamily;
}

function resolveSourceElement(element: SourceCanvasElement): CanvasElement {
  switch (element.type) {
    case "group":
      return { ...element, children: element.children.map(resolveSourceElement) };
    case "text":
      return { ...element, fontFamily: resolveFontFamily(element.fontFamily) };
    case "image": {
      const src = SOURCE_ASSET_URLS[element.src];
      if (!src) throw new Error(`Missing source canvas asset: ${element.src}`);
      return { ...element, src };
    }
    case "circle":
    case "rect":
      return {
        ...element,
        stroke: element.stroke ?? "transparent",
        strokeWidth: element.strokeWidth ?? 0,
      };
    case "line":
      return { ...element, lineCap: element.lineCap ?? "butt" };
    case "arrow":
    case "ellipse":
    case "polygon":
    case "star":
      return element;
    default: {
      const exhaustiveElement: never = element;
      throw new Error(`Unsupported source canvas element: ${JSON.stringify(exhaustiveElement)}`);
    }
  }
}

function createCanvasDocument(document: SourceCanvasDocument): CanvasDocument {
  return {
    ...document,
    documentType: document.documentType ?? "longform",
    elements: document.elements.map(resolveSourceElement),
  };
}

export const EDITOR_TEMPLATES: CanvasDocument[] = [
  createCanvasDocument(sourceDocument),
  PPT_TEMPLATE_DOCUMENT,
];
