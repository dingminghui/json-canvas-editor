import {
  createMaterialEvidenceText,
  normalizeMaterialEvidenceText,
} from "@/features/ai-ppt/material-evidence";
import {
  DEFAULT_BAILIAN_API_HOST,
  getPptMaterialPlanJsonSchema,
  getPptStructureContentIssues,
  getPptStructureJsonSchema,
  getPptStructureMaterialIssues,
  PPT_MODEL,
  PptMaterialPlanSchema,
  PptStructureSchema,
  PptTokenUsageSchema,
  type CreatePptStructureInput,
  type PptMaterialPlanV1,
  type PptStructureV1,
  type PptTokenUsageV1,
} from "@/features/ai-ppt/schema";
import { mergePptTokenUsage } from "@/features/ai-ppt/token-usage";
import materialAnalysisPrompt from "../../../skills/generate-ppt-structure/references/material-analysis-prompt.md?raw";
import runtimePrompt from "../../../skills/generate-ppt-structure/references/runtime-prompt.md?raw";

export type PptGenerationPhase = "generating" | "repairing";
export type PptMaterialAnalysisPhase = "analyzing-material" | "repairing-material";

export type PptGenerationErrorCode =
  | "invalid-host"
  | "invalid-key"
  | "forbidden"
  | "rate-limited"
  | "request-failed"
  | "network"
  | "timeout"
  | "cancelled"
  | "invalid-material-plan"
  | "invalid-structure"
  | "invalid-visual-plan"
  | "invalid-visual-review";

export class PptGenerationError extends Error {
  constructor(
    readonly code: PptGenerationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PptGenerationError";
  }
}

interface GeneratePptStructureOptions {
  apiKey: string;
  apiHost?: string;
  input: CreatePptStructureInput;
  materialPlan: PptMaterialPlanV1;
  signal?: AbortSignal;
  onPhaseChange?: (phase: PptGenerationPhase) => void;
}

interface AnalyzePptMaterialOptions {
  apiKey: string;
  apiHost?: string;
  input: CreatePptStructureInput;
  signal?: AbortSignal;
  onPhaseChange?: (phase: PptMaterialAnalysisPhase) => void;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: unknown;
}

export interface BailianCompletionResult {
  content: string;
  usage: PptTokenUsageV1;
}

export type BailianMessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | {
          type: "image_url";
          image_url: { url: string };
          min_pixels?: number;
          max_pixels?: number;
        }
    >;

export interface BailianChatMessage {
  role: "system" | "user";
  content: BailianMessageContent;
}

export interface GeneratePptStructureResult {
  structure: PptStructureV1;
  usage: PptTokenUsageV1;
}

export interface AnalyzePptMaterialResult {
  materialPlan: PptMaterialPlanV1;
  usage: PptTokenUsageV1;
}

export function isLocalBrowserHost(hostname = globalThis.location?.hostname ?? ""): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function normalizeBailianApiHost(apiHost: string = DEFAULT_BAILIAN_API_HOST): string {
  let url: URL;
  try {
    url = new URL(apiHost.trim());
  } catch {
    throw new PptGenerationError("invalid-host", "接口地址格式无效。");
  }

  const isAllowedHostname =
    url.hostname === "aliyuncs.com" || url.hostname.endsWith(".aliyuncs.com");
  if (
    url.protocol !== "https:" ||
    !isAllowedHostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new PptGenerationError("invalid-host", "接口地址必须是阿里云百炼的加密连接地址。");
  }

  const pathname = url.pathname.replace(/\/+$/, "");
  if (!pathname.endsWith("/compatible-mode/v1")) {
    throw new PptGenerationError("invalid-host", "接口地址必须以 /compatible-mode/v1 结尾。");
  }

  return `${url.origin}${pathname}`;
}

function createStructureSystemPrompt(): string {
  return runtimePrompt.replace(
    "{{OUTPUT_SCHEMA}}",
    JSON.stringify(getPptStructureJsonSchema(), null, 2),
  );
}

function createMaterialSystemPrompt(): string {
  return materialAnalysisPrompt.replace(
    "{{OUTPUT_SCHEMA}}",
    JSON.stringify(getPptMaterialPlanJsonSchema(), null, 2),
  );
}

function escapeSourceMaterial(source: string): string {
  return source.replace(/<\/source_material>/gi, "&lt;/source_material&gt;");
}

function createMaterialUserPrompt(input: CreatePptStructureInput): string {
  const { sourceMarkdown = "", ...brief } = input;
  const sourceEvidenceText = createMaterialEvidenceText(sourceMarkdown);
  return [
    "分析以下材料，并为这次演示提出一个有材料依据的推荐方向。",
    "source_material 是从原始 Markdown 生成的纯文本证据视图。",
    "",
    "<presentation_brief>",
    JSON.stringify(brief, null, 2),
    "</presentation_brief>",
    "",
    "<source_material>",
    escapeSourceMaterial(sourceEvidenceText),
    "</source_material>",
  ].join("\n");
}

function createUserPrompt(input: CreatePptStructureInput, materialPlan: PptMaterialPlanV1): string {
  const { sourceMarkdown = "", ...brief } = input;
  return [
    "根据以下演示需求和已经确认的材料方向生成完整 PPT 文本结构。",
    "",
    "<presentation_brief>",
    JSON.stringify(brief, null, 2),
    "</presentation_brief>",
    "",
    "<confirmed_material_plan>",
    JSON.stringify(materialPlan, null, 2),
    "</confirmed_material_plan>",
    "",
    "<source_material>",
    escapeSourceMaterial(sourceMarkdown),
    "</source_material>",
  ].join("\n");
}

function createRepairPrompt(content: string, issues: string[]): string {
  return [
    "修复下面的候选输出，使其严格满足系统消息中的 JSON Schema 和业务约束。",
    "只返回修复后的 JSON 对象。",
    "",
    "<validation_issues>",
    issues.slice(0, 20).join("\n"),
    "</validation_issues>",
    "",
    "<candidate_output>",
    content.slice(0, 120_000),
    "</candidate_output>",
  ].join("\n");
}

function createMaterialRepairPrompt(
  content: string,
  issues: string[],
  sourceMarkdown: string,
): string {
  const sourceEvidenceText = createMaterialEvidenceText(sourceMarkdown);
  return [
    "修复下面的材料分析，使其严格满足系统消息中的 JSON Schema 和材料事实约束。",
    "sourceExcerpt 必须从 source_material 中复制一个连续的原文片段，不得拼接、改写、补充标点或添加说明。",
    "禁止用 ...、… 或其他省略标记代替中间原文，除非该符号本身就在 source_material 中。",
    "如果一个 statement 依赖多个不连续片段，必须拆成多个原子事实，重新顺序编号，并同步更新 direction.sections 中的全部 factIds。",
    "只返回修复后的 JSON 对象。",
    "",
    "<validation_issues>",
    issues.slice(0, 30).join("\n"),
    "</validation_issues>",
    "",
    "<candidate_output>",
    content.slice(0, 120_000),
    "</candidate_output>",
    "",
    "<source_material>",
    escapeSourceMaterial(sourceEvidenceText),
    "</source_material>",
  ].join("\n");
}

function getValidationIssues(error: unknown, materialPlan: PptMaterialPlanV1): string[] {
  if (error instanceof SyntaxError) return ["输出不是合法的结构化数据。"];
  const result = PptStructureSchema.safeParse(error);
  if (!result.success) {
    return result.error.issues.map(
      (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
    );
  }
  return [
    ...getPptStructureMaterialIssues(result.data, materialPlan),
    ...getPptStructureContentIssues(result.data),
  ];
}

function getMaterialSourceIssues(
  materialPlan: PptMaterialPlanV1,
  sourceMarkdown: string,
): string[] {
  const normalizedSource = normalizeMaterialEvidenceText(sourceMarkdown);
  return materialPlan.facts.flatMap((fact) => {
    if (normalizedSource.includes(normalizeMaterialEvidenceText(fact.sourceExcerpt))) {
      return [];
    }
    if (/\.{3,}|…/.test(fact.sourceExcerpt)) {
      return [
        `${fact.id} 的 sourceExcerpt 包含材料中不存在的省略标记；请复制完整连续原文，或把依赖不连续材料的 statement 拆成多个原子事实`,
      ];
    }
    return [`${fact.id} 的 sourceExcerpt 必须逐字来自已有材料的纯文本证据视图`];
  });
}

function getMaterialValidationIssues(error: unknown, sourceMarkdown: string): string[] {
  if (error instanceof SyntaxError) return ["输出不是合法的结构化数据。"];
  const result = PptMaterialPlanSchema.safeParse(error);
  if (!result.success) {
    return result.error.issues.map(
      (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
    );
  }
  return getMaterialSourceIssues(result.data, sourceMarkdown);
}

function formatMaterialValidationFailure(issues: string[]): string {
  const displayedIssues = issues.slice(0, 3);
  const remainingCount = issues.length - displayedIssues.length;
  const suffix = remainingCount > 0 ? `；另有 ${remainingCount} 项` : "";
  return `模型修复后的材料分析仍有 ${issues.length} 项未通过校验：${displayedIssues.join(
    "；",
  )}${suffix}`;
}

function parsePptStructure(content: string, materialPlan: PptMaterialPlanV1): PptStructureV1 {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new PptGenerationError("invalid-structure", "模型返回的内容不是合法的结构化数据。");
  }

  const result = PptStructureSchema.safeParse(value);
  if (
    !result.success ||
    getPptStructureMaterialIssues(result.data, materialPlan).length > 0 ||
    getPptStructureContentIssues(result.data).length > 0
  ) {
    throw new PptGenerationError("invalid-structure", "模型返回的 PPT 结构未通过校验。");
  }
  return result.data;
}

function parsePptMaterialPlan(content: string, sourceMarkdown: string): PptMaterialPlanV1 {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new PptGenerationError("invalid-material-plan", "模型返回的材料分析格式无效。");
  }

  const result = PptMaterialPlanSchema.safeParse(value);
  if (!result.success || getMaterialSourceIssues(result.data, sourceMarkdown).length > 0) {
    throw new PptGenerationError("invalid-material-plan", "模型返回的材料分析未通过校验。");
  }
  return result.data;
}

function mapHttpError(status: number): PptGenerationError {
  switch (status) {
    case 401:
      return new PptGenerationError("invalid-key", "接口密钥无效，请检查后重试。");
    case 403:
      return new PptGenerationError("forbidden", "当前接口密钥无权调用该模型或地域。");
    case 429:
      return new PptGenerationError("rate-limited", "请求过于频繁，请稍后重试。");
    default:
      return new PptGenerationError("request-failed", `百炼请求失败（${status}）。`);
  }
}

export async function requestBailianCompletion(
  apiHost: string,
  apiKey: string,
  messages: BailianChatMessage[],
  signal: AbortSignal,
  temperature = 0.3,
): Promise<BailianCompletionResult> {
  let response: Response;
  try {
    response = await fetch(`${apiHost}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: PPT_MODEL,
        messages,
        response_format: { type: "json_object" },
        enable_thinking: false,
        temperature,
        stream: false,
      }),
      referrerPolicy: "no-referrer",
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new PptGenerationError("network", "无法连接百炼，请检查网络、接口地址或浏览器跨域限制。");
  }

  if (!response.ok) throw mapHttpError(response.status);

  const payload = (await response.json()) as ChatCompletionResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new PptGenerationError("request-failed", "百炼响应中没有可用内容。");
  }
  const usageResult = PptTokenUsageSchema.safeParse(payload.usage);
  if (!usageResult.success) {
    throw new PptGenerationError("request-failed", "百炼响应中没有有效的用量统计。");
  }
  return {
    content,
    usage: usageResult.data,
  };
}

export async function analyzePptMaterial({
  apiKey,
  apiHost = DEFAULT_BAILIAN_API_HOST,
  input,
  signal,
  onPhaseChange,
}: AnalyzePptMaterialOptions): Promise<AnalyzePptMaterialResult> {
  const sourceMarkdown = input.sourceMarkdown;
  if (!sourceMarkdown?.trim()) {
    throw new PptGenerationError("invalid-material-plan", "请先提供已有材料。");
  }

  const normalizedHost = normalizeBailianApiHost(apiHost);
  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
  const clearRequestTimeout = () => {
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
  };
  const restartTimeout = () => {
    clearRequestTimeout();
    timedOut = false;
    timeoutId = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 180_000);
  };
  restartTimeout();
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener("abort", abortFromCaller, { once: true });
  if (signal?.aborted) abortFromCaller();

  try {
    const systemMessage = { role: "system" as const, content: createMaterialSystemPrompt() };
    const userMessage = { role: "user" as const, content: createMaterialUserPrompt(input) };
    onPhaseChange?.("analyzing-material");
    const firstCompletion = await requestBailianCompletion(
      normalizedHost,
      apiKey,
      [systemMessage, userMessage],
      controller.signal,
      0.2,
    );

    try {
      return {
        materialPlan: parsePptMaterialPlan(firstCompletion.content, sourceMarkdown),
        usage: firstCompletion.usage,
      };
    } catch {
      let candidate: unknown = firstCompletion.content;
      try {
        candidate = JSON.parse(firstCompletion.content);
      } catch {
        // 保留原始文本，让修复请求处理格式问题。
      }
      const issues = getMaterialValidationIssues(candidate, sourceMarkdown);
      onPhaseChange?.("repairing-material");
      restartTimeout();
      const repairedCompletion = await requestBailianCompletion(
        normalizedHost,
        apiKey,
        [
          systemMessage,
          {
            role: "user",
            content: createMaterialRepairPrompt(firstCompletion.content, issues, sourceMarkdown),
          },
        ],
        controller.signal,
        0.1,
      );

      try {
        return {
          materialPlan: parsePptMaterialPlan(repairedCompletion.content, sourceMarkdown),
          usage: mergePptTokenUsage(firstCompletion.usage, repairedCompletion.usage),
        };
      } catch {
        let repairedCandidate: unknown = repairedCompletion.content;
        try {
          repairedCandidate = JSON.parse(repairedCompletion.content);
        } catch {
          // 保留原始文本，用于生成结构化校验原因。
        }
        const repairedIssues = getMaterialValidationIssues(repairedCandidate, sourceMarkdown);
        throw new PptGenerationError(
          "invalid-material-plan",
          formatMaterialValidationFailure(repairedIssues),
        );
      }
    }
  } catch (error) {
    if (error instanceof PptGenerationError) throw error;
    if (controller.signal.aborted) {
      throw new PptGenerationError(
        timedOut ? "timeout" : "cancelled",
        timedOut ? "材料分析超时，请缩短材料后重试。" : "已取消材料分析。",
      );
    }
    throw new PptGenerationError("network", "材料分析失败，请检查网络后重试。");
  } finally {
    clearRequestTimeout();
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function generatePptStructure({
  apiKey,
  apiHost = DEFAULT_BAILIAN_API_HOST,
  input,
  materialPlan,
  signal,
  onPhaseChange,
}: GeneratePptStructureOptions): Promise<GeneratePptStructureResult> {
  const materialPlanResult = PptMaterialPlanSchema.safeParse(materialPlan);
  if (!materialPlanResult.success) {
    throw new PptGenerationError("invalid-material-plan", "请先修正材料方向后再生成结构。");
  }
  const confirmedMaterialPlan = materialPlanResult.data;
  const normalizedHost = normalizeBailianApiHost(apiHost);
  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
  const clearRequestTimeout = () => {
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
  };
  const restartTimeout = () => {
    clearRequestTimeout();
    timedOut = false;
    timeoutId = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 180_000);
  };
  restartTimeout();
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener("abort", abortFromCaller, { once: true });
  if (signal?.aborted) abortFromCaller();

  try {
    const systemMessage = { role: "system" as const, content: createStructureSystemPrompt() };
    const userMessage = {
      role: "user" as const,
      content: createUserPrompt(input, confirmedMaterialPlan),
    };
    onPhaseChange?.("generating");
    const firstCompletion = await requestBailianCompletion(
      normalizedHost,
      apiKey,
      [systemMessage, userMessage],
      controller.signal,
    );

    try {
      return {
        structure: parsePptStructure(firstCompletion.content, confirmedMaterialPlan),
        usage: firstCompletion.usage,
      };
    } catch {
      let parsedCandidate: unknown = firstCompletion.content;
      try {
        parsedCandidate = JSON.parse(firstCompletion.content);
      } catch {
        // Keep the original string so the repair prompt can fix malformed JSON.
      }
      const issues = getValidationIssues(parsedCandidate, confirmedMaterialPlan);
      onPhaseChange?.("repairing");
      restartTimeout();
      const repairedCompletion = await requestBailianCompletion(
        normalizedHost,
        apiKey,
        [
          systemMessage,
          {
            role: "user",
            content: createRepairPrompt(firstCompletion.content, issues),
          },
        ],
        controller.signal,
      );

      try {
        return {
          structure: parsePptStructure(repairedCompletion.content, confirmedMaterialPlan),
          usage: mergePptTokenUsage(firstCompletion.usage, repairedCompletion.usage),
        };
      } catch {
        throw new PptGenerationError(
          "invalid-structure",
          "模型两次返回的结构都未通过校验，请调整材料后重试。",
        );
      }
    }
  } catch (error) {
    if (error instanceof PptGenerationError) throw error;
    if (controller.signal.aborted) {
      throw new PptGenerationError(
        timedOut ? "timeout" : "cancelled",
        timedOut ? "生成超时，请缩短材料后重试。" : "已取消生成。",
      );
    }
    throw new PptGenerationError("network", "生成失败，请检查网络后重试。");
  } finally {
    clearRequestTimeout();
    signal?.removeEventListener("abort", abortFromCaller);
  }
}
