import type {
  ContentDocumentV1,
  LongformStructureV1,
  MaterialPlanV1,
  PresentationStructureV1,
  VisualPlanV1,
} from "./schema";

export const createContentDocumentFixture = (): ContentDocumentV1 => ({
  schemaVersion: "content-document/v1",
  title: "从材料到视觉产物",
  subtitle: "同一事实源，多种载体",
  language: "zh-CN",
  audience: "产品与设计团队",
  purpose: "说明通用内容工作台的价值",
  coreMessage: "先稳定内容语义，再确定载体与视觉表达。",
  sections: [
    {
      id: "S01",
      title: "核心方法",
      objective: "解释内容与视觉解耦的必要性。",
      blocks: [
        {
          id: "B001",
          type: "paragraph",
          text: "ContentDocument 保存稳定语义，Markdown 只承担人工确认和交换格式。",
          evidenceRefs: ["F001"],
        },
        {
          id: "B002",
          type: "metrics",
          items: [
            { value: "1", label: "唯一事实源", context: "JSON" },
            { value: "6", label: "可执行 StylePack" },
          ],
          evidenceRefs: ["F002"],
        },
      ],
    },
    {
      id: "S02",
      title: "跨载体输出",
      objective: "说明 PPT 和长图的结构差异。",
      blocks: [
        {
          id: "B003",
          type: "chart",
          relationship: "comparison",
          takeaway: "不同载体使用不同阅读节奏",
          categories: ["PPT", "长图"],
          series: [{ name: "阅读连续度", values: [35, 90] }],
          evidenceRefs: ["F003"],
        },
        {
          id: "B004",
          type: "quote",
          quote: "模型选择注册 ID，确定性渲染器负责坐标。",
          attribution: "视觉规划原则",
          evidenceRefs: ["F004"],
        },
      ],
    },
  ],
});

export const createMaterialPlanFixture = (): MaterialPlanV1 => ({
  schemaVersion: "material-plan/v1",
  sourceSummary: "通用内容工作台方案。",
  facts: [
    { id: "F001", kind: "fact", priority: "required", statement: "JSON 是唯一事实源", sourceExcerpt: "JSON 是唯一事实源" },
    { id: "F002", kind: "data", priority: "required", statement: "首期六套样式", sourceExcerpt: "首期六套样式" },
    { id: "F003", kind: "claim", priority: "supporting", statement: "载体阅读节奏不同", sourceExcerpt: "载体阅读节奏不同" },
    { id: "F004", kind: "constraint", priority: "required", statement: "模型不输出坐标", sourceExcerpt: "模型不输出坐标" },
  ],
  gaps: [],
  direction: {
    title: "通用内容到视觉",
    coreMessage: "内容事实与视觉表达分层。",
    rationale: "同一内容可以安全地产生不同载体。",
    sections: [
      { id: "S01", title: "核心方法", objective: "解释内容层", factIds: ["F001", "F002"] },
      { id: "S02", title: "跨载体", objective: "解释输出层", factIds: ["F003", "F004"] },
    ],
  },
});

export const createPresentationStructureFixture = (): PresentationStructureV1 => ({
  schemaVersion: "output-structure/v1",
  outputType: "pptx",
  width: 1600,
  height: 900,
  pageCount: 4,
  pages: [
    { id: "P01", role: "cover", title: "从材料到视觉产物", coreMessage: "先稳定内容语义。", blockIds: ["B001"], audienceMove: { before: "关注输出形式", after: "理解事实源优先" } },
    { id: "P02", role: "data", title: "系统的确定性边界", coreMessage: "六套样式共享一套语义模型。", blockIds: ["B002"], audienceMove: { before: "认为样式只是配色", after: "理解样式是完整 token" } },
    { id: "P03", role: "data", title: "载体节奏不同", coreMessage: "PPT 翻页，长图连续。", blockIds: ["B003"], audienceMove: { before: "混淆两种载体", after: "理解结构差异" } },
    { id: "P04", role: "closing", title: "让模型选 ID", coreMessage: "渲染器负责确定坐标。", blockIds: ["B004"], audienceMove: { before: "依赖任意坐标", after: "接受受控生成" } },
  ],
});

export const createLongformStructureFixture = (): LongformStructureV1 => ({
  schemaVersion: "output-structure/v1",
  outputType: "longform",
  width: 1080,
  maxHeight: 12000,
  regions: [
    { id: "R01", role: "hero", title: "从材料到视觉产物", coreMessage: "先稳定内容语义。", blockIds: ["B001"] },
    { id: "R02", role: "data", title: "可执行视觉系统", coreMessage: "样式包包含完整视觉 token。", blockIds: ["B002"] },
    { id: "R03", role: "data", title: "载体节奏不同", coreMessage: "PPT 翻页，长图连续。", blockIds: ["B003"] },
    { id: "R04", role: "closing", title: "确定性渲染", coreMessage: "模型选 ID，系统算坐标。", blockIds: ["B004"] },
  ],
});

export const createPresentationVisualPlanFixture = (
  stylePackId: VisualPlanV1["stylePackId"] = "modern-corporate",
): Extract<VisualPlanV1, { outputType: "pptx" }> => ({
  schemaVersion: "visual-plan/v1",
  outputType: "pptx",
  stylePackId,
  artDirection: {
    stylePackId,
    rationale: "清晰表达系统层次。",
    emphasisStrategy: "标题和数据优先。",
    pacing: "封面、指标、图表、收尾。",
  },
  items: [
    { outputNodeId: "P01", recipeId: "cover-editorial", density: "spacious", accentBlockId: "B001", assetId: null, mediaPlacement: "none", focalPointX: 0.5, focalPointY: 0.5 },
    { outputNodeId: "P02", recipeId: "metrics-cluster", density: "standard", accentBlockId: "B002", assetId: null, mediaPlacement: "none", focalPointX: 0.5, focalPointY: 0.5 },
    { outputNodeId: "P03", recipeId: "chart-insight", density: "standard", accentBlockId: "B003", assetId: null, mediaPlacement: "none", focalPointX: 0.5, focalPointY: 0.5 },
    { outputNodeId: "P04", recipeId: "action-close", density: "spacious", accentBlockId: "B004", assetId: null, mediaPlacement: "none", focalPointX: 0.5, focalPointY: 0.5 },
  ],
});

export const createLongformVisualPlanFixture = (
  stylePackId: VisualPlanV1["stylePackId"] = "warm-editorial",
): Extract<VisualPlanV1, { outputType: "longform" }> => ({
  schemaVersion: "visual-plan/v1",
  outputType: "longform",
  stylePackId,
  artDirection: {
    stylePackId,
    rationale: "适合连续阅读。",
    emphasisStrategy: "章节与数据交替。",
    pacing: "由 hero 进入数据故事并收尾。",
  },
  items: [
    { outputNodeId: "R01", recipeId: "longform-hero", density: "spacious", accentBlockId: "B001", assetId: null, mediaPlacement: "none", focalPointX: 0.5, focalPointY: 0.5 },
    { outputNodeId: "R02", recipeId: "metrics-strip", density: "standard", accentBlockId: "B002", assetId: null, mediaPlacement: "none", focalPointX: 0.5, focalPointY: 0.5 },
    { outputNodeId: "R03", recipeId: "data-story", density: "standard", accentBlockId: "B003", assetId: null, mediaPlacement: "none", focalPointX: 0.5, focalPointY: 0.5 },
    { outputNodeId: "R04", recipeId: "longform-close", density: "spacious", accentBlockId: "B004", assetId: null, mediaPlacement: "none", focalPointX: 0.5, focalPointY: 0.5 },
  ],
});
