import type {
  CreatePptStructureInput,
  PptMaterialPlanV1,
  PptProjectV1,
  PptStructureV1,
  PptTokenUsageV1,
  PptVisualPlanV2,
  PptVisualReviewDecisionV1,
  PptVisualReviewV1,
} from "@/features/ai-ppt/schema";

export function createTestPptTokenUsage(overrides: Partial<PptTokenUsageV1> = {}): PptTokenUsageV1 {
  return {
    total_tokens: 10_110,
    completion_tokens: 4_194,
    prompt_tokens: 5_916,
    completion_tokens_details: {
      reasoning_tokens: 3_120,
      text_tokens: 4_194,
    },
    prompt_tokens_details: {
      cached_tokens: 0,
      text_tokens: 5_916,
    },
    ...overrides,
  };
}

export function createTestPptInput(): CreatePptStructureInput {
  return {
    topic: "AI 产品战略",
    audience: "公司管理层",
    objective: "获得下一阶段研发预算批准",
    sourceMarkdown:
      "# 背景\n当前产品进入规模化阶段。\n\n# 资源需求\n下一阶段需要明确资源配置方案。",
    sourceTreatment:
      "以已有材料为内容边界；允许围绕演示目标重组、提炼和调整顺序，但不得新增材料外的事实、数字或结论。",
    slideCount: 4,
    deliveryContext: "内部评审",
    durationMinutes: 20,
    tone: "专业简洁",
    mustInclude: ["资源需求"],
    exclude: ["未经支持的数据"],
    language: "zh-CN",
  };
}

export function createTestPptMaterialPlan(): PptMaterialPlanV1 {
  return {
    schemaVersion: "ppt-material-plan/v1",
    sourceSummary: "产品已进入规模化阶段，需要围绕资源投入形成管理层决策材料。",
    facts: [
      {
        id: "F001",
        kind: "fact",
        priority: "required",
        statement: "当前产品进入规模化阶段。",
        sourceExcerpt: "当前产品进入规模化阶段。",
        sourceLocation: "背景",
      },
      {
        id: "F002",
        kind: "constraint",
        priority: "supporting",
        statement: "下一阶段需要明确资源配置方案。",
        sourceExcerpt: "下一阶段需要明确资源配置方案。",
        sourceLocation: "资源需求",
      },
    ],
    gaps: ["材料未提供可验证的投入产出数字。"],
    direction: {
      title: "AI 产品规模化投入决策",
      coreMessage: "围绕规模化阶段的重点场景配置资源，并用明确验证路径控制投入风险。",
      narrativeMode: "pyramid",
      rationale: "管理层需要先看到决策结论，再理解材料支持的背景和资源安排。",
      sections: [
        {
          id: "S01",
          title: "决策背景与行动",
          objective: "说明规模化阶段及其资源要求。",
          factIds: ["F001", "F002"],
        },
      ],
    },
  };
}

export function createTestPptStructure(): PptStructureV1 {
  return {
    schemaVersion: "ppt-structure/v1",
    deck: {
      title: "AI 产品战略",
      subtitle: "从能力建设到商业价值",
      language: "zh-CN",
      audience: "公司管理层",
      purpose: "获得下一阶段研发预算批准",
      coreMessage: "聚焦高价值场景能让 AI 投入形成可衡量回报。",
      deliveryContext: "20 分钟内部评审",
      readingMode: "balanced",
      narrativeMode: "pyramid",
      pageCount: 4,
    },
    sections: [
      {
        id: "main",
        title: "战略主线",
        objective: "从结论推进到行动",
        slideIds: ["P01", "P02", "P03", "P04"],
      },
    ],
    slides: [
      {
        id: "P01",
        index: 1,
        sectionId: "main",
        role: "cover",
        title: "AI 产品战略",
        coreMessage: "聚焦高价值场景，建立可持续的 AI 产品能力。",
        audienceMove: { before: "等待了解主题", after: "明确本次汇报的决策焦点" },
        layoutIntent: "cover",
        contentBlocks: [{ type: "paragraph", text: "2026 年内部战略评审" }],
        evidenceRefs: [],
        speakerNotes: "说明汇报目标。",
      },
      {
        id: "P02",
        index: 2,
        sectionId: "main",
        role: "agenda",
        title: "今天需要回答三个问题",
        coreMessage: "机会、方案和投入共同构成决策闭环。",
        audienceMove: { before: "尚不清楚结构", after: "理解讨论路径" },
        layoutIntent: "title-bullets",
        contentBlocks: [
          { type: "bullet-list", items: ["为什么现在做", "优先做什么", "需要什么投入"] },
        ],
        evidenceRefs: ["F002"],
      },
      {
        id: "P03",
        index: 3,
        sectionId: "main",
        role: "content",
        title: "高价值场景应成为第一优先级",
        coreMessage: "先验证业务收益，再扩大技术覆盖面。",
        audienceMove: { before: "关注能力数量", after: "关注价值验证顺序" },
        layoutIntent: "title-body",
        contentBlocks: [
          { type: "paragraph", text: "优先选择需求稳定、数据可得、收益可量化的场景。" },
        ],
        evidenceRefs: ["F001"],
      },
      {
        id: "P04",
        index: 4,
        sectionId: "main",
        role: "summary",
        title: "下一步：用一个季度验证投入产出",
        coreMessage: "批准试点资源即可启动价值验证。",
        audienceMove: { before: "理解方案", after: "愿意做出资源决策" },
        layoutIntent: "summary",
        contentBlocks: [
          { type: "bullet-list", items: ["确认试点范围", "配置核心团队", "设定季度指标"] },
        ],
        evidenceRefs: ["F001", "F002"],
      },
    ],
  };
}

export function createTestPptProject(
  overrides: Partial<Pick<PptProjectV1, "id" | "createdAt" | "updatedAt">> = {},
): PptProjectV1 {
  return {
    schemaVersion: 1,
    id: overrides.id ?? "11111111-1111-4111-8111-111111111111",
    input: createTestPptInput(),
    materialPlan: createTestPptMaterialPlan(),
    structure: createTestPptStructure(),
    generator: {
      model: "qwen3.7-plus",
      promptVersion: "ppt-structure/v1",
      usage: createTestPptTokenUsage(),
    },
    createdAt: overrides.createdAt ?? "2026-07-29T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-29T00:00:00.000Z",
  };
}

export function createTestPptVisualPlan(): PptVisualPlanV2 {
  return {
    schemaVersion: "ppt-visual-plan/v2",
    theme: {
      style: "editorial",
      primaryColor: "#4F46E5",
      accentColor: "#F59E0B",
      backgroundColor: "#F8FAFC",
      foregroundColor: "#111827",
      surfaceColor: "#FFFFFF",
      mutedColor: "#64748B",
      borderColor: "#CBD5E1",
      headingFont: "noto-sans-sc",
      bodyFont: "noto-sans-sc",
      cornerStyle: "soft",
    },
    designSystem: {
      grid: "editorial",
      typeScale: "balanced",
      motif: "rules",
      mediaPolicy: "none",
    },
    slides: [
      {
        slideId: "P01",
        layoutVariant: "cover-editorial",
        density: "spacious",
        visualFocus: "聚焦高价值场景",
        accentBlockIndex: 0,
        tableStyle: "minimal",
        rhythm: "breathing",
        primaryVisual: "typography",
        composition: "centered-statement",
        assetId: null,
        mediaLayout: "none",
        imageTreatment: "natural",
        focalPointX: 0.5,
        focalPointY: 0.5,
      },
      {
        slideId: "P02",
        layoutVariant: "agenda-list",
        density: "standard",
        visualFocus: "三个决策问题",
        accentBlockIndex: null,
        tableStyle: "minimal",
        rhythm: "anchor",
        primaryVisual: "typography",
        composition: "modular-grid",
        assetId: null,
        mediaLayout: "none",
        imageTreatment: "natural",
        focalPointX: 0.5,
        focalPointY: 0.5,
      },
      {
        slideId: "P03",
        layoutVariant: "content-editorial",
        density: "standard",
        visualFocus: "价值验证顺序",
        accentBlockIndex: 0,
        tableStyle: "soft",
        rhythm: "anchor",
        primaryVisual: "mixed",
        composition: "asymmetric-split",
        assetId: null,
        mediaLayout: "none",
        imageTreatment: "natural",
        focalPointX: 0.5,
        focalPointY: 0.5,
      },
      {
        slideId: "P04",
        layoutVariant: "summary-list",
        density: "spacious",
        visualFocus: "下一季度行动",
        accentBlockIndex: 0,
        tableStyle: "contrast",
        rhythm: "breathing",
        primaryVisual: "typography",
        composition: "action-close",
        assetId: null,
        mediaLayout: "none",
        imageTreatment: "natural",
        focalPointX: 0.5,
        focalPointY: 0.5,
      },
    ],
  };
}

export function createTestPptVisualReview(
  visualPlan: PptVisualPlanV2 = createTestPptVisualPlan(),
): PptVisualReviewV1 {
  return {
    schemaVersion: "ppt-visual-review/v1",
    verdict: "approved",
    summary: "整套页面层级清楚，疏密节奏和构图变化达到专业演示基线。",
    strengths: ["封面与内容页层级明确", "相邻页面轮廓具有变化"],
    issues: [],
    themeChanged: false,
    designSystemChanged: false,
    revisedSlideIds: [],
    revisedVisualPlan: visualPlan,
  };
}

export function createTestPptVisualReviewDecision(): PptVisualReviewDecisionV1 {
  return {
    schemaVersion: "ppt-visual-review-decision/v1",
    summary: "整套页面层级清楚，疏密节奏和构图变化达到专业演示基线。",
    strengths: ["封面与内容页层级明确", "相邻页面轮廓具有变化"],
    issues: [],
    themePatch: {},
    designSystemPatch: {},
    slidePatches: [],
  };
}
