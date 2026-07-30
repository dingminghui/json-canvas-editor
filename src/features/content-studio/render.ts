import type {
  CanvasDocument,
  CanvasElement,
  GroupElement,
  RectElement,
  TableCellStyle,
} from "@/editor/types";
import {
  createCanvasArrow,
  createCanvasChart,
  createCanvasGroup,
  createCanvasImage,
  createCanvasRect,
  createCanvasTable,
  createCanvasText,
} from "@/features/ai-ppt/render/canvas-factories";

import {
  RECIPE_REGISTRY,
  getRecipe,
  getRecipeCapacityIssues,
  type LayoutRecipe,
  type RecipeUsage,
} from "./recipes";
import {
  getOutputStructureIssues,
  getVisualPlanIssues,
  type ContentBlock,
  type ContentDocumentV1,
  type LongformRecipeId,
  type OutputStructureV1,
  type PresentationRecipeId,
  type VisualAssetRecord,
  type VisualPlanV1,
} from "./schema";
import { getStylePack, type StylePack } from "./style-packs";

export const CONTENT_CANVAS_RENDERER_VERSION = "content-canvas/v1";
export const PPT_WIDTH = 1600;
export const PPT_HEIGHT = 900;
export const LONGFORM_WIDTH = 1080;
export const LONGFORM_MAX_HEIGHT = 12_000;

interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RenderContext {
  documentId: string;
  style: StylePack;
  assetsById: Map<string, VisualAssetRecord>;
}

export class ContentCanvasRenderError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join("\n"));
    this.name = "ContentCanvasRenderError";
  }
}

const fontFamilyFor = (style: StylePack, role: "display" | "body" | "mono") => {
  if (role === "mono") return "jetbrains-mono" as const;
  if (style.id === "warm-editorial" || style.id === "data-journalism") {
    return role === "display" ? ("noto-serif-sc" as const) : ("noto-sans-sc" as const);
  }
  return "noto-sans-sc" as const;
};

const flattenBlocks = (document: ContentDocumentV1) =>
  new Map(document.sections.flatMap((section) => section.blocks.map((block) => [block.id, block])));

const blockText = (block: ContentBlock): string => {
  switch (block.type) {
    case "paragraph":
      return block.text;
    case "bullet-list":
    case "numbered-list":
      return block.items.join(" ");
    case "comparison":
      return `${block.left.heading} ${block.left.items.join(" ")} ${block.right.heading} ${block.right.items.join(" ")}`;
    case "process":
      return block.steps.map((step) => `${step.title} ${step.description ?? ""}`).join(" ");
    case "metrics":
      return block.items.map((item) => `${item.value} ${item.label} ${item.context ?? ""}`).join(" ");
    case "quote":
      return `${block.quote} ${block.attribution ?? ""}`;
    case "table":
      return `${block.columns.join(" ")} ${block.rows.flat().join(" ")}`;
    case "chart":
      return `${block.takeaway} ${block.categories.join(" ")} ${block.series.map((series) => series.name).join(" ")}`;
    case "diagram":
      return block.nodes.map((node) => `${node.label} ${node.description ?? ""}`).join(" ");
  }
};

const blockItemCount = (block: ContentBlock): number => {
  switch (block.type) {
    case "bullet-list":
    case "numbered-list":
      return block.items.length;
    case "comparison":
      return block.left.items.length + block.right.items.length;
    case "process":
      return block.steps.length;
    case "metrics":
      return block.items.length;
    case "table":
      return block.rows.length * block.columns.length;
    case "chart":
      return block.categories.length;
    case "diagram":
      return block.nodes.length;
    default:
      return 1;
  }
};

const addBackgroundMotif = (
  elements: CanvasElement[],
  frame: Frame,
  style: StylePack,
  id: string,
) => {
  const motif = style.backgroundMotif;
  if (motif === "grid") {
    for (let x = frame.x; x <= frame.x + frame.width; x += 80) {
      elements.push(
        createCanvasRect(
          `${id}-grid-v-${x}`,
          "背景网格",
          { x, y: frame.y, width: 1, height: frame.height },
          style.colors.line,
          { opacity: 0.32, locked: true },
        ),
      );
    }
    for (let y = frame.y; y <= frame.y + frame.height; y += 80) {
      elements.push(
        createCanvasRect(
          `${id}-grid-h-${y}`,
          "背景网格",
          { x: frame.x, y, width: frame.width, height: 1 },
          style.colors.line,
          { opacity: 0.32, locked: true },
        ),
      );
    }
  } else if (motif === "rules") {
    elements.push(
      createCanvasRect(
        `${id}-rule`,
        "编辑标尺",
        { x: frame.x + 72, y: frame.y + 44, width: frame.width - 144, height: 3 },
        style.colors.accent,
        { locked: true },
      ),
    );
  } else if (motif === "bands") {
    elements.push(
      createCanvasRect(
        `${id}-band`,
        "品牌色带",
        { x: frame.x, y: frame.y, width: 18, height: frame.height },
        style.colors.primary,
        { locked: true },
      ),
    );
  } else if (motif === "halo") {
    elements.push(
      createCanvasRect(
        `${id}-halo`,
        "暖色底纹",
        {
          x: frame.x + frame.width * 0.64,
          y: frame.y + 40,
          width: frame.width * 0.3,
          height: frame.height - 80,
        },
        style.colors.secondary,
        { cornerRadius: style.shape.radius * 4, locked: true, opacity: 0.34 },
      ),
    );
  } else if (motif === "registration") {
    elements.push(
      createCanvasText(
        `${id}-reg`,
        "套准标记",
        "＋  01  /  STUDIO",
        { x: frame.x + frame.width - 260, y: frame.y + 32, width: 210, height: 30 },
        {
          align: "right",
          fill: style.colors.text,
          fontFamily: fontFamilyFor(style, "mono"),
          fontSize: 15,
          fontWeight: "700",
          locked: true,
        },
      ),
    );
  }
};

const card = (
  id: string,
  frame: Frame,
  style: StylePack,
  fill = style.colors.surface,
): RectElement =>
  createCanvasRect(id, "内容卡片", frame, fill, {
    cornerRadius: style.shape.radius,
    shadow: style.shape.shadow,
    stroke: style.colors.line,
    strokeWidth: style.shape.borderWidth,
  });

const renderTextBlock = (
  block: Extract<ContentBlock, { type: "paragraph" | "bullet-list" | "numbered-list" | "quote" }>,
  frame: Frame,
  style: StylePack,
): CanvasElement[] => {
  const isQuote = block.type === "quote";
  const value =
    block.type === "paragraph"
      ? block.text
      : block.type === "quote"
        ? `“${block.quote}”${block.attribution ? `\n— ${block.attribution}` : ""}`
        : block.items
            .map((item, index) => `${block.type === "numbered-list" ? `${index + 1}.` : "•"} ${item}`)
            .join("\n");
  return [
    ...(isQuote ? [card(`${block.id}-quote-card`, frame, style, style.colors.surfaceMuted)] : []),
    createCanvasText(block.id, block.type, value, isQuote ? inset(frame, 30) : frame, {
      fill: style.colors.text,
      fontFamily: fontFamilyFor(style, isQuote ? "display" : "body"),
      fontSize: isQuote ? style.typeScale.heading : style.typeScale.body,
      fontWeight: isQuote ? "600" : "400",
      lineHeight: isQuote ? 1.3 : 1.45,
    }),
  ];
};

const inset = (frame: Frame, amount: number): Frame => ({
  x: frame.x + amount,
  y: frame.y + amount,
  width: Math.max(1, frame.width - amount * 2),
  height: Math.max(1, frame.height - amount * 2),
});

const splitFrames = (frame: Frame, count: number, gap = 22): Frame[] => {
  const columns = count <= 3 ? count : Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const width = (frame.width - gap * (columns - 1)) / columns;
  const height = (frame.height - gap * (rows - 1)) / rows;
  return Array.from({ length: count }, (_, index) => ({
    x: frame.x + (index % columns) * (width + gap),
    y: frame.y + Math.floor(index / columns) * (height + gap),
    width,
    height,
  }));
};

const renderBlock = (
  block: ContentBlock,
  frame: Frame,
  style: StylePack,
): CanvasElement[] => {
  switch (block.type) {
    case "paragraph":
    case "bullet-list":
    case "numbered-list":
    case "quote":
      return renderTextBlock(block, frame, style);
    case "metrics":
      return splitFrames(frame, block.items.length).flatMap((metricFrame, index) => {
        const metric = block.items[index];
        return [
          card(`${block.id}-metric-card-${index}`, metricFrame, style),
          createCanvasText(
            `${block.id}-metric-value-${index}`,
            "指标值",
            metric.value,
            { x: metricFrame.x + 24, y: metricFrame.y + 18, width: metricFrame.width - 48, height: 70 },
            {
              fill: style.colors.primary,
              fontFamily: fontFamilyFor(style, "display"),
              fontSize: Math.min(style.typeScale.title, metricFrame.height * 0.34),
              fontWeight: "700",
            },
          ),
          createCanvasText(
            `${block.id}-metric-label-${index}`,
            "指标标签",
            `${metric.label}${metric.context ? `\n${metric.context}` : ""}`,
            { x: metricFrame.x + 24, y: metricFrame.y + 92, width: metricFrame.width - 48, height: metricFrame.height - 110 },
            {
              fill: style.colors.text,
              fontFamily: fontFamilyFor(style, "body"),
              fontSize: Math.min(style.typeScale.body, 20),
              fontWeight: "500",
            },
          ),
        ];
      });
    case "comparison": {
      const halves = splitFrames(frame, 2, 28);
      return [block.left, block.right].flatMap((side, index) => [
        card(
          `${block.id}-comparison-card-${index}`,
          halves[index],
          style,
          index === 0 ? style.colors.surface : style.colors.surfaceMuted,
        ),
        createCanvasText(
          `${block.id}-comparison-heading-${index}`,
          "对比标题",
          side.heading,
          { x: halves[index].x + 28, y: halves[index].y + 24, width: halves[index].width - 56, height: 54 },
          {
            fill: index === 0 ? style.colors.primary : style.colors.accent,
            fontFamily: fontFamilyFor(style, "display"),
            fontSize: style.typeScale.heading,
            fontWeight: "700",
          },
        ),
        createCanvasText(
          `${block.id}-comparison-items-${index}`,
          "对比内容",
          side.items.map((item) => `• ${item}`).join("\n"),
          { x: halves[index].x + 28, y: halves[index].y + 92, width: halves[index].width - 56, height: halves[index].height - 116 },
          {
            fill: style.colors.text,
            fontFamily: fontFamilyFor(style, "body"),
            fontSize: style.typeScale.body,
          },
        ),
      ]);
    }
    case "process": {
      const frames = splitFrames(frame, block.steps.length, 18);
      return block.steps.flatMap((step, index) => [
        card(`${block.id}-step-card-${index}`, frames[index], style),
        createCanvasText(
          `${block.id}-step-number-${index}`,
          "步骤编号",
          String(index + 1).padStart(2, "0"),
          { x: frames[index].x + 20, y: frames[index].y + 18, width: 64, height: 40 },
          {
            fill: style.colors.accent,
            fontFamily: fontFamilyFor(style, "mono"),
            fontSize: 20,
            fontWeight: "700",
          },
        ),
        createCanvasText(
          `${block.id}-step-copy-${index}`,
          "步骤内容",
          `${step.title}${step.description ? `\n${step.description}` : ""}`,
          { x: frames[index].x + 20, y: frames[index].y + 68, width: frames[index].width - 40, height: frames[index].height - 88 },
          {
            fill: style.colors.text,
            fontFamily: fontFamilyFor(style, "body"),
            fontSize: Math.min(style.typeScale.body, 20),
            fontWeight: "600",
          },
        ),
      ]);
    }
    case "chart":
      return [
        createCanvasChart(
          block.id,
          "原生图表",
          frame,
          block.relationship === "trend"
            ? "line"
            : block.relationship === "part-to-whole"
              ? "pie"
              : "bar",
          block.series.map((series) => ({
            name: series.name,
            labels: block.categories,
            values: series.values,
          })),
          style.chart.palette,
          { showLegend: block.series.length > 1, showValue: true, title: block.takeaway },
        ),
      ];
    case "table": {
      const columnWidth = frame.width / block.columns.length;
      const headerStyle: TableCellStyle = {
        fill: style.colors.primary,
        color: style.colors.canvas,
        fontFamily: fontFamilyFor(style, "body"),
        fontSize: 16,
        fontWeight: "700",
        align: "left",
        valign: "middle",
        borderColor: style.colors.line,
        borderWidth: style.shape.borderWidth,
      };
      return [
        createCanvasTable(
          block.id,
          "原生表格",
          frame,
          block.columns.map((name, index) => ({
            id: `c${index}`,
            name,
            width: columnWidth,
          })),
          block.rows.map((row, rowIndex) => ({
            id: `r${rowIndex}`,
            height: Math.max(36, frame.height / (block.rows.length + 1)),
            cells: Object.fromEntries(row.map((value, index) => [`c${index}`, value])),
          })),
          headerStyle,
          {
            ...headerStyle,
            fill: style.colors.surface,
            color: style.colors.text,
            fontWeight: "400",
          },
        ),
      ];
    }
    case "diagram": {
      const frames = splitFrames(frame, block.nodes.length, 28);
      const indexById = new Map(block.nodes.map((node, index) => [node.id, index]));
      return [
        ...block.edges.flatMap((edge, edgeIndex) => {
          const from = frames[indexById.get(edge.from) ?? -1];
          const to = frames[indexById.get(edge.to) ?? -1];
          if (!from || !to) return [];
          return [
            createCanvasArrow(
              `${block.id}-edge-${edgeIndex}`,
              edge.label ? `关系：${edge.label}` : "关系",
              {
                x: from.x + from.width / 2,
                y: from.y + from.height / 2,
                width: to.x + to.width / 2 - (from.x + from.width / 2),
                height: to.y + to.height / 2 - (from.y + from.height / 2),
              },
              style.diagram.edgeColor,
            ),
          ];
        }),
        ...block.nodes.flatMap((node, index) => [
          card(
            `${block.id}-node-card-${index}`,
            frames[index],
            style,
            index === 0 ? style.diagram.emphasisFill : style.diagram.nodeFill,
          ),
          createCanvasText(
            `${block.id}-node-copy-${index}`,
            "关系节点",
            `${node.label}${node.description ? `\n${node.description}` : ""}`,
            inset(frames[index], 20),
            {
              align: "center",
              fill: style.colors.text,
              fontFamily: fontFamilyFor(style, "body"),
              fontSize: Math.min(style.typeScale.body, 19),
              fontWeight: "600",
            },
          ),
        ]),
      ];
    }
  }
};

const renderAsset = (
  outputNodeId: string,
  assetId: string,
  frame: Frame,
  placement: "full-bleed" | "left" | "right" | "inset",
  focalPointX: number,
  focalPointY: number,
  context: RenderContext,
): CanvasElement[] => {
  const asset = context.assetsById.get(assetId);
  if (!asset) return [];
  const credit =
    asset.provider === "pexels" && asset.photographer
      ? `Photo: ${asset.photographer} / Pexels`
      : `Image: ${asset.name}`;
  const creditFrame = {
    x: frame.x + 24,
    y: frame.y + frame.height - 48,
    width: frame.width - 48,
    height: 24,
  };
  return [
    createCanvasImage(
      `${outputNodeId}-asset`,
      `视觉素材 · ${placement}`,
      `asset://${asset.id}`,
      frame,
      {
        cornerRadius: context.style.image.radius,
        fit: "cover",
        focalPointX,
        focalPointY,
      },
    ),
    ...(context.style.image.overlayOpacity > 0
      ? [
          createCanvasRect(
            `${outputNodeId}-asset-overlay`,
            "图片叠层",
            frame,
            context.style.image.overlayColor,
            {
              cornerRadius: context.style.image.radius,
              opacity: context.style.image.overlayOpacity,
            },
          ),
        ]
      : []),
    createCanvasRect(
      `${outputNodeId}-asset-credit-background`,
      "图片署名底板",
      creditFrame,
      context.style.colors.surface,
      { cornerRadius: Math.min(6, context.style.shape.radius), opacity: 0.82 },
    ),
    createCanvasText(
      `${outputNodeId}-asset-credit`,
      "图片署名",
      credit,
      creditFrame,
      {
        align: "right",
        fill: context.style.colors.textMuted,
        fontFamily: fontFamilyFor(context.style, "body"),
        fontSize: 11,
        fontWeight: "500",
      },
    ),
  ];
};

const renderPptPage = ({
  node,
  plan,
  blocks,
  context,
  pageIndex,
  pageCount,
}: {
  node: Extract<OutputStructureV1, { outputType: "pptx" }>["pages"][number];
  plan: Extract<VisualPlanV1, { outputType: "pptx" }>["items"][number];
  blocks: ContentBlock[];
  context: RenderContext;
  pageIndex: number;
  pageCount: number;
}): GroupElement => {
  const style = context.style;
  const children: CanvasElement[] = [
    createCanvasRect(
      `${node.id}-background`,
      "页面背景",
      { x: 0, y: 0, width: PPT_WIDTH, height: PPT_HEIGHT },
      style.colors.canvas,
      { locked: true },
    ),
  ];
  addBackgroundMotif(children, { x: 0, y: 0, width: PPT_WIDTH, height: PPT_HEIGHT }, style, node.id);

  const isCover = node.role === "cover";
  const mediaFrame =
    plan.mediaPlacement === "full-bleed"
      ? { x: 0, y: 0, width: PPT_WIDTH, height: PPT_HEIGHT }
      : plan.mediaPlacement === "left"
        ? { x: 72, y: 170, width: 610, height: 610 }
        : plan.mediaPlacement === "right"
          ? { x: 918, y: 170, width: 610, height: 610 }
          : { x: 1050, y: 520, width: 430, height: 250 };
  if (plan.assetId && plan.mediaPlacement !== "none") {
    children.push(
      ...renderAsset(
        node.id,
        plan.assetId,
        mediaFrame,
        plan.mediaPlacement,
        plan.focalPointX,
        plan.focalPointY,
        context,
      ),
    );
  }

  const titleFrame =
    isCover && plan.mediaPlacement === "right"
      ? { x: 90, y: 170, width: 730, height: 260 }
      : isCover
        ? { x: 100, y: 230, width: 1300, height: 230 }
        : { x: 80, y: 74, width: 1100, height: 72 };
  children.push(
    createCanvasText(`${node.id}-title`, "页面标题", node.title, titleFrame, {
      fill: style.colors.text,
      fontFamily: fontFamilyFor(style, "display"),
      fontSize: isCover ? style.typeScale.hero : style.typeScale.title,
      fontWeight: "700",
      lineHeight: 1.08,
    }),
    createCanvasText(
      `${node.id}-message`,
      "核心信息",
      node.coreMessage,
      isCover
        ? { x: titleFrame.x, y: titleFrame.y + titleFrame.height + 20, width: titleFrame.width, height: 110 }
        : { x: 82, y: 152, width: 1260, height: 62 },
      {
        fill: isCover ? style.colors.primary : style.colors.textMuted,
        fontFamily: fontFamilyFor(style, "body"),
        fontSize: isCover ? 26 : 18,
        fontWeight: isCover ? "600" : "400",
      },
    ),
  );

  if (blocks.length > 0) {
    let contentFrame: Frame = isCover
      ? plan.mediaPlacement === "right"
        ? { x: 100, y: 600, width: 720, height: 160 }
        : { x: 100, y: 600, width: 1120, height: 160 }
      : { x: 80, y: 240, width: 1440, height: 560 };
    if (plan.assetId && plan.mediaPlacement === "right") contentFrame = { x: 80, y: 240, width: 780, height: 540 };
    if (plan.assetId && plan.mediaPlacement === "left") contentFrame = { x: 740, y: 240, width: 780, height: 540 };
    if (isCover) {
      contentFrame =
        plan.assetId && plan.mediaPlacement === "left"
          ? { x: 740, y: 600, width: 760, height: 160 }
          : plan.assetId && plan.mediaPlacement === "right"
            ? { x: 100, y: 600, width: 720, height: 160 }
            : { x: 100, y: 600, width: 1120, height: 160 };
    }
    const densityInset = plan.density === "spacious" ? 18 : plan.density === "compact" ? 0 : 8;
    contentFrame = inset(contentFrame, densityInset);
    const frames =
      blocks.length === 1
        ? [contentFrame]
        : plan.recipeId === "editorial-flow" || plan.recipeId === "asymmetric-split"
          ? blocks.map((_, index) =>
              index === 0
                ? { x: contentFrame.x, y: contentFrame.y, width: contentFrame.width * 0.58, height: contentFrame.height }
                : {
                    x: contentFrame.x + contentFrame.width * 0.62,
                    y: contentFrame.y + (index - 1) * (contentFrame.height / Math.max(1, blocks.length - 1)),
                    width: contentFrame.width * 0.38,
                    height: contentFrame.height / Math.max(1, blocks.length - 1) - 12,
                  },
            )
          : splitFrames(contentFrame, blocks.length);
    blocks.forEach((block, index) => {
      const frame = frames[index];
      if (block.id === plan.accentBlockId) {
        children.push(
          createCanvasRect(
            `${node.id}-${block.id}-accent`,
            "强调标记",
            { x: frame.x, y: frame.y, width: 7, height: frame.height },
            style.colors.accent,
            { cornerRadius: 3 },
          ),
        );
      }
      children.push(...renderBlock(block, block.id === plan.accentBlockId ? { ...frame, x: frame.x + 18, width: frame.width - 18 } : frame, style));
    });
  }
  children.push(
    createCanvasText(
      `${node.id}-folio`,
      "页码",
      `${String(pageIndex + 1).padStart(2, "0")} / ${String(pageCount).padStart(2, "0")}`,
      { x: 1320, y: 838, width: 200, height: 22 },
      {
        align: "right",
        fill: style.colors.textMuted,
        fontFamily: fontFamilyFor(style, "mono"),
        fontSize: 13,
        fontWeight: "500",
      },
    ),
  );
  return createCanvasGroup(`${context.documentId}-${node.id}`, `页面 ${pageIndex + 1} · ${node.title}`, children);
};

const estimateRegionHeight = (
  blocks: ContentBlock[],
  role: Extract<OutputStructureV1, { outputType: "longform" }>["regions"][number]["role"],
  hasAsset: boolean,
) => {
  if (role === "hero") return hasAsset ? 1100 : 680;
  if (role === "chapter") return 420;
  if (role === "closing") return 500;
  const content = blocks.reduce((sum, block) => {
    if (block.type === "chart" || block.type === "diagram") return sum + 540;
    if (block.type === "table") return sum + 120 + block.rows.length * 56;
    if (block.type === "metrics") return sum + 280;
    if (block.type === "process" || block.type === "comparison") return sum + 420;
    return sum + Math.max(160, Math.ceil(blockText(block).length / 38) * 34);
  }, 0);
  return Math.max(360, 180 + content + (hasAsset ? 380 : 0));
};

const renderLongformRegion = ({
  node,
  plan,
  blocks,
  context,
  y,
  height,
  index,
}: {
  node: Extract<OutputStructureV1, { outputType: "longform" }>["regions"][number];
  plan: Extract<VisualPlanV1, { outputType: "longform" }>["items"][number];
  blocks: ContentBlock[];
  context: RenderContext;
  y: number;
  height: number;
  index: number;
}): CanvasElement[] => {
  const style = context.style;
  const elements: CanvasElement[] = [
    createCanvasRect(
      `${node.id}-background`,
      "区段背景",
      { x: 0, y, width: LONGFORM_WIDTH, height },
      index % 2 === 0 ? style.colors.canvas : style.colors.surface,
      { locked: true },
    ),
  ];
  addBackgroundMotif(elements, { x: 0, y, width: LONGFORM_WIDTH, height }, style, node.id);
  const isHero = node.role === "hero";
  const isChapter = node.role === "chapter";
  elements.push(
    createCanvasText(
      `${node.id}-title`,
      "区段标题",
      node.title,
      {
        x: 72,
        y: y + (isHero ? 100 : 56),
        width: 936,
        height: isHero ? 160 : isChapter ? 92 : 74,
      },
      {
        fill: style.colors.text,
        fontFamily: fontFamilyFor(style, "display"),
        fontSize: isHero ? 66 : isChapter ? 44 : 34,
        fontWeight: "700",
        lineHeight: 1.12,
      },
    ),
    createCanvasText(
      `${node.id}-message`,
      "区段核心信息",
      node.coreMessage,
      { x: 72, y: y + (isHero ? 280 : 138), width: 870, height: isHero ? 110 : 70 },
      {
        fill: style.colors.textMuted,
        fontFamily: fontFamilyFor(style, "body"),
        fontSize: isHero ? 24 : 18,
        fontWeight: isHero ? "500" : "400",
      },
    ),
  );

  let cursorY = y + (isHero ? 410 : isChapter ? 190 : 230);
  let contentX = 72;
  let contentWidth = 936;
  let splitMedia = false;
  if (plan.assetId && plan.mediaPlacement !== "none") {
    splitMedia =
      !isHero &&
      (plan.mediaPlacement === "left" || plan.mediaPlacement === "right") &&
      plan.recipeId === "split-media-section";
    const assetFrame: Frame = {
      x: splitMedia && plan.mediaPlacement === "right" ? 578 : 72,
      y: cursorY,
      width: splitMedia ? 430 : 936,
      height: isHero ? 360 : 330,
    };
    elements.push(
      ...renderAsset(
        node.id,
        plan.assetId,
        assetFrame,
        plan.mediaPlacement,
        plan.focalPointX,
        plan.focalPointY,
        context,
      ),
    );
    if (splitMedia) {
      contentX = plan.mediaPlacement === "left" ? 540 : 72;
      contentWidth = 468;
    } else {
      cursorY += assetFrame.height + 34;
    }
  }
  if (blocks.length > 0) {
    const availableHeight = Math.max(160, y + height - cursorY - 64);
    const densityInset = plan.density === "spacious" ? 16 : plan.density === "compact" ? 0 : 8;
    const frames =
      blocks.length === 1
        ? [inset({ x: contentX, y: cursorY, width: contentWidth, height: availableHeight }, densityInset)]
        : blocks.map((_, blockIndex) => {
            const blockHeight = availableHeight / blocks.length - 18;
            return {
              x: contentX + densityInset,
              y: cursorY + blockIndex * (blockHeight + 18),
              width: contentWidth - densityInset * 2,
              height: blockHeight - densityInset,
            };
          });
    blocks.forEach((block, blockIndex) => {
      const frame = frames[blockIndex];
      if (block.id === plan.accentBlockId) {
        elements.push(
          createCanvasRect(
            `${node.id}-${block.id}-accent`,
            "强调标记",
            { x: frame.x, y: frame.y, width: 7, height: frame.height },
            style.colors.accent,
            { cornerRadius: 3 },
          ),
        );
      }
      elements.push(
        ...renderBlock(
          block,
          block.id === plan.accentBlockId
            ? { ...frame, x: frame.x + 18, width: frame.width - 18 }
            : frame,
          style,
        ),
      );
    });
  }
  return elements;
};

export const getContentCanvasIssues = (document: CanvasDocument): string[] => {
  const issues: string[] = [];
  if (document.documentType === "pptx" && (document.width !== PPT_WIDTH || document.height !== PPT_HEIGHT)) {
    issues.push("PPT Canvas 必须为 1600×900。");
  }
  if (document.documentType === "longform" && document.width !== LONGFORM_WIDTH) {
    issues.push("长图 Canvas 必须为 1080px 宽。");
  }
  if (document.documentType === "longform" && document.height > LONGFORM_MAX_HEIGHT) {
    issues.push(`长图高度 ${document.height}px 超过 12,000px 上限。`);
  }
  const visit = (elements: CanvasElement[]) => {
    for (const element of elements) {
      if (element.type === "group") {
        visit(element.children);
        continue;
      }
      const numbers = [element.x, element.y, element.width, element.height, element.rotation, element.opacity];
      if (numbers.some((value) => !Number.isFinite(value))) {
        issues.push(`${element.id} 含有非有限坐标。`);
      }
      if (element.x < 0 || element.y < 0 || element.x + element.width > document.width + 1) {
        issues.push(`${element.id} 超出画布水平边界。`);
      }
      if (element.y + element.height > document.height + 1) {
        issues.push(`${element.id} 超出画布垂直边界。`);
      }
      if (
        element.type === "text" &&
        (element.x < 24 ||
          element.x + element.width > document.width - 24 ||
          element.y < 24 ||
          element.y + element.height > document.height - 24)
      ) {
        issues.push(`${element.id} 超出文本安全区。`);
      }
    }
  };
  visit(document.elements);
  const visitCredits = (elements: CanvasElement[]) => {
    const flat = elements.flatMap((element) =>
      element.type === "group" ? element.children : [element],
    );
    const ids = new Set(flat.map((element) => element.id));
    for (const element of flat) {
      if (
        element.type === "image" &&
        element.src.startsWith("asset://") &&
        !ids.has(`${element.id}-credit`)
      ) {
        issues.push(`${element.id} 缺少图片署名。`);
      }
      if (element.type === "group") visitCredits(element.children);
    }
  };
  visitCredits(document.elements);
  return issues;
};

export const getSafeLongformPixelRatio = (
  width: number,
  height: number,
  preferred = 2,
): number => Math.max(0.25, Math.min(preferred, 16_384 / Math.max(width, height)));

const getRecipeUsage = (
  blocks: ContentBlock[],
  hasAsset: boolean,
): RecipeUsage => ({
  blockCount: blocks.length,
  characterCount: blocks.reduce(
    (sum, block) => sum + blockText(block).length,
    0,
  ),
  itemCount: blocks.reduce(
    (sum, block) => sum + blockItemCount(block),
    0,
  ),
  imageCount: hasAsset ? 1 : 0,
});

const selectCompatibleRecipe = ({
  outputType,
  role,
  blocks,
  usage,
  currentRecipeId,
  previousRecipeIds,
}: {
  outputType: OutputStructureV1["outputType"];
  role: string;
  blocks: ContentBlock[];
  usage: RecipeUsage;
  currentRecipeId: VisualPlanV1["items"][number]["recipeId"];
  previousRecipeIds: string[];
}): LayoutRecipe => {
  const blockTypes = [...new Set(blocks.map((block) => block.type))];
  const typeCompatible = RECIPE_REGISTRY.filter(
    (recipe) =>
      recipe.outputType === outputType &&
      blockTypes.every((blockType) => recipe.blockTypes.includes(blockType)),
  );
  const capacityCompatible = typeCompatible.filter(
    (recipe) => getRecipeCapacityIssues(recipe.id, usage).length === 0,
  );
  const candidates =
    capacityCompatible.length > 0 ? capacityCompatible : typeCompatible;
  const fallback = RECIPE_REGISTRY.filter(
    (recipe) => recipe.outputType === outputType,
  );
  const pool = candidates.length > 0 ? candidates : fallback;

  return [...pool].sort((left, right) => {
    const score = (recipe: LayoutRecipe) => {
      const repeatsThreeTimes =
        previousRecipeIds.length >= 2 &&
        previousRecipeIds.at(-1) === recipe.id &&
        previousRecipeIds.at(-2) === recipe.id;
      return (
        (recipe.roles.some((recipeRole) => recipeRole === role) ? 100 : 0) +
        (recipe.id === currentRecipeId ? 10 : 0) -
        recipe.blockTypes.length -
        (repeatsThreeTimes ? 1_000 : 0)
      );
    };
    return score(right) - score(left);
  })[0];
};

export const normalizeVisualPlanRecipes = (
  contentDocument: ContentDocumentV1,
  outputStructure: OutputStructureV1,
  visualPlan: VisualPlanV1,
): VisualPlanV1 => {
  if (outputStructure.outputType !== visualPlan.outputType) return visualPlan;
  const blocksById = flattenBlocks(contentDocument);
  const outputNodes =
    outputStructure.outputType === "pptx"
      ? outputStructure.pages
      : outputStructure.regions;
  const normalizedRecipeIds: Array<
    PresentationRecipeId | LongformRecipeId
  > = [];

  visualPlan.items.forEach((item, index) => {
    const node = outputNodes[index];
    if (!node) {
      normalizedRecipeIds.push(item.recipeId);
      return;
    }
    const blocks = node.blockIds.flatMap((id) => {
      const block = blocksById.get(id);
      return block ? [block] : [];
    });
    normalizedRecipeIds.push(
      selectCompatibleRecipe({
        outputType: outputStructure.outputType,
        role: node.role,
        blocks,
        usage: getRecipeUsage(blocks, Boolean(item.assetId)),
        currentRecipeId: item.recipeId,
        previousRecipeIds: normalizedRecipeIds,
      }).id,
    );
  });

  return visualPlan.outputType === "pptx"
    ? {
        ...visualPlan,
        items: visualPlan.items.map((item, index) => ({
          ...item,
          recipeId: normalizedRecipeIds[index] as PresentationRecipeId,
        })),
      }
    : {
        ...visualPlan,
        items: visualPlan.items.map((item, index) => ({
          ...item,
          recipeId: normalizedRecipeIds[index] as LongformRecipeId,
        })),
      };
};

export const getVisualPlanRecipeIssues = (
  contentDocument: ContentDocumentV1,
  outputStructure: OutputStructureV1,
  visualPlan: VisualPlanV1,
): string[] => {
  if (outputStructure.outputType !== visualPlan.outputType) {
    return ["输出结构与视觉方案的产物类型不一致。"];
  }
  const blocksById = flattenBlocks(contentDocument);
  const outputNodes =
    outputStructure.outputType === "pptx" ? outputStructure.pages : outputStructure.regions;
  return visualPlan.items.flatMap((item, index) => {
    const node = outputNodes[index];
    if (!node) return [`视觉方案第 ${index + 1} 项没有对应输出节点。`];
    const blocks = node.blockIds.flatMap((id) => {
      const block = blocksById.get(id);
      return block ? [block] : [];
    });
    const recipe = getRecipe(item.recipeId);
    const issues: string[] = [];
    if (recipe.outputType !== outputStructure.outputType) {
      issues.push(`${item.recipeId} 不支持 ${outputStructure.outputType}。`);
    }
    const unsupportedTypes = blocks
      .map((block) => block.type)
      .filter((type) => !recipe.blockTypes.includes(type));
    if (unsupportedTypes.length > 0) {
      issues.push(`${item.recipeId} 不支持内容块类型 ${[...new Set(unsupportedTypes)].join("、")}。`);
    }
    issues.push(
      ...getRecipeCapacityIssues(
        item.recipeId,
        getRecipeUsage(blocks, Boolean(item.assetId)),
      ),
    );
    return issues.map((issue) => `${node.id}：${issue}`);
  });
};

export const renderContentToCanvas = ({
  documentId,
  contentDocument,
  outputStructure,
  visualPlan,
  assets = [],
}: {
  documentId: string;
  contentDocument: ContentDocumentV1;
  outputStructure: OutputStructureV1;
  visualPlan: VisualPlanV1;
  assets?: VisualAssetRecord[];
}): CanvasDocument => {
  const issues = [
    ...getOutputStructureIssues(outputStructure, contentDocument),
    ...getVisualPlanIssues(
      visualPlan,
      outputStructure,
      assets.map((asset) => asset.id),
    ),
    ...getVisualPlanRecipeIssues(contentDocument, outputStructure, visualPlan),
  ];
  const blocksById = flattenBlocks(contentDocument);
  if (issues.length > 0) throw new ContentCanvasRenderError(issues);

  const style = getStylePack(visualPlan.stylePackId);
  const context: RenderContext = {
    documentId,
    style,
    assetsById: new Map(assets.map((asset) => [asset.id, asset])),
  };

  let canvas: CanvasDocument;
  if (outputStructure.outputType === "pptx" && visualPlan.outputType === "pptx") {
    canvas = {
      id: documentId,
      name: contentDocument.title,
      description: contentDocument.coreMessage,
      documentType: "pptx",
      width: PPT_WIDTH,
      height: PPT_HEIGHT,
      elements: outputStructure.pages.map((node, index) =>
        renderPptPage({
          node,
          plan: visualPlan.items[index],
          blocks: node.blockIds.flatMap((id) => {
            const block = blocksById.get(id);
            return block ? [block] : [];
          }),
          context,
          pageIndex: index,
          pageCount: outputStructure.pages.length,
        }),
      ),
    };
  } else if (outputStructure.outputType === "longform" && visualPlan.outputType === "longform") {
    const heights = outputStructure.regions.map((node, index) =>
      estimateRegionHeight(
        node.blockIds.flatMap((id) => {
          const block = blocksById.get(id);
          return block ? [block] : [];
        }),
        node.role,
        Boolean(visualPlan.items[index]?.assetId),
      ),
    );
    const totalHeight = heights.reduce((sum, height) => sum + height, 0);
    if (totalHeight > LONGFORM_MAX_HEIGHT) {
      throw new ContentCanvasRenderError([
        `长图预计高度 ${totalHeight}px 超过 12,000px，请精简内容或减少区段。`,
      ]);
    }
    let cursor = 0;
    const children = outputStructure.regions.flatMap((node, index) => {
      const height = heights[index];
      const elements = renderLongformRegion({
        node,
        plan: visualPlan.items[index],
        blocks: node.blockIds.flatMap((id) => {
          const block = blocksById.get(id);
          return block ? [block] : [];
        }),
        context,
        y: cursor,
        height,
        index,
      });
      cursor += height;
      return elements;
    });
    canvas = {
      id: documentId,
      name: contentDocument.title,
      description: contentDocument.coreMessage,
      documentType: "longform",
      width: LONGFORM_WIDTH,
      height: totalHeight,
      elements: [createCanvasGroup(`${documentId}-longform`, "长图", children)],
    };
  } else {
    throw new ContentCanvasRenderError(["输出结构与视觉方案的产物类型不一致。"]);
  }

  const canvasIssues = getContentCanvasIssues(canvas);
  if (canvasIssues.length > 0) throw new ContentCanvasRenderError(canvasIssues);
  return canvas;
};
