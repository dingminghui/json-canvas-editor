import { App } from "@/App";
import * as api from "@/features/ai-ppt/api";
import {
  getPptCanvasArtifact,
  PPT_CANVAS_ARTIFACT_STORAGE_KEY,
} from "@/features/ai-ppt/canvas-storage";
import { getPptProject, savePptProject } from "@/features/ai-ppt/storage";
import {
  createTestPptMaterialPlan,
  createTestPptProject,
  createTestPptStructure,
  createTestPptTokenUsage,
  createTestPptVisualPlan,
  createTestPptVisualReview,
} from "@/features/ai-ppt/test-fixtures";
import * as visualApi from "@/features/ai-ppt/visual-api";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/editor/JsonCanvasEditor", () => ({
  JsonCanvasEditor: ({ value }: { value: ReadonlyArray<{ name: string }> }) => (
    <div data-testid="画布编辑器">{value[0]?.name}</div>
  ),
}));

vi.mock("@/features/ai-ppt/PptVisualReviewCapture", async () => {
  const { useEffect } = await import("react");
  return {
    PptVisualReviewCapture: ({
      slideIds,
      onCaptured,
    }: {
      slideIds: readonly string[];
      onCaptured: (
        previews: Array<{
          slideId: string;
          dataUrl: string;
        }>,
      ) => void;
    }) => {
      useEffect(() => {
        onCaptured(
          slideIds.map((slideId) => ({
            slideId,
            dataUrl: "data:image/png;base64,dGVzdA==",
          })),
        );
      }, [onCaptured, slideIds]);
      return null;
    },
  };
});

function renderApp(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
    </MemoryRouter>,
  );
}

describe("AI 生成 PPT 文本结构页面", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("首页显示创建入口和本地空状态", () => {
    renderApp("/");

    expect(screen.getByRole("link", { name: "创建 PPT 结构" })).toHaveAttribute(
      "href",
      "/ai-ppt/new",
    );
    expect(screen.getByText("还没有生成过 PPT 结构")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "开始创建" })).not.toBeInTheDocument();
  });

  it("创建页校验必填项并显示材料字数", async () => {
    const user = userEvent.setup();
    renderApp("/ai-ppt/new");

    await user.type(screen.getByLabelText(/已有材料/), "三字文");
    await user.type(screen.getByLabelText("PPT 主题"), "材料测试");
    await user.type(screen.getByLabelText("目标听众"), "管理层");
    await user.type(screen.getByLabelText("演示目标"), "形成决策");
    expect(screen.getByText("3 / 50,000 字")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "分析材料并生成方向" }));
    expect(screen.getByRole("alert")).toHaveTextContent("请输入百炼接口密钥");
  });

  it("非本机地址禁用生成功能", () => {
    vi.spyOn(api, "isLocalBrowserHost").mockReturnValue(false);
    renderApp("/ai-ppt/new");

    expect(screen.getByText("本功能仅支持从本机地址运行。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "分析材料并生成方向" })).toBeDisabled();
  });

  it("生成成功后保存非敏感输入并进入大纲页", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "analyzePptMaterial").mockResolvedValue({
      materialPlan: createTestPptMaterialPlan(),
      usage: createTestPptTokenUsage(),
    });
    vi.spyOn(api, "generatePptStructure").mockResolvedValue({
      structure: createTestPptStructure(),
      usage: createTestPptTokenUsage(),
    });
    renderApp("/ai-ppt/new");

    await user.type(screen.getByLabelText("百炼接口密钥"), "sk-not-persisted");
    await user.type(screen.getByLabelText("PPT 主题"), "AI 产品战略");
    await user.type(screen.getByLabelText("目标听众"), "公司管理层");
    await user.type(screen.getByLabelText("演示目标"), "获得研发预算批准");
    await user.type(screen.getByLabelText(/已有材料/), "当前产品进入规模化阶段。");
    await user.click(screen.getByRole("button", { name: "分析材料并生成方向" }));
    expect(await screen.findByRole("heading", { name: "确认生成方向" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认方向并生成 PPT 结构" }));

    expect(await screen.findByDisplayValue("AI 产品战略")).toBeInTheDocument();
    const persisted = globalThis.localStorage.getItem("json-canvas-editor:ppt-projects:v1");
    expect(persisted).not.toContain("sk-not-persisted");
    expect(persisted).toContain('"total_tokens":20220');
    expect(api.generatePptStructure).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "sk-not-persisted",
        input: expect.objectContaining({
          topic: "AI 产品战略",
          language: "zh-CN",
        }),
        materialPlan: createTestPptMaterialPlan(),
      }),
    );
  });

  it("生成过程中允许用户取消", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "analyzePptMaterial").mockImplementation(
      ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new api.PptGenerationError("cancelled", "已取消生成。")),
            { once: true },
          );
        }),
    );
    renderApp("/ai-ppt/new");

    await user.type(screen.getByLabelText("百炼接口密钥"), "sk-cancel");
    await user.type(screen.getByLabelText("PPT 主题"), "AI 产品战略");
    await user.type(screen.getByLabelText("目标听众"), "公司管理层");
    await user.type(screen.getByLabelText("演示目标"), "获得研发预算批准");
    await user.type(screen.getByLabelText(/已有材料/), "当前产品进入规模化阶段。");
    await user.click(screen.getByRole("button", { name: "分析材料并生成方向" }));
    await user.click(await screen.findByRole("button", { name: "取消生成" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("已取消生成");
    expect(globalThis.localStorage.length).toBe(0);
  });

  it("不存在的本地项目显示返回入口", () => {
    renderApp("/ai-ppt/11111111-1111-4111-8111-111111111111");

    expect(screen.getByText("没有找到这份大纲")).toBeInTheDocument();
    const backLink = screen.getByRole("link", { name: "返回首页" });
    expect(backLink).toHaveAttribute("href", "/");
    expect(backLink).toHaveAttribute("data-size", "icon-sm");
    expect(backLink.querySelector(".sr-only")).toHaveTextContent("返回首页");
  });

  it("文字编辑在防抖后保存，结构操作立即保存", async () => {
    const user = userEvent.setup();
    const project = createTestPptProject();
    expect(savePptProject(project)).toBe(true);
    renderApp(`/ai-ppt/${project.id}`);

    const allProjectsLink = screen.getByRole("link", { name: "全部项目" });
    expect(allProjectsLink).toHaveAttribute("href", "/");
    expect(allProjectsLink).toHaveAttribute("data-size", "icon-sm");
    expect(allProjectsLink.querySelector(".sr-only")).toHaveTextContent("全部项目");

    const title = screen.getByLabelText("PPT 标题");
    await user.clear(title);
    await user.type(title, "新的战略标题");

    expect(screen.getByRole("status")).toHaveTextContent("保存中");
    await waitFor(
      () => {
        expect(getPptProject(project.id)?.structure.deck.title).toBe("新的战略标题");
        expect(screen.getByRole("status")).toHaveTextContent("已保存到本地");
      },
      { timeout: 1_500 },
    );

    await user.click(screen.getAllByRole("button", { name: "在后面添加一页" })[1]);
    expect(getPptProject(project.id)?.structure.deck.pageCount).toBe(5);
    expect(screen.getByText("共 5 页")).toBeInTheDocument();
  });

  it("结构元数据显示在章节结构上方", () => {
    const project = createTestPptProject();
    savePptProject(project);
    renderApp(`/ai-ppt/${project.id}`);

    const headings = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(headings.indexOf("结构元数据")).toBeLessThan(headings.indexOf("章节结构"));
  });

  it("大纲页显示材料覆盖率和逐页事实来源", () => {
    const project = createTestPptProject();
    savePptProject(project);
    renderApp(`/ai-ppt/${project.id}`);

    expect(screen.getByText("材料覆盖 100%")).toBeInTheDocument();
    expect(screen.getByText("必需事实 1/1")).toBeInTheDocument();
    expect(screen.getByLabelText("P03 材料依据 ID")).toHaveValue("F001");
    expect(screen.getAllByText("当前产品进入规模化阶段。").length).toBeGreaterThan(0);
  });

  it("大纲页可以继续编辑图表数据和关系图结构", () => {
    const project = createTestPptProject();
    project.structure.slides[1] = {
      ...project.structure.slides[1],
      layoutIntent: "chart",
      contentBlocks: [
        {
          type: "chart",
          relationship: "comparison",
          takeaway: "方案 B 表现更好。",
          categories: ["方案 A", "方案 B"],
          series: [{ name: "得分", values: [72, 88] }],
        },
      ],
    };
    project.structure.slides[2] = {
      ...project.structure.slides[2],
      layoutIntent: "diagram",
      contentBlocks: [
        {
          type: "diagram",
          relationship: "process",
          nodes: [
            { id: "input", label: "输入" },
            { id: "output", label: "输出" },
          ],
          edges: [{ from: "input", to: "output", label: "处理" }],
        },
      ],
    };
    savePptProject(project);
    renderApp(`/ai-ppt/${project.id}`);

    expect(screen.getByLabelText("图表数据关系")).toBeInTheDocument();
    expect(screen.getByLabelText("图表核心结论")).toHaveValue("方案 B 表现更好。");
    expect(screen.getByLabelText("图表数据")).toHaveValue("类别 | 得分\n方案 A | 72\n方案 B | 88");
    expect(screen.getByLabelText("结构图节点")).toHaveValue("input | 输入 | \noutput | 输出 | ");
    expect(screen.getByLabelText("结构图连接")).toHaveValue("input | output | 处理");
  });

  it("使用百炼视觉方案生成画布并进入现有编辑器", async () => {
    const user = userEvent.setup();
    const project = createTestPptProject();
    savePptProject(project);
    const generateVisualPlan = vi.spyOn(visualApi, "generatePptVisualPlan").mockResolvedValue({
      visualPlan: createTestPptVisualPlan(),
      usage: createTestPptTokenUsage(),
    });
    vi.spyOn(visualApi, "reviewPptVisualPlan").mockResolvedValue({
      review: createTestPptVisualReview(),
      usage: createTestPptTokenUsage(),
    });
    renderApp(`/ai-ppt/${project.id}`);

    await user.click(screen.getByRole("button", { name: "生成可编辑幻灯片" }));
    await user.type(screen.getByLabelText("百炼接口密钥"), "sk-canvas-not-persisted");
    await user.type(screen.getByLabelText(/视觉偏好/), "克制、专业，突出行动项");
    await user.upload(
      screen.getByLabelText(/图片素材/),
      new File(["hero"], "hero.png", { type: "image/png" }),
    );
    await screen.findByLabelText("hero.png 的图片描述");
    await user.click(screen.getByRole("button", { name: "生成可编辑幻灯片" }));

    const backLink = await screen.findByRole("link", { name: "返回文本大纲" });
    expect(backLink).toHaveAttribute("href", `/ai-ppt/${project.id}`);
    expect(backLink).toHaveAttribute("data-size", "icon-sm");
    expect(backLink.querySelector(".sr-only")).toHaveTextContent("返回文本大纲");
    const artifact = getPptCanvasArtifact(project.id);
    expect(artifact?.document.documentType).toBe("pptx");
    expect(artifact?.document.elements).toHaveLength(4);
    expect(artifact?.visualReview?.verdict).toBe("approved");
    expect(artifact?.assets).toEqual([
      expect.objectContaining({ id: "A01", name: "hero.png", alt: "hero" }),
    ]);
    expect(generateVisualPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        assets: [expect.objectContaining({ id: "A01", name: "hero.png" })],
      }),
    );
    const persisted = globalThis.localStorage.getItem(PPT_CANVAS_ARTIFACT_STORAGE_KEY);
    expect(persisted).not.toContain("sk-canvas-not-persisted");
    expect(getPptProject(project.id)?.generator.usage.total_tokens).toBe(30_330);
  });

  it("缺少画布时提示返回文本大纲", () => {
    const project = createTestPptProject();
    savePptProject(project);
    renderApp(`/ai-ppt/${project.id}/editor`);

    expect(screen.getByText("没有找到可编辑画布")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回文本大纲" })).toHaveAttribute(
      "href",
      `/ai-ppt/${project.id}`,
    );
  });

  it("首页按更新时间展示并可确认删除最近项目", async () => {
    const user = userEvent.setup();
    const project = createTestPptProject();
    savePptProject(project);
    renderApp("/");

    expect(
      screen.getByRole("link", { name: `打开 AI PPT 项目 ${project.structure.deck.title}` }),
    ).toHaveAttribute("href", `/ai-ppt/${project.id}`);
    expect(screen.getByText("模型用量 10,110 词元")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "新建" })).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: `删除 AI PPT 项目 ${project.structure.deck.title}`,
      }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("删除这份 PPT 结构");
    await user.click(screen.getByRole("button", { name: "删除" }));

    expect(screen.getByText("还没有生成过 PPT 结构")).toBeInTheDocument();
    expect(getPptProject(project.id)).toBeNull();
  });
});
