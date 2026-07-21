import type {
  CanvasDocument,
  CanvasElement,
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
import rawStoryMock from "../../mock/kidney-awakening-story.json";

interface StoryAsset {
  id: string;
  width: number;
  height: number;
}

interface StorySegment {
  text: string;
  marks?: ("artistic" | "strong")[];
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
  | { type: "quote"; content: string; variant?: "accent" }
  | { type: "list"; title: string; ordered: boolean; items: StoryListItem[] };

interface StorySection {
  id: string;
  eyebrow: string;
  title: string;
  blocks: StoryBlock[];
}

interface StoryMock {
  id: string;
  source: { title: string };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    quote: string;
  };
  assets: StoryAsset[];
  sections: StorySection[];
  footer: {
    disclaimers: string[];
    copyright: string;
  };
}

const storyMock = rawStoryMock as unknown as StoryMock;

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
};

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
  options: Partial<Pick<TextElement, "align" | "fill" | "fontSize" | "fontWeight">> = {},
): TextElement {
  return {
    ...baseLeaf(id, name, x, y, width, height),
    type: "text",
    text,
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
  return Math.max(minimum, Math.ceil(lines * fontSize * 1.22));
}

function segmentsToMarkdown(segments: StorySegment[]) {
  return segments
    .map((segment) => {
      if (segment.marks?.includes("strong")) return `**${segment.text}**`;
      if (segment.marks?.includes("artistic")) return `*${segment.text}*`;
      return segment.text;
    })
    .join("");
}

function createImageBlock(
  sectionId: string,
  blockIndex: number,
  assetId: string,
  y: number,
): { elements: CanvasElement[]; height: number } {
  const asset = storyMock.assets.find((candidate) => candidate.id === assetId);
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
        { fontSize: 20, fontWeight: "700" },
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
        { fontSize: 22, fontWeight: "500" },
      ),
      createText(
        `${id}-source`,
        "事实来源",
        `来源：${block.source}`,
        CONTENT_X + 28,
        y + 32 + contentHeight,
        CONTENT_WIDTH - 56,
        sourceHeight,
        { fill: COLORS.muted, fontSize: 16 },
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
): { elements: CanvasElement[]; height: number } {
  const id = `${sectionId}-quote-${blockIndex}`;
  const text = `*“${block.content}”*`;
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
        { fill: COLORS.accent, fontSize: 27, fontWeight: "500" },
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
        { fill: COLORS.warm, fontSize: 26, fontWeight: "700" },
      ),
      createText(
        `${id}-item-${itemIndex}`,
        `要点 ${itemIndex + 1}`,
        text,
        CONTENT_X + 78,
        cursorY,
        CONTENT_WIDTH - 108,
        textHeight,
        { fontSize: 21 },
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

function createStoryDocument(): CanvasDocument {
  const elements: CanvasElement[] = [];
  const heroChildren: CanvasElement[] = [];
  let cursorY = 72;

  heroChildren.push(
    createText(
      "story-eyebrow",
      "病例声明",
      storyMock.hero.eyebrow,
      CONTENT_X,
      cursorY,
      CONTENT_WIDTH,
      36,
      { align: "center", fill: COLORS.warm, fontSize: 18, fontWeight: "600" },
    ),
  );
  cursorY += 72;
  heroChildren.push(
    createText(
      "story-title",
      "主标题",
      storyMock.hero.title,
      CONTENT_X,
      cursorY,
      CONTENT_WIDTH,
      112,
      { align: "center", fontSize: 58, fontWeight: "700" },
    ),
  );
  cursorY += 132;
  heroChildren.push(
    createText(
      "story-subtitle",
      "副标题",
      storyMock.hero.subtitle,
      CONTENT_X,
      cursorY,
      CONTENT_WIDTH,
      48,
      { align: "center", fill: COLORS.muted, fontSize: 25, fontWeight: "500" },
    ),
  );
  cursorY += 76;
  heroChildren.push(
    createText(
      "story-hero-quote",
      "开篇引语",
      `*“${storyMock.hero.quote}”*`,
      CONTENT_X,
      cursorY,
      CONTENT_WIDTH,
      58,
      { align: "center", fill: COLORS.accent, fontSize: 27, fontWeight: "500" },
    ),
  );
  cursorY += 92;
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

  storyMock.sections.forEach((section) => {
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
        { fill: COLORS.accent, fontSize: 19, fontWeight: "700" },
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
        { fontSize: 42, fontWeight: "700" },
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
                { fontSize: 23 },
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
                { fontSize: 23 },
              ),
            ],
            height,
          };
          break;
        }
        case "image":
          result = createImageBlock(section.id, blockIndex, block.assetId, cursorY);
          break;
        case "table":
          result = createTableBlock(section.id, blockIndex, block, cursorY);
          break;
        case "fact":
          result = createFactBlock(section.id, blockIndex, block, cursorY);
          break;
        case "quote":
          result = createQuoteBlock(section.id, blockIndex, block, cursorY);
          break;
        case "list":
          result = createListBlock(section.id, blockIndex, block, cursorY);
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
  storyMock.footer.disclaimers.forEach((disclaimer, index) => {
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
        { align: "center", fill: COLORS.muted, fontSize: 17 },
      ),
    );
    cursorY += height + 20;
  });
  footerChildren.push(
    createText(
      "story-footer-copyright",
      "版权信息",
      storyMock.footer.copyright,
      CONTENT_X,
      cursorY,
      CONTENT_WIDTH,
      32,
      { align: "center", fill: COLORS.muted, fontSize: 16 },
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
    id: storyMock.id,
    name: "肾脏觉醒之路",
    description: storyMock.source.title,
    width: PAGE_WIDTH,
    height: cursorY,
    elements: [background, ...elements],
  };
}

export const EDITOR_TEMPLATES: CanvasDocument[] = [createStoryDocument()];
