import {
  normalizeBailianApiHost,
  PptGenerationError,
  requestBailianCompletion,
} from "@/features/ai-ppt/api";
import {
  DEFAULT_BAILIAN_API_HOST,
  getPptVisualPlanJsonSchema,
  getPptVisualPlanStructureIssues,
  PptVisualPlanSchema,
  type PptStructureV1,
  type PptTokenUsageV1,
  type PptVisualPlanV1,
} from "@/features/ai-ppt/schema";
import { mergePptTokenUsage } from "@/features/ai-ppt/token-usage";
import runtimePrompt from "../../../skills/render-ppt-canvas/references/runtime-prompt.md?raw";

export type PptVisualGenerationPhase = "planning-visuals" | "repairing-visuals";

interface GeneratePptVisualPlanOptions {
  apiKey: string;
  apiHost?: string;
  structure: PptStructureV1;
  visualPreference?: string;
  signal?: AbortSignal;
  onPhaseChange?: (phase: PptVisualGenerationPhase) => void;
}

export interface GeneratePptVisualPlanResult {
  visualPlan: PptVisualPlanV1;
  usage: PptTokenUsageV1;
}

function createSystemPrompt(): string {
  return runtimePrompt.replace(
    "{{OUTPUT_SCHEMA}}",
    JSON.stringify(getPptVisualPlanJsonSchema(), null, 2),
  );
}

function createUserPrompt(structure: PptStructureV1, visualPreference: string): string {
  return [
    "为下面的 PPT 文本结构规划完整视觉方案。",
    "",
    "<visual_preference>",
    visualPreference.trim() || "未指定，由你根据主题、听众和演示目标判断。",
    "</visual_preference>",
    "",
    "<ppt_structure>",
    JSON.stringify(structure, null, 2),
    "</ppt_structure>",
  ].join("\n");
}

function getCandidateIssues(value: unknown, structure: PptStructureV1): string[] {
  const result = PptVisualPlanSchema.safeParse(value);
  if (!result.success) {
    return result.error.issues.map(
      (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
    );
  }
  return getPptVisualPlanStructureIssues(result.data, structure);
}

function parseVisualPlan(content: string, structure: PptStructureV1): PptVisualPlanV1 {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new PptGenerationError("invalid-visual-plan", "模型返回的视觉方案格式无效。");
  }

  const result = PptVisualPlanSchema.safeParse(value);
  if (!result.success || getPptVisualPlanStructureIssues(result.data, structure).length > 0) {
    throw new PptGenerationError("invalid-visual-plan", "模型返回的视觉方案未通过校验。");
  }
  return result.data;
}

function createRepairPrompt(
  content: string,
  issues: readonly string[],
  structure: PptStructureV1,
): string {
  return [
    "修复下面的视觉方案，使其严格满足 JSON Schema，并与 PPT 文本结构逐页对应。",
    "只返回修复后的 JSON 对象。",
    "",
    "<validation_issues>",
    issues.slice(0, 30).join("\n"),
    "</validation_issues>",
    "",
    "<expected_slide_ids>",
    structure.slides.map((slide) => slide.id).join(", "),
    "</expected_slide_ids>",
    "",
    "<candidate_output>",
    content.slice(0, 120_000),
    "</candidate_output>",
  ].join("\n");
}

export async function generatePptVisualPlan({
  apiKey,
  apiHost = DEFAULT_BAILIAN_API_HOST,
  structure,
  visualPreference = "",
  signal,
  onPhaseChange,
}: GeneratePptVisualPlanOptions): Promise<GeneratePptVisualPlanResult> {
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
    const userMessage = {
      role: "user" as const,
      content: createUserPrompt(structure, visualPreference),
    };
    onPhaseChange?.("planning-visuals");
    const firstCompletion = await requestBailianCompletion(
      normalizedHost,
      apiKey,
      [systemMessage, userMessage],
      controller.signal,
      0.5,
    );

    try {
      return {
        visualPlan: parseVisualPlan(firstCompletion.content, structure),
        usage: firstCompletion.usage,
      };
    } catch {
      let candidate: unknown = firstCompletion.content;
      try {
        candidate = JSON.parse(firstCompletion.content);
      } catch {
        // 保留原始文本，让修复请求处理格式问题。
      }
      const issues = getCandidateIssues(candidate, structure);
      onPhaseChange?.("repairing-visuals");
      const repairedCompletion = await requestBailianCompletion(
        normalizedHost,
        apiKey,
        [
          systemMessage,
          {
            role: "user",
            content: createRepairPrompt(firstCompletion.content, issues, structure),
          },
        ],
        controller.signal,
        0.3,
      );

      try {
        return {
          visualPlan: parseVisualPlan(repairedCompletion.content, structure),
          usage: mergePptTokenUsage(firstCompletion.usage, repairedCompletion.usage),
        };
      } catch {
        throw new PptGenerationError(
          "invalid-visual-plan",
          "模型两次返回的视觉方案都未通过校验，请调整视觉偏好后重试。",
        );
      }
    }
  } catch (error) {
    if (error instanceof PptGenerationError) throw error;
    if (controller.signal.aborted) {
      throw new PptGenerationError(
        timedOut ? "timeout" : "cancelled",
        timedOut ? "视觉方案生成超时，请稍后重试。" : "已取消生成视觉方案。",
      );
    }
    throw new PptGenerationError("network", "视觉方案生成失败，请检查网络后重试。");
  } finally {
    globalThis.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}
