import { z } from "zod";

export const CONTENT_PROJECT_SCHEMA_VERSION = 1 as const;
export const MATERIAL_PLAN_SCHEMA_VERSION = "material-plan/v1" as const;
export const CONTENT_DOCUMENT_SCHEMA_VERSION = "content-document/v1" as const;
export const OUTPUT_STRUCTURE_SCHEMA_VERSION = "output-structure/v1" as const;
export const ASSET_SEARCH_PLAN_SCHEMA_VERSION = "asset-search-plan/v1" as const;
export const VISUAL_PLAN_SCHEMA_VERSION = "visual-plan/v1" as const;
export const VISUAL_REVIEW_SCHEMA_VERSION = "visual-review/v1" as const;
export const CONTENT_MODEL = "qwen3.7-plus" as const;

export const OUTPUT_TYPES = ["pptx", "longform"] as const;
export const STYLE_PACK_IDS = [
  "editorial-swiss",
  "modern-corporate",
  "dark-tech",
  "data-journalism",
  "warm-editorial",
  "brutalist-poster",
] as const;
export const VISUAL_DENSITIES = ["spacious", "standard", "compact"] as const;
export const ASSET_ORIENTATIONS = ["landscape", "portrait", "square"] as const;

export const PRESENTATION_ROLES = [
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

export const LONGFORM_ROLES = [
  "hero",
  "chapter",
  "content",
  "comparison",
  "process",
  "data",
  "quote",
  "closing",
] as const;

export const PRESENTATION_RECIPE_IDS = [
  "cover-editorial",
  "cover-split-media",
  "section-statement",
  "agenda-rail",
  "editorial-flow",
  "asymmetric-split",
  "modular-grid",
  "comparison-panels",
  "process-flow",
  "timeline-ribbon",
  "metrics-cluster",
  "chart-insight",
  "relationship-map",
  "table-report",
  "quote-focus",
  "action-close",
] as const;

export const LONGFORM_RECIPE_IDS = [
  "longform-hero",
  "chapter-band",
  "editorial-section",
  "split-media-section",
  "modular-highlights",
  "comparison-stack",
  "process-stack",
  "metrics-strip",
  "data-story",
  "quote-break",
  "longform-close",
] as const;

const NonEmptyText = z.string().trim().min(1);
const FactIdSchema = z.string().regex(/^F\d{3,}$/);
const SectionIdSchema = z.string().regex(/^S\d{2,}$/);
const BlockIdSchema = z.string().regex(/^B\d{3,}$/);
const OutputNodeIdSchema = z.string().regex(/^(?:P|R)\d{2,}$/);
const VisualAssetIdSchema = z.string().regex(/^A[a-zA-Z0-9]{2,}$/);

const BlockBaseShape = {
  id: BlockIdSchema,
  evidenceRefs: z.array(FactIdSchema).max(20).default([]),
};

const ParagraphBlockSchema = z
  .object({
    ...BlockBaseShape,
    type: z.literal("paragraph"),
    text: NonEmptyText.max(1600),
  })
  .strict();

const BulletListBlockSchema = z
  .object({
    ...BlockBaseShape,
    type: z.literal("bullet-list"),
    items: z.array(NonEmptyText.max(300)).min(1).max(8),
  })
  .strict();

const NumberedListBlockSchema = z
  .object({
    ...BlockBaseShape,
    type: z.literal("numbered-list"),
    items: z.array(NonEmptyText.max(300)).min(1).max(8),
  })
  .strict();

const ComparisonBlockSchema = z
  .object({
    ...BlockBaseShape,
    type: z.literal("comparison"),
    left: z
      .object({
        heading: NonEmptyText.max(100),
        items: z.array(NonEmptyText.max(300)).min(1).max(6),
      })
      .strict(),
    right: z
      .object({
        heading: NonEmptyText.max(100),
        items: z.array(NonEmptyText.max(300)).min(1).max(6),
      })
      .strict(),
  })
  .strict();

const ProcessBlockSchema = z
  .object({
    ...BlockBaseShape,
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
    ...BlockBaseShape,
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
    ...BlockBaseShape,
    type: z.literal("quote"),
    quote: NonEmptyText.max(700),
    attribution: z.string().trim().max(160).optional(),
  })
  .strict();

const TableBlockSchema = z
  .object({
    ...BlockBaseShape,
    type: z.literal("table"),
    columns: z.array(NonEmptyText.max(100)).min(1).max(6),
    rows: z.array(z.array(z.string().trim().max(300))).min(1).max(16),
  })
  .strict()
  .superRefine((table, context) => {
    table.rows.forEach((row, index) => {
      if (row.length !== table.columns.length) {
        context.addIssue({
          code: "custom",
          message: "表格每行的单元格数量必须与列数一致",
          path: ["rows", index],
        });
      }
    });
  });

const ChartBlockSchema = z
  .object({
    ...BlockBaseShape,
    type: z.literal("chart"),
    relationship: z.enum(["comparison", "trend", "part-to-whole"]),
    takeaway: NonEmptyText.max(300),
    categories: z.array(NonEmptyText.max(80)).min(2).max(12),
    series: z
      .array(
        z
          .object({
            name: NonEmptyText.max(100),
            values: z.array(z.number().finite()).min(2).max(12),
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict()
  .superRefine((chart, context) => {
    chart.series.forEach((series, index) => {
      if (series.values.length !== chart.categories.length) {
        context.addIssue({
          code: "custom",
          message: "图表系列长度必须与类别数量一致",
          path: ["series", index, "values"],
        });
      }
    });
    if (chart.relationship === "part-to-whole" && chart.series.length !== 1) {
      context.addIssue({
        code: "custom",
        message: "占比图只能包含一个数据系列",
        path: ["series"],
      });
    }
  });

const DiagramBlockSchema = z
  .object({
    ...BlockBaseShape,
    type: z.literal("diagram"),
    relationship: z.enum(["process", "hierarchy", "cycle", "system", "cause-effect"]),
    nodes: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/),
            label: NonEmptyText.max(100),
            description: z.string().trim().max(240).optional(),
          })
          .strict(),
      )
      .min(2)
      .max(8),
    edges: z
      .array(
        z
          .object({
            from: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/),
            to: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/),
            label: z.string().trim().max(80).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict()
  .superRefine((diagram, context) => {
    const nodeIds = new Set<string>();
    diagram.nodes.forEach((node, index) => {
      if (nodeIds.has(node.id)) {
        context.addIssue({
          code: "custom",
          message: "关系图节点 ID 必须唯一",
          path: ["nodes", index, "id"],
        });
      }
      nodeIds.add(node.id);
    });
    diagram.edges.forEach((edge, index) => {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to) || edge.from === edge.to) {
        context.addIssue({
          code: "custom",
          message: "关系图连线必须引用两个不同的现有节点",
          path: ["edges", index],
        });
      }
    });
  });

export const ContentBlockSchema = z.discriminatedUnion("type", [
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

export const MaterialPlanSchema = z
  .object({
    schemaVersion: z.literal(MATERIAL_PLAN_SCHEMA_VERSION),
    sourceSummary: NonEmptyText.max(1200),
    facts: z
      .array(
        z
          .object({
            id: FactIdSchema,
            kind: z.enum(["fact", "data", "claim", "constraint"]),
            priority: z.enum(["required", "supporting", "optional"]),
            statement: NonEmptyText.max(500),
            sourceExcerpt: NonEmptyText.max(500),
            sourceLocation: z.string().trim().max(200).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    gaps: z.array(NonEmptyText.max(300)).max(20),
    direction: z
      .object({
        title: NonEmptyText.max(120),
        coreMessage: NonEmptyText.max(500),
        rationale: NonEmptyText.max(800),
        sections: z
          .array(
            z
              .object({
                id: SectionIdSchema,
                title: NonEmptyText.max(120),
                objective: NonEmptyText.max(400),
                factIds: z.array(FactIdSchema).min(1).max(30),
              })
              .strict(),
          )
          .min(1)
          .max(12),
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
    plan.direction.sections.forEach((section, sectionIndex) => {
      if (sectionIds.has(section.id)) {
        context.addIssue({
          code: "custom",
          message: "材料方向章节 ID 必须唯一",
          path: ["direction", "sections", sectionIndex, "id"],
        });
      }
      sectionIds.add(section.id);
      section.factIds.forEach((factId, factIndex) => {
        if (!factIds.has(factId)) {
          context.addIssue({
            code: "custom",
            message: "章节引用的事实必须存在",
            path: ["direction", "sections", sectionIndex, "factIds", factIndex],
          });
        }
      });
    });
  });

export const ContentDocumentSchema = z
  .object({
    schemaVersion: z.literal(CONTENT_DOCUMENT_SCHEMA_VERSION),
    title: NonEmptyText.max(120),
    subtitle: z.string().trim().max(240).optional(),
    language: z.enum(["zh-CN", "en-US"]),
    audience: NonEmptyText.max(300),
    purpose: NonEmptyText.max(500),
    coreMessage: NonEmptyText.max(500),
    sections: z
      .array(
        z
          .object({
            id: SectionIdSchema,
            title: NonEmptyText.max(120),
            objective: NonEmptyText.max(400),
            blocks: z.array(ContentBlockSchema).min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict()
  .superRefine((document, context) => {
    const sectionIds = new Set<string>();
    const blockIds = new Set<string>();
    document.sections.forEach((section, sectionIndex) => {
      if (sectionIds.has(section.id)) {
        context.addIssue({
          code: "custom",
          message: "章节 ID 必须唯一",
          path: ["sections", sectionIndex, "id"],
        });
      }
      sectionIds.add(section.id);
      section.blocks.forEach((block, blockIndex) => {
        if (blockIds.has(block.id)) {
          context.addIssue({
            code: "custom",
            message: "内容块 ID 必须唯一",
            path: ["sections", sectionIndex, "blocks", blockIndex, "id"],
          });
        }
        blockIds.add(block.id);
      });
    });
  });

const OutputNodeBaseShape = {
  id: OutputNodeIdSchema,
  title: NonEmptyText.max(160),
  coreMessage: NonEmptyText.max(500),
  blockIds: z.array(BlockIdSchema).min(1).max(8),
};

const PresentationStructureSchema = z
  .object({
    schemaVersion: z.literal(OUTPUT_STRUCTURE_SCHEMA_VERSION),
    outputType: z.literal("pptx"),
    width: z.literal(1600),
    height: z.literal(900),
    pageCount: z.number().int().min(4).max(20),
    pages: z
      .array(
        z
          .object({
            ...OutputNodeBaseShape,
            id: z.string().regex(/^P\d{2,}$/),
            role: z.enum(PRESENTATION_ROLES),
            audienceMove: z
              .object({
                before: NonEmptyText.max(300),
                after: NonEmptyText.max(300),
              })
              .strict(),
            speakerNotes: z.string().trim().max(4000).optional(),
          })
          .strict(),
      )
      .min(4)
      .max(20),
  })
  .strict()
  .superRefine((structure, context) => {
    if (structure.pages.length !== structure.pageCount) {
      context.addIssue({
        code: "custom",
        message: "pageCount 必须等于页面数量",
        path: ["pageCount"],
      });
    }
    structure.pages.forEach((page, index) => {
      const expectedId = `P${String(index + 1).padStart(2, "0")}`;
      if (page.id !== expectedId) {
        context.addIssue({
          code: "custom",
          message: `页面必须顺序编号为 ${expectedId}`,
          path: ["pages", index, "id"],
        });
      }
    });
  });

const LongformStructureSchema = z
  .object({
    schemaVersion: z.literal(OUTPUT_STRUCTURE_SCHEMA_VERSION),
    outputType: z.literal("longform"),
    width: z.literal(1080),
    maxHeight: z.literal(12000),
    regions: z
      .array(
        z
          .object({
            ...OutputNodeBaseShape,
            id: z.string().regex(/^R\d{2,}$/),
            role: z.enum(LONGFORM_ROLES),
          })
          .strict(),
      )
      .min(3)
      .max(30),
  })
  .strict()
  .superRefine((structure, context) => {
    structure.regions.forEach((region, index) => {
      const expectedId = `R${String(index + 1).padStart(2, "0")}`;
      if (region.id !== expectedId) {
        context.addIssue({
          code: "custom",
          message: `区段必须顺序编号为 ${expectedId}`,
          path: ["regions", index, "id"],
        });
      }
    });
  });

export const OutputStructureSchema = z.discriminatedUnion("outputType", [
  PresentationStructureSchema,
  LongformStructureSchema,
]);

export const ArtDirectionSchema = z
  .object({
    stylePackId: z.enum(STYLE_PACK_IDS),
    rationale: NonEmptyText.max(600),
    emphasisStrategy: NonEmptyText.max(400),
    pacing: NonEmptyText.max(400),
  })
  .strict();

export const AssetSearchPlanSchema = z
  .object({
    schemaVersion: z.literal(ASSET_SEARCH_PLAN_SCHEMA_VERSION),
    requests: z
      .array(
        z
          .object({
            id: z.string().regex(/^Q\d{2,}$/),
            outputNodeId: OutputNodeIdSchema,
            purpose: NonEmptyText.max(240),
            query: z.string().trim().min(2).max(120),
            orientation: z.enum(ASSET_ORIENTATIONS),
            required: z.boolean(),
          })
          .strict(),
      )
      .max(6),
  })
  .strict()
  .superRefine((plan, context) => {
    const requestIds = new Set<string>();
    plan.requests.forEach((request, index) => {
      if (requestIds.has(request.id)) {
        context.addIssue({
          code: "custom",
          message: "素材需求 ID 必须唯一",
          path: ["requests", index, "id"],
        });
      }
      requestIds.add(request.id);
    });
  });

const VisualItemBaseShape = {
  outputNodeId: OutputNodeIdSchema,
  density: z.enum(VISUAL_DENSITIES),
  accentBlockId: BlockIdSchema.nullable(),
  assetId: VisualAssetIdSchema.nullable(),
  mediaPlacement: z.enum(["none", "full-bleed", "left", "right", "inset"]),
  focalPointX: z.number().finite().min(0).max(1),
  focalPointY: z.number().finite().min(0).max(1),
};

export const VisualPlanSchema = z
  .discriminatedUnion("outputType", [
    z
      .object({
      schemaVersion: z.literal(VISUAL_PLAN_SCHEMA_VERSION),
      outputType: z.literal("pptx"),
      stylePackId: z.enum(STYLE_PACK_IDS),
      artDirection: ArtDirectionSchema,
      items: z
        .array(
          z
            .object({
              ...VisualItemBaseShape,
              recipeId: z.enum(PRESENTATION_RECIPE_IDS),
            })
            .strict(),
        )
        .min(4)
        .max(20),
    })
      .strict(),
    z
      .object({
      schemaVersion: z.literal(VISUAL_PLAN_SCHEMA_VERSION),
      outputType: z.literal("longform"),
      stylePackId: z.enum(STYLE_PACK_IDS),
      artDirection: ArtDirectionSchema,
      items: z
        .array(
          z
            .object({
              ...VisualItemBaseShape,
              recipeId: z.enum(LONGFORM_RECIPE_IDS),
            })
            .strict(),
        )
        .min(3)
        .max(30),
    })
      .strict(),
  ])
  .superRefine((plan, context) => {
    if (plan.stylePackId !== plan.artDirection.stylePackId) {
      context.addIssue({
        code: "custom",
        message: "视觉方案 StylePack 必须与 ArtDirection 一致",
        path: ["artDirection", "stylePackId"],
      });
    }
  });

export const VisualReviewSchema = z
  .object({
    schemaVersion: z.literal(VISUAL_REVIEW_SCHEMA_VERSION),
    verdict: z.enum(["approved", "revised"]),
    summary: NonEmptyText.max(600),
    issues: z
      .array(
        z
          .object({
            outputNodeId: OutputNodeIdSchema.nullable(),
            category: z.enum([
              "hierarchy",
              "density",
              "rhythm",
              "repetition",
              "typography",
              "color",
              "content-fit",
              "asset",
            ]),
            severity: z.enum(["suggestion", "important", "critical"]),
            observation: NonEmptyText.max(360),
            recommendation: NonEmptyText.max(360),
          })
          .strict(),
      )
      .max(30),
    revisedVisualPlan: VisualPlanSchema,
  })
  .strict();

export const ContentProjectInputSchema = z
  .object({
    topic: NonEmptyText.max(120),
    audience: NonEmptyText.max(300),
    objective: NonEmptyText.max(500),
    sourceMarkdown: NonEmptyText.max(50_000),
    sourceTreatment: NonEmptyText.max(500),
    tone: z.string().trim().max(100).optional(),
    mustInclude: z.array(NonEmptyText.max(100)).max(20),
    exclude: z.array(NonEmptyText.max(100)).max(20),
    language: z.enum(["zh-CN", "en-US"]),
  })
  .strict();

const TokenUsageSchema = z
  .object({
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  })
  .strict();

export const ContentProjectSchema = z
  .object({
    schemaVersion: z.literal(CONTENT_PROJECT_SCHEMA_VERSION),
    id: z.string().uuid(),
    input: ContentProjectInputSchema,
    materialPlan: MaterialPlanSchema,
    contentDocument: ContentDocumentSchema,
    contentMarkdown: z.string().min(1).max(120_000),
    contentRevision: z.number().int().positive(),
    contentConfirmedAt: z.string().datetime().nullable(),
    outputType: z.enum(OUTPUT_TYPES).nullable(),
    outputStructure: OutputStructureSchema.nullable(),
    selectedStylePackId: z.enum(STYLE_PACK_IDS).nullable(),
    artDirection: ArtDirectionSchema.nullable(),
    assetSearchPlan: AssetSearchPlanSchema.nullable(),
    assetDecisions: z.record(
      z.string().regex(/^Q\d{2,}$/),
      z.enum(["selected", "skipped"]),
    ),
    generator: z
      .object({
        model: z.literal(CONTENT_MODEL),
        promptVersion: z.string().min(1),
        usage: TokenUsageSchema,
      })
      .strict(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((project, context) => {
    if (
      project.outputStructure &&
      project.outputType !== project.outputStructure.outputType
    ) {
      context.addIssue({
        code: "custom",
        message: "项目产物类型必须与输出结构一致",
        path: ["outputStructure"],
      });
    }
    if (
      project.selectedStylePackId &&
      project.artDirection &&
      project.selectedStylePackId !== project.artDirection.stylePackId
    ) {
      context.addIssue({
        code: "custom",
        message: "项目确认的 StylePack 必须与 ArtDirection 一致",
        path: ["artDirection", "stylePackId"],
      });
    }
    const requestIds = new Set(project.assetSearchPlan?.requests.map((request) => request.id) ?? []);
    Object.keys(project.assetDecisions).forEach((requestId) => {
      if (!requestIds.has(requestId)) {
        context.addIssue({
          code: "custom",
          message: "素材决策必须引用现有搜索需求",
          path: ["assetDecisions", requestId],
        });
      }
    });
  });

export interface VisualAssetRecord {
  id: string;
  projectId: string;
  provider: "pexels" | "upload";
  providerAssetId?: string;
  name: string;
  alt: string;
  purpose: string;
  outputNodeId?: string;
  searchRequestId?: string;
  photographer?: string;
  photographerUrl?: string;
  sourceUrl?: string;
  width: number;
  height: number;
  averageColor?: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  blob: Blob;
  createdAt: string;
}

export type ContentBlock = z.infer<typeof ContentBlockSchema>;
export type ContentBlockType = ContentBlock["type"];
export type MaterialPlanV1 = z.infer<typeof MaterialPlanSchema>;
export type ContentDocumentV1 = z.infer<typeof ContentDocumentSchema>;
export type OutputStructureV1 = z.infer<typeof OutputStructureSchema>;
export type PresentationStructureV1 = z.infer<typeof PresentationStructureSchema>;
export type LongformStructureV1 = z.infer<typeof LongformStructureSchema>;
export type ArtDirection = z.infer<typeof ArtDirectionSchema>;
export type AssetSearchPlanV1 = z.infer<typeof AssetSearchPlanSchema>;
export type VisualPlanV1 = z.infer<typeof VisualPlanSchema>;
export type VisualReviewV1 = z.infer<typeof VisualReviewSchema>;
export type ContentProjectInput = z.infer<typeof ContentProjectInputSchema>;
export type ContentProjectV1 = z.infer<typeof ContentProjectSchema>;
export type OutputType = (typeof OUTPUT_TYPES)[number];
export type StylePackId = (typeof STYLE_PACK_IDS)[number];
export type PresentationRole = (typeof PRESENTATION_ROLES)[number];
export type LongformRole = (typeof LONGFORM_ROLES)[number];
export type PresentationRecipeId = (typeof PRESENTATION_RECIPE_IDS)[number];
export type LongformRecipeId = (typeof LONGFORM_RECIPE_IDS)[number];

export function getContentBlockIds(document: ContentDocumentV1): string[] {
  return document.sections.flatMap((section) => section.blocks.map((block) => block.id));
}

export function getOutputNodes(structure: OutputStructureV1) {
  return structure.outputType === "pptx" ? structure.pages : structure.regions;
}

export function getOutputStructureIssues(
  structure: OutputStructureV1,
  contentDocument: ContentDocumentV1,
): string[] {
  const expectedBlockIds = getContentBlockIds(contentDocument);
  const expected = new Set(expectedBlockIds);
  const referenced = getOutputNodes(structure).flatMap((node) => node.blockIds);
  const issues: string[] = [];

  referenced.forEach((blockId) => {
    if (!expected.has(blockId)) issues.push(`输出结构引用了不存在的内容块 ${blockId}`);
  });
  expectedBlockIds.forEach((blockId) => {
    const count = referenced.filter((candidate) => candidate === blockId).length;
    if (count === 0) issues.push(`内容块 ${blockId} 必须在输出结构中至少出现一次`);
  });
  return issues;
}

const normalizeNodeBlockIds = (
  nodes: ReadonlyArray<{ blockIds: string[] }>,
  expectedBlockIds: string[],
) => {
  const validBlockIds = new Set(expectedBlockIds);
  const claimedBlockIds = new Set<string>();
  const normalized = nodes.map((node) => {
    const blockIds: string[] = [];
    node.blockIds.forEach((blockId) => {
      if (!validBlockIds.has(blockId) || claimedBlockIds.has(blockId)) return;
      claimedBlockIds.add(blockId);
      blockIds.push(blockId);
    });
    return blockIds;
  });

  const missingBlockIds = expectedBlockIds.filter(
    (blockId) => !claimedBlockIds.has(blockId),
  );
  missingBlockIds.forEach((blockId) => {
    const targetIndex = normalized.reduce(
      (bestIndex, blockIds, index) => {
        if (blockIds.length >= 8) return bestIndex;
        if (bestIndex === -1 || blockIds.length < normalized[bestIndex].length) {
          return index;
        }
        return bestIndex;
      },
      -1,
    );
    if (targetIndex !== -1) normalized[targetIndex].push(blockId);
  });

  // A carrier can require more output nodes than the document has blocks
  // (for example, PPT requires at least four pages). Reuse a valid block only
  // when it is necessary to keep every output node renderable.
  normalized.forEach((blockIds, index) => {
    if (blockIds.length === 0 && expectedBlockIds.length > 0) {
      blockIds.push(expectedBlockIds[index % expectedBlockIds.length]);
    }
  });

  return normalized;
};

export function normalizeOutputStructureBlockRefs(
  structure: OutputStructureV1,
  contentDocument: ContentDocumentV1,
): OutputStructureV1 {
  const expectedBlockIds = getContentBlockIds(contentDocument);
  const nodes = getOutputNodes(structure);
  const normalizedBlockIds = normalizeNodeBlockIds(nodes, expectedBlockIds);

  return structure.outputType === "pptx"
    ? {
        ...structure,
        pages: structure.pages.map((page, index) => ({
          ...page,
          blockIds: normalizedBlockIds[index],
        })),
      }
    : {
        ...structure,
        regions: structure.regions.map((region, index) => ({
          ...region,
          blockIds: normalizedBlockIds[index],
        })),
      };
}

export function getVisualPlanIssues(
  visualPlan: VisualPlanV1,
  outputStructure: OutputStructureV1,
  assetIds: readonly string[],
): string[] {
  const issues: string[] = [];
  if (visualPlan.outputType !== outputStructure.outputType) {
    issues.push("视觉方案产物类型与输出结构不一致");
    return issues;
  }
  const nodes = getOutputNodes(outputStructure);
  if (visualPlan.items.length !== nodes.length) {
    issues.push("视觉方案节点数量与输出结构不一致");
  }
  visualPlan.items.forEach((item, index) => {
    if (item.outputNodeId !== nodes[index]?.id) {
      issues.push(`视觉方案第 ${index + 1} 项必须对应 ${nodes[index]?.id ?? "现有节点"}`);
    }
    if (item.assetId && !assetIds.includes(item.assetId)) {
      issues.push(`视觉方案引用了不存在的素材 ${item.assetId}`);
    }
    if (item.mediaPlacement === "none" && item.assetId !== null) {
      issues.push(`${item.outputNodeId} 未使用媒体布局时不能引用素材`);
    }
  });
  for (let index = 2; index < visualPlan.items.length; index += 1) {
    const current = visualPlan.items[index];
    if (
      current.recipeId === visualPlan.items[index - 1]?.recipeId &&
      current.recipeId === visualPlan.items[index - 2]?.recipeId
    ) {
      issues.push(`${current.outputNodeId} 与前两项连续重复同一布局配方`);
    }
  }
  return issues;
}
