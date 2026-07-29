import { PptGenerationError } from "@/features/ai-ppt/api";
import {
  createTestPptStructure,
  createTestPptTokenUsage,
  createTestPptVisualPlan,
  createTestPptVisualReviewDecision,
} from "@/features/ai-ppt/test-fixtures";
import { generatePptVisualPlan, reviewPptVisualPlan } from "@/features/ai-ppt/visual-api";

function completionResponse(content: string, status = 200): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: createTestPptTokenUsage(),
    }),
    {
      headers: { "Content-Type": "application/json" },
      status,
    },
  );
}

describe("百炼视觉方案客户端", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("使用结构化输出生成与文本结构对应的视觉方案", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(completionResponse(JSON.stringify(createTestPptVisualPlan())));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generatePptVisualPlan({
      apiKey: "sk-visual-secret",
      structure: createTestPptStructure(),
      visualPreference: "专业、克制，突出行动项。",
    });

    expect(result.visualPlan.slides).toHaveLength(4);
    expect(result.usage.total_tokens).toBe(10_110);
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions");
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "qwen3.7-plus",
      response_format: { type: "json_object" },
      stream: false,
      temperature: 0.5,
    });
    expect(String(request.body)).toContain("专业、克制，突出行动项。");
  });

  it("页码不匹配时修复一次", async () => {
    const invalidPlan = createTestPptVisualPlan();
    invalidPlan.slides[1] = { ...invalidPlan.slides[1], slideId: "P09" };
    const phases: string[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(completionResponse(JSON.stringify(invalidPlan)))
      .mockResolvedValueOnce(completionResponse(JSON.stringify(createTestPptVisualPlan())));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generatePptVisualPlan({
      apiKey: "sk-visual-secret",
      structure: createTestPptStructure(),
      onPhaseChange: (phase) => phases.push(phase),
    });

    expect(result.visualPlan.slides[1].slideId).toBe("P02");
    expect(result.usage.total_tokens).toBe(20_220);
    expect(phases).toEqual(["planning-visuals", "repairing-visuals"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("两次视觉方案都无效时停止且错误不包含密钥", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(completionResponse("{}"))
        .mockResolvedValueOnce(completionResponse("{}")),
    );

    const error = await generatePptVisualPlan({
      apiKey: "sk-never-persist",
      structure: createTestPptStructure(),
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(PptGenerationError);
    expect(error).toMatchObject({ code: "invalid-visual-plan" });
    expect(JSON.stringify(error)).not.toContain("sk-never-persist");
  });

  it("把逐页预览作为多模态输入并返回结构化视觉评审", async () => {
    const structure = createTestPptStructure();
    const visualPlan = createTestPptVisualPlan();
    const decision = createTestPptVisualReviewDecision();
    const fetchMock = vi.fn().mockResolvedValue(completionResponse(JSON.stringify(decision)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await reviewPptVisualPlan({
      apiKey: "sk-visual-review",
      structure,
      visualPlan,
      visualPreference: "克制、编辑式排版",
      previews: structure.slides.map((slide) => ({
        slideId: slide.id,
        dataUrl: "data:image/png;base64,dGVzdA==",
      })),
    });

    expect(result.review.verdict).toBe("approved");
    expect(result.review.revisedVisualPlan).toEqual(visualPlan);
    expect(result.review.revisedSlideIds).toEqual([]);
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body)) as {
      messages: Array<{ content: unknown }>;
    };
    expect(body.messages[0]?.content).toEqual(expect.stringContaining('"slidePatches"'));
    expect(body.messages[0]?.content).not.toEqual(expect.stringContaining('"revisedVisualPlan"'));
    expect(body.messages[1]?.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "image_url" }),
        expect.objectContaining({ type: "text", text: expect.stringContaining("P01") }),
      ]),
    );
    expect(String(request.body)).toContain("克制、编辑式排版");
    expect(String(request.body)).not.toContain("sk-visual-review");
  });

  it("视觉评审补丁无效时修复一次并返回确定性评审", async () => {
    const structure = createTestPptStructure();
    const phases: string[] = [];
    const invalidDecision = {
      ...createTestPptVisualReviewDecision(),
      slidePatches: [{ slideId: "P99", changes: { density: "spacious" } }],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(completionResponse(JSON.stringify(invalidDecision)))
      .mockResolvedValueOnce(
        completionResponse(JSON.stringify(createTestPptVisualReviewDecision())),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await reviewPptVisualPlan({
      apiKey: "sk-visual-review",
      structure,
      visualPlan: createTestPptVisualPlan(),
      previews: structure.slides.map((slide) => ({
        slideId: slide.id,
        dataUrl: "data:image/png;base64,dGVzdA==",
      })),
      onPhaseChange: (phase) => phases.push(phase),
    });

    expect(result.review.verdict).toBe("approved");
    expect(phases).toEqual(["reviewing-visuals", "repairing-visual-review"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, repairRequest] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(String(repairRequest.body)).toContain("P99");
    expect(String(repairRequest.body)).toContain("不存在的页面");
  });

  it("确定性应用最小视觉补丁并派生变更声明", async () => {
    const structure = createTestPptStructure();
    const visualPlan = createTestPptVisualPlan();
    const decision = {
      ...createTestPptVisualReviewDecision(),
      summary: "第三页需要更明确的层级。",
      issues: [
        {
          slideId: "P03",
          category: "hierarchy" as const,
          severity: "important" as const,
          observation: "第三页的主次信息竞争。",
          recommendation: "调整构图与信息密度。",
        },
      ],
      themePatch: { accentColor: "#2563eb" },
      slidePatches: [
        {
          slideId: "P03",
          changes: {
            layoutVariant: "content-rail" as const,
            density: "spacious" as const,
          },
        },
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completionResponse(JSON.stringify(decision))));

    const result = await reviewPptVisualPlan({
      apiKey: "sk-visual-review",
      structure,
      visualPlan,
      previews: structure.slides.map((slide) => ({
        slideId: slide.id,
        dataUrl: "data:image/png;base64,dGVzdA==",
      })),
    });

    expect(result.review).toMatchObject({
      verdict: "revised",
      themeChanged: true,
      revisedSlideIds: ["P03"],
      revisedVisualPlan: {
        theme: { accentColor: "#2563eb" },
      },
    });
    expect(result.review.revisedVisualPlan.slides[2]).toMatchObject({
      layoutVariant: "content-rail",
      density: "spacious",
      visualFocus: visualPlan.slides[2].visualFocus,
    });
  });

  it("第二次补丁仍无效时返回具体页面和原因", async () => {
    const structure = createTestPptStructure();
    const invalidDecision = {
      ...createTestPptVisualReviewDecision(),
      slidePatches: [
        {
          slideId: "P99",
          changes: { density: "spacious" },
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(completionResponse(JSON.stringify(invalidDecision)))
        .mockResolvedValueOnce(completionResponse(JSON.stringify(invalidDecision))),
    );

    const error = await reviewPptVisualPlan({
      apiKey: "sk-visual-review",
      structure,
      visualPlan: createTestPptVisualPlan(),
      previews: structure.slides.map((slide) => ({
        slideId: slide.id,
        dataUrl: "data:image/png;base64,dGVzdA==",
      })),
    }).catch((reason: unknown) => reason);

    expect(error).toMatchObject({ code: "invalid-visual-review" });
    expect((error as Error).message).toContain("P99");
    expect((error as Error).message).toContain("不存在的页面");
  });

  it("拒绝与文本结构顺序不一致的视觉评审预览", async () => {
    const structure = createTestPptStructure();
    const error = await reviewPptVisualPlan({
      apiKey: "sk-visual-review",
      structure,
      visualPlan: createTestPptVisualPlan(),
      previews: [
        {
          slideId: "P02",
          dataUrl: "data:image/png;base64,dGVzdA==",
        },
      ],
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(PptGenerationError);
    expect(error).toMatchObject({ code: "invalid-visual-review" });
  });
});
