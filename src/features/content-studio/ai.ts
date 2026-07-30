import {
  normalizeBailianApiHost,
  requestBailianCompletion,
  PptGenerationError,
  type BailianChatMessage,
} from "@/features/ai-ppt/api";
import {
  DEFAULT_BAILIAN_API_HOST,
  type PptTokenUsageV1,
} from "@/features/ai-ppt/schema";
import { mergePptTokenUsage } from "@/features/ai-ppt/token-usage";
import { z } from "zod";

import {
  ArtDirectionSchema,
  AssetSearchPlanSchema,
  ContentDocumentSchema,
  getOutputStructureIssues,
  getVisualPlanIssues,
  MaterialPlanSchema,
  normalizeOutputStructureBlockRefs,
  OutputStructureSchema,
  VisualPlanSchema,
  VisualReviewSchema,
  type ArtDirection,
  type AssetSearchPlanV1,
  type ContentDocumentV1,
  type ContentProjectInput,
  type MaterialPlanV1,
  type OutputStructureV1,
  type OutputType,
  type StylePackId,
  type VisualPlanV1,
  type VisualReviewV1,
} from "./schema";
import { STYLE_PACK_LIST } from "./style-packs";
import { LONGFORM_RECIPES, PRESENTATION_RECIPES } from "./recipes";
import {
  getVisualPlanRecipeIssues,
  normalizeVisualPlanRecipes,
} from "./render";
import { getMaterialEvidenceIssues } from "./evidence";

export type ContentGenerationPhase = "generating" | "repairing";

interface AiOptions {
  apiKey: string;
  apiHost?: string;
  signal?: AbortSignal;
  onPhaseChange?: (phase: ContentGenerationPhase) => void;
}

interface GenerationResult<T> {
  data: T;
  usage: PptTokenUsageV1;
}

const escapeXmlLikeContent = (value: string) =>
  value.replace(/<\/(source_material|content_document|output_structure)>/gi, "&lt;/$1&gt;");

const toIssues = (error: z.ZodError) =>
  error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);

const describeJsonRoot = (value: unknown): string => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "数组";
  if (typeof value !== "object") return typeof value === "string" ? "字符串" : typeof value;

  const keys = Object.keys(value);
  if (keys.length === 0) return "空对象";
  const displayedKeys = keys.slice(0, 8).join(", ");
  const remainingCount = keys.length - 8;
  return `对象（顶层字段：${displayedKeys}${remainingCount > 0 ? `；另有 ${remainingCount} 个` : ""}）`;
};

const withTimeoutSignal = (
  callerSignal: AbortSignal | undefined,
  timeoutMs = 180_000,
): { signal: AbortSignal; cleanup: () => void; timedOut: () => boolean } => {
  const controller = new AbortController();
  let didTimeOut = false;
  const timeout = globalThis.setTimeout(() => {
    didTimeOut = true;
    controller.abort();
  }, timeoutMs);
  const abort = () => controller.abort();
  callerSignal?.addEventListener("abort", abort, { once: true });
  if (callerSignal?.aborted) abort();
  return {
    signal: controller.signal,
    cleanup: () => {
      globalThis.clearTimeout(timeout);
      callerSignal?.removeEventListener("abort", abort);
    },
    timedOut: () => didTimeOut,
  };
};

const generateValidated = async <T>({
  apiKey,
  apiHost = DEFAULT_BAILIAN_API_HOST,
  signal,
  onPhaseChange,
  schema,
  system,
  user,
  repairContext,
  businessIssues = () => [],
  normalize = (value) => value,
}: AiOptions & {
  schema: z.ZodType<T>;
  system: string;
  user: BailianChatMessage["content"];
  repairContext?: string;
  businessIssues?: (value: T) => string[];
  normalize?: (value: T) => T;
}): Promise<GenerationResult<T>> => {
  const host = normalizeBailianApiHost(apiHost);
  const request = withTimeoutSignal(signal);
  const systemMessage: BailianChatMessage = {
    role: "system",
    content: `${system}\n\n只返回 JSON 对象，不要 Markdown 代码围栏。\n\nJSON Schema:\n${JSON.stringify(z.toJSONSchema(schema, { target: "draft-07" }), null, 2)}`,
  };
  const userMessage: BailianChatMessage = { role: "user", content: user };
  let usage: PptTokenUsageV1 | null = null;
  try {
    onPhaseChange?.("generating");
    const first = await requestBailianCompletion(
      host,
      apiKey,
      [systemMessage, userMessage],
      request.signal,
      0.25,
    );
    usage = first.usage;
    let value: unknown;
    try {
      value = JSON.parse(first.content);
    } catch {
      value = first.content;
    }
    const parsed = schema.safeParse(value);
    let issues: string[];
    if (parsed.success) {
      const normalized = normalize(parsed.data);
      issues = businessIssues(normalized);
      if (issues.length === 0) {
        return { data: normalized, usage: first.usage };
      }
    } else {
      issues = [`候选 JSON 根值：${describeJsonRoot(value)}。`, ...toIssues(parsed.error)];
    }

    onPhaseChange?.("repairing");
    const repaired = await requestBailianCompletion(
      host,
      apiKey,
      [
        systemMessage,
        {
          role: "user",
          content: [
            ...(repairContext
              ? [
                  "以下是首次生成时使用的原始任务上下文，修复时必须继续以此为事实依据。",
                  "<original_request_context>",
                  repairContext,
                  "</original_request_context>",
                  "",
                ]
              : []),
            "修复候选输出。不得改变输入事实，只能修复 Schema、引用、数量或枚举错误。",
            "<validation_issues>",
            issues.slice(0, 30).join("\n"),
            "</validation_issues>",
            "<candidate_output>",
            first.content.slice(0, 120_000),
            "</candidate_output>",
          ].join("\n"),
        },
      ],
      request.signal,
      0.1,
    );
    usage = mergePptTokenUsage(first.usage, repaired.usage);
    let repairedValue: unknown;
    try {
      repairedValue = JSON.parse(repaired.content);
    } catch {
      throw new PptGenerationError("request-failed", "模型修复结果不是合法 JSON。");
    }
    const repairedParsed = schema.safeParse(repairedValue);
    if (!repairedParsed.success) {
      throw new PptGenerationError(
        "request-failed",
        `模型修复后仍未通过 Schema（根值：${describeJsonRoot(repairedValue)}）：${toIssues(repairedParsed.error).slice(0, 3).join("；")}`,
      );
    }
    const normalizedRepaired = normalize(repairedParsed.data);
    const repairedIssues = businessIssues(normalizedRepaired);
    if (repairedIssues.length > 0) {
      throw new PptGenerationError(
        "request-failed",
        `模型修复后仍有业务约束错误：${repairedIssues.slice(0, 3).join("；")}`,
      );
    }
    return { data: normalizedRepaired, usage };
  } catch (error) {
    if (error instanceof PptGenerationError) throw error;
    if (request.signal.aborted) {
      throw new PptGenerationError(
        request.timedOut() ? "timeout" : "cancelled",
        request.timedOut() ? "生成超时，请精简材料后重试。" : "已取消生成。",
      );
    }
    throw new PptGenerationError(
      "network",
      error instanceof Error ? error.message : "AI 生成失败。",
    );
  } finally {
    request.cleanup();
  }
};

export const analyzeContentMaterial = async (
  input: ContentProjectInput,
  options: AiOptions,
): Promise<GenerationResult<MaterialPlanV1>> => {
  const user = [
    "<content_brief>",
    JSON.stringify({ ...input, sourceMarkdown: undefined }, null, 2),
    "</content_brief>",
    "<source_material>",
    escapeXmlLikeContent(input.sourceMarkdown),
    "</source_material>",
  ].join("\n");

  return generateValidated({
    ...options,
    schema: MaterialPlanSchema,
    system: [
      "你是内容研究员。把已有材料拆为可追溯的原子事实，再提出通用内容方向。",
      "输出根节点必须直接是 MaterialPlan JSON 对象，顶层字段只能是 schemaVersion、sourceSummary、facts、gaps、direction。",
      "不得返回数组、字符串化 JSON，也不得添加 materialPlan、data、result 等包装层。",
      "sourceExcerpt 应优先摘录 source_material 原文；允许合并换行、忽略 Markdown 格式、调整标点，或在不改变事实含义的前提下做轻微压缩。",
      "sourceExcerpt 必须能明确追溯到材料，不得补写材料中没有的事实或数据。",
      "不要预设最终产物是 PPT 或长图。",
    ].join("\n"),
    user,
    repairContext: user,
    businessIssues: (plan) =>
      getMaterialEvidenceIssues(plan, input.sourceMarkdown),
  });
};

export const generateContentDocument = async (
  input: ContentProjectInput,
  materialPlan: MaterialPlanV1,
  options: AiOptions,
): Promise<GenerationResult<ContentDocumentV1>> =>
  generateValidated({
    ...options,
    schema: ContentDocumentSchema,
    system: [
      "你是通用内容架构师。把已确认材料方向转为 ContentDocument。",
      "每个语义块只承担一个清晰的信息任务，稳定 ID 从 B001 连续编号。",
      "事实只可来自材料计划，evidenceRefs 下沉到内容块。",
      "适当使用 comparison、process、metrics、chart、diagram 和 table，但不要为了形式虚构数据。",
    ].join("\n"),
    user: [
      "<content_brief>",
      JSON.stringify({ ...input, sourceMarkdown: undefined }, null, 2),
      "</content_brief>",
      "<confirmed_material_plan>",
      JSON.stringify(materialPlan, null, 2),
      "</confirmed_material_plan>",
    ].join("\n"),
    businessIssues: (document) => {
      const validFacts = new Set(materialPlan.facts.map((fact) => fact.id));
      return document.sections.flatMap((section) =>
        section.blocks.flatMap((block) =>
          block.evidenceRefs.flatMap((id) =>
            validFacts.has(id) ? [] : [`${block.id} 引用了不存在的证据 ${id}。`],
          ),
        ),
      );
    },
  });

export const generateOutputStructure = async (
  outputType: OutputType,
  contentDocument: ContentDocumentV1,
  options: AiOptions,
): Promise<GenerationResult<OutputStructureV1>> =>
  generateValidated({
    ...options,
    schema: OutputStructureSchema,
    system: [
      "你是跨载体内容编辑。将 ContentDocument 规划为一个单一产物的输出结构。",
      outputType === "pptx"
        ? "输出 4–20 页、固定 1600×900 的演示结构。每页只有一个核心信息，并描述 audienceMove。"
        : "输出固定宽 1080px、最大高 12000px 的长图区段结构，包含 hero、内容推进和 closing。",
      "每个 Bxxx 内容块必须且只能引用一次。不得复制、改写或新增内容事实。",
      `outputType 必须是 ${outputType}。`,
    ].join("\n"),
    user: `<content_document>\n${JSON.stringify(contentDocument, null, 2)}\n</content_document>`,
    normalize: (structure) =>
      normalizeOutputStructureBlockRefs(structure, contentDocument),
    businessIssues: (structure) => [
      ...(structure.outputType === outputType ? [] : [`outputType 必须为 ${outputType}。`]),
      ...getOutputStructureIssues(structure, contentDocument),
    ],
  });

export const recommendArtDirection = async (
  outputStructure: OutputStructureV1,
  contentDocument: ContentDocumentV1,
  options: AiOptions,
): Promise<GenerationResult<ArtDirection>> =>
  generateValidated({
    ...options,
    schema: ArtDirectionSchema,
    system: [
      "你是视觉总监。只能从注册 StylePack 中推荐一个 ID，不得创造颜色、CSS 或坐标。",
      "可选样式：",
      ...STYLE_PACK_LIST.map((pack) => `${pack.id}: ${pack.description}`),
    ].join("\n"),
    user: JSON.stringify(
      {
        title: contentDocument.title,
        audience: contentDocument.audience,
        purpose: contentDocument.purpose,
        coreMessage: contentDocument.coreMessage,
        outputType: outputStructure.outputType,
        nodes:
          outputStructure.outputType === "pptx"
            ? outputStructure.pages.map(({ role, title, coreMessage }) => ({ role, title, coreMessage }))
            : outputStructure.regions.map(({ role, title, coreMessage }) => ({ role, title, coreMessage })),
      },
      null,
      2,
    ),
  });

export const generateAssetSearchPlan = async (
  outputStructure: OutputStructureV1,
  artDirection: ArtDirection,
  options: AiOptions,
): Promise<GenerationResult<AssetSearchPlanV1>> =>
  generateValidated({
    ...options,
    schema: AssetSearchPlanSchema,
    system: [
      "你是图片编辑。最多提出 6 个真正有叙事价值的 Pexels 素材需求。",
      "query 必须是适合图库搜索的英文短语，不能搜索抽象 UI、文字海报或无法拍摄的概念。",
      "不需要图片的内容可以返回空 requests。输出节点 ID 必须来自输入。",
    ].join("\n"),
    user: JSON.stringify({ outputStructure, artDirection }, null, 2),
    businessIssues: (plan) => {
      const validIds = new Set(
        outputStructure.outputType === "pptx"
          ? outputStructure.pages.map((page) => page.id)
          : outputStructure.regions.map((region) => region.id),
      );
      return plan.requests.flatMap((request) =>
        validIds.has(request.outputNodeId)
          ? []
          : [`${request.id} 引用了不存在的输出节点 ${request.outputNodeId}。`],
      );
    },
  });

export const generateVisualPlan = async (
  outputStructure: OutputStructureV1,
  contentDocument: ContentDocumentV1,
  stylePackId: StylePackId,
  artDirection: ArtDirection,
  selectedAssets: Array<{ id: string; outputNodeId?: string; purpose: string }>,
  options: AiOptions,
): Promise<GenerationResult<VisualPlanV1>> =>
  generateValidated({
    ...options,
    schema: VisualPlanSchema,
    system: [
      "你是 Canvas 视觉规划师。只能选择注册的 recipeId、密度、强调块、素材 ID、媒体位置与焦点。",
      "严禁输出坐标、颜色或 CSS。不得改变内容事实。",
      "连续三项不得使用同一 Recipe。",
      "PPT Recipes:",
      ...PRESENTATION_RECIPES.map((recipe) => `${recipe.id}: ${recipe.description}`),
      "Longform Recipes:",
      ...LONGFORM_RECIPES.map((recipe) => `${recipe.id}: ${recipe.description}`),
    ].join("\n"),
    user: JSON.stringify(
      { outputStructure, contentDocument, stylePackId, artDirection, selectedAssets },
      null,
      2,
    ),
    normalize: (plan) =>
      normalizeVisualPlanRecipes(contentDocument, outputStructure, plan),
    businessIssues: (plan) => [
      ...(plan.stylePackId === stylePackId ? [] : [`stylePackId 必须为 ${stylePackId}。`]),
      ...getVisualPlanIssues(
        plan,
        outputStructure,
        selectedAssets.map((asset) => asset.id),
      ),
      ...getVisualPlanRecipeIssues(contentDocument, outputStructure, plan),
    ],
  });

export const reviewVisualPlan = async (
  outputStructure: OutputStructureV1,
  contentDocument: ContentDocumentV1,
  currentPlan: VisualPlanV1,
  selectedAssetIds: string[],
  previewImages: string[],
  options: AiOptions,
): Promise<GenerationResult<VisualReviewV1>> =>
  generateValidated({
    ...options,
    schema: VisualReviewSchema,
    system: [
      "你是视觉评审。基于预览图最多进行一次方案修订。",
      "只能修订 StylePack/Recipe/密度/强调/素材位置和焦点，不能修改内容事实或输出坐标。",
      "若无需修改，verdict 为 approved，revisedVisualPlan 与当前方案相同。",
    ].join("\n"),
    user: [
      {
        type: "text",
        text: JSON.stringify(
          { outputStructure, contentDocument, currentPlan, selectedAssetIds },
          null,
          2,
        ),
      },
      ...previewImages.slice(0, 20).map((url) => ({
        type: "image_url" as const,
        image_url: { url },
      })),
    ],
    normalize: (review) => ({
      ...review,
      revisedVisualPlan: normalizeVisualPlanRecipes(
        contentDocument,
        outputStructure,
        review.revisedVisualPlan,
      ),
    }),
    businessIssues: (review) => [
      ...getVisualPlanIssues(review.revisedVisualPlan, outputStructure, selectedAssetIds),
      ...getVisualPlanRecipeIssues(
        contentDocument,
        outputStructure,
        review.revisedVisualPlan,
      ),
    ],
  });
