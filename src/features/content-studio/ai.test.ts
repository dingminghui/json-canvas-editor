import { analyzeContentMaterial } from "./ai";
import type { ContentProjectInput } from "./schema";
import { createMaterialPlanFixture } from "./test-fixtures";

const TOKEN_USAGE = {
  total_tokens: 300,
  completion_tokens: 100,
  prompt_tokens: 200,
};

const completionResponse = (content: string): Response =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: TOKEN_USAGE,
    }),
    {
      headers: { "Content-Type": "application/json" },
      status: 200,
    },
  );

const createInput = (): ContentProjectInput => ({
  topic: "通用内容工作台",
  audience: "产品与设计团队",
  objective: "说明内容事实与视觉表达分层的价值",
  sourceMarkdown: [
    "# 内容工作台",
    "JSON 是唯一事实源。",
    "首期六套样式。",
    "载体阅读节奏不同。",
    "模型不输出坐标。",
  ].join("\n"),
  sourceTreatment: "忠于材料事实。",
  tone: "专业、清晰",
  mustInclude: [],
  exclude: [],
  language: "zh-CN",
});

describe("content studio AI material analysis", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("repairs evidence with the original source material still in context", async () => {
    const invalidPlan = createMaterialPlanFixture();
    invalidPlan.facts[0].sourceExcerpt = "原文中不存在的内容";
    const validPlan = createMaterialPlanFixture();
    const phases: string[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(completionResponse(JSON.stringify(invalidPlan)))
      .mockResolvedValueOnce(completionResponse(JSON.stringify(validPlan)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeContentMaterial(createInput(), {
      apiKey: "sk-test-secret",
      onPhaseChange: (phase) => phases.push(phase),
    });

    expect(result.data).toEqual(validPlan);
    expect(phases).toEqual(["generating", "repairing"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [, repairRequest] = fetchMock.mock.calls[1] as [string, RequestInit];
    const repairBody = JSON.parse(String(repairRequest.body)) as {
      messages: Array<{ content: string }>;
    };
    expect(repairBody.messages).toHaveLength(2);
    expect(repairBody.messages[1]?.content).toContain("<original_request_context>");
    expect(repairBody.messages[1]?.content).toContain("<source_material>");
    expect(repairBody.messages[1]?.content).toContain("JSON 是唯一事实源。");
    expect(repairBody.messages[1]?.content).toContain("F001.sourceExcerpt 与材料缺少足够文本关联");
  });

  it("reports the repaired JSON root shape when the model returns an array", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(completionResponse("[]"))
      .mockResolvedValueOnce(completionResponse("[]"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      analyzeContentMaterial(createInput(), {
        apiKey: "sk-test-secret",
      }),
    ).rejects.toMatchObject({
      code: "request-failed",
      message: expect.stringContaining("根值：数组"),
    });

    const [, repairRequest] = fetchMock.mock.calls[1] as [string, RequestInit];
    const repairBody = JSON.parse(String(repairRequest.body)) as {
      messages: Array<{ content: string }>;
    };
    expect(repairBody.messages[0]?.content).toContain(
      "不得返回数组、字符串化 JSON，也不得添加 materialPlan、data、result 等包装层",
    );
    expect(repairBody.messages[1]?.content).toContain("候选 JSON 根值：数组");
  });
});
