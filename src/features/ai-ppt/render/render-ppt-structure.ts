import type {
  CanvasDocument,
  CanvasElement,
  CanvasLeafElement,
  GroupElement,
  TableCellStyle,
} from "@/editor/types";
import {
  createCanvasArrow,
  createCanvasChart,
  createCanvasGroup,
  createCanvasRect,
  createCanvasTable,
  createCanvasText,
} from "@/features/ai-ppt/render/canvas-factories";
import {
  resolveCanvasTheme,
  type ResolvedCanvasTheme,
} from "@/features/ai-ppt/render/canvas-theme";
import {
  getPptVisualPlanStructureIssues,
  type PptContentBlock,
  type PptSlide,
  type PptStructureV1,
  type PptVisualPlanV1,
} from "@/features/ai-ppt/schema";

export const AI_PPT_SLIDE_WIDTH = 1600;
export const AI_PPT_SLIDE_HEIGHT = 900;

interface RenderContext {
  documentId: string;
  pageCount: number;
  plan: PptVisualPlanV1["slides"][number];
  sectionTitle: string;
  structure: PptStructureV1;
  theme: ResolvedCanvasTheme;
}

type Frame = { x: number; y: number; width: number; height: number };

export class CanvasRenderError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(issues[0] ?? "画布文档生成失败。");
    this.name = "CanvasRenderError";
  }
}

function fitFontSize(value: string, preferred: number, minimum: number, budget: number): number {
  if (value.length <= budget) return preferred;
  return Math.max(minimum, Math.round(preferred * Math.sqrt(budget / value.length)));
}

function getSlidePrefix(context: RenderContext, slide: PptSlide): string {
  return `${context.documentId}-${slide.id.toLowerCase()}`;
}

function blockToText(block: PptContentBlock): string {
  switch (block.type) {
    case "paragraph":
      return block.text;
    case "bullet-list":
      return block.items.map((item) => `• ${item}`).join("\n");
    case "numbered-list":
      return block.items.map((item, index) => `${index + 1}. ${item}`).join("\n");
    case "comparison":
      return [
        block.left.heading,
        ...block.left.items.map((item) => `• ${item}`),
        block.right.heading,
        ...block.right.items.map((item) => `• ${item}`),
      ].join("\n");
    case "process":
      return block.steps
        .map(
          (step, index) =>
            `${index + 1}. ${step.title}${step.description ? `：${step.description}` : ""}`,
        )
        .join("\n");
    case "metrics":
      return block.items
        .map((item) => `${item.value} ${item.label}${item.context ? `：${item.context}` : ""}`)
        .join("\n");
    case "quote":
      return `${block.quote}${block.attribution ? `\n—— ${block.attribution}` : ""}`;
    case "table":
      return [block.columns.join(" ｜ "), ...block.rows.map((row) => row.join(" ｜ "))].join("\n");
    case "chart":
      return [
        block.takeaway,
        ...block.series.map(
          (series) =>
            `${series.name}：${block.categories
              .map((category, index) => `${category} ${series.values[index]}`)
              .join("；")}`,
        ),
      ].join("\n");
    case "diagram":
      return block.nodes
        .map((node) => `${node.label}${node.description ? `：${node.description}` : ""}`)
        .join("\n");
    default: {
      const exhaustiveBlock: never = block;
      return exhaustiveBlock;
    }
  }
}

function renderBackground(
  prefix: string,
  theme: ResolvedCanvasTheme,
  fill = theme.colors.background,
): CanvasElement[] {
  const elements: CanvasElement[] = [
    createCanvasRect(
      `${prefix}-background`,
      "页面背景",
      { x: 0, y: 0, width: AI_PPT_SLIDE_WIDTH, height: AI_PPT_SLIDE_HEIGHT },
      fill,
      { locked: true },
    ),
  ];
  const { colors, style } = theme;
  switch (style) {
    case "swiss":
      elements.push(
        createCanvasRect(
          `${prefix}-style-top-rule`,
          "Swiss 顶部粗线",
          { x: 0, y: 0, width: AI_PPT_SLIDE_WIDTH, height: 18 },
          colors.foreground,
          { locked: true },
        ),
      );
      break;
    case "data-journalism":
    case "research":
      elements.push(
        createCanvasRect(
          `${prefix}-style-bottom-rule`,
          "数据报道底部标尺",
          { x: 96, y: 866, width: 1404, height: 2 },
          colors.border,
          { locked: true },
        ),
        createCanvasRect(
          `${prefix}-style-bottom-accent`,
          "数据报道底部强调",
          { x: 96, y: 866, width: 210, height: 4 },
          colors.accent,
          { locked: true },
        ),
      );
      break;
    case "technology":
    case "dark-tech":
      elements.push(
        createCanvasRect(
          `${prefix}-style-tech-frame`,
          "技术风格边框",
          { x: 34, y: 34, width: 1532, height: 832 },
          "transparent",
          {
            locked: true,
            opacity: 0.52,
            stroke: colors.border,
            strokeWidth: 1,
          },
        ),
        createCanvasRect(
          `${prefix}-style-tech-corner`,
          "技术风格角标",
          { x: 1488, y: 34, width: 78, height: 14 },
          colors.accent,
          { locked: true },
        ),
      );
      break;
    case "soft-rounded":
    case "warm":
      elements.push(
        createCanvasRect(
          `${prefix}-style-soft-block`,
          "柔和风格色块",
          { x: 1320, y: 0, width: 280, height: 96 },
          colors.surface,
          { cornerRadius: 48, locked: true, opacity: 0.72 },
        ),
      );
      break;
    case "brutalist":
      elements.push(
        createCanvasRect(
          `${prefix}-style-brutalist-top`,
          "粗野主义顶部色带",
          { x: 0, y: 0, width: AI_PPT_SLIDE_WIDTH, height: 24 },
          colors.accent,
          { locked: true },
        ),
        createCanvasRect(
          `${prefix}-style-brutalist-side`,
          "粗野主义侧边色带",
          { x: 0, y: 24, width: 18, height: 876 },
          colors.foreground,
          { locked: true },
        ),
      );
      break;
    case "editorial":
    case "corporate":
      break;
    default: {
      const exhaustiveStyle: never = style;
      return exhaustiveStyle;
    }
  }
  return elements;
}

function renderContentHeader(
  slide: PptSlide,
  context: RenderContext,
  prefix: string,
): CanvasElement[] {
  const { colors, fonts } = context.theme;
  const dense = context.plan.rhythm === "dense";
  const breathing = context.plan.rhythm === "breathing";
  const pageLabel = `${String(slide.index).padStart(2, "0")} / ${String(context.pageCount).padStart(
    2,
    "0",
  )}`;
  return [
    createCanvasRect(
      `${prefix}-header-accent`,
      "页眉强调线",
      { x: 96, y: 46, width: 48, height: 6 },
      colors.accent,
      { locked: true, cornerRadius: 3 },
    ),
    createCanvasText(
      `${prefix}-section`,
      "章节名称",
      context.sectionTitle,
      { x: 164, y: 30, width: 930, height: 40 },
      {
        fill: colors.muted,
        fontFamily: fonts.body,
        fontSize: 20,
        fontWeight: "600",
        lineHeight: 1,
      },
    ),
    createCanvasText(
      `${prefix}-page`,
      "页码",
      pageLabel,
      { x: 1320, y: 30, width: 180, height: 40 },
      {
        align: "right",
        fill: colors.muted,
        fontFamily: "inter",
        fontSize: 20,
        fontWeight: "600",
        lineHeight: 1,
      },
    ),
    createCanvasText(
      `${prefix}-title`,
      "页面标题",
      slide.title,
      { x: 96, y: 105, width: 1404, height: 108 },
      {
        fill: colors.foreground,
        fontFamily: fonts.heading,
        fontSize: fitFontSize(slide.title, breathing ? 66 : dense ? 50 : 58, dense ? 34 : 38, 34),
        fontWeight: "800",
        lineHeight: 1.12,
      },
    ),
    createCanvasText(
      `${prefix}-message`,
      "核心信息",
      slide.coreMessage,
      { x: 100, y: 218, width: 1320, height: 64 },
      {
        fill: colors.muted,
        fontFamily: fonts.body,
        fontSize: fitFontSize(
          slide.coreMessage,
          breathing ? 30 : dense ? 23 : 27,
          dense ? 19 : 21,
          80,
        ),
        fontWeight: "400",
        lineHeight: 1.3,
      },
    ),
  ];
}

function renderCoverSlide(slide: PptSlide, context: RenderContext): GroupElement {
  const prefix = getSlidePrefix(context, slide);
  const { colors, fonts } = context.theme;
  const isSplit =
    context.plan.layoutVariant === "cover-split" || context.plan.composition === "asymmetric-split";
  const children = renderBackground(prefix, context.theme);

  if (isSplit) {
    children.push(
      createCanvasRect(
        `${prefix}-panel`,
        "封面强调面板",
        { x: 1060, y: 0, width: 540, height: 900 },
        colors.primary,
        { locked: true },
      ),
      createCanvasText(
        `${prefix}-focus`,
        "视觉重点",
        context.plan.visualFocus,
        { x: 1120, y: 540, width: 360, height: 170 },
        {
          fill: colors.primaryForeground,
          fontFamily: fonts.heading,
          fontSize: 38,
          fontWeight: "700",
          lineHeight: 1.3,
        },
      ),
    );
  } else {
    children.push(
      createCanvasRect(
        `${prefix}-accent`,
        "封面强调块",
        { x: 96, y: 146, width: 14, height: 500 },
        colors.accent,
        { locked: true, cornerRadius: 7 },
      ),
    );
  }

  children.push(
    createCanvasText(
      `${prefix}-kicker`,
      "封面标签",
      context.sectionTitle,
      { x: 140, y: 118, width: 760, height: 44 },
      {
        fill: colors.primary,
        fontFamily: fonts.body,
        fontSize: 23,
        fontWeight: "700",
        lineHeight: 1,
      },
    ),
    createCanvasText(
      `${prefix}-title`,
      "封面标题",
      slide.title,
      { x: 136, y: 216, width: isSplit ? 820 : 1240, height: 245 },
      {
        fill: colors.foreground,
        fontFamily: fonts.heading,
        fontSize: fitFontSize(slide.title, 82, 54, 28),
        fontWeight: "800",
        lineHeight: 1.14,
      },
    ),
    createCanvasText(
      `${prefix}-message`,
      "封面核心信息",
      slide.coreMessage,
      { x: 140, y: 510, width: isSplit ? 790 : 1060, height: 125 },
      {
        fill: colors.muted,
        fontFamily: fonts.body,
        fontSize: fitFontSize(slide.coreMessage, 32, 24, 60),
        lineHeight: 1.45,
      },
    ),
    createCanvasText(
      `${prefix}-meta`,
      "封面说明",
      slide.contentBlocks.map(blockToText).join("\n"),
      { x: 140, y: 704, width: isSplit ? 790 : 1100, height: 90 },
      {
        fill: colors.foreground,
        fontFamily: fonts.body,
        fontSize: 22,
        fontWeight: "500",
        lineHeight: 1.35,
      },
    ),
  );
  if (!isSplit) {
    children.push(
      createCanvasText(
        `${prefix}-focus`,
        "封面视觉钩子",
        context.plan.visualFocus,
        { x: 1040, y: 682, width: 360, height: 92 },
        {
          align: "right",
          fill: colors.accent,
          fontFamily: fonts.heading,
          fontSize: 24,
          fontWeight: "800",
          lineHeight: 1.2,
        },
      ),
    );
  }
  return createCanvasGroup(
    prefix,
    `${String(slide.index).padStart(2, "0")} ${slide.title}`,
    children,
  );
}

function renderSectionSlide(slide: PptSlide, context: RenderContext): GroupElement {
  const prefix = getSlidePrefix(context, slide);
  const { colors, fonts } = context.theme;
  const children = [
    ...renderBackground(prefix, context.theme, colors.primary),
    createCanvasText(
      `${prefix}-index`,
      "章节编号",
      String(slide.index).padStart(2, "0"),
      { x: 100, y: 92, width: 220, height: 90 },
      {
        fill: colors.accent,
        fontFamily: "inter",
        fontSize: 72,
        fontWeight: "800",
        lineHeight: 1,
      },
    ),
    createCanvasText(
      `${prefix}-title`,
      "章节标题",
      slide.title,
      { x: 100, y: 276, width: 1230, height: 210 },
      {
        fill: colors.primaryForeground,
        fontFamily: fonts.heading,
        fontSize: fitFontSize(slide.title, 78, 52, 30),
        fontWeight: "800",
        lineHeight: 1.16,
      },
    ),
    createCanvasText(
      `${prefix}-message`,
      "章节核心信息",
      slide.coreMessage,
      { x: 106, y: 530, width: 1080, height: 130 },
      {
        fill: colors.primaryForeground,
        fontFamily: fonts.body,
        fontSize: 31,
        lineHeight: 1.45,
        opacity: 0.82,
      },
    ),
  ];
  return createCanvasGroup(
    prefix,
    `${String(slide.index).padStart(2, "0")} ${slide.title}`,
    children,
  );
}

function renderAgendaSlide(slide: PptSlide, context: RenderContext): GroupElement {
  const prefix = getSlidePrefix(context, slide);
  const { colors, fonts, cornerRadius } = context.theme;
  const items =
    slide.contentBlocks.find(
      (block): block is Extract<PptContentBlock, { type: "bullet-list" | "numbered-list" }> =>
        block.type === "bullet-list" || block.type === "numbered-list",
    )?.items ?? context.structure.sections.map((section) => section.title);
  const columns =
    context.plan.layoutVariant === "agenda-grid" || context.plan.composition === "modular-grid"
      ? 2
      : 1;
  const itemWidth = columns === 2 ? 670 : 1400;
  const rows = Math.ceil(items.length / columns);
  const rowGap = 18;
  const itemHeight = Math.min(120, (470 - rowGap * Math.max(0, rows - 1)) / Math.max(rows, 1));
  const children = [
    ...renderBackground(prefix, context.theme),
    ...renderContentHeader(slide, context, prefix),
  ];

  items.forEach((item, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 96 + column * (itemWidth + 60);
    const y = 315 + row * (itemHeight + rowGap);
    children.push(
      createCanvasRect(
        `${prefix}-agenda-${index}-surface`,
        `议程 ${index + 1} 底板`,
        { x, y, width: itemWidth, height: itemHeight },
        colors.surface,
        { cornerRadius, stroke: colors.border, strokeWidth: 1 },
      ),
      createCanvasText(
        `${prefix}-agenda-${index}-number`,
        `议程 ${index + 1} 编号`,
        String(index + 1).padStart(2, "0"),
        { x: x + 28, y: y + 24, width: 70, height: itemHeight - 30 },
        {
          fill: colors.accent,
          fontFamily: "inter",
          fontSize: 30,
          fontWeight: "800",
          lineHeight: 1,
        },
      ),
      createCanvasText(
        `${prefix}-agenda-${index}-text`,
        `议程 ${index + 1}`,
        item,
        { x: x + 110, y: y + 18, width: itemWidth - 140, height: itemHeight - 26 },
        {
          fill: colors.surfaceForeground,
          fontFamily: fonts.heading,
          fontSize: fitFontSize(item, 30, 22, 35),
          fontWeight: "700",
          lineHeight: 1.25,
        },
      ),
    );
  });
  return createCanvasGroup(
    prefix,
    `${String(slide.index).padStart(2, "0")} ${slide.title}`,
    children,
  );
}

function renderComparisonSlide(slide: PptSlide, context: RenderContext): GroupElement {
  const prefix = getSlidePrefix(context, slide);
  const { colors, fonts, cornerRadius } = context.theme;
  const comparison = slide.contentBlocks.find(
    (block): block is Extract<PptContentBlock, { type: "comparison" }> =>
      block.type === "comparison",
  );
  if (!comparison) return renderGenericSlide(slide, context);

  const children = [
    ...renderBackground(prefix, context.theme),
    ...renderContentHeader(slide, context, prefix),
  ];
  [comparison.left, comparison.right].forEach((side, index) => {
    const x = 96 + index * 720;
    const panelFill = index === 0 ? colors.surface : colors.primary;
    const panelForeground = index === 0 ? colors.surfaceForeground : colors.primaryForeground;
    children.push(
      createCanvasRect(
        `${prefix}-comparison-${index}-panel`,
        index === 0 ? "左侧对比面板" : "右侧对比面板",
        { x, y: 318, width: 680, height: 470 },
        panelFill,
        { cornerRadius, stroke: colors.border, strokeWidth: index === 0 ? 1 : 0 },
      ),
      createCanvasText(
        `${prefix}-comparison-${index}-heading`,
        `${side.heading}标题`,
        side.heading,
        { x: x + 40, y: 358, width: 600, height: 70 },
        {
          fill: panelForeground,
          fontFamily: fonts.heading,
          fontSize: 36,
          fontWeight: "800",
          lineHeight: 1.15,
        },
      ),
      createCanvasText(
        `${prefix}-comparison-${index}-items`,
        `${side.heading}内容`,
        side.items.map((item) => `• ${item}`).join("\n"),
        { x: x + 42, y: 460, width: 592, height: 270 },
        {
          fill: panelForeground,
          fontFamily: fonts.body,
          fontSize: fitFontSize(side.items.join(""), 27, 21, 125),
          lineHeight: 1.55,
        },
      ),
    );
  });
  return createCanvasGroup(
    prefix,
    `${String(slide.index).padStart(2, "0")} ${slide.title}`,
    children,
  );
}

function renderProcessSlide(slide: PptSlide, context: RenderContext): GroupElement {
  const prefix = getSlidePrefix(context, slide);
  const { colors, fonts, cornerRadius } = context.theme;
  const process = slide.contentBlocks.find(
    (block): block is Extract<PptContentBlock, { type: "process" }> => block.type === "process",
  );
  const numbered = slide.contentBlocks.find(
    (block): block is Extract<PptContentBlock, { type: "numbered-list" }> =>
      block.type === "numbered-list",
  );
  const steps =
    process?.steps ??
    numbered?.items.map((item) => ({
      title: item,
      description: "",
    })) ??
    [];
  if (steps.length === 0) return renderGenericSlide(slide, context);
  const sourceBlockIndex = slide.contentBlocks.findIndex(
    (block) => block === process || block === numbered,
  );
  const blockAccented = context.plan.accentBlockIndex === sourceBlockIndex;

  const vertical = context.plan.layoutVariant === "process-vertical" || steps.length > 5;
  const columns = vertical ? Math.ceil(steps.length / 2) : steps.length;
  const gap = 24;
  const cardWidth = (1404 - gap * (columns - 1)) / columns;
  const cardHeight = vertical ? 190 : 330;
  const children = [
    ...renderBackground(prefix, context.theme),
    ...renderContentHeader(slide, context, prefix),
  ];
  if (blockAccented) {
    children.push(
      createCanvasRect(
        `${prefix}-process-accent-rule`,
        "流程整体强调线",
        { x: 96, y: 296, width: 1404, height: 6 },
        colors.accent,
        { cornerRadius: 3, locked: true },
      ),
    );
  }

  steps.forEach((step, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 96 + column * (cardWidth + gap);
    const y = 330 + row * (cardHeight + 24);
    children.push(
      createCanvasRect(
        `${prefix}-step-${index}-card`,
        `步骤 ${index + 1} 底板`,
        { x, y, width: cardWidth, height: cardHeight },
        colors.surface,
        { cornerRadius, stroke: colors.border, strokeWidth: 1 },
      ),
      createCanvasText(
        `${prefix}-step-${index}-number`,
        `步骤 ${index + 1} 编号`,
        String(index + 1).padStart(2, "0"),
        { x: x + 26, y: y + 24, width: 80, height: 54 },
        {
          fill: colors.accent,
          fontFamily: "inter",
          fontSize: 34,
          fontWeight: "800",
          lineHeight: 1,
        },
      ),
      createCanvasText(
        `${prefix}-step-${index}-title`,
        `步骤 ${index + 1} 标题`,
        step.title,
        {
          x: x + 28,
          y: y + (vertical ? 72 : 94),
          width: cardWidth - 56,
          height: vertical ? 54 : 84,
        },
        {
          fill: colors.surfaceForeground,
          fontFamily: fonts.heading,
          fontSize: fitFontSize(step.title, 29, 21, 24),
          fontWeight: "700",
          lineHeight: 1.2,
        },
      ),
      createCanvasText(
        `${prefix}-step-${index}-description`,
        `步骤 ${index + 1} 说明`,
        step.description ?? "",
        {
          x: x + 28,
          y: y + (vertical ? 132 : 190),
          width: cardWidth - 56,
          height: vertical ? 38 : cardHeight - 212,
        },
        {
          fill: colors.muted,
          fontFamily: fonts.body,
          fontSize: 20,
          lineHeight: 1.4,
        },
      ),
    );
    if (!vertical && index < steps.length - 1) {
      children.push(
        createCanvasArrow(
          `${prefix}-step-${index}-arrow`,
          `步骤 ${index + 1} 连接线`,
          { x: x + cardWidth + 5, y: y + cardHeight / 2, width: gap - 10, height: 0 },
          colors.accent,
        ),
      );
    }
  });
  return createCanvasGroup(
    prefix,
    `${String(slide.index).padStart(2, "0")} ${slide.title}`,
    children,
  );
}

function renderChartSlide(slide: PptSlide, context: RenderContext): GroupElement {
  const prefix = getSlidePrefix(context, slide);
  const { colors, fonts, cornerRadius } = context.theme;
  const chart = slide.contentBlocks.find(
    (block): block is Extract<PptContentBlock, { type: "chart" }> => block.type === "chart",
  );
  if (!chart) return renderGenericSlide(slide, context);

  const chartType = {
    comparison: "bar",
    trend: "line",
    "part-to-whole": "pie",
  }[chart.relationship] as "bar" | "line" | "pie";
  const railWidth =
    context.plan.composition === "data-led" || context.plan.layoutVariant === "chart-insight"
      ? 360
      : 300;
  const chartWidth = 1404 - railWidth - 28;
  const children = [
    ...renderBackground(prefix, context.theme),
    ...renderContentHeader(slide, context, prefix),
    createCanvasChart(
      `${prefix}-chart`,
      "原生数据图表",
      { x: 96 + railWidth + 28, y: 320, width: chartWidth, height: 470 },
      chartType,
      chart.series.map((series) => ({
        labels: chart.categories,
        name: series.name,
        values: series.values,
      })),
      [colors.primary, colors.accent, colors.muted, colors.border],
      {
        showLegend: chart.series.length > 1,
        showValue: chart.categories.length <= 8,
      },
    ),
    createCanvasRect(
      `${prefix}-chart-insight-panel`,
      "图表结论侧栏",
      { x: 124, y: 340, width: railWidth, height: 430 },
      colors.surface,
      {
        cornerRadius,
        stroke: colors.border,
        strokeWidth: context.theme.style === "brutalist" ? 3 : 1,
      },
    ),
    createCanvasText(
      `${prefix}-chart-insight-label`,
      "图表结论标签",
      "KEY INSIGHT",
      { x: 154, y: 374, width: railWidth - 60, height: 34 },
      {
        fill: colors.accent,
        fontFamily: "inter",
        fontSize: 18,
        fontWeight: "800",
        lineHeight: 1,
      },
    ),
    createCanvasText(
      `${prefix}-chart-insight`,
      "图表核心结论",
      chart.takeaway,
      { x: 154, y: 438, width: railWidth - 60, height: 250 },
      {
        fill: colors.surfaceForeground,
        fontFamily: fonts.heading,
        fontSize: fitFontSize(chart.takeaway, 34, 24, 55),
        fontWeight: "800",
        lineHeight: 1.35,
      },
    ),
  ];

  return createCanvasGroup(
    prefix,
    `${String(slide.index).padStart(2, "0")} ${slide.title}`,
    children,
  );
}

function createDiagramConnector(
  id: string,
  name: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  stroke: string,
) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  const arrow = createCanvasArrow(id, name, { x, y, width, height }, stroke);
  return {
    ...arrow,
    points: [start.x - x, start.y - y, end.x - x, end.y - y],
    strokeWidth: 3,
  };
}

function getDiagramFrames(
  diagram: Extract<PptContentBlock, { type: "diagram" }>,
): Map<string, Frame> {
  const frames = new Map<string, Frame>();
  const count = diagram.nodes.length;

  if (diagram.relationship === "system") {
    const center = diagram.nodes[0];
    frames.set(center.id, { x: 620, y: 470, width: 360, height: 150 });
    const satellites = diagram.nodes.slice(1);
    const positions = [
      { x: 120, y: 330 },
      { x: 1130, y: 330 },
      { x: 120, y: 650 },
      { x: 1130, y: 650 },
      { x: 380, y: 320 },
      { x: 900, y: 650 },
      { x: 640, y: 690 },
    ];
    satellites.forEach((node, index) => {
      const position = positions[index] ?? positions.at(-1)!;
      frames.set(node.id, { ...position, width: 300, height: 118 });
    });
    return frames;
  }

  if (diagram.relationship === "cycle") {
    const centerX = 800;
    const centerY = 548;
    const radiusX = count <= 4 ? 470 : 540;
    const radiusY = count <= 4 ? 190 : 205;
    diagram.nodes.forEach((node, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
      frames.set(node.id, {
        x: centerX + Math.cos(angle) * radiusX - 130,
        y: centerY + Math.sin(angle) * radiusY - 58,
        width: 260,
        height: 116,
      });
    });
    return frames;
  }

  if (diagram.relationship === "hierarchy") {
    const incoming = new Map(diagram.nodes.map((node) => [node.id, 0]));
    diagram.edges.forEach((edge) => incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1));
    const roots = diagram.nodes.filter((node) => incoming.get(node.id) === 0);
    const rootIds = new Set(
      (roots.length > 0 ? roots : diagram.nodes.slice(0, 1)).map((node) => node.id),
    );
    const topNodes = diagram.nodes.filter((node) => rootIds.has(node.id));
    const lowerNodes = diagram.nodes.filter((node) => !rootIds.has(node.id));
    const setRow = (nodes: typeof diagram.nodes, y: number, width: number) => {
      const gap = 24;
      const totalWidth = nodes.length * width + Math.max(0, nodes.length - 1) * gap;
      const startX = (AI_PPT_SLIDE_WIDTH - totalWidth) / 2;
      nodes.forEach((node, index) =>
        frames.set(node.id, { x: startX + index * (width + gap), y, width, height: 126 }),
      );
    };
    setRow(topNodes, 330, Math.min(420, 1180 / Math.max(1, topNodes.length)));
    const lowerColumns = Math.min(4, Math.max(1, lowerNodes.length));
    const lowerWidth = (1360 - (lowerColumns - 1) * 24) / lowerColumns;
    lowerNodes.forEach((node, index) => {
      const row = Math.floor(index / lowerColumns);
      const column = index % lowerColumns;
      frames.set(node.id, {
        x: 120 + column * (lowerWidth + 24),
        y: 560 + row * 146,
        width: lowerWidth,
        height: 120,
      });
    });
    return frames;
  }

  const columns = count > 4 ? Math.ceil(count / 2) : count;
  const gap = 28;
  const width = (1360 - (columns - 1) * gap) / columns;
  diagram.nodes.forEach((node, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    frames.set(node.id, {
      x: 120 + column * (width + gap),
      y: 390 + row * 230,
      width,
      height: count > 4 ? 160 : 210,
    });
  });
  return frames;
}

function renderDiagramSlide(slide: PptSlide, context: RenderContext): GroupElement {
  const prefix = getSlidePrefix(context, slide);
  const { colors, fonts, cornerRadius } = context.theme;
  const diagram = slide.contentBlocks.find(
    (block): block is Extract<PptContentBlock, { type: "diagram" }> => block.type === "diagram",
  );
  if (!diagram) return renderGenericSlide(slide, context);

  const frames = getDiagramFrames(diagram);
  const children = [
    ...renderBackground(prefix, context.theme),
    ...renderContentHeader(slide, context, prefix),
  ];

  diagram.edges.forEach((edge, index) => {
    const from = frames.get(edge.from);
    const to = frames.get(edge.to);
    if (!from || !to) return;
    const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    const end = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
    children.push(
      createDiagramConnector(
        `${prefix}-edge-${index}`,
        `关系 ${index + 1}`,
        start,
        end,
        colors.border,
      ),
    );
    if (edge.label) {
      children.push(
        createCanvasText(
          `${prefix}-edge-${index}-label`,
          `关系 ${index + 1} 标签`,
          edge.label,
          {
            x: (start.x + end.x) / 2 - 70,
            y: (start.y + end.y) / 2 - 18,
            width: 140,
            height: 36,
          },
          {
            align: "center",
            fill: colors.muted,
            fontFamily: fonts.body,
            fontSize: 16,
            fontWeight: "600",
            lineHeight: 1,
          },
        ),
      );
    }
  });

  diagram.nodes.forEach((node, index) => {
    const frame = frames.get(node.id);
    if (!frame) return;
    const central = diagram.relationship === "system" && index === 0;
    children.push(
      createCanvasRect(
        `${prefix}-node-${node.id}-card`,
        `${node.label} 底板`,
        frame,
        central ? colors.primary : colors.surface,
        {
          cornerRadius: context.theme.style === "brutalist" ? 0 : cornerRadius,
          stroke: central ? colors.primary : colors.border,
          strokeWidth: context.theme.style === "brutalist" ? 3 : 1,
        },
      ),
      createCanvasText(
        `${prefix}-node-${node.id}-index`,
        `${node.label} 编号`,
        String(index + 1).padStart(2, "0"),
        { x: frame.x + 22, y: frame.y + 18, width: 50, height: 30 },
        {
          fill: central ? colors.accent : colors.primary,
          fontFamily: "inter",
          fontSize: 18,
          fontWeight: "800",
          lineHeight: 1,
        },
      ),
      createCanvasText(
        `${prefix}-node-${node.id}-title`,
        `${node.label} 标题`,
        node.label,
        {
          x: frame.x + 22,
          y: frame.y + 52,
          width: frame.width - 44,
          height: node.description ? 46 : frame.height - 70,
        },
        {
          align: diagram.relationship === "cycle" ? "center" : "left",
          fill: central ? colors.primaryForeground : colors.surfaceForeground,
          fontFamily: fonts.heading,
          fontSize: fitFontSize(node.label, central ? 30 : 25, 19, 20),
          fontWeight: "800",
          lineHeight: 1.18,
        },
      ),
    );
    if (node.description) {
      children.push(
        createCanvasText(
          `${prefix}-node-${node.id}-description`,
          `${node.label} 说明`,
          node.description,
          {
            x: frame.x + 22,
            y: frame.y + 100,
            width: frame.width - 44,
            height: Math.max(36, frame.height - 112),
          },
          {
            fill: central ? colors.primaryForeground : colors.muted,
            fontFamily: fonts.body,
            fontSize: fitFontSize(node.description, 18, 15, 45),
            lineHeight: 1.35,
            opacity: central ? 0.84 : 1,
          },
        ),
      );
    }
  });

  return createCanvasGroup(
    prefix,
    `${String(slide.index).padStart(2, "0")} ${slide.title}`,
    children,
  );
}

function renderMetricsSlide(slide: PptSlide, context: RenderContext): GroupElement {
  const prefix = getSlidePrefix(context, slide);
  const { colors, fonts, cornerRadius } = context.theme;
  const metrics = slide.contentBlocks.find(
    (block): block is Extract<PptContentBlock, { type: "metrics" }> => block.type === "metrics",
  );
  if (!metrics) return renderGenericSlide(slide, context);
  const metricsBlockIndex = slide.contentBlocks.findIndex((block) => block === metrics);
  const featureFirstMetric =
    context.plan.layoutVariant === "hero-number" ||
    context.plan.composition === "data-led" ||
    (context.plan.primaryVisual === "metrics" &&
      context.plan.accentBlockIndex === metricsBlockIndex);

  if (featureFirstMetric) {
    const [hero, ...supporting] = metrics.items;
    const children = [
      ...renderBackground(prefix, context.theme),
      ...renderContentHeader(slide, context, prefix),
      createCanvasRect(
        `${prefix}-metric-hero-panel`,
        "主指标底板",
        { x: 96, y: 320, width: supporting.length > 0 ? 700 : 1404, height: 470 },
        colors.primary,
        {
          cornerRadius: context.theme.style === "brutalist" ? 0 : cornerRadius,
          stroke: colors.primary,
          strokeWidth: context.theme.style === "brutalist" ? 3 : 0,
        },
      ),
      createCanvasText(
        `${prefix}-metric-hero-value`,
        "主指标数值",
        hero.value,
        { x: 140, y: 390, width: supporting.length > 0 ? 610 : 1316, height: 150 },
        {
          align: supporting.length > 0 ? "left" : "center",
          fill: colors.primaryForeground,
          fontFamily: fonts.heading,
          fontSize: fitFontSize(hero.value, 112, 72, 14),
          fontWeight: "800",
          lineHeight: 1,
        },
      ),
      createCanvasText(
        `${prefix}-metric-hero-label`,
        "主指标标签",
        hero.label,
        { x: 144, y: 575, width: supporting.length > 0 ? 600 : 1308, height: 62 },
        {
          align: supporting.length > 0 ? "left" : "center",
          fill: colors.primaryForeground,
          fontFamily: fonts.heading,
          fontSize: 32,
          fontWeight: "700",
          lineHeight: 1.2,
        },
      ),
      createCanvasText(
        `${prefix}-metric-hero-context`,
        "主指标说明",
        hero.context ?? context.plan.visualFocus,
        { x: 144, y: 670, width: supporting.length > 0 ? 600 : 1308, height: 68 },
        {
          align: supporting.length > 0 ? "left" : "center",
          fill: colors.primaryForeground,
          fontFamily: fonts.body,
          fontSize: 22,
          lineHeight: 1.35,
          opacity: 0.82,
        },
      ),
    ];
    const columns = supporting.length <= 2 ? 1 : 2;
    const rows = Math.ceil(supporting.length / columns);
    const gap = 20;
    const supportWidth = (676 - gap * (columns - 1)) / columns;
    const supportHeight = rows > 0 ? (470 - gap * Math.max(0, rows - 1)) / rows : 470;
    supporting.forEach((item, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = 824 + column * (supportWidth + gap);
      const y = 320 + row * (supportHeight + gap);
      children.push(
        createCanvasRect(
          `${prefix}-metric-support-${index}-panel`,
          `辅助指标 ${index + 1} 底板`,
          { x, y, width: supportWidth, height: supportHeight },
          colors.surface,
          { cornerRadius, stroke: colors.border, strokeWidth: 1 },
        ),
        createCanvasText(
          `${prefix}-metric-support-${index}-value`,
          `辅助指标 ${index + 1} 数值`,
          item.value,
          { x: x + 24, y: y + 28, width: supportWidth - 48, height: 74 },
          {
            fill: colors.primary,
            fontFamily: fonts.heading,
            fontSize: fitFontSize(item.value, 46, 30, 12),
            fontWeight: "800",
            lineHeight: 1,
          },
        ),
        createCanvasText(
          `${prefix}-metric-support-${index}-label`,
          `辅助指标 ${index + 1} 标签`,
          item.label,
          {
            x: x + 24,
            y: y + Math.min(112, supportHeight * 0.48),
            width: supportWidth - 48,
            height: 48,
          },
          {
            fill: colors.surfaceForeground,
            fontFamily: fonts.heading,
            fontSize: 22,
            fontWeight: "700",
            lineHeight: 1.2,
          },
        ),
      );
    });
    return createCanvasGroup(
      prefix,
      `${String(slide.index).padStart(2, "0")} ${slide.title}`,
      children,
    );
  }

  const columns = metrics.items.length <= 2 ? metrics.items.length : 3;
  const rows = Math.ceil(metrics.items.length / columns);
  const gap = 24;
  const cardWidth = (1404 - gap * (columns - 1)) / columns;
  const cardHeight = rows === 1 ? 380 : 216;
  const children = [
    ...renderBackground(prefix, context.theme),
    ...renderContentHeader(slide, context, prefix),
  ];

  metrics.items.forEach((item, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 96 + column * (cardWidth + gap);
    const y = 322 + row * (cardHeight + gap);
    const accented = false;
    children.push(
      createCanvasRect(
        `${prefix}-metric-${index}-card`,
        `指标 ${index + 1} 底板`,
        { x, y, width: cardWidth, height: cardHeight },
        accented ? colors.primary : colors.surface,
        { cornerRadius, stroke: colors.border, strokeWidth: accented ? 0 : 1 },
      ),
      createCanvasText(
        `${prefix}-metric-${index}-value`,
        `指标 ${index + 1} 数值`,
        item.value,
        { x: x + 34, y: y + 38, width: cardWidth - 68, height: rows === 1 ? 130 : 80 },
        {
          fill: accented ? colors.primaryForeground : colors.primary,
          fontFamily: fonts.heading,
          fontSize: fitFontSize(item.value, rows === 1 ? 72 : 50, 36, 12),
          fontWeight: "800",
          lineHeight: 1,
        },
      ),
      createCanvasText(
        `${prefix}-metric-${index}-label`,
        `指标 ${index + 1} 标签`,
        item.label,
        {
          x: x + 36,
          y: y + (rows === 1 ? 186 : 116),
          width: cardWidth - 72,
          height: 54,
        },
        {
          fill: accented ? colors.primaryForeground : colors.surfaceForeground,
          fontFamily: fonts.heading,
          fontSize: 27,
          fontWeight: "700",
          lineHeight: 1.2,
        },
      ),
      createCanvasText(
        `${prefix}-metric-${index}-context`,
        `指标 ${index + 1} 说明`,
        item.context ?? "",
        {
          x: x + 36,
          y: y + (rows === 1 ? 258 : 166),
          width: cardWidth - 72,
          height: rows === 1 ? 80 : 40,
        },
        {
          fill: accented ? colors.primaryForeground : colors.muted,
          fontFamily: fonts.body,
          fontSize: 20,
          lineHeight: 1.35,
          opacity: accented ? 0.82 : 1,
        },
      ),
    );
  });
  return createCanvasGroup(
    prefix,
    `${String(slide.index).padStart(2, "0")} ${slide.title}`,
    children,
  );
}

function renderQuoteSlide(slide: PptSlide, context: RenderContext): GroupElement {
  const prefix = getSlidePrefix(context, slide);
  const { colors, fonts } = context.theme;
  const quote = slide.contentBlocks.find(
    (block): block is Extract<PptContentBlock, { type: "quote" }> => block.type === "quote",
  );
  if (!quote) return renderGenericSlide(slide, context);

  const children = [
    ...renderBackground(prefix, context.theme),
    ...renderContentHeader(slide, context, prefix),
    createCanvasText(
      `${prefix}-quote-mark`,
      "引用符号",
      "“",
      { x: 100, y: 284, width: 180, height: 180 },
      {
        fill: colors.accent,
        fontFamily: fonts.heading,
        fontSize: 160,
        fontWeight: "800",
        lineHeight: 1,
      },
    ),
    createCanvasText(
      `${prefix}-quote`,
      "引用内容",
      quote.quote,
      { x: 230, y: 348, width: 1110, height: 280 },
      {
        fill: colors.foreground,
        fontFamily: fonts.heading,
        fontSize: fitFontSize(quote.quote, 52, 34, 75),
        fontWeight: "700",
        lineHeight: 1.4,
      },
    ),
    createCanvasText(
      `${prefix}-attribution`,
      "引用来源",
      quote.attribution ? `—— ${quote.attribution}` : "",
      { x: 238, y: 682, width: 900, height: 54 },
      {
        fill: colors.muted,
        fontFamily: fonts.body,
        fontSize: 24,
        fontWeight: "500",
        lineHeight: 1,
      },
    ),
  ];
  return createCanvasGroup(
    prefix,
    `${String(slide.index).padStart(2, "0")} ${slide.title}`,
    children,
  );
}

function getTableStyles(
  context: RenderContext,
): Pick<ReturnType<typeof createCanvasTable>, "headerStyle" | "cellStyle"> {
  const { colors, fonts } = context.theme;
  const compact = context.plan.density === "compact";
  const minimal = context.plan.tableStyle === "minimal";
  const soft = context.plan.tableStyle === "soft";
  const headerFill = minimal ? colors.background : soft ? colors.surface : colors.primary;
  const headerColor = minimal
    ? colors.foreground
    : soft
      ? colors.surfaceForeground
      : colors.primaryForeground;
  const shared = {
    align: "left" as const,
    borderColor: colors.border,
    borderWidth: minimal ? 0.5 : 1,
    fontFamily: fonts.body,
    valign: "middle" as const,
  };
  const headerStyle: TableCellStyle = {
    ...shared,
    color: headerColor,
    fill: headerFill,
    fontSize: compact ? 18 : 21,
    fontWeight: "700",
  };
  const cellStyle: TableCellStyle = {
    ...shared,
    color: colors.surfaceForeground,
    fill: colors.surface,
    fontSize: compact ? 17 : 20,
    fontWeight: "400",
  };
  return { cellStyle, headerStyle };
}

function renderTableSlide(slide: PptSlide, context: RenderContext): GroupElement {
  const prefix = getSlidePrefix(context, slide);
  const table = slide.contentBlocks.find(
    (block): block is Extract<PptContentBlock, { type: "table" }> => block.type === "table",
  );
  if (!table) return renderGenericSlide(slide, context);
  const rowHeight = Math.min(74, 430 / Math.max(table.rows.length, 1));
  const columnWidth = 1400 / table.columns.length;
  const styles = getTableStyles(context);
  const children = [
    ...renderBackground(prefix, context.theme),
    ...renderContentHeader(slide, context, prefix),
    createCanvasTable(
      `${prefix}-table`,
      "数据表格",
      { x: 100, y: 326, width: 1400, height: Math.min(470, rowHeight * (table.rows.length + 1)) },
      table.columns.map((name, index) => ({
        id: `column-${index + 1}`,
        name,
        width: columnWidth,
      })),
      table.rows.map((cells, rowIndex) => ({
        cells: Object.fromEntries(
          cells.map((cell, columnIndex) => [`column-${columnIndex + 1}`, cell]),
        ),
        height: rowHeight,
        id: `row-${rowIndex + 1}`,
      })),
      styles.headerStyle,
      styles.cellStyle,
    ),
  ];
  return createCanvasGroup(
    prefix,
    `${String(slide.index).padStart(2, "0")} ${slide.title}`,
    children,
  );
}

function renderGenericBlock(
  block: PptContentBlock,
  blockIndex: number,
  frame: Frame,
  slide: PptSlide,
  context: RenderContext,
): CanvasElement[] {
  const prefix = `${getSlidePrefix(context, slide)}-block-${blockIndex}`;
  const { colors, fonts, cornerRadius } = context.theme;
  const accented = blockIndex === context.plan.accentBlockIndex;
  const useCard =
    frame.height >= 80 && (context.plan.layoutVariant === "content-cards" || accented);
  const elements: CanvasElement[] = [];
  const innerFrame = useCard
    ? {
        x: frame.x + 32,
        y: frame.y + 24,
        width: frame.width - 64,
        height: frame.height - 48,
      }
    : frame;

  if (useCard) {
    elements.push(
      createCanvasRect(
        `${prefix}-surface`,
        `内容块 ${blockIndex + 1} 底板`,
        frame,
        accented ? colors.primary : colors.surface,
        { cornerRadius, stroke: colors.border, strokeWidth: accented ? 0 : 1 },
      ),
    );
  }

  elements.push(
    createCanvasText(
      `${prefix}-content`,
      `内容块 ${blockIndex + 1}`,
      blockToText(block),
      innerFrame,
      {
        fill: accented ? colors.primaryForeground : colors.foreground,
        fontFamily: block.type === "quote" ? fonts.heading : fonts.body,
        fontSize: fitFontSize(
          blockToText(block),
          context.plan.density === "spacious" ? 30 : 26,
          18,
          Math.max(80, Math.round((innerFrame.width * innerFrame.height) / 6_500)),
        ),
        fontWeight: block.type === "quote" ? "700" : "400",
        lineHeight: block.type === "paragraph" ? 1.5 : 1.42,
      },
    ),
  );
  return elements;
}

function renderGenericSlide(slide: PptSlide, context: RenderContext): GroupElement {
  const prefix = getSlidePrefix(context, slide);
  const { colors, fonts } = context.theme;
  const children = [
    ...renderBackground(prefix, context.theme),
    ...renderContentHeader(slide, context, prefix),
  ];
  const centered =
    context.plan.rhythm === "breathing" ||
    context.plan.composition === "centered-statement" ||
    context.plan.layoutVariant === "hero-number";
  const asymmetric =
    context.plan.composition === "asymmetric-split" ||
    context.plan.layoutVariant === "content-asymmetric" ||
    context.plan.primaryVisual === "mixed";
  const grid =
    context.plan.composition === "modular-grid" ||
    context.plan.layoutVariant === "matrix-2x2" ||
    context.plan.rhythm === "dense";

  if (centered) {
    children.push(
      createCanvasText(
        `${prefix}-statement-focus`,
        "页面视觉钩子",
        context.plan.visualFocus,
        { x: 220, y: 328, width: 1160, height: 152 },
        {
          align: "center",
          fill: colors.accent,
          fontFamily: fonts.heading,
          fontSize: fitFontSize(context.plan.visualFocus, 64, 42, 30),
          fontWeight: "800",
          lineHeight: 1.15,
        },
      ),
      createCanvasText(
        `${prefix}-statement-content`,
        "页面核心内容",
        slide.contentBlocks.map(blockToText).join("\n"),
        { x: 290, y: 540, width: 1020, height: 220 },
        {
          align: "center",
          fill: colors.foreground,
          fontFamily: fonts.body,
          fontSize: fitFontSize(slide.contentBlocks.map(blockToText).join(""), 30, 22, 110),
          lineHeight: 1.5,
        },
      ),
    );
  } else if (asymmetric) {
    const [primaryBlock, ...secondaryBlocks] = slide.contentBlocks;
    children.push(
      createCanvasRect(
        `${prefix}-asymmetric-rail`,
        "非对称布局强调栏",
        { x: 1040, y: 318, width: 460, height: 470 },
        colors.surface,
        {
          cornerRadius: context.theme.cornerRadius,
          stroke: colors.border,
          strokeWidth: 1,
        },
      ),
      createCanvasText(
        `${prefix}-asymmetric-focus`,
        "非对称布局视觉钩子",
        context.plan.visualFocus,
        { x: 1080, y: 354, width: 380, height: 108 },
        {
          fill: colors.primary,
          fontFamily: fonts.heading,
          fontSize: fitFontSize(context.plan.visualFocus, 38, 28, 32),
          fontWeight: "800",
          lineHeight: 1.25,
        },
      ),
      ...renderGenericBlock(
        primaryBlock,
        0,
        { x: 96, y: 318, width: 900, height: 470 },
        slide,
        context,
      ),
    );
    const gap = 16;
    const secondaryHeight =
      secondaryBlocks.length > 0
        ? (260 - gap * Math.max(0, secondaryBlocks.length - 1)) / secondaryBlocks.length
        : 0;
    secondaryBlocks.forEach((block, index) => {
      children.push(
        ...renderGenericBlock(
          block,
          index + 1,
          {
            x: 1080,
            y: 500 + index * (secondaryHeight + gap),
            width: 380,
            height: secondaryHeight,
          },
          slide,
          context,
        ),
      );
    });
  } else if (grid) {
    const columns = slide.contentBlocks.length === 1 ? 1 : 2;
    const rows = Math.ceil(slide.contentBlocks.length / columns);
    const gap = 22;
    const blockWidth = (1404 - gap * (columns - 1)) / columns;
    const blockHeight = (470 - gap * Math.max(0, rows - 1)) / rows;
    slide.contentBlocks.forEach((block, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      children.push(
        ...renderGenericBlock(
          block,
          index,
          {
            x: 96 + column * (blockWidth + gap),
            y: 318 + row * (blockHeight + gap),
            width: blockWidth,
            height: blockHeight,
          },
          slide,
          context,
        ),
      );
    });
  } else {
    const gap = 20;
    const blockHeight =
      (470 - gap * Math.max(0, slide.contentBlocks.length - 1)) / slide.contentBlocks.length;
    slide.contentBlocks.forEach((block, index) => {
      const y = 318 + index * (blockHeight + gap);
      children.push(
        createCanvasText(
          `${prefix}-editorial-index-${index}`,
          `内容块 ${index + 1} 编号`,
          String(index + 1).padStart(2, "0"),
          { x: 96, y: y + 12, width: 100, height: 46 },
          {
            fill: colors.accent,
            fontFamily: "inter",
            fontSize: 24,
            fontWeight: "800",
            lineHeight: 1,
          },
        ),
        ...renderGenericBlock(
          block,
          index,
          {
            x: 220,
            y,
            width: 1280,
            height: blockHeight,
          },
          slide,
          context,
        ),
      );
    });
  }
  return createCanvasGroup(
    prefix,
    `${String(slide.index).padStart(2, "0")} ${slide.title}`,
    children,
  );
}

function renderClosingSlide(slide: PptSlide, context: RenderContext): GroupElement {
  const prefix = getSlidePrefix(context, slide);
  const { colors, fonts } = context.theme;
  const content = slide.contentBlocks.map(blockToText).join("\n");
  const children = [
    ...renderBackground(prefix, context.theme, colors.primary),
    createCanvasRect(
      `${prefix}-accent`,
      "结束页强调线",
      { x: 100, y: 154, width: 12, height: 500 },
      colors.accent,
      { cornerRadius: 6 },
    ),
    createCanvasText(
      `${prefix}-title`,
      "结束页标题",
      slide.title,
      { x: 150, y: 190, width: 1180, height: 190 },
      {
        fill: colors.primaryForeground,
        fontFamily: fonts.heading,
        fontSize: fitFontSize(slide.title, 76, 48, 32),
        fontWeight: "800",
        lineHeight: 1.16,
      },
    ),
    createCanvasText(
      `${prefix}-message`,
      "结束页核心信息",
      slide.coreMessage,
      { x: 154, y: 430, width: 1030, height: 120 },
      {
        fill: colors.primaryForeground,
        fontFamily: fonts.body,
        fontSize: 31,
        lineHeight: 1.45,
        opacity: 0.84,
      },
    ),
    createCanvasText(
      `${prefix}-content`,
      "结束页行动项",
      content,
      { x: 154, y: 620, width: 1040, height: 150 },
      {
        fill: colors.primaryForeground,
        fontFamily: fonts.body,
        fontSize: 24,
        fontWeight: "600",
        lineHeight: 1.5,
      },
    ),
    createCanvasText(
      `${prefix}-focus`,
      "结束页视觉钩子",
      context.plan.visualFocus,
      { x: 1210, y: 700, width: 280, height: 70 },
      {
        align: "right",
        fill: colors.accent,
        fontFamily: fonts.heading,
        fontSize: 22,
        fontWeight: "800",
        lineHeight: 1.2,
      },
    ),
  ];
  return createCanvasGroup(
    prefix,
    `${String(slide.index).padStart(2, "0")} ${slide.title}`,
    children,
  );
}

function renderSlide(slide: PptSlide, context: RenderContext): GroupElement {
  if (slide.role === "cover") return renderCoverSlide(slide, context);
  if (slide.role === "section") return renderSectionSlide(slide, context);
  if (slide.role === "agenda") return renderAgendaSlide(slide, context);
  if (slide.role === "closing" || slide.role === "summary") {
    return renderClosingSlide(slide, context);
  }
  if (slide.contentBlocks.some((block) => block.type === "chart")) {
    return renderChartSlide(slide, context);
  }
  if (slide.contentBlocks.some((block) => block.type === "diagram")) {
    return renderDiagramSlide(slide, context);
  }
  if (slide.contentBlocks.some((block) => block.type === "table")) {
    return renderTableSlide(slide, context);
  }
  if (slide.contentBlocks.some((block) => block.type === "comparison")) {
    return renderComparisonSlide(slide, context);
  }
  if (
    slide.contentBlocks.some(
      (block) => block.type === "process" || block.type === "numbered-list",
    ) &&
    (slide.layoutIntent === "process" || slide.layoutIntent === "timeline")
  ) {
    return renderProcessSlide(slide, context);
  }
  if (slide.contentBlocks.some((block) => block.type === "metrics")) {
    return renderMetricsSlide(slide, context);
  }
  if (slide.contentBlocks.some((block) => block.type === "quote")) {
    return renderQuoteSlide(slide, context);
  }
  return renderGenericSlide(slide, context);
}

function isLeafElement(element: CanvasElement): element is CanvasLeafElement {
  return element.type !== "group";
}

export function getCanvasDocumentIssues(document: CanvasDocument): string[] {
  const issues: string[] = [];
  if (document.documentType !== "pptx") issues.push("画布文档类型必须是 PPT");
  if (document.width !== AI_PPT_SLIDE_WIDTH || document.height !== AI_PPT_SLIDE_HEIGHT) {
    issues.push("画布尺寸必须是 1600 × 900");
  }
  const ids = new Set<string>();

  function inspectElement(element: CanvasElement, pageId: string) {
    if (ids.has(element.id)) issues.push(`画布元素编号重复：${element.id}`);
    ids.add(element.id);
    if (element.type === "group") {
      if (element.children.length === 0) issues.push(`页面 ${pageId} 没有内容`);
      element.children.forEach((child) => inspectElement(child, pageId));
      return;
    }

    const values = [
      element.x,
      element.y,
      element.width,
      element.height,
      element.rotation,
      element.opacity,
    ];
    if (!values.every(Number.isFinite)) issues.push(`元素 ${element.id} 包含无效数值`);
    if (element.width < 0 || element.height < 0) issues.push(`元素 ${element.id} 的尺寸无效`);
    if (
      element.x < 0 ||
      element.y < 0 ||
      element.x + element.width > document.width + 1 ||
      element.y + element.height > document.height + 1
    ) {
      issues.push(`元素 ${element.id} 超出页面边界`);
    }
  }

  document.elements.forEach((element) => {
    if (element.type !== "group") {
      issues.push("PPT 顶层元素必须全部是页面分组");
      return;
    }
    const hasFullBackground = element.children.some(
      (child) =>
        isLeafElement(child) &&
        child.type === "rect" &&
        child.x === 0 &&
        child.y === 0 &&
        child.width === document.width &&
        child.height === document.height,
    );
    if (!hasFullBackground) issues.push(`页面 ${element.id} 缺少全尺寸背景`);
    inspectElement(element, element.id);
  });
  return issues;
}

export function renderPptStructureToCanvas(
  structure: PptStructureV1,
  visualPlan: PptVisualPlanV1,
  documentId: string,
): CanvasDocument {
  const planIssues = getPptVisualPlanStructureIssues(visualPlan, structure);
  if (planIssues.length > 0) throw new CanvasRenderError(planIssues);

  const theme = resolveCanvasTheme(visualPlan.theme);
  const planBySlideId = new Map(visualPlan.slides.map((slide) => [slide.slideId, slide]));
  const sectionTitleById = new Map(
    structure.sections.map((section) => [section.id, section.title]),
  );
  const document: CanvasDocument = {
    description: structure.deck.coreMessage,
    documentType: "pptx",
    elements: structure.slides.map((slide) => {
      const plan = planBySlideId.get(slide.id);
      if (!plan) throw new CanvasRenderError([`缺少 ${slide.id} 的视觉方案`]);
      return renderSlide(slide, {
        documentId,
        pageCount: structure.slides.length,
        plan,
        sectionTitle: sectionTitleById.get(slide.sectionId) ?? slide.sectionId,
        structure,
        theme,
      });
    }),
    height: AI_PPT_SLIDE_HEIGHT,
    id: documentId,
    name: structure.deck.title,
    width: AI_PPT_SLIDE_WIDTH,
  };

  const issues = getCanvasDocumentIssues(document);
  if (issues.length > 0) throw new CanvasRenderError(issues);
  return document;
}
