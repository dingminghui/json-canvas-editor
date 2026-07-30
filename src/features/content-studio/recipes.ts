import {
  LONGFORM_RECIPE_IDS,
  PRESENTATION_RECIPE_IDS,
  type ContentBlockType,
  type LongformRecipeId,
  type LongformRole,
  type OutputType,
  type PresentationRecipeId,
  type PresentationRole,
} from "./schema";

export interface RecipeCapacity {
  maxBlocks: number;
  maxCharacters: number;
  maxItems: number;
  imageCount: { min: number; max: number };
  imageRatios: string[];
}

export interface LayoutRecipe<
  TId extends PresentationRecipeId | LongformRecipeId = PresentationRecipeId | LongformRecipeId,
> {
  id: TId;
  outputType: OutputType;
  label: string;
  description: string;
  roles: readonly (PresentationRole | LongformRole)[];
  blockTypes: readonly ContentBlockType[];
  densities: readonly ("spacious" | "standard" | "compact")[];
  capacity: RecipeCapacity;
  renderer: TId;
}

const textTypes = ["paragraph", "bullet-list", "numbered-list", "quote"] as const;
const dataTypes = ["metrics", "chart", "table"] as const;
const relationshipTypes = ["process", "diagram"] as const;
const allTypes = [
  ...textTypes,
  "comparison",
  ...relationshipTypes,
  ...dataTypes,
] as const satisfies readonly ContentBlockType[];

const capacity = (
  maxBlocks: number,
  maxCharacters: number,
  maxItems: number,
  imageMax = 1,
  ratios = ["16:9", "4:3", "1:1"],
): RecipeCapacity => ({
  maxBlocks,
  maxCharacters,
  maxItems,
  imageCount: { min: 0, max: imageMax },
  imageRatios: ratios,
});

const ppt = (
  id: PresentationRecipeId,
  label: string,
  roles: PresentationRole[],
  blockTypes: readonly ContentBlockType[],
  recipeCapacity: RecipeCapacity,
  description: string,
): LayoutRecipe<PresentationRecipeId> => ({
  id,
  outputType: "pptx",
  label,
  description,
  roles,
  blockTypes,
  densities: ["spacious", "standard", "compact"],
  capacity: recipeCapacity,
  renderer: id,
});

const longform = (
  id: LongformRecipeId,
  label: string,
  roles: LongformRole[],
  blockTypes: readonly ContentBlockType[],
  recipeCapacity: RecipeCapacity,
  description: string,
): LayoutRecipe<LongformRecipeId> => ({
  id,
  outputType: "longform",
  label,
  description,
  roles,
  blockTypes,
  densities: ["spacious", "standard", "compact"],
  capacity: recipeCapacity,
  renderer: id,
});

export const PRESENTATION_RECIPES = [
  ppt("cover-editorial", "封面", ["cover"], textTypes, capacity(2, 110, 2, 1, ["16:9"]), "单一强标题与可选主图。"),
  ppt("cover-split-media", "分屏封面", ["cover"], textTypes, capacity(3, 150, 3, 1, ["4:3"]), "文本与图像各占半场。"),
  ppt("section-statement", "章节陈述", ["section"], textTypes, capacity(2, 170, 3, 0), "用一句核心判断推进叙事。"),
  ppt("agenda-rail", "议程轨道", ["agenda"], ["bullet-list", "numbered-list"], capacity(2, 240, 8, 0), "按顺序展示议程和阅读推进。"),
  ppt("editorial-flow", "编辑流", ["content", "summary"], textTypes, capacity(4, 520, 7, 1), "杂志式标题、正文与侧注。"),
  ppt("asymmetric-split", "非对称分栏", ["content"], allTypes, capacity(4, 480, 7, 1), "主次明确的 2:1 内容分栏。"),
  ppt("modular-grid", "模块网格", ["content", "data"], [...textTypes, "metrics"], capacity(6, 420, 8, 0), "多个平级模块组成规则网格。"),
  ppt("comparison-panels", "对比", ["comparison"], ["comparison"], capacity(2, 460, 10, 0), "左右对照并突出差异。"),
  ppt("process-flow", "流程", ["process"], ["process"], capacity(2, 330, 7, 0), "水平步骤与因果推进。"),
  ppt("timeline-ribbon", "时间线", ["timeline"], ["process"], capacity(2, 360, 8, 0), "沿时间轴组织节点。"),
  ppt("metrics-cluster", "指标", ["data"], ["metrics"], capacity(2, 200, 6, 0), "大数字与短标签优先。"),
  ppt("chart-insight", "图表洞察", ["data"], ["chart", "paragraph"], capacity(3, 300, 8, 0), "图表为主，旁置结论与注释。"),
  ppt("relationship-map", "关系图", ["data"], ["diagram"], capacity(2, 260, 9, 0), "展示节点、边与核心关系。"),
  ppt("table-report", "表格报告", ["data"], ["table"], capacity(1, 650, 36, 0), "紧凑表格和表头强调。"),
  ppt("quote-focus", "引用", ["content", "summary"], ["quote"], capacity(1, 260, 2, 1), "将关键引语作为视觉焦点。"),
  ppt("action-close", "行动收尾", ["closing"], textTypes, capacity(3, 260, 5, 0), "结论、下一步和行动号召。"),
] as const;

export const LONGFORM_RECIPES = [
  longform("longform-hero", "长图封面", ["hero"], textTypes, capacity(3, 170, 3, 1, ["4:3", "16:9"]), "标题、导语与视觉入口。"),
  longform("chapter-band", "章节带", ["chapter"], textTypes, capacity(2, 180, 3, 0), "用色带切分长图章节。"),
  longform("editorial-section", "编辑式正文", ["content"], textTypes, capacity(5, 900, 10, 0), "适合连续阅读的正文模块。"),
  longform("split-media-section", "图文分栏", ["content"], textTypes, capacity(4, 560, 8, 1, ["4:3", "1:1"]), "图片与文本在固定宽度中并置。"),
  longform("modular-highlights", "重点模块", ["content", "data"], allTypes, capacity(6, 620, 10, 0), "用模块强调重点信息，也作为复杂混合内容的安全回退。"),
  longform("comparison-stack", "纵向对比", ["comparison"], ["comparison"], capacity(2, 700, 12, 0), "上下或双列呈现对比信息。"),
  longform("process-stack", "纵向流程", ["process"], ["process", "diagram"], capacity(2, 560, 9, 0), "沿纵轴展开步骤或关系。"),
  longform("metrics-strip", "指标带", ["data"], ["metrics"], capacity(2, 260, 8, 0), "横向指标带形成节奏。"),
  longform("data-story", "数据故事", ["data"], ["chart", "paragraph", "table"], capacity(4, 780, 20, 0), "图表、结论和注释连续讲述。"),
  longform("quote-break", "引用转场", ["quote"], ["quote"], capacity(1, 300, 2, 1), "通过引用形成视觉停顿。"),
  longform("longform-close", "长图收尾", ["closing"], textTypes, capacity(3, 320, 5, 0), "总结与行动信息收束全文。"),
] as const;

export const RECIPE_REGISTRY = [...PRESENTATION_RECIPES, ...LONGFORM_RECIPES];

if (PRESENTATION_RECIPES.length !== PRESENTATION_RECIPE_IDS.length) {
  throw new Error("PPT Recipe Registry 未覆盖全部 Recipe ID。");
}
if (LONGFORM_RECIPES.length !== LONGFORM_RECIPE_IDS.length) {
  throw new Error("长图 Recipe Registry 未覆盖全部 Recipe ID。");
}

export const getRecipe = (id: PresentationRecipeId | LongformRecipeId) => {
  const recipe = RECIPE_REGISTRY.find((item) => item.id === id);
  if (!recipe) throw new Error(`未知 Recipe：${id}`);
  return recipe;
};

export const getCompatibleRecipes = (
  outputType: OutputType,
  role: PresentationRole | LongformRole,
  blockTypes: ContentBlockType[],
) =>
  RECIPE_REGISTRY.filter(
    (recipe) =>
      recipe.outputType === outputType &&
      recipe.roles.includes(role) &&
      blockTypes.every((blockType) => recipe.blockTypes.includes(blockType)),
  );

export interface RecipeUsage {
  blockCount: number;
  characterCount: number;
  itemCount: number;
  imageCount: number;
}

export const getRecipeCapacityIssues = (
  id: PresentationRecipeId | LongformRecipeId,
  usage: RecipeUsage,
): string[] => {
  const recipe = getRecipe(id);
  const issues: string[] = [];
  if (usage.blockCount > recipe.capacity.maxBlocks) {
    issues.push(`${id} 最多容纳 ${recipe.capacity.maxBlocks} 个内容块。`);
  }
  if (usage.characterCount > recipe.capacity.maxCharacters) {
    issues.push(`${id} 最多容纳 ${recipe.capacity.maxCharacters} 个字符。`);
  }
  if (usage.itemCount > recipe.capacity.maxItems) {
    issues.push(`${id} 最多容纳 ${recipe.capacity.maxItems} 个列表/数据项。`);
  }
  if (
    usage.imageCount < recipe.capacity.imageCount.min ||
    usage.imageCount > recipe.capacity.imageCount.max
  ) {
    issues.push(
      `${id} 需要 ${recipe.capacity.imageCount.min}–${recipe.capacity.imageCount.max} 张图片。`,
    );
  }
  return issues;
};
