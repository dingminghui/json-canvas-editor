import { z } from "zod";

export const PPT_STRUCTURE_SCHEMA_VERSION = "ppt-structure/v1" as const;
export const PPT_PROJECT_SCHEMA_VERSION = 1 as const;
export const PPT_MODEL = "qwen3.7-plus" as const;
export const PPT_PROMPT_VERSION = "ppt-structure/v3" as const;
export const PPT_MATERIAL_PLAN_SCHEMA_VERSION = "ppt-material-plan/v1" as const;
export const DEFAULT_PPT_SOURCE_TREATMENT =
  "以已有材料为内容边界；允许围绕演示目标重组、提炼和调整顺序，但不得新增材料外的事实、数字或结论。" as const;
export const PPT_VISUAL_PLAN_SCHEMA_VERSION = "ppt-visual-plan/v1" as const;
export const PPT_VISUAL_PROMPT_VERSION = "ppt-visual-plan/v3" as const;
export const PPT_VISUAL_REVIEW_SCHEMA_VERSION = "ppt-visual-review/v1" as const;
export const PPT_VISUAL_REVIEW_DECISION_SCHEMA_VERSION = "ppt-visual-review-decision/v1" as const;
export const PPT_VISUAL_REVIEW_PROMPT_VERSION = "ppt-visual-review/v2" as const;
export const PPT_CANVAS_RENDERER_VERSION = "canvas-render/v2" as const;
export const DEFAULT_BAILIAN_API_HOST =
  "https://dashscope.aliyuncs.com/compatible-mode/v1" as const;

export const PPT_SLIDE_ROLES = [
  "cover",
  "agenda",
  "section",
  "content",
  "comparison",
  "process",
  "timeline",
  "data",
  "summary",
  "closing",
] as const;

export const PPT_LAYOUT_INTENTS = [
  "cover",
  "title-body",
  "title-bullets",
  "two-column",
  "comparison",
  "process",
  "timeline",
  "metrics",
  "chart",
  "diagram",
  "quote",
  "summary",
] as const;

export const PPT_READING_MODES = ["text", "balanced", "presentation"] as const;
export const PPT_NARRATIVE_MODES = [
  "pyramid",
  "narrative",
  "instructional",
  "showcase",
  "briefing",
] as const;
export const PPT_MATERIAL_FACT_KINDS = ["fact", "data", "claim", "constraint"] as const;
export const PPT_MATERIAL_FACT_PRIORITIES = ["required", "supporting", "optional"] as const;

export const PPT_VISUAL_STYLES = [
  "editorial",
  "corporate",
  "technology",
  "research",
  "warm",
  "swiss",
  "data-journalism",
  "dark-tech",
  "soft-rounded",
  "brutalist",
] as const;

export const PPT_VISUAL_DENSITIES = ["spacious", "standard", "compact"] as const;
export const PPT_PAGE_RHYTHMS = ["anchor", "dense", "breathing"] as const;
export const PPT_PRIMARY_VISUALS = [
  "typography",
  "chart",
  "diagram",
  "table",
  "metrics",
  "mixed",
] as const;
export const PPT_COMPOSITIONS = [
  "editorial-flow",
  "asymmetric-split",
  "centered-statement",
  "modular-grid",
  "data-led",
  "relationship-led",
  "report-table",
  "action-close",
] as const;

export const PPT_CANVAS_LAYOUT_VARIANTS = [
  "cover-editorial",
  "cover-split",
  "agenda-list",
  "agenda-grid",
  "section-statement",
  "content-editorial",
  "content-cards",
  "two-column",
  "comparison-panels",
  "process-horizontal",
  "process-vertical",
  "timeline-horizontal",
  "metrics-cards",
  "quote-focus",
  "table-report",
  "summary-list",
  "closing-statement",
  "hero-number",
  "content-asymmetric",
  "content-rail",
  "chart-insight",
  "diagram-focus",
  "matrix-2x2",
] as const;

export const PPT_TABLE_STYLE_VARIANTS = ["minimal", "contrast", "soft"] as const;
export const PPT_VISUAL_REVIEW_VERDICTS = ["approved", "revised"] as const;
export const PPT_VISUAL_REVIEW_SEVERITIES = ["suggestion", "important", "critical"] as const;
export const PPT_VISUAL_REVIEW_CATEGORIES = [
  "hierarchy",
  "density",
  "rhythm",
  "repetition",
  "typography",
  "color",
  "chart",
  "table",
  "diagram",
  "content-fit",
] as const;

const NonEmptyText = z.string().trim().min(1);
const ShortItem = NonEmptyText.max(300);
const FactIdSchema = z.string().regex(/^F\d{3,}$/);

const ParagraphBlockSchema = z
  .object({
    type: z.literal("paragraph"),
    text: NonEmptyText.max(1200),
  })
  .strict();

const BulletListBlockSchema = z
  .object({
    type: z.literal("bullet-list"),
    items: z.array(ShortItem).min(1).max(8),
  })
  .strict();

const NumberedListBlockSchema = z
  .object({
    type: z.literal("numbered-list"),
    items: z.array(ShortItem).min(1).max(8),
  })
  .strict();

const ComparisonSideSchema = z
  .object({
    heading: NonEmptyText.max(100),
    items: z.array(ShortItem).min(1).max(6),
  })
  .strict();

const ComparisonBlockSchema = z
  .object({
    type: z.literal("comparison"),
    left: ComparisonSideSchema,
    right: ComparisonSideSchema,
  })
  .strict();

const ProcessBlockSchema = z
  .object({
    type: z.literal("process"),
    steps: z
      .array(
        z
          .object({
            title: NonEmptyText.max(100),
            description: z.string().trim().max(300).optional(),
          })
          .strict(),
      )
      .min(2)
      .max(8),
  })
  .strict();

const MetricsBlockSchema = z
  .object({
    type: z.literal("metrics"),
    items: z
      .array(
        z
          .object({
            value: NonEmptyText.max(60),
            label: NonEmptyText.max(100),
            context: z.string().trim().max(200).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(6),
  })
  .strict();

const QuoteBlockSchema = z
  .object({
    type: z.literal("quote"),
    quote: NonEmptyText.max(500),
    attribution: z.string().trim().max(100).optional(),
  })
  .strict();

const TableBlockSchema = z
  .object({
    type: z.literal("table"),
    columns: z.array(NonEmptyText.max(100)).min(1).max(6),
    rows: z
      .array(z.array(z.string().trim().max(300)))
      .min(1)
      .max(12),
  })
  .strict()
  .superRefine((table, context) => {
    table.rows.forEach((row, index) => {
      if (row.length !== table.columns.length) {
        context.addIssue({
          code: "custom",
          message: `第 ${index + 1} 行单元格数量必须与列数一致`,
          path: ["rows", index],
        });
      }
    });
  });

const ChartSeriesSchema = z
  .object({
    name: NonEmptyText.max(100),
    values: z.array(z.number().finite()).min(2).max(12),
  })
  .strict();

const ChartBlockSchema = z
  .object({
    type: z.literal("chart"),
    relationship: z.enum(["comparison", "trend", "part-to-whole"]),
    takeaway: NonEmptyText.max(300),
    categories: z.array(NonEmptyText.max(80)).min(2).max(12),
    series: z.array(ChartSeriesSchema).min(1).max(4),
  })
  .strict()
  .superRefine((chart, context) => {
    chart.series.forEach((series, index) => {
      if (series.values.length !== chart.categories.length) {
        context.addIssue({
          code: "custom",
          message: `第 ${index + 1} 个数据系列长度必须与 categories 一致`,
          path: ["series", index, "values"],
        });
      }
    });
    if (chart.relationship === "part-to-whole" && chart.series.length !== 1) {
      context.addIssue({
        code: "custom",
        message: "part-to-whole 图表只能包含一个数据系列",
        path: ["series"],
      });
    }
  });

const DiagramNodeSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/),
    label: NonEmptyText.max(100),
    description: z.string().trim().max(240).optional(),
  })
  .strict();

const DiagramEdgeSchema = z
  .object({
    from: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/),
    to: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/),
    label: z.string().trim().max(80).optional(),
  })
  .strict();

const DiagramBlockSchema = z
  .object({
    type: z.literal("diagram"),
    relationship: z.enum(["process", "hierarchy", "cycle", "system", "cause-effect"]),
    nodes: z.array(DiagramNodeSchema).min(2).max(8),
    edges: z.array(DiagramEdgeSchema).min(1).max(12),
  })
  .strict()
  .superRefine((diagram, context) => {
    const nodeIds = new Set<string>();
    diagram.nodes.forEach((node, index) => {
      if (nodeIds.has(node.id)) {
        context.addIssue({
          code: "custom",
          message: "diagram node id 必须唯一",
          path: ["nodes", index, "id"],
        });
      }
      nodeIds.add(node.id);
    });
    diagram.edges.forEach((edge, index) => {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to) || edge.from === edge.to) {
        context.addIssue({
          code: "custom",
          message: "diagram edge 必须引用两个不同的现有节点",
          path: ["edges", index],
        });
      }
    });
  });

export const PptContentBlockSchema = z.discriminatedUnion("type", [
  ParagraphBlockSchema,
  BulletListBlockSchema,
  NumberedListBlockSchema,
  ComparisonBlockSchema,
  ProcessBlockSchema,
  MetricsBlockSchema,
  QuoteBlockSchema,
  TableBlockSchema,
  ChartBlockSchema,
  DiagramBlockSchema,
]);

export const PptSlideSchema = z
  .object({
    id: z.string().regex(/^P\d{2,}$/),
    index: z.number().int().min(1).max(99),
    sectionId: NonEmptyText.max(80),
    role: z.enum(PPT_SLIDE_ROLES),
    title: NonEmptyText.max(160),
    coreMessage: NonEmptyText.max(500),
    audienceMove: z
      .object({
        before: NonEmptyText.max(300),
        after: NonEmptyText.max(300),
      })
      .strict(),
    layoutIntent: z.enum(PPT_LAYOUT_INTENTS),
    contentBlocks: z.array(PptContentBlockSchema).min(1).max(8),
    evidenceRefs: z.array(FactIdSchema).max(20).default([]),
    speakerNotes: z.string().trim().max(4000).optional(),
  })
  .strict();

export const PptStructureSchema = z
  .object({
    schemaVersion: z.literal(PPT_STRUCTURE_SCHEMA_VERSION),
    deck: z
      .object({
        title: NonEmptyText.max(100),
        subtitle: z.string().trim().max(200).optional(),
        language: z.enum(["zh-CN", "en-US"]),
        audience: NonEmptyText.max(300),
        purpose: NonEmptyText.max(500),
        coreMessage: NonEmptyText.max(500),
        deliveryContext: NonEmptyText.max(300),
        readingMode: z.enum(PPT_READING_MODES),
        narrativeMode: z.enum(PPT_NARRATIVE_MODES),
        pageCount: z.number().int().min(4).max(20),
      })
      .strict(),
    sections: z
      .array(
        z
          .object({
            id: NonEmptyText.max(80),
            title: NonEmptyText.max(120),
            objective: NonEmptyText.max(400),
            slideIds: z.array(z.string().regex(/^P\d{2,}$/)).min(1),
          })
          .strict(),
      )
      .min(1)
      .max(10),
    slides: z.array(PptSlideSchema).min(4).max(20),
  })
  .strict()
  .superRefine((structure, context) => {
    const { deck, sections, slides } = structure;
    if (deck.pageCount !== slides.length) {
      context.addIssue({
        code: "custom",
        message: "deck.pageCount 必须等于 slides.length",
        path: ["deck", "pageCount"],
      });
    }

    const expectedSlideIds = slides.map((_, index) => `P${String(index + 1).padStart(2, "0")}`);
    slides.forEach((slide, index) => {
      if (slide.id !== expectedSlideIds[index] || slide.index !== index + 1) {
        context.addIssue({
          code: "custom",
          message: `幻灯片必须按顺序编号为 ${expectedSlideIds[index]}`,
          path: ["slides", index, "id"],
        });
      }
    });

    if (slides[0]?.role !== "cover") {
      context.addIssue({
        code: "custom",
        message: "第一张幻灯片必须是 cover",
        path: ["slides", 0, "role"],
      });
    }
    const finalRole = slides.at(-1)?.role;
    if (finalRole !== "summary" && finalRole !== "closing") {
      context.addIssue({
        code: "custom",
        message: "最后一张幻灯片必须是 summary 或 closing",
        path: ["slides", Math.max(0, slides.length - 1), "role"],
      });
    }

    const sectionIds = new Set<string>();
    sections.forEach((section, index) => {
      if (sectionIds.has(section.id)) {
        context.addIssue({
          code: "custom",
          message: "section id 必须唯一",
          path: ["sections", index, "id"],
        });
      }
      sectionIds.add(section.id);
    });

    const referencedSlideIds = sections.flatMap((section) => section.slideIds);
    slides.forEach((slide, index) => {
      if (!sectionIds.has(slide.sectionId)) {
        context.addIssue({
          code: "custom",
          message: "slide.sectionId 必须引用存在的 section",
          path: ["slides", index, "sectionId"],
        });
      }
      if (referencedSlideIds.filter((id) => id === slide.id).length !== 1) {
        context.addIssue({
          code: "custom",
          message: "每张幻灯片必须在 sections.slideIds 中恰好出现一次",
          path: ["slides", index, "id"],
        });
      }
    });
    referencedSlideIds.forEach((slideId, index) => {
      if (!expectedSlideIds.includes(slideId)) {
        context.addIssue({
          code: "custom",
          message: "sections.slideIds 包含不存在的幻灯片",
          path: ["sections", index],
        });
      }
    });

    const requiredBlockTypeByLayout: Partial<
      Record<(typeof PPT_LAYOUT_INTENTS)[number], PptContentBlock["type"][]>
    > = {
      comparison: ["comparison"],
      process: ["process", "numbered-list"],
      timeline: ["process", "numbered-list"],
      metrics: ["metrics"],
      chart: ["chart"],
      diagram: ["diagram"],
      quote: ["quote"],
      "title-bullets": ["bullet-list", "numbered-list"],
    };
    slides.forEach((slide, index) => {
      const acceptedTypes = requiredBlockTypeByLayout[slide.layoutIntent];
      if (
        acceptedTypes &&
        !slide.contentBlocks.some((block) => acceptedTypes.includes(block.type))
      ) {
        context.addIssue({
          code: "custom",
          message: `${slide.layoutIntent} 布局缺少兼容的内容块`,
          path: ["slides", index, "contentBlocks"],
        });
      }
    });
  });

const PptMaterialFactSchema = z
  .object({
    id: FactIdSchema,
    kind: z.enum(PPT_MATERIAL_FACT_KINDS),
    priority: z.enum(PPT_MATERIAL_FACT_PRIORITIES),
    statement: NonEmptyText.max(500),
    sourceExcerpt: NonEmptyText.max(500),
    sourceLocation: z.string().trim().max(200).optional(),
  })
  .strict();

const PptMaterialDirectionSectionSchema = z
  .object({
    id: z.string().regex(/^S\d{2,}$/),
    title: NonEmptyText.max(120),
    objective: NonEmptyText.max(400),
    factIds: z.array(FactIdSchema).min(1).max(30),
  })
  .strict();

export const PptMaterialPlanSchema = z
  .object({
    schemaVersion: z.literal(PPT_MATERIAL_PLAN_SCHEMA_VERSION),
    sourceSummary: NonEmptyText.max(1200),
    facts: z.array(PptMaterialFactSchema).min(1).max(100),
    gaps: z.array(NonEmptyText.max(300)).max(20),
    direction: z
      .object({
        title: NonEmptyText.max(100),
        coreMessage: NonEmptyText.max(500),
        narrativeMode: z.enum(PPT_NARRATIVE_MODES),
        rationale: NonEmptyText.max(800),
        sections: z.array(PptMaterialDirectionSectionSchema).min(1).max(10),
      })
      .strict(),
  })
  .strict()
  .superRefine((plan, context) => {
    const factIds = new Set<string>();
    plan.facts.forEach((fact, index) => {
      if (factIds.has(fact.id)) {
        context.addIssue({
          code: "custom",
          message: "材料事实 ID 必须唯一",
          path: ["facts", index, "id"],
        });
      }
      factIds.add(fact.id);
    });

    const sectionIds = new Set<string>();
    const plannedFactIds = new Set<string>();
    plan.direction.sections.forEach((section, sectionIndex) => {
      if (sectionIds.has(section.id)) {
        context.addIssue({
          code: "custom",
          message: "方向章节 ID 必须唯一",
          path: ["direction", "sections", sectionIndex, "id"],
        });
      }
      sectionIds.add(section.id);
      section.factIds.forEach((factId, factIndex) => {
        if (!factIds.has(factId)) {
          context.addIssue({
            code: "custom",
            message: "方向章节引用了不存在的材料事实",
            path: ["direction", "sections", sectionIndex, "factIds", factIndex],
          });
        }
        plannedFactIds.add(factId);
      });
    });

    plan.facts.forEach((fact, index) => {
      if (fact.priority === "required" && !plannedFactIds.has(fact.id)) {
        context.addIssue({
          code: "custom",
          message: "必需材料事实必须进入推荐方向",
          path: ["facts", index, "id"],
        });
      }
    });
  });

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const PptVisualThemeSchema = z
  .object({
    style: z.enum(PPT_VISUAL_STYLES),
    primaryColor: HexColorSchema,
    accentColor: HexColorSchema,
    backgroundColor: HexColorSchema,
    foregroundColor: HexColorSchema,
    surfaceColor: HexColorSchema,
    mutedColor: HexColorSchema,
    borderColor: HexColorSchema,
    headingFont: z.enum(["noto-sans-sc", "noto-serif-sc"]),
    bodyFont: z.enum(["noto-sans-sc", "noto-serif-sc"]),
    cornerStyle: z.enum(["square", "soft", "rounded"]),
  })
  .strict();

const PptVisualSlideSchema = z
  .object({
    slideId: z.string().regex(/^P\d{2,}$/),
    layoutVariant: z.enum(PPT_CANVAS_LAYOUT_VARIANTS),
    density: z.enum(PPT_VISUAL_DENSITIES),
    visualFocus: NonEmptyText.max(200),
    accentBlockIndex: z.number().int().min(0).max(7).nullable(),
    tableStyle: z.enum(PPT_TABLE_STYLE_VARIANTS),
    rhythm: z.enum(PPT_PAGE_RHYTHMS).default("anchor"),
    primaryVisual: z.enum(PPT_PRIMARY_VISUALS).default("typography"),
    composition: z.enum(PPT_COMPOSITIONS).default("editorial-flow"),
  })
  .strict();

export const PptVisualPlanSchema = z
  .object({
    schemaVersion: z.literal(PPT_VISUAL_PLAN_SCHEMA_VERSION),
    theme: PptVisualThemeSchema,
    slides: z.array(PptVisualSlideSchema).min(4).max(20),
  })
  .strict()
  .superRefine((plan, context) => {
    const slideIds = new Set<string>();
    plan.slides.forEach((slide, index) => {
      if (slideIds.has(slide.slideId)) {
        context.addIssue({
          code: "custom",
          message: "视觉方案中的幻灯片编号必须唯一",
          path: ["slides", index, "slideId"],
        });
      }
      slideIds.add(slide.slideId);
    });
  });

const PptVisualReviewIssueSchema = z
  .object({
    slideId: z
      .string()
      .regex(/^P\d{2,}$/)
      .nullable(),
    category: z.enum(PPT_VISUAL_REVIEW_CATEGORIES),
    severity: z.enum(PPT_VISUAL_REVIEW_SEVERITIES),
    observation: NonEmptyText.max(360),
    recommendation: NonEmptyText.max(360),
  })
  .strict();

const PptVisualReviewSlideChangesSchema = PptVisualSlideSchema.omit({
  slideId: true,
  visualFocus: true,
})
  .partial()
  .strict();

export const PptVisualReviewDecisionSchema = z
  .object({
    schemaVersion: z.literal(PPT_VISUAL_REVIEW_DECISION_SCHEMA_VERSION),
    summary: NonEmptyText.max(600),
    strengths: z.array(NonEmptyText.max(240)).max(5),
    issues: z.array(PptVisualReviewIssueSchema).max(30),
    themePatch: PptVisualThemeSchema.partial().strict(),
    slidePatches: z
      .array(
        z
          .object({
            slideId: z.string().regex(/^P\d{2,}$/),
            changes: PptVisualReviewSlideChangesSchema,
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

export const PptVisualReviewSchema = z
  .object({
    schemaVersion: z.literal(PPT_VISUAL_REVIEW_SCHEMA_VERSION),
    verdict: z.enum(PPT_VISUAL_REVIEW_VERDICTS),
    summary: NonEmptyText.max(600),
    strengths: z.array(NonEmptyText.max(240)).max(5),
    issues: z.array(PptVisualReviewIssueSchema).max(30),
    themeChanged: z.boolean(),
    revisedSlideIds: z.array(z.string().regex(/^P\d{2,}$/)).max(20),
    revisedVisualPlan: PptVisualPlanSchema,
  })
  .strict();

export const CreatePptStructureInputSchema = z
  .object({
    topic: NonEmptyText.max(100),
    audience: NonEmptyText.max(300),
    objective: NonEmptyText.max(500),
    sourceMarkdown: z.string().max(50_000).optional(),
    sourceTreatment: z.string().trim().max(500).default(DEFAULT_PPT_SOURCE_TREATMENT),
    slideCount: z.union([z.literal("auto"), z.number().int().min(4).max(20)]),
    deliveryContext: z.string().trim().max(200).optional(),
    durationMinutes: z.number().int().min(1).max(480).optional(),
    tone: z.string().trim().max(100).optional(),
    mustInclude: z.array(NonEmptyText.max(100)).max(20),
    exclude: z.array(NonEmptyText.max(100)).max(20),
    language: z.enum(["zh-CN", "en-US"]),
  })
  .strict();

const TokenCountSchema = z.number().int().nonnegative();

export const PptTokenUsageSchema = z
  .object({
    total_tokens: TokenCountSchema,
    completion_tokens: TokenCountSchema,
    prompt_tokens: TokenCountSchema,
    completion_tokens_details: z
      .object({
        reasoning_tokens: TokenCountSchema.nullable().optional(),
        text_tokens: TokenCountSchema.nullable().optional(),
      })
      .optional(),
    prompt_tokens_details: z
      .object({
        cached_tokens: TokenCountSchema.nullable().optional(),
        text_tokens: TokenCountSchema.nullable().optional(),
      })
      .optional(),
  })
  .strip();

export const PptProjectSchema = z
  .object({
    schemaVersion: z.literal(PPT_PROJECT_SCHEMA_VERSION),
    id: z.string().uuid(),
    input: CreatePptStructureInputSchema,
    materialPlan: PptMaterialPlanSchema.optional(),
    structure: PptStructureSchema,
    generator: z
      .object({
        model: z.literal(PPT_MODEL),
        promptVersion: z.enum(["ppt-structure/v1", "ppt-structure/v2", PPT_PROMPT_VERSION]),
        usage: PptTokenUsageSchema,
      })
      .strict(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type PptContentBlock = z.infer<typeof PptContentBlockSchema>;
export type PptSlide = z.infer<typeof PptSlideSchema>;
export type PptStructureV1 = z.infer<typeof PptStructureSchema>;
export type PptMaterialPlanV1 = z.infer<typeof PptMaterialPlanSchema>;
export type PptVisualPlanV1 = z.infer<typeof PptVisualPlanSchema>;
export type PptVisualReviewDecisionV1 = z.infer<typeof PptVisualReviewDecisionSchema>;
export type PptVisualReviewV1 = z.infer<typeof PptVisualReviewSchema>;
export type CreatePptStructureInput = z.infer<typeof CreatePptStructureInputSchema>;
export type PptTokenUsageV1 = z.infer<typeof PptTokenUsageSchema>;
export type PptProjectV1 = z.infer<typeof PptProjectSchema>;

export function getPptStructureJsonSchema() {
  return z.toJSONSchema(PptStructureSchema, { target: "draft-07" });
}

export function getPptMaterialPlanJsonSchema() {
  return z.toJSONSchema(PptMaterialPlanSchema, { target: "draft-07" });
}

export function getPptVisualPlanJsonSchema() {
  return z.toJSONSchema(PptVisualPlanSchema, { target: "draft-07" });
}

export function getPptVisualReviewJsonSchema() {
  return z.toJSONSchema(PptVisualReviewSchema, { target: "draft-07" });
}

export function getPptVisualReviewDecisionJsonSchema() {
  return z.toJSONSchema(PptVisualReviewDecisionSchema, { target: "draft-07" });
}

export function getPptStructureMaterialIssues(
  structure: PptStructureV1,
  materialPlan: PptMaterialPlanV1,
): string[] {
  const issues: string[] = [];
  const knownFactIds = new Set(materialPlan.facts.map((fact) => fact.id));
  const referencedFactIds = new Set(structure.slides.flatMap((slide) => slide.evidenceRefs));

  structure.slides.forEach((slide) => {
    slide.evidenceRefs.forEach((factId) => {
      if (!knownFactIds.has(factId)) {
        issues.push(`${slide.id} 引用了不存在的材料事实 ${factId}`);
      }
    });
  });

  materialPlan.facts.forEach((fact) => {
    if (fact.priority === "required" && !referencedFactIds.has(fact.id)) {
      issues.push(`必需材料事实 ${fact.id} 未被任何页面使用`);
    }
  });

  return issues;
}

export function getPptMaterialCoverage(structure: PptStructureV1, materialPlan: PptMaterialPlanV1) {
  const referencedFactIds = new Set(structure.slides.flatMap((slide) => slide.evidenceRefs));
  const requiredFacts = materialPlan.facts.filter((fact) => fact.priority === "required");
  const coveredFacts = materialPlan.facts.filter((fact) => referencedFactIds.has(fact.id));
  const coveredRequiredFacts = requiredFacts.filter((fact) => referencedFactIds.has(fact.id));
  const weightByPriority = { required: 3, supporting: 2, optional: 1 } as const;
  const totalWeight = materialPlan.facts.reduce(
    (sum, fact) => sum + weightByPriority[fact.priority],
    0,
  );
  const coveredWeight = coveredFacts.reduce(
    (sum, fact) => sum + weightByPriority[fact.priority],
    0,
  );

  return {
    coveragePercent: totalWeight === 0 ? 100 : Math.round((coveredWeight / totalWeight) * 100),
    coveredFactCount: coveredFacts.length,
    totalFactCount: materialPlan.facts.length,
    coveredRequiredFactCount: coveredRequiredFacts.length,
    requiredFactCount: requiredFacts.length,
    missingRequiredFacts: requiredFacts.filter((fact) => !referencedFactIds.has(fact.id)),
  };
}

export function getPptVisualPlanStructureIssues(
  plan: PptVisualPlanV1,
  structure: PptStructureV1,
): string[] {
  const issues: string[] = [];
  if (plan.slides.length !== structure.slides.length) {
    issues.push("视觉方案页数必须与 PPT 文本结构页数一致");
  }

  const expectedSlideIds = structure.slides.map((slide) => slide.id);
  plan.slides.forEach((slide, index) => {
    if (slide.slideId !== expectedSlideIds[index]) {
      issues.push(`视觉方案第 ${index + 1} 页必须引用 ${expectedSlideIds[index] ?? "对应页面"}`);
    }
    if (
      slide.accentBlockIndex !== null &&
      slide.accentBlockIndex >= (structure.slides[index]?.contentBlocks.length ?? 0)
    ) {
      issues.push(`视觉方案 ${slide.slideId} 的强调内容块编号不存在`);
    }
    const sourceSlide = structure.slides[index];
    if (!sourceSlide) return;
    const blockTypes = new Set(sourceSlide.contentBlocks.map((block) => block.type));
    if (
      blockTypes.has("chart") &&
      slide.primaryVisual !== "chart" &&
      slide.primaryVisual !== "mixed"
    ) {
      issues.push(`视觉方案 ${slide.slideId} 必须以 chart 或 mixed 作为主视觉`);
    }
    if (
      blockTypes.has("diagram") &&
      slide.primaryVisual !== "diagram" &&
      slide.primaryVisual !== "mixed"
    ) {
      issues.push(`视觉方案 ${slide.slideId} 必须以 diagram 或 mixed 作为主视觉`);
    }
    if (
      blockTypes.has("table") &&
      slide.primaryVisual !== "table" &&
      slide.primaryVisual !== "mixed"
    ) {
      issues.push(`视觉方案 ${slide.slideId} 必须以 table 或 mixed 作为主视觉`);
    }
  });
  plan.slides.slice(2).forEach((slide, index) => {
    const previous = plan.slides[index + 1];
    const beforePrevious = plan.slides[index];
    if (
      previous &&
      beforePrevious &&
      slide.composition === previous.composition &&
      slide.composition === beforePrevious.composition &&
      slide.layoutVariant === previous.layoutVariant &&
      slide.layoutVariant === beforePrevious.layoutVariant
    ) {
      issues.push(`视觉方案 ${beforePrevious.slideId} 至 ${slide.slideId} 连续重复同一构图`);
    }
  });
  return issues;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => valuesEqual(value, right[index]))
    );
  }
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return false;
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(rightRecord, key) &&
        valuesEqual(leftRecord[key], rightRecord[key]),
    )
  );
}

export function getPptVisualReviewStructureIssues(
  review: PptVisualReviewV1,
  sourcePlan: PptVisualPlanV1,
  structure: PptStructureV1,
): string[] {
  const issues = getPptVisualPlanStructureIssues(review.revisedVisualPlan, structure);
  const expectedSlideIds = structure.slides.map((slide) => slide.id);
  const expectedSlideIdSet = new Set(expectedSlideIds);

  review.issues.forEach((issue, index) => {
    if (issue.slideId !== null && !expectedSlideIdSet.has(issue.slideId)) {
      issues.push(`视觉评审第 ${index + 1} 条问题引用了不存在的页面 ${issue.slideId}`);
    }
  });

  const revisedPlanBySlideId = new Map(
    review.revisedVisualPlan.slides.map((slide) => [slide.slideId, slide]),
  );
  sourcePlan.slides.forEach((slide) => {
    const revisedSlide = revisedPlanBySlideId.get(slide.slideId);
    if (revisedSlide && revisedSlide.visualFocus !== slide.visualFocus) {
      issues.push(`视觉评审不得修改 ${slide.slideId} 的观众可见视觉焦点文案`);
    }
  });
  const changedSlideIds = sourcePlan.slides
    .filter((slide) => !valuesEqual(slide, revisedPlanBySlideId.get(slide.slideId)))
    .map((slide) => slide.slideId);
  const themeChanged = !valuesEqual(sourcePlan.theme, review.revisedVisualPlan.theme);

  if (review.themeChanged !== themeChanged) {
    issues.push("视觉评审对主题是否变化的声明与实际修订不一致");
  }
  if (!valuesEqual(review.revisedSlideIds, changedSlideIds)) {
    issues.push("视觉评审声明的修订页面与实际 VisualPlan 变化不一致");
  }

  const hasRevision = themeChanged || changedSlideIds.length > 0;
  if (review.verdict === "approved" && hasRevision) {
    issues.push("视觉评审结论为通过时不得修改 VisualPlan");
  }
  if (review.verdict === "revised" && !hasRevision) {
    issues.push("视觉评审结论为修订时必须至少修改主题或一页视觉方案");
  }
  if (review.verdict === "revised" && review.issues.length === 0) {
    issues.push("视觉评审执行修订时必须说明至少一个视觉问题");
  }

  return issues;
}
