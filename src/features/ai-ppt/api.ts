import {
  DEFAULT_BAILIAN_API_HOST,
  getPptStructureJsonSchema,
  PPT_MODEL,
  PptStructureSchema,
  PptTokenUsageSchema,
  type CreatePptStructureInput,
  type PptStructureV1,
  type PptTokenUsageV1,
} from "@/features/ai-ppt/schema";
import { mergePptTokenUsage } from "@/features/ai-ppt/token-usage";
import runtimePrompt from "../../../skills/generate-ppt-structure/references/runtime-prompt.md?raw";

export type PptGenerationPhase = "generating" | "repairing";

export type PptGenerationErrorCode =
  | "invalid-host"
  | "invalid-key"
  | "forbidden"
  | "rate-limited"
  | "request-failed"
  | "network"
  | "timeout"
  | "cancelled"
  | "invalid-structure"
  | "invalid-visual-plan";

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
  signal?: AbortSignal;
  onPhaseChange?: (phase: PptGenerationPhase) => void;
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

export interface GeneratePptStructureResult {
  structure: PptStructureV1;
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

function createSystemPrompt(): string {
  return runtimePrompt.replace(
    "{{OUTPUT_SCHEMA}}",
    JSON.stringify(getPptStructureJsonSchema(), null, 2),
  );
}

function escapeSourceMaterial(source: string): string {
  return source.replace(/<\/source_material>/gi, "&lt;/source_material&gt;");
}

function createUserPrompt(input: CreatePptStructureInput): string {
  const { sourceMarkdown = "", ...brief } = input;
  return [
    "根据以下演示需求生成完整 PPT 文本结构。",
    "",
    "<presentation_brief>",
    JSON.stringify(brief, null, 2),
    "</presentation_brief>",
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

function getValidationIssues(error: unknown): string[] {
  if (error instanceof SyntaxError) return ["输出不是合法的结构化数据。"];
  const result = PptStructureSchema.safeParse(error);
  if (result.success) return [];
  return result.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);
}

function parsePptStructure(content: string): PptStructureV1 {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new PptGenerationError("invalid-structure", "模型返回的内容不是合法的结构化数据。");
  }

  const result = PptStructureSchema.safeParse(value);
  if (!result.success) {
    throw new PptGenerationError("invalid-structure", "模型返回的 PPT 结构未通过校验。");
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
  messages: Array<{ role: "system" | "user"; content: string }>,
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

export async function generatePptStructure({
  apiKey,
  apiHost = DEFAULT_BAILIAN_API_HOST,
  input,
  signal,
  onPhaseChange,
}: GeneratePptStructureOptions): Promise<GeneratePptStructureResult> {
  const normalizedHost = normalizeBailianApiHost(apiHost);
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 180_000);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const systemMessage = { role: "system" as const, content: createSystemPrompt() };
    const userMessage = { role: "user" as const, content: createUserPrompt(input) };
    onPhaseChange?.("generating");
    const firstCompletion = await requestBailianCompletion(
      normalizedHost,
      apiKey,
      [systemMessage, userMessage],
      controller.signal,
    );

    try {
      return {
        structure: parsePptStructure(firstCompletion.content),
        usage: firstCompletion.usage,
      };
    } catch {
      let parsedCandidate: unknown = firstCompletion.content;
      try {
        parsedCandidate = JSON.parse(firstCompletion.content);
      } catch {
        // Keep the original string so the repair prompt can fix malformed JSON.
      }
      const issues = getValidationIssues(parsedCandidate);
      onPhaseChange?.("repairing");
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
          structure: parsePptStructure(repairedCompletion.content),
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
    globalThis.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}
