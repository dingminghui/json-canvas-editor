import { DEFAULT_CANVAS_FONT_FAMILY, type CanvasFontFamily } from "@/editor/fonts";
import type {
  CanvasDocument,
  CanvasElement,
  CircleElement,
  GroupElement,
  ImageElement,
  RectElement,
  TextElement,
} from "@/editor/types";
import legEdemaUrl from "../../mock/assets/01-leg-edema.jpg";
import consultationReportUrl from "../../mock/assets/02-consultation-report.jpg";
import kidneyTreatmentPlanUrl from "../../mock/assets/03-kidney-treatment-plan.jpg";
import parkWalkUrl from "../../mock/assets/04-park-walk.jpg";
import outcomeNotebookUrl from "../../mock/assets/05-outcome-notebook.jpg";
import lymphomaDiagnosisUrl from "../../mock/assets/06-lymphoma-diagnosis.jpg";
import lymphomaProgressionUrl from "../../mock/assets/07-lymphoma-progression.jpg";
import rchopTreatmentPlanUrl from "../../mock/assets/08-rchop-treatment-plan.jpg";
import chemotherapySupportUrl from "../../mock/assets/09-chemotherapy-support.jpg";
import springParkRecoveryUrl from "../../mock/assets/10-spring-park-recovery.jpg";
import symbicortHeroUrl from "../../mock/assets/11-symbicort-hero.webp";
import airwayMechanismUrl from "../../mock/assets/12-airway-mechanism.webp";
import ginaProtectionUrl from "../../mock/assets/13-gina-protection.webp";
import icsLabaDuoUrl from "../../mock/assets/14-ics-laba-duo.webp";
import inhalerStepsUrl from "../../mock/assets/15-inhaler-steps.webp";
import followupReviewUrl from "../../mock/assets/16-followup-review.webp";
import urgentCareUrl from "../../mock/assets/17-urgent-care.webp";
import rawKidneyStoryMock from "../../mock/kidney-awakening-story.json";
import rawLymphomaStoryMock from "../../mock/lymphoma-transformation-story.json";
import rawSymbicortOriginalMock from "../../mock/symbicort-longform-original.json";
import rawSymbicortStoryMock from "../../mock/symbicort-longform-story.json";

interface StoryAsset {
  id: string;
  width: number;
  height: number;
}

interface StorySegment {
  text: string;
  marks?: ("artistic" | "fact" | "strong")[];
  source?: string;
}

interface StoryListItem {
  lead: string;
  content: string;
}

type StoryBlock =
  | { type: "paragraph"; content: string }
  | { type: "richText"; segments: StorySegment[] }
  | { type: "image"; assetId: string }
  | {
      type: "table";
      columns: string[];
      rows: string[][];
      highlightColumn?: number;
    }
  | { type: "fact"; content: string; source: string; highlights?: string[] }
  | { type: "quote"; content: string; attribution?: string; variant?: "accent" }
  | { type: "list"; title: string; ordered: boolean; items: StoryListItem[] };

interface StorySection {
  id: string;
  eyebrow: string;
  title: string;
  blocks: StoryBlock[];
}

interface StoryMock {
  id: string;
  name: string;
  source: { title: string };
  theme: {
    fonts: StoryFontPresets;
  };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    quote?: string;
    assetId?: string;
  };
  assets: StoryAsset[];
  sections: StorySection[];
  footer: {
    disclaimers: string[];
    copyright: string;
  };
}

interface StoryFontPresets {
  body: CanvasFontFamily;
  display: CanvasFontFamily;
  technical: CanvasFontFamily;
}

type OriginalTextElement = Omit<TextElement, "fontFamily"> & { fontFamily: string };
type OriginalRectElement = Omit<RectElement, "stroke" | "strokeWidth"> &
  Partial<Pick<RectElement, "stroke" | "strokeWidth">>;
type OriginalCircleElement = Omit<CircleElement, "stroke" | "strokeWidth"> &
  Partial<Pick<CircleElement, "stroke" | "strokeWidth">>;
type OriginalGroupElement = Omit<GroupElement, "children"> & {
  children: OriginalCanvasElement[];
};
type OriginalCanvasElement =
  | Exclude<CanvasElement, CircleElement | GroupElement | RectElement | TextElement>
  | OriginalCircleElement
  | OriginalGroupElement
  | OriginalRectElement
  | OriginalTextElement;
interface OriginalCanvasDocument extends Omit<CanvasDocument, "elements"> {
  elements: OriginalCanvasElement[];
}

const kidneyStoryMock = rawKidneyStoryMock as unknown as StoryMock;
const lymphomaStoryMock = rawLymphomaStoryMock as unknown as StoryMock;
const symbicortStoryMock = rawSymbicortStoryMock as unknown as StoryMock;
const symbicortOriginalMock = rawSymbicortOriginalMock as unknown as OriginalCanvasDocument;

const PAGE_WIDTH = 1080;
const CONTENT_X = 140;
const CONTENT_WIDTH = 800;
const SECTION_GAP = 96;

const COLORS = {
  accent: "#48745f",
  divider: "#d8d4c8",
  fact: "#e5efe7",
  muted: "#66766f",
  paper: "#f8f4ea",
  tableHeader: "#dce8df",
  text: "#24382f",
  warm: "#b88d52",
  white: "#fffdf8",
} as const;

const assetUrls: Record<string, string> = {
  "consultation-report": consultationReportUrl,
  "kidney-treatment-plan": kidneyTreatmentPlanUrl,
  "leg-edema": legEdemaUrl,
  "outcome-notebook": outcomeNotebookUrl,
  "park-walk": parkWalkUrl,
  "lymphoma-diagnosis": lymphomaDiagnosisUrl,
  "lymphoma-progression": lymphomaProgressionUrl,
  "rchop-treatment-plan": rchopTreatmentPlanUrl,
  "chemotherapy-support": chemotherapySupportUrl,
  "spring-park-recovery": springParkRecoveryUrl,
  "symbicort-hero": symbicortHeroUrl,
  "airway-mechanism": airwayMechanismUrl,
  "gina-protection": ginaProtectionUrl,
  "ics-laba-duo": icsLabaDuoUrl,
  "inhaler-steps": inhalerStepsUrl,
  "followup-review": followupReviewUrl,
  "urgent-care": urgentCareUrl,
};

const originalSymbicortAssetUrls: Record<string, string> = {
  "/assets/medical-comic/hero-real.webp": symbicortHeroUrl,
  "/assets/medical-comic/mechanism-real.webp": airwayMechanismUrl,
  "/assets/medical-comic/gina-protection-real.webp": ginaProtectionUrl,
  "/assets/medical-comic/ics-laba-duo-real.webp": icsLabaDuoUrl,
  "/assets/medical-comic/inhaler-steps-real.webp": inhalerStepsUrl,
  "/assets/medical-comic/followup-warning-real.webp": followupReviewUrl,
  "/assets/medical-comic/urgent-care-real.webp": urgentCareUrl,
};

const originalFontFamilies: Record<string, CanvasFontFamily> = {
  Arial: "inter",
  "Microsoft YaHei": "noto-sans-sc",
};

function createOriginalCanvasDocument(document: OriginalCanvasDocument): CanvasDocument {
  function resolveElement(element: OriginalCanvasElement): CanvasElement {
    switch (element.type) {
      case "group":
        return { ...element, children: element.children.map(resolveElement) };
      case "text": {
        const fontFamily = originalFontFamilies[element.fontFamily];
        if (!fontFamily) throw new Error(`Unsupported original font: ${element.fontFamily}`);
        return { ...element, fontFamily };
      }
      case "image": {
        const src = originalSymbicortAssetUrls[element.src];
        if (!src) throw new Error(`Missing original canvas asset: ${element.src}`);
        return { ...element, src };
      }
      case "circle":
      case "rect":
        return {
          ...element,
          stroke: element.stroke ?? "#000000",
          strokeWidth: element.strokeWidth ?? 0,
        };
      case "ellipse":
      case "line":
      case "arrow":
      case "polygon":
      case "star":
        return element;
      default: {
        const exhaustiveElement: never = element;
        throw new Error(
          `Unsupported original canvas element: ${JSON.stringify(exhaustiveElement)}`,
        );
      }
    }
  }

  return { ...document, elements: document.elements.map(resolveElement) };
}

function baseLeaf(id: string, name: string, x: number, y: number, width: number, height: number) {
  return {
    id,
    name,
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
  };
}

function createText(
  id: string,
  name: string,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: Partial<
    Pick<TextElement, "align" | "fill" | "fontFamily" | "fontSize" | "fontWeight">
  > = {},
): TextElement {
  return {
    ...baseLeaf(id, name, x, y, width, height),
    type: "text",
    text,
    fontFamily: options.fontFamily ?? DEFAULT_CANVAS_FONT_FAMILY,
    fontSize: options.fontSize ?? 24,
    fontWeight: options.fontWeight ?? "400",
    align: options.align ?? "left",
    fill: options.fill ?? COLORS.text,
  };
}

function createRect(
  id: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  cornerRadius = 0,
): RectElement {
  return {
    ...baseLeaf(id, name, x, y, width, height),
    type: "rect",
    fill,
    stroke: "#000000",
    strokeWidth: 0,
    cornerRadius,
  };
}

function estimateTextHeight(
  text: string,
  fontSize: number,
  width: number,
  minimum = fontSize * 1.4,
) {
  const displayText = text.replace(/[*_~]/g, "");
  const charactersPerLine = Math.max(1, Math.floor(width / (fontSize * 0.95)));
  const lines = displayText
    .split("\n")
    .reduce((count, line) => count + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0);
  return Math.ceil(Math.max(minimum, lines * fontSize * 1.22));
}

function segmentsToMarkdown(segments: StorySegment[]) {
  return segments
    .map((segment) => {
      if (segment.marks?.includes("strong")) return `**${segment.text}**`;
      if (segment.marks?.includes("fact")) return `**${segment.text}**`;
      if (segment.marks?.includes("artistic")) return `*${segment.text}*`;
      return segment.text;
    })
    .join("");
}

function createImageBlock(
  story: StoryMock,
  sectionId: string,
  blockIndex: number,
  assetId: string,
  y: number,
): { elements: CanvasElement[]; height: number } {
  const asset = story.assets.find((candidate) => candidate.id === assetId);
  const src = assetUrls[assetId];
  if (!asset || !src) throw new Error(`Missing story asset: ${assetId}`);

  const height = Math.round((CONTENT_WIDTH * asset.height) / asset.width);
  const element: ImageElement = {
    ...baseLeaf(
      `${sectionId}-image-${blockIndex}`,
      `插图 ${blockIndex + 1}`,
      CONTENT_X,
      y,
      CONTENT_WIDTH,
      height,
    ),
    type: "image",
    src,
    fit: "cover",
    cornerRadius: 12,
  };
  return { elements: [element], height };
}

function createTableBlock(
  sectionId: string,
  blockIndex: number,
  block: Extract<StoryBlock, { type: "table" }>,
  y: number,
  fonts: StoryFontPresets,
): { elements: CanvasElement[]; height: number } {
  const id = `${sectionId}-table-${blockIndex}`;
  const headerHeight = 62;
  const rowHeight = 58;
  const height = headerHeight + block.rows.length * rowHeight;
  const columnWidth = CONTENT_WIDTH / block.columns.length;
  const children: CanvasElement[] = [
    createRect(
      `${id}-background`,
      "表格背景",
      CONTENT_X,
      y,
      CONTENT_WIDTH,
      height,
      COLORS.white,
      8,
    ),
    createRect(
      `${id}-header-background`,
      "表头背景",
      CONTENT_X,
      y,
      CONTENT_WIDTH,
      headerHeight,
      COLORS.tableHeader,
      8,
    ),
  ];

  block.columns.forEach((column, columnIndex) => {
    children.push(
      createText(
        `${id}-header-${columnIndex}`,
        `表头 ${column}`,
        column,
        CONTENT_X + columnIndex * columnWidth + 14,
        y + 10,
        columnWidth - 28,
        42,
        { fontFamily: fonts.technical, fontSize: 20, fontWeight: "700" },
      ),
    );
  });

  block.rows.forEach((row, rowIndex) => {
    const rowY = y + headerHeight + rowIndex * rowHeight;
    if (rowIndex > 0) {
      children.push(
        createRect(
          `${id}-rule-${rowIndex}`,
          "表格横线",
          CONTENT_X,
          rowY,
          CONTENT_WIDTH,
          1,
          COLORS.divider,
        ),
      );
    }
    row.forEach((cell, columnIndex) => {
      children.push(
        createText(
          `${id}-cell-${rowIndex}-${columnIndex}`,
          `表格内容 ${rowIndex + 1}-${columnIndex + 1}`,
          cell,
          CONTENT_X + columnIndex * columnWidth + 14,
          rowY + 8,
          columnWidth - 28,
          42,
          {
            fill: block.highlightColumn === columnIndex ? COLORS.accent : COLORS.text,
            fontFamily: fonts.body,
            fontSize: 19,
            fontWeight: block.highlightColumn === columnIndex ? "700" : "400",
          },
        ),
      );
    });
  });

  for (let columnIndex = 1; columnIndex < block.columns.length; columnIndex += 1) {
    children.push(
      createRect(
        `${id}-column-rule-${columnIndex}`,
        "表格竖线",
        CONTENT_X + columnIndex * columnWidth,
        y,
        1,
        height,
        COLORS.divider,
      ),
    );
  }

  const group: GroupElement = {
    id,
    type: "group",
    name: "数据表格",
    visible: true,
    locked: false,
    children,
  };
  return { elements: [group], height };
}

function createFactBlock(
  sectionId: string,
  blockIndex: number,
  block: Extract<StoryBlock, { type: "fact" }>,
  y: number,
  fonts: StoryFontPresets,
): { elements: CanvasElement[]; height: number } {
  const id = `${sectionId}-fact-${blockIndex}`;
  const content =
    block.highlights?.reduce(
      (text, highlight) => text.replace(highlight, `**${highlight}**`),
      block.content,
    ) ?? block.content;
  const contentHeight = estimateTextHeight(content, 22, CONTENT_WIDTH - 56);
  const sourceHeight = estimateTextHeight(block.source, 16, CONTENT_WIDTH - 56);
  const height = 32 + contentHeight + 18 + sourceHeight + 28;
  const group: GroupElement = {
    id,
    type: "group",
    name: "医学事实",
    visible: true,
    locked: false,
    children: [
      createRect(
        `${id}-background`,
        "事实卡背景",
        CONTENT_X,
        y,
        CONTENT_WIDTH,
        height,
        COLORS.fact,
        10,
      ),
      createRect(`${id}-accent`, "事实卡强调线", CONTENT_X, y, 6, height, COLORS.warm, 3),
      createText(
        `${id}-content`,
        "事实内容",
        content,
        CONTENT_X + 28,
        y + 24,
        CONTENT_WIDTH - 56,
        contentHeight,
        { fontFamily: fonts.body, fontSize: 22, fontWeight: "500" },
      ),
      createText(
        `${id}-source`,
        "事实来源",
        `来源：${block.source}`,
        CONTENT_X + 28,
        y + 32 + contentHeight,
        CONTENT_WIDTH - 56,
        sourceHeight,
        { fill: COLORS.muted, fontFamily: fonts.technical, fontSize: 16 },
      ),
    ],
  };
  return { elements: [group], height };
}

function createQuoteBlock(
  sectionId: string,
  blockIndex: number,
  block: Extract<StoryBlock, { type: "quote" }>,
  y: number,
  fonts: StoryFontPresets,
): { elements: CanvasElement[]; height: number } {
  const id = `${sectionId}-quote-${blockIndex}`;
  const attribution = block.attribution ? `\n— ${block.attribution}` : "";
  const text = `*“${block.content}”*${attribution}`;
  const textHeight = estimateTextHeight(text, 27, CONTENT_WIDTH - 76, 64);
  const height = textHeight + 48;
  const group: GroupElement = {
    id,
    type: "group",
    name: "人物引语",
    visible: true,
    locked: false,
    children: [
      createRect(
        `${id}-background`,
        "引语背景",
        CONTENT_X,
        y,
        CONTENT_WIDTH,
        height,
        block.variant === "accent" ? COLORS.fact : COLORS.white,
        8,
      ),
      createRect(`${id}-accent`, "引语强调线", CONTENT_X, y, 5, height, COLORS.accent, 3),
      createText(
        `${id}-text`,
        "引语文字",
        text,
        CONTENT_X + 38,
        y + 24,
        CONTENT_WIDTH - 76,
        textHeight,
        {
          fill: COLORS.accent,
          fontFamily: fonts.display,
          fontSize: 27,
          fontWeight: "500",
        },
      ),
    ],
  };
  return { elements: [group], height };
}

function createListBlock(
  sectionId: string,
  blockIndex: number,
  block: Extract<StoryBlock, { type: "list" }>,
  y: number,
  fonts: StoryFontPresets,
): { elements: CanvasElement[]; height: number } {
  const id = `${sectionId}-list-${blockIndex}`;
  const children: CanvasElement[] = [];
  let cursorY = y + 30;
  children.push(
    createText(
      `${id}-title`,
      "要点标题",
      block.title,
      CONTENT_X + 30,
      cursorY,
      CONTENT_WIDTH - 60,
      46,
      {
        fontFamily: fonts.display,
        fontSize: 25,
        fontWeight: "700",
      },
    ),
  );
  cursorY += 66;

  block.items.forEach((item, itemIndex) => {
    const marker = block.ordered ? `${itemIndex + 1}.` : "•";
    const text = `**${item.lead}** ${item.content}`;
    const textHeight = estimateTextHeight(text, 21, CONTENT_WIDTH - 100);
    children.push(
      createText(
        `${id}-marker-${itemIndex}`,
        `要点 ${itemIndex + 1} 标记`,
        marker,
        CONTENT_X + 30,
        cursorY,
        40,
        36,
        {
          fill: COLORS.warm,
          fontFamily: fonts.technical,
          fontSize: 26,
          fontWeight: "700",
        },
      ),
      createText(
        `${id}-item-${itemIndex}`,
        `要点 ${itemIndex + 1}`,
        text,
        CONTENT_X + 78,
        cursorY,
        CONTENT_WIDTH - 108,
        textHeight,
        { fontFamily: fonts.body, fontSize: 21 },
      ),
    );
    cursorY += textHeight + 24;
  });

  const height = cursorY - y + 12;
  children.unshift(
    createRect(
      `${id}-background`,
      "要点背景",
      CONTENT_X,
      y,
      CONTENT_WIDTH,
      height,
      COLORS.white,
      10,
    ),
  );
  const group: GroupElement = {
    id,
    type: "group",
    name: "案例关键要点",
    visible: true,
    locked: false,
    children,
  };
  return { elements: [group], height };
}

function createStoryDocument(story: StoryMock): CanvasDocument {
  const elements: CanvasElement[] = [];
  const heroChildren: CanvasElement[] = [];
  const fonts = story.theme.fonts;
  let cursorY = 72;

  heroChildren.push(
    createText(
      "story-eyebrow",
      "病例声明",
      story.hero.eyebrow,
      CONTENT_X,
      cursorY,
      CONTENT_WIDTH,
      36,
      {
        align: "center",
        fill: COLORS.warm,
        fontFamily: fonts.technical,
        fontSize: 18,
        fontWeight: "600",
      },
    ),
  );
  cursorY += 72;
  heroChildren.push(
    createText("story-title", "主标题", story.hero.title, CONTENT_X, cursorY, CONTENT_WIDTH, 112, {
      align: "center",
      fontFamily: fonts.display,
      fontSize: 58,
      fontWeight: "700",
    }),
  );
  cursorY += 132;
  heroChildren.push(
    createText(
      "story-subtitle",
      "副标题",
      story.hero.subtitle,
      CONTENT_X,
      cursorY,
      CONTENT_WIDTH,
      48,
      {
        align: "center",
        fill: COLORS.muted,
        fontFamily: fonts.body,
        fontSize: 25,
        fontWeight: "500",
      },
    ),
  );
  cursorY += 76;
  if (story.hero.quote) {
    heroChildren.push(
      createText(
        "story-hero-quote",
        "开篇引语",
        `*“${story.hero.quote}”*`,
        CONTENT_X,
        cursorY,
        CONTENT_WIDTH,
        58,
        {
          align: "center",
          fill: COLORS.accent,
          fontFamily: fonts.display,
          fontSize: 27,
          fontWeight: "500",
        },
      ),
    );
    cursorY += 92;
  }
  if (story.hero.assetId) {
    const heroImage = createImageBlock(story, "story-hero", 0, story.hero.assetId, cursorY);
    heroChildren.push(...heroImage.elements);
    cursorY += heroImage.height + 64;
  }
  heroChildren.push(
    createRect(
      "story-hero-divider",
      "开篇分隔线",
      CONTENT_X,
      cursorY,
      CONTENT_WIDTH,
      1,
      COLORS.divider,
    ),
  );
  cursorY += SECTION_GAP;

  elements.push({
    id: "story-hero-group",
    type: "group",
    name: "开篇",
    visible: true,
    locked: false,
    children: heroChildren,
  });

  story.sections.forEach((section) => {
    const sectionChildren: CanvasElement[] = [];
    sectionChildren.push(
      createText(
        `${section.id}-eyebrow`,
        "章节序号",
        section.eyebrow,
        CONTENT_X,
        cursorY,
        CONTENT_WIDTH,
        34,
        {
          fill: COLORS.accent,
          fontFamily: fonts.technical,
          fontSize: 19,
          fontWeight: "700",
        },
      ),
    );
    cursorY += 48;
    sectionChildren.push(
      createText(
        `${section.id}-title`,
        "章节标题",
        section.title,
        CONTENT_X,
        cursorY,
        CONTENT_WIDTH,
        70,
        { fontFamily: fonts.display, fontSize: 42, fontWeight: "700" },
      ),
    );
    cursorY += 96;

    section.blocks.forEach((block, blockIndex) => {
      let result: { elements: CanvasElement[]; height: number };
      switch (block.type) {
        case "paragraph": {
          const height = estimateTextHeight(block.content, 23, CONTENT_WIDTH);
          result = {
            elements: [
              createText(
                `${section.id}-paragraph-${blockIndex}`,
                `正文 ${blockIndex + 1}`,
                block.content,
                CONTENT_X,
                cursorY,
                CONTENT_WIDTH,
                height,
                { fontFamily: fonts.body, fontSize: 23 },
              ),
            ],
            height,
          };
          break;
        }
        case "richText": {
          const markdown = segmentsToMarkdown(block.segments);
          const height = estimateTextHeight(markdown, 23, CONTENT_WIDTH);
          result = {
            elements: [
              createText(
                `${section.id}-rich-text-${blockIndex}`,
                `富文本 ${blockIndex + 1}`,
                markdown,
                CONTENT_X,
                cursorY,
                CONTENT_WIDTH,
                height,
                { fontFamily: fonts.body, fontSize: 23 },
              ),
            ],
            height,
          };
          break;
        }
        case "image":
          result = createImageBlock(story, section.id, blockIndex, block.assetId, cursorY);
          break;
        case "table":
          result = createTableBlock(section.id, blockIndex, block, cursorY, fonts);
          break;
        case "fact":
          result = createFactBlock(section.id, blockIndex, block, cursorY, fonts);
          break;
        case "quote":
          result = createQuoteBlock(section.id, blockIndex, block, cursorY, fonts);
          break;
        case "list":
          result = createListBlock(section.id, blockIndex, block, cursorY, fonts);
          break;
        default: {
          const exhaustiveBlock: never = block;
          throw new Error(`Unsupported story block: ${JSON.stringify(exhaustiveBlock)}`);
        }
      }

      sectionChildren.push(...result.elements);
      cursorY += result.height + 34;
    });

    cursorY += 22;
    sectionChildren.push(
      createRect(
        `${section.id}-divider`,
        "章节分隔线",
        CONTENT_X,
        cursorY,
        CONTENT_WIDTH,
        1,
        COLORS.divider,
      ),
    );
    cursorY += SECTION_GAP;

    elements.push({
      id: `${section.id}-group`,
      type: "group",
      name: `${section.eyebrow} · ${section.title}`,
      visible: true,
      locked: false,
      children: sectionChildren,
    });
  });

  const footerChildren: CanvasElement[] = [];
  story.footer.disclaimers.forEach((disclaimer, index) => {
    const height = estimateTextHeight(disclaimer, 17, CONTENT_WIDTH);
    footerChildren.push(
      createText(
        `story-footer-disclaimer-${index}`,
        `页脚声明 ${index + 1}`,
        disclaimer,
        CONTENT_X,
        cursorY,
        CONTENT_WIDTH,
        height,
        { align: "center", fill: COLORS.muted, fontFamily: fonts.body, fontSize: 17 },
      ),
    );
    cursorY += height + 20;
  });
  footerChildren.push(
    createText(
      "story-footer-copyright",
      "版权信息",
      story.footer.copyright,
      CONTENT_X,
      cursorY,
      CONTENT_WIDTH,
      32,
      {
        align: "center",
        fill: COLORS.muted,
        fontFamily: fonts.technical,
        fontSize: 16,
      },
    ),
  );
  cursorY += 112;
  elements.push({
    id: "story-footer-group",
    type: "group",
    name: "页脚",
    visible: true,
    locked: false,
    children: footerChildren,
  });

  const background = createRect(
    "story-background",
    "纸张背景",
    0,
    0,
    PAGE_WIDTH,
    cursorY,
    COLORS.paper,
  );
  background.locked = true;

  return {
    id: story.id,
    name: story.name,
    description: story.source.title,
    width: PAGE_WIDTH,
    height: cursorY,
    elements: [background, ...elements],
  };
}

export const EDITOR_TEMPLATES: CanvasDocument[] = [
  createStoryDocument(kidneyStoryMock),
  createStoryDocument(lymphomaStoryMock),
  createStoryDocument(symbicortStoryMock),
  createOriginalCanvasDocument(symbicortOriginalMock),
];
