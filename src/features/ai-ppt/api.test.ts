import {
  analyzePptMaterial,
  generatePptStructure,
  normalizeBailianApiHost,
  PptGenerationError,
} from "@/features/ai-ppt/api";
import {
  createTestPptInput,
  createTestPptMaterialPlan,
  createTestPptStructure,
  createTestPptTokenUsage,
} from "@/features/ai-ppt/test-fixtures";

function completionResponse(
  content: string,
  status = 200,
  usage: unknown = createTestPptTokenUsage(),
): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage,
    }),
    {
      headers: { "Content-Type": "application/json" },
      status,
    },
  );
}

describe("百炼文本结构客户端", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("先分析材料并返回可确认的事实与方向", async () => {
    const phases: string[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValue(completionResponse(JSON.stringify(createTestPptMaterialPlan())));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzePptMaterial({
      apiKey: "sk-test-secret",
      input: createTestPptInput(),
      onPhaseChange: (phase) => phases.push(phase),
    });

    expect(result.materialPlan.direction.title).toBe("AI 产品规模化投入决策");
    expect(result.materialPlan.facts.map((fact) => fact.id)).toEqual(["F001", "F002"]);
    expect(phases).toEqual(["analyzing-material"]);
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body.temperature).toBe(0.2);
    expect(body.enable_thinking).toBe(false);
  });

  it("材料为空时不发起分析请求", async () => {
    const input = createTestPptInput();
    input.sourceMarkdown = "";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      analyzePptMaterial({
        apiKey: "sk-test-secret",
        input,
      }),
    ).rejects.toMatchObject({
      code: "invalid-material-plan",
      message: "请先提供已有材料。",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("材料摘录不在原文中时触发一次修复", async () => {
    const invalidPlan = createTestPptMaterialPlan();
    invalidPlan.facts[0].sourceExcerpt = "原文中不存在的内容";
    const phases: string[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(completionResponse(JSON.stringify(invalidPlan)))
      .mockResolvedValueOnce(completionResponse(JSON.stringify(createTestPptMaterialPlan())));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzePptMaterial({
      apiKey: "sk-test-secret",
      input: createTestPptInput(),
      onPhaseChange: (phase) => phases.push(phase),
    });

    expect(result.materialPlan.facts[0].sourceExcerpt).toBe("当前产品进入规模化阶段。");
    expect(phases).toEqual(["analyzing-material", "repairing-material"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, repairRequest] = fetchMock.mock.calls[1] as [string, RequestInit];
    const repairBody = JSON.parse(String(repairRequest.body)) as {
      messages: Array<{ content: string }>;
    };
    expect(repairBody.messages[1]?.content).toContain("<source_material>");
    expect(repairBody.messages[1]?.content).toContain("当前产品进入规模化阶段。");
    expect(repairBody.messages[1]?.content).toContain("不得拼接、改写、补充标点或添加说明");
  });

  it("使用固定模型和结构化输出参数发起请求", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(completionResponse(JSON.stringify(createTestPptStructure())));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generatePptStructure({
      apiKey: "sk-test-secret",
      input: createTestPptInput(),
      materialPlan: createTestPptMaterialPlan(),
    });

    expect(result.structure.deck.title).toBe("AI 产品战略");
    expect(result.usage).toEqual(createTestPptTokenUsage());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions");
    expect(request.headers).toEqual({
      Authorization: "Bearer sk-test-secret",
      "Content-Type": "application/json",
    });
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "qwen3.7-plus",
      response_format: { type: "json_object" },
      enable_thinking: false,
      stream: false,
      temperature: 0.3,
    });
    expect(body).not.toHaveProperty("max_tokens");
  });

  it("修复阶段重新获得完整的三分钟超时窗口", async () => {
    vi.useFakeTimers();
    const invalidPlan = createTestPptMaterialPlan();
    invalidPlan.facts[0].sourceExcerpt = "原文中不存在的内容";
    const delayedResponse = (
      request: RequestInit,
      delay: number,
      content: string,
    ): Promise<Response> =>
      new Promise<Response>((resolve, reject) => {
        const timerId = globalThis.setTimeout(
          () => resolve(completionResponse(content)),
          delay,
        );
        request.signal?.addEventListener(
          "abort",
          () => {
            globalThis.clearTimeout(timerId);
            reject(new DOMException("已取消", "AbortError"));
          },
          { once: true },
        );
      });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce((_url: string, request: RequestInit) =>
        delayedResponse(request, 170_000, JSON.stringify(invalidPlan)),
      )
      .mockImplementationOnce((_url: string, request: RequestInit) =>
        delayedResponse(request, 20_000, JSON.stringify(createTestPptMaterialPlan())),
      );
    vi.stubGlobal("fetch", fetchMock);

    const pending = analyzePptMaterial({
      apiKey: "sk-test-secret",
      input: createTestPptInput(),
    });

    await vi.advanceTimersByTimeAsync(170_000);
    await vi.advanceTimersByTimeAsync(20_000);

    await expect(pending).resolves.toMatchObject({
      materialPlan: { direction: { title: "AI 产品规模化投入决策" } },
    });
  });

  it("首次结构无效时只修复一次并返回修复结果", async () => {
    const phases: string[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(completionResponse("{}"))
      .mockResolvedValueOnce(completionResponse(JSON.stringify(createTestPptStructure())));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generatePptStructure({
      apiKey: "sk-test-secret",
      input: createTestPptInput(),
      materialPlan: createTestPptMaterialPlan(),
      onPhaseChange: (phase) => phases.push(phase),
    });

    expect(result.structure.slides).toHaveLength(4);
    expect(result.usage).toMatchObject({
      total_tokens: 20_220,
      completion_tokens: 8_388,
      prompt_tokens: 11_832,
      completion_tokens_details: {
        reasoning_tokens: 6_240,
        text_tokens: 8_388,
      },
      prompt_tokens_details: {
        cached_tokens: 0,
        text_tokens: 11_832,
      },
    });
    expect(phases).toEqual(["generating", "repairing"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("第二次结构仍无效时停止且错误不包含密钥", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(completionResponse("不是结构化数据"))
        .mockResolvedValueOnce(completionResponse("{}")),
    );

    const error = await generatePptStructure({
      apiKey: "sk-never-leak",
      input: createTestPptInput(),
      materialPlan: createTestPptMaterialPlan(),
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(PptGenerationError);
    expect(error).toMatchObject({ code: "invalid-structure" });
    expect(String((error as Error).message)).not.toContain("sk-never-leak");
    expect(JSON.stringify(error)).not.toContain("sk-never-leak");
  });

  it.each([
    [401, "invalid-key"],
    [403, "forbidden"],
    [429, "rate-limited"],
  ])("将状态码 %s 转为可处理的错误", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completionResponse("", status)));

    const error = await generatePptStructure({
      apiKey: "sk-test-secret",
      input: createTestPptInput(),
      materialPlan: createTestPptMaterialPlan(),
    }).catch((reason: unknown) => reason);

    expect(error).toMatchObject({ code });
  });

  it("缺少有效用量统计时不接受响应", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(completionResponse(JSON.stringify(createTestPptStructure()), 200, null)),
    );

    await expect(
      generatePptStructure({
        apiKey: "sk-test-secret",
        input: createTestPptInput(),
        materialPlan: createTestPptMaterialPlan(),
      }),
    ).rejects.toMatchObject({
      code: "request-failed",
      message: "百炼响应中没有有效的用量统计。",
    });
  });

  it("拒绝把密钥发送到非阿里云域名", () => {
    expect(() => normalizeBailianApiHost("https://example.com/compatible-mode/v1")).toThrow(
      PptGenerationError,
    );
    expect(() =>
      normalizeBailianApiHost(
        "https://dashscope.aliyuncs.com/compatible-mode/v1?redirect=example.com",
      ),
    ).toThrow(PptGenerationError);
    expect(() =>
      normalizeBailianApiHost("https://dashscope.aliyuncs.com.example.com/compatible-mode/v1"),
    ).toThrow(PptGenerationError);
  });

  it("支持调用方取消请求", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, request: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          request.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("已取消", "AbortError")),
            { once: true },
          );
        });
      }),
    );
    const controller = new AbortController();
    const pending = generatePptStructure({
      apiKey: "sk-test-secret",
      input: createTestPptInput(),
      materialPlan: createTestPptMaterialPlan(),
      signal: controller.signal,
    });

    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: "cancelled" });
  });

  it("请求超过三分钟后中止并返回超时错误", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, request: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          request.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("已超时", "AbortError")),
            { once: true },
          );
        });
      }),
    );
    const pending = generatePptStructure({
      apiKey: "sk-test-secret",
      input: createTestPptInput(),
      materialPlan: createTestPptMaterialPlan(),
    });
    const assertion = expect(pending).rejects.toMatchObject({ code: "timeout" });

    await vi.advanceTimersByTimeAsync(180_000);

    await assertion;
  });
});
