import {
  CreatePptStructureInputSchema,
  getPptMaterialCoverage,
  getPptMaterialPlanJsonSchema,
  getPptStructureJsonSchema,
  getPptStructureMaterialIssues,
  getPptVisualPlanJsonSchema,
  getPptVisualPlanStructureIssues,
  getPptVisualReviewJsonSchema,
  getPptVisualReviewStructureIssues,
  PptMaterialPlanSchema,
  PptProjectSchema,
  PptStructureSchema,
  PptVisualPlanSchema,
  PptVisualReviewSchema,
} from "@/features/ai-ppt/schema";
import {
  createTestPptInput,
  createTestPptMaterialPlan,
  createTestPptProject,
  createTestPptStructure,
  createTestPptVisualPlan,
  createTestPptVisualReview,
} from "@/features/ai-ppt/test-fixtures";

describe("PptStructureSchema", () => {
  it("accepts a complete valid structure and exports one JSON Schema contract", () => {
    expect(PptStructureSchema.parse(createTestPptStructure())).toEqual(createTestPptStructure());
    expect(getPptStructureJsonSchema()).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
  });

  it.each([
    [
      "page count",
      (structure: ReturnType<typeof createTestPptStructure>) => {
        structure.deck.pageCount = 8;
      },
    ],
    [
      "slide ids",
      (structure: ReturnType<typeof createTestPptStructure>) => {
        structure.slides[1].id = "P08";
      },
    ],
    [
      "cover",
      (structure: ReturnType<typeof createTestPptStructure>) => {
        structure.slides[0].role = "content";
      },
    ],
    [
      "closing",
      (structure: ReturnType<typeof createTestPptStructure>) => {
        structure.slides[3].role = "content";
      },
    ],
    [
      "section reference",
      (structure: ReturnType<typeof createTestPptStructure>) => {
        structure.slides[2].sectionId = "missing";
      },
    ],
    [
      "layout compatibility",
      (structure: ReturnType<typeof createTestPptStructure>) => {
        structure.slides[2].layoutIntent = "comparison";
      },
    ],
  ])("rejects an invalid %s", (_, mutate) => {
    const structure = structuredClone(createTestPptStructure());
    mutate(structure);
    expect(PptStructureSchema.safeParse(structure).success).toBe(false);
  });

  it("rejects table rows whose cell count differs from the header", () => {
    const structure = structuredClone(createTestPptStructure());
    structure.slides[2].contentBlocks = [
      {
        type: "table",
        columns: ["指标", "结果"],
        rows: [["客户数"]],
      },
    ];

    expect(PptStructureSchema.safeParse(structure).success).toBe(false);
  });

  it("accepts editable chart and diagram blocks and rejects broken relationships", () => {
    const structure = structuredClone(createTestPptStructure());
    structure.slides[2] = {
      ...structure.slides[2],
      layoutIntent: "chart",
      contentBlocks: [
        {
          type: "chart",
          relationship: "trend",
          takeaway: "增长速度正在加快。",
          categories: ["Q1", "Q2", "Q3"],
          series: [{ name: "收入", values: [10, 16, 25] }],
        },
      ],
    };
    expect(PptStructureSchema.safeParse(structure).success).toBe(true);

    structure.slides[2] = {
      ...structure.slides[2],
      layoutIntent: "diagram",
      contentBlocks: [
        {
          type: "diagram",
          relationship: "system",
          nodes: [
            { id: "core", label: "核心引擎" },
            { id: "input", label: "输入" },
          ],
          edges: [{ from: "missing", to: "core" }],
        },
      ],
    };
    expect(PptStructureSchema.safeParse(structure).success).toBe(false);
  });

  it("enforces the Markdown material limit", () => {
    const input = createTestPptInput();
    input.sourceMarkdown = "字".repeat(50_001);

    expect(CreatePptStructureInputSchema.safeParse(input).success).toBe(false);
  });

  it("校验材料事实、方向引用和逐页来源覆盖", () => {
    const materialPlan = createTestPptMaterialPlan();
    const structure = createTestPptStructure();

    expect(PptMaterialPlanSchema.parse(materialPlan)).toEqual(materialPlan);
    expect(getPptMaterialPlanJsonSchema()).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
    expect(getPptStructureMaterialIssues(structure, materialPlan)).toEqual([]);
    expect(getPptMaterialCoverage(structure, materialPlan)).toMatchObject({
      coveragePercent: 100,
      coveredFactCount: 2,
      totalFactCount: 2,
      coveredRequiredFactCount: 1,
      requiredFactCount: 1,
    });

    structure.slides.forEach((slide) => {
      slide.evidenceRefs = slide.evidenceRefs.filter((factId) => factId !== "F001");
    });
    expect(getPptStructureMaterialIssues(structure, materialPlan)).toContain(
      "必需材料事实 F001 未被任何页面使用",
    );
  });

  it("校验视觉方案并导出相同的结构契约", () => {
    const plan = createTestPptVisualPlan();
    expect(PptVisualPlanSchema.parse(plan)).toEqual(plan);
    expect(getPptVisualPlanJsonSchema()).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
    expect(getPptVisualPlanStructureIssues(plan, createTestPptStructure())).toEqual([]);
  });

  it("拒绝无效颜色、重复页面和不存在的内容块引用", () => {
    const plan = createTestPptVisualPlan();
    plan.theme.primaryColor = "blue";
    plan.slides[1] = { ...plan.slides[1], slideId: "P01" };
    expect(PptVisualPlanSchema.safeParse(plan).success).toBe(false);

    const referencePlan = createTestPptVisualPlan();
    referencePlan.slides[2] = { ...referencePlan.slides[2], accentBlockIndex: 7 };
    expect(getPptVisualPlanStructureIssues(referencePlan, createTestPptStructure())).toContain(
      "视觉方案 P03 的强调内容块编号不存在",
    );
  });

  it("校验视觉评审声明与实际 VisualPlan 修订一致", () => {
    const sourcePlan = createTestPptVisualPlan();
    const revisedPlan = structuredClone(sourcePlan);
    revisedPlan.slides[2] = {
      ...revisedPlan.slides[2],
      layoutVariant: "content-rail",
    };
    const review = {
      ...createTestPptVisualReview(revisedPlan),
      verdict: "revised" as const,
      summary: "第三页的信息层级需要更明确。",
      issues: [
        {
          slideId: "P03",
          category: "hierarchy" as const,
          severity: "important" as const,
          observation: "第三页的主次信息竞争。",
          recommendation: "改为带解释栏的内容构图。",
        },
      ],
      revisedSlideIds: ["P03"],
    };

    expect(PptVisualReviewSchema.parse(review)).toEqual(review);
    expect(getPptVisualReviewJsonSchema()).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
    expect(
      getPptVisualReviewStructureIssues(review, sourcePlan, createTestPptStructure()),
    ).toEqual([]);

    review.revisedSlideIds = [];
    expect(
      getPptVisualReviewStructureIssues(review, sourcePlan, createTestPptStructure()),
    ).toContain("视觉评审声明的修订页面与实际 VisualPlan 变化不一致");

    review.revisedVisualPlan.slides[2] = {
      ...review.revisedVisualPlan.slides[2],
      visualFocus: "评审阶段改写的可见文案",
    };
    expect(
      getPptVisualReviewStructureIssues(review, sourcePlan, createTestPptStructure()),
    ).toContain("视觉评审不得修改 P03 的观众可见视觉焦点文案");
  });
});

describe("PptProjectSchema", () => {
  it("要求项目记录模型用量", () => {
    const project = createTestPptProject();
    expect(PptProjectSchema.safeParse(project).success).toBe(true);

    const withoutUsage = structuredClone(project) as Record<string, unknown>;
    const generator = withoutUsage.generator as Record<string, unknown>;
    delete generator.usage;

    expect(PptProjectSchema.safeParse(withoutUsage).success).toBe(false);
  });
});
