import {
  generatePptStructure,
  normalizeBailianApiHost,
  PptGenerationError,
} from "@/features/ai-ppt/api";
import {
  createTestPptInput,
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

  it("使用固定模型和结构化输出参数发起请求", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(completionResponse(JSON.stringify(createTestPptStructure())));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generatePptStructure({
      apiKey: "sk-test-secret",
      input: createTestPptInput(),
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
      stream: false,
      temperature: 0.3,
    });
    expect(body).not.toHaveProperty("max_tokens");
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
    });
    const assertion = expect(pending).rejects.toMatchObject({ code: "timeout" });

    await vi.advanceTimersByTimeAsync(180_000);

    await assertion;
  });
});
