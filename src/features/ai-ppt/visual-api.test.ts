import { PptGenerationError } from "@/features/ai-ppt/api";
import {
  createTestPptStructure,
  createTestPptTokenUsage,
  createTestPptVisualPlan,
} from "@/features/ai-ppt/test-fixtures";
import { generatePptVisualPlan } from "@/features/ai-ppt/visual-api";

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
});
