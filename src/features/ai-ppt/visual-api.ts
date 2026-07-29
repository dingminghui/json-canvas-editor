import {
  normalizeBailianApiHost,
  PptGenerationError,
  requestBailianCompletion,
  type BailianChatMessage,
  type BailianMessageContent,
} from "@/features/ai-ppt/api";
import {
  DEFAULT_BAILIAN_API_HOST,
  getPptVisualPlanJsonSchema,
  getPptVisualPlanStructureIssues,
  getPptVisualReviewDecisionJsonSchema,
  getPptVisualReviewStructureIssues,
  PptVisualPlanSchema,
  PptVisualReviewDecisionSchema,
  type PptStructureV1,
  type PptTokenUsageV1,
  type PptVisualPlanV1,
  type PptVisualReviewDecisionV1,
  type PptVisualReviewV1,
} from "@/features/ai-ppt/schema";
import { mergePptTokenUsage } from "@/features/ai-ppt/token-usage";
import runtimePrompt from "../../../skills/render-ppt-canvas/references/runtime-prompt.md?raw";
import visualReviewPrompt from "../../../skills/render-ppt-canvas/references/visual-review-prompt.md?raw";

export type PptVisualGenerationPhase = "planning-visuals" | "repairing-visuals";
export type PptVisualReviewPhase = "reviewing-visuals" | "repairing-visual-review";

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

export interface PptSlidePreview {
  slideId: string;
  dataUrl: string;
}

interface ReviewPptVisualPlanOptions {
  apiKey: string;
  apiHost?: string;
  structure: PptStructureV1;
  visualPlan: PptVisualPlanV1;
  previews: readonly PptSlidePreview[];
  visualPreference?: string;
  signal?: AbortSignal;
  onPhaseChange?: (phase: PptVisualReviewPhase) => void;
}

export interface ReviewPptVisualPlanResult {
  review: PptVisualReviewV1;
  usage: PptTokenUsageV1;
}

function createSystemPrompt(): string {
  return runtimePrompt.replace(
    "{{OUTPUT_SCHEMA}}",
    JSON.stringify(getPptVisualPlanJsonSchema(), null, 2),
  );
}

function createVisualReviewSystemPrompt(): string {
  return visualReviewPrompt.replace(
    "{{OUTPUT_SCHEMA}}",
    JSON.stringify(getPptVisualReviewDecisionJsonSchema(), null, 2),
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

function getPreviewIssues(
  previews: readonly PptSlidePreview[],
  structure: PptStructureV1,
): string[] {
  const issues: string[] = [];
  if (previews.length !== structure.slides.length) {
    issues.push("视觉评审预览页数必须与 PPT 文本结构一致");
  }
  previews.forEach((preview, index) => {
    const expectedSlideId = structure.slides[index]?.id;
    if (preview.slideId !== expectedSlideId) {
      issues.push(`视觉评审第 ${index + 1} 张预览必须对应 ${expectedSlideId ?? "存在的页面"}`);
    }
    if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(preview.dataUrl)) {
      issues.push(`视觉评审 ${preview.slideId} 的预览不是受支持的图片 Data URL`);
    }
  });
  return issues;
}

function createVisualReviewUserContent(
  structure: PptStructureV1,
  visualPlan: PptVisualPlanV1,
  previews: readonly PptSlidePreview[],
  visualPreference: string,
  repair?: { content: string; issues: readonly string[] },
): Exclude<BailianMessageContent, string> {
  const instruction = [
    repair
      ? "修复候选视觉评审决策，使其严格满足 JSON Schema、图片观察和最小补丁约束。"
      : "评审下面这套已经渲染的 PPT，并在必要时只返回最小 VisualPlan 补丁。",
    "图片按照 PPT 文本结构中的页面顺序提供。",
    "",
    "<visual_preference>",
    visualPreference.trim() || "未指定，以清晰、统一、有节奏的专业演示为基线。",
    "</visual_preference>",
    "",
    "<ppt_structure>",
    JSON.stringify(structure, null, 2),
    "</ppt_structure>",
    "",
    "<current_visual_plan>",
    JSON.stringify(visualPlan, null, 2),
    "</current_visual_plan>",
    ...(repair
      ? [
          "",
          "<validation_issues>",
          repair.issues.slice(0, 30).join("\n"),
          "</validation_issues>",
          "",
          "<candidate_review>",
          repair.content.slice(0, 120_000),
          "</candidate_review>",
        ]
      : []),
    "",
    "<slide_previews>",
    "以下每个页面标签后紧跟对应的渲染图片。",
    "</slide_previews>",
  ].join("\n");

  return [
    { type: "text", text: instruction },
    ...previews.flatMap((preview) => [
      { type: "text" as const, text: `<slide_preview id="${preview.slideId}">` },
      {
        type: "image_url" as const,
        image_url: { url: preview.dataUrl },
        min_pixels: 65_536,
        max_pixels: 524_288,
      },
    ]),
  ];
}

function getVisualReviewCandidateIssues(
  value: unknown,
  sourcePlan: PptVisualPlanV1,
  structure: PptStructureV1,
): string[] {
  const result = PptVisualReviewDecisionSchema.safeParse(value);
  if (!result.success) {
    return result.error.issues.map(
      (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
    );
  }
  return buildVisualReview(result.data, sourcePlan, structure).issues;
}

function flatValuesDiffer(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].some((key) => !Object.is(left[key], right[key]));
}

function buildVisualReview(
  decision: PptVisualReviewDecisionV1,
  sourcePlan: PptVisualPlanV1,
  structure: PptStructureV1,
): { review?: PptVisualReviewV1; issues: string[] } {
  const issues: string[] = [];
  const revisedPlan = structuredClone(sourcePlan);
  Object.assign(revisedPlan.theme, decision.themePatch);

  const revisedSlidesById = new Map(revisedPlan.slides.map((slide) => [slide.slideId, slide]));
  const patchedSlideIds = new Set<string>();
  decision.slidePatches.forEach((patch, index) => {
    if (patchedSlideIds.has(patch.slideId)) {
      issues.push(`slidePatches.${index}.slideId: 同一页面只能修订一次`);
      return;
    }
    patchedSlideIds.add(patch.slideId);

    const slide = revisedSlidesById.get(patch.slideId);
    if (!slide) {
      issues.push(`slidePatches.${index}.slideId: 引用了不存在的页面 ${patch.slideId}`);
      return;
    }
    Object.assign(slide, patch.changes);
  });
  if (issues.length > 0) return { issues };

  const revisedPlanResult = PptVisualPlanSchema.safeParse(revisedPlan);
  if (!revisedPlanResult.success) {
    return {
      issues: revisedPlanResult.error.issues.map(
        (issue) => `revisedVisualPlan.${issue.path.join(".") || "root"}: ${issue.message}`,
      ),
    };
  }
  const validatedPlan = revisedPlanResult.data;
  const planIssues = getPptVisualPlanStructureIssues(validatedPlan, structure);
  if (planIssues.length > 0) return { issues: planIssues };

  const themeChanged = flatValuesDiffer(
    sourcePlan.theme as Record<string, unknown>,
    validatedPlan.theme as Record<string, unknown>,
  );
  const revisedSlideIds = sourcePlan.slides
    .filter((sourceSlide, index) =>
      flatValuesDiffer(
        sourceSlide as Record<string, unknown>,
        validatedPlan.slides[index] as Record<string, unknown>,
      ),
    )
    .map((slide) => slide.slideId);
  const review: PptVisualReviewV1 = {
    schemaVersion: "ppt-visual-review/v1",
    verdict: themeChanged || revisedSlideIds.length > 0 ? "revised" : "approved",
    summary: decision.summary,
    strengths: decision.strengths,
    issues: decision.issues,
    themeChanged,
    revisedSlideIds,
    revisedVisualPlan: validatedPlan,
  };
  const reviewIssues = getPptVisualReviewStructureIssues(review, sourcePlan, structure);
  return reviewIssues.length > 0 ? { issues: reviewIssues } : { review, issues: [] };
}

function parseVisualReviewDecision(
  content: string,
  sourcePlan: PptVisualPlanV1,
  structure: PptStructureV1,
): PptVisualReviewV1 {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new PptGenerationError("invalid-visual-review", "模型返回的视觉评审格式无效。");
  }

  const result = PptVisualReviewDecisionSchema.safeParse(value);
  if (!result.success) {
    throw new PptGenerationError("invalid-visual-review", "模型返回的视觉评审未通过校验。");
  }
  const builtReview = buildVisualReview(result.data, sourcePlan, structure);
  if (!builtReview.review) {
    throw new PptGenerationError("invalid-visual-review", "模型返回的视觉评审未通过校验。");
  }
  return builtReview.review;
}

function formatVisualReviewValidationFailure(issues: readonly string[]): string {
  const displayedIssues = issues.slice(0, 3);
  const remainingCount = issues.length - displayedIssues.length;
  const suffix = remainingCount > 0 ? `；另有 ${remainingCount} 项` : "";
  return `模型修复后的视觉评审仍有 ${issues.length} 项未通过校验：${displayedIssues.join(
    "；",
  )}${suffix}`;
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

export async function reviewPptVisualPlan({
  apiKey,
  apiHost = DEFAULT_BAILIAN_API_HOST,
  structure,
  visualPlan,
  previews,
  visualPreference = "",
  signal,
  onPhaseChange,
}: ReviewPptVisualPlanOptions): Promise<ReviewPptVisualPlanResult> {
  const previewIssues = getPreviewIssues(previews, structure);
  if (previewIssues.length > 0) {
    throw new PptGenerationError("invalid-visual-review", previewIssues[0]);
  }

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
    const systemMessage: BailianChatMessage = {
      role: "system",
      content: createVisualReviewSystemPrompt(),
    };
    const firstUserContent = createVisualReviewUserContent(
      structure,
      visualPlan,
      previews,
      visualPreference,
    );
    onPhaseChange?.("reviewing-visuals");
    const firstCompletion = await requestBailianCompletion(
      normalizedHost,
      apiKey,
      [systemMessage, { role: "user", content: firstUserContent }],
      controller.signal,
      0.2,
    );

    try {
      return {
        review: parseVisualReviewDecision(firstCompletion.content, visualPlan, structure),
        usage: firstCompletion.usage,
      };
    } catch {
      let candidate: unknown = firstCompletion.content;
      try {
        candidate = JSON.parse(firstCompletion.content);
      } catch {
        // 保留原始文本，让修复请求处理格式问题。
      }
      const issues = getVisualReviewCandidateIssues(candidate, visualPlan, structure);
      onPhaseChange?.("repairing-visual-review");
      const repairedCompletion = await requestBailianCompletion(
        normalizedHost,
        apiKey,
        [
          systemMessage,
          {
            role: "user",
            content: createVisualReviewUserContent(
              structure,
              visualPlan,
              previews,
              visualPreference,
              { content: firstCompletion.content, issues },
            ),
          },
        ],
        controller.signal,
        0.1,
      );

      try {
        return {
          review: parseVisualReviewDecision(repairedCompletion.content, visualPlan, structure),
          usage: mergePptTokenUsage(firstCompletion.usage, repairedCompletion.usage),
        };
      } catch {
        let repairedCandidate: unknown = repairedCompletion.content;
        try {
          repairedCandidate = JSON.parse(repairedCompletion.content);
        } catch {
          // 保留原始文本，用于生成结构化校验原因。
        }
        const repairedIssues = getVisualReviewCandidateIssues(
          repairedCandidate,
          visualPlan,
          structure,
        );
        throw new PptGenerationError(
          "invalid-visual-review",
          formatVisualReviewValidationFailure(repairedIssues),
        );
      }
    }
  } catch (error) {
    if (error instanceof PptGenerationError) throw error;
    if (controller.signal.aborted) {
      throw new PptGenerationError(
        timedOut ? "timeout" : "cancelled",
        timedOut ? "视觉评审超时，请稍后重试。" : "已取消视觉评审。",
      );
    }
    throw new PptGenerationError("network", "视觉评审失败，请检查网络后重试。");
  } finally {
    globalThis.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}
