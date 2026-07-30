import { getDocumentPages } from "@/editor/document-pages";
import { createCanvasDocumentPresentation } from "@/editor/pptx-export";
import type { ChartElement, ImageElement, TableElement, TextElement } from "@/editor/types";
import {
  CanvasRenderError,
  getCanvasDocumentIssues,
  renderPptStructureToCanvas,
} from "@/features/ai-ppt/render/render-ppt-structure";
import type { PptContentBlock, PptSlide, PptVisualPlanV2 } from "@/features/ai-ppt/schema";
import { createTestPptStructure, createTestPptVisualPlan } from "@/features/ai-ppt/test-fixtures";
import JSZip from "jszip";

describe("PPT 画布渲染器", () => {
  it("把逐页文本结构转换为编辑器可用的多页画布", () => {
    const structure = createTestPptStructure();
    const document = renderPptStructureToCanvas(
      structure,
      createTestPptVisualPlan(),
      "ai-ppt-canvas-test",
    );

    expect(document).toMatchObject({
      id: "ai-ppt-canvas-test",
      documentType: "pptx",
      width: 1600,
      height: 900,
      name: structure.deck.title,
    });
    expect(getDocumentPages(document)).toHaveLength(structure.slides.length);
    expect(getCanvasDocumentIssues(document)).toEqual([]);

    for (const page of getDocumentPages(document)) {
      expect(page.elements).toContainEqual(
        expect.objectContaining({
          type: "rect",
          x: 0,
          y: 0,
          width: 1600,
          height: 900,
        }),
      );
    }
  });

  it("拒绝小于演示阅读下限的正文和标题字号", () => {
    const document = renderPptStructureToCanvas(
      createTestPptStructure(),
      createTestPptVisualPlan(),
      "font-size-guard",
    );
    const page = getDocumentPages(document)[2];
    const body = page.elements.find(
      (element): element is TextElement =>
        element.type === "text" && !/页码|章节名称|标签$|编号$/u.test(element.name),
    );

    expect(body).toBeDefined();
    if (!body) return;
    body.fontSize = 12;
    expect(getCanvasDocumentIssues(document)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(new RegExp(`文本 ${body.id} 的字号小于 \\d+`)),
      ]),
    );
  });

  it("拒绝有效内容占比过低、存在大面积无意义留白的页面", () => {
    const document = renderPptStructureToCanvas(
      createTestPptStructure(),
      createTestPptVisualPlan(),
      "occupancy-guard",
    );
    const page = getDocumentPages(document)[2];
    page.elements.forEach((element) => {
      if (element.type === "group") return;
      const isBackground =
        element.type === "rect" &&
        element.x === 0 &&
        element.y === 0 &&
        element.width === 1600 &&
        element.height === 900;
      if (!isBackground) {
        element.width = 1;
        element.height = 1;
      }
    });

    expect(getCanvasDocumentIssues(document)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/页面 .* 的有效视觉占比仅为 .*%，存在过度留白/u),
      ]),
    );
  });

  it("拒绝与文本结构页码不一致的视觉方案", () => {
    const visualPlan = createTestPptVisualPlan();
    visualPlan.slides[1] = { ...visualPlan.slides[1], slideId: "P09" };

    expect(() =>
      renderPptStructureToCanvas(createTestPptStructure(), visualPlan, "invalid"),
    ).toThrow(CanvasRenderError);
  });

  it("根据百炼视觉方案生成不同的表格样式", () => {
    const structure = createTestPptStructure();
    structure.slides[2] = {
      ...structure.slides[2],
      role: "data",
      contentBlocks: [
        {
          type: "table",
          columns: ["方案", "成本", "收益"],
          rows: [
            ["试点", "低", "可验证"],
            ["扩展", "中", "规模化"],
          ],
        },
      ],
    };
    const visualPlan = createTestPptVisualPlan();
    visualPlan.slides[2] = {
      ...visualPlan.slides[2],
      layoutVariant: "table-report",
      tableStyle: "contrast",
    };

    const document = renderPptStructureToCanvas(structure, visualPlan, "table-test");
    const table = getDocumentPages(document)[2].elements.find(
      (element): element is TableElement => element.type === "table",
    );

    expect(table).toBeDefined();
    expect(table?.headerStyle.fill).toBe(visualPlan.theme.primaryColor);
    expect(table?.headerStyle.fontWeight).toBe("700");
    expect(table?.rows).toHaveLength(2);
  });

  const specializedCases: Array<{
    name: string;
    block: PptContentBlock;
    intent: PptSlide["layoutIntent"];
    variant: PptVisualPlanV2["slides"][number]["layoutVariant"];
  }> = [
    {
      name: "对比",
      block: {
        type: "comparison",
        left: { heading: "当前", items: ["流程分散", "反馈缓慢"] },
        right: { heading: "目标", items: ["流程统一", "快速验证"] },
      },
      intent: "comparison",
      variant: "comparison-panels",
    },
    {
      name: "流程",
      block: {
        type: "process",
        steps: Array.from({ length: 8 }, (_, index) => ({
          title: `步骤 ${index + 1}`,
          description: "说明",
        })),
      },
      intent: "process",
      variant: "process-vertical",
    },
    {
      name: "指标",
      block: {
        type: "metrics",
        items: Array.from({ length: 6 }, (_, index) => ({
          value: `${index + 1}0%`,
          label: `指标 ${index + 1}`,
          context: "指标说明",
        })),
      },
      intent: "metrics",
      variant: "metrics-cards",
    },
    {
      name: "引用",
      block: {
        type: "quote",
        quote: "设计不是装饰，而是信息优先级的表达。",
        attribution: "内部设计原则",
      },
      intent: "quote",
      variant: "quote-focus",
    },
  ];

  it.each(specializedCases)("稳定渲染$name页面且不越界", ({ block, intent, variant }) => {
    const structure = createTestPptStructure();
    structure.slides[2] = {
      ...structure.slides[2],
      contentBlocks: [block],
      layoutIntent: intent,
    };
    const visualPlan = createTestPptVisualPlan();
    visualPlan.slides[2] = { ...visualPlan.slides[2], layoutVariant: variant };

    const document = renderPptStructureToCanvas(structure, visualPlan, `test-${block.type}`);
    expect(getCanvasDocumentIssues(document)).toEqual([]);
  });

  it("内容块较多时自动收敛卡片内边距", () => {
    const structure = createTestPptStructure();
    structure.slides[2] = {
      ...structure.slides[2],
      contentBlocks: Array.from({ length: 8 }, (_, index) => ({
        type: "paragraph" as const,
        text: `正文内容 ${index + 1}`,
      })),
    };
    const visualPlan = createTestPptVisualPlan();
    visualPlan.slides[2] = {
      ...visualPlan.slides[2],
      layoutVariant: "content-cards",
    };

    const document = renderPptStructureToCanvas(structure, visualPlan, "many-blocks");
    expect(getCanvasDocumentIssues(document)).toEqual([]);
  });

  it("用专属总结布局容纳五条较长结论", () => {
    const structure = createTestPptStructure();
    structure.slides[3] = {
      ...structure.slides[3],
      title: "核心困境：治疗手段受限与肿瘤进展",
      coreMessage: "肿瘤进展与治疗耐受性下降同时限制后续选择。",
      contentBlocks: [
        {
          type: "bullet-list",
          items: [
            "肿瘤进展：AFP飙升至3000+，肝内多发复发及新发灶。",
            "免疫耐药：经历两线免疫治疗后仍然出现疾病进展。",
            "肝功能失代偿：低蛋白、高胆红素、凝血异常。",
            "骨髓抑制：血小板极低，限制介入及系统治疗。",
            "最终诊断：肝恶性肿瘤多发、酒精性肝硬化失代偿期及脾功能亢进。",
          ],
        },
      ],
    };
    const visualPlan = createTestPptVisualPlan();
    visualPlan.slides[3] = {
      ...visualPlan.slides[3],
      layoutVariant: "summary-list",
      density: "compact",
      rhythm: "dense",
      visualFocus: "五大核心困境",
    };

    const document = renderPptStructureToCanvas(structure, visualPlan, "long-summary");
    const elements = getDocumentPages(document)[3].elements;

    expect(elements.filter((element) => /^总结项 \d+$/.test(element.name))).toHaveLength(5);
    expect(elements.some((element) => element.name === "结束页行动项")).toBe(false);
    expect(getCanvasDocumentIssues(document)).toEqual([]);
  });

  it("把语义数据和结构关系渲染为可编辑图表与形状连接", () => {
    const structure = createTestPptStructure();
    structure.slides[1] = {
      ...structure.slides[1],
      role: "data",
      layoutIntent: "chart",
      contentBlocks: [
        {
          type: "chart",
          relationship: "trend",
          takeaway: "季度收入连续增长。",
          categories: ["Q1", "Q2", "Q3"],
          series: [{ name: "收入", values: [10, 18, 29] }],
        },
      ],
    };
    structure.slides[2] = {
      ...structure.slides[2],
      layoutIntent: "diagram",
      contentBlocks: [
        {
          type: "diagram",
          relationship: "system",
          nodes: [
            { id: "engine", label: "决策引擎", description: "统一判断" },
            { id: "input", label: "业务输入" },
            { id: "output", label: "行动输出" },
          ],
          edges: [
            { from: "input", to: "engine" },
            { from: "engine", to: "output" },
          ],
        },
      ],
    };
    const visualPlan = createTestPptVisualPlan();
    visualPlan.slides[1] = {
      ...visualPlan.slides[1],
      layoutVariant: "chart-insight",
      primaryVisual: "chart",
      composition: "data-led",
    };
    visualPlan.slides[2] = {
      ...visualPlan.slides[2],
      layoutVariant: "diagram-focus",
      primaryVisual: "diagram",
      composition: "relationship-led",
    };

    const document = renderPptStructureToCanvas(structure, visualPlan, "native-visuals");
    const chart = getDocumentPages(document)[1].elements.find(
      (element): element is ChartElement => element.type === "chart",
    );
    const diagramElements = getDocumentPages(document)[2].elements;

    expect(chart).toMatchObject({ chartType: "line", showValue: true });
    expect(diagramElements.filter((element) => element.type === "arrow")).toHaveLength(2);
    expect(getCanvasDocumentIssues(document)).toEqual([]);
  });

  it("让页面节奏、构图和风格字段改变实际画布", () => {
    const structure = createTestPptStructure();
    const visualPlan = createTestPptVisualPlan();
    visualPlan.theme.style = "swiss";
    visualPlan.slides[2] = {
      ...visualPlan.slides[2],
      rhythm: "breathing",
      primaryVisual: "typography",
      composition: "centered-statement",
    };

    const document = renderPptStructureToCanvas(structure, visualPlan, "visual-grammar");
    const elements = getDocumentPages(document)[2].elements;

    expect(elements.some((element) => element.name === "Swiss 顶部粗线")).toBe(true);
    expect(elements.some((element) => element.name === "页面视觉钩子")).toBe(true);
    expect(getCanvasDocumentIssues(document)).toEqual([]);
  });

  it("根据非对称栏宽高自动收敛视觉钩子字号", () => {
    const structure = createTestPptStructure();
    const visualPlan = createTestPptVisualPlan();
    visualPlan.slides[2] = {
      ...visualPlan.slides[2],
      layoutVariant: "two-column",
      composition: "asymmetric-split",
      primaryVisual: "typography",
      visualFocus: "左侧文字描述TIPS及脾栓塞史，右侧留白或辅助图形",
    };

    const document = renderPptStructureToCanvas(structure, visualPlan, "asymmetric-focus");
    const focus = getDocumentPages(document)[2].elements.find(
      (element): element is TextElement =>
        element.type === "text" && element.name === "非对称布局视觉钩子",
    );

    expect(focus?.fontSize).toBe(33);
    expect(getCanvasDocumentIssues(document)).toEqual([]);
  });

  it("用登记图片生成全幅媒体页并保留裁切焦点", () => {
    const structure = createTestPptStructure();
    const visualPlan = createTestPptVisualPlan();
    const assets = [
      {
        id: "A01",
        name: "architecture.webp",
        alt: "建筑与水面倒影，主体位于画面右侧",
        credit: "用户提供",
        src: "data:image/webp;base64,dGVzdA==",
      },
    ];
    visualPlan.designSystem = {
      ...visualPlan.designSystem,
      grid: "cinematic",
      typeScale: "dramatic",
      mediaPolicy: "evidence-first",
    };
    visualPlan.slides[0] = {
      ...visualPlan.slides[0],
      assetId: "A01",
      mediaLayout: "full-bleed",
      imageTreatment: "darkened",
      focalPointX: 0.8,
      focalPointY: 0.45,
    };

    const document = renderPptStructureToCanvas(structure, visualPlan, "media-layout", assets);
    const page = getDocumentPages(document)[0];
    const image = page.elements.find(
      (element): element is ImageElement => element.type === "image",
    );

    expect(image).toMatchObject({
      fit: "cover",
      focalPointX: 0.8,
      focalPointY: 0.45,
      height: 900,
      width: 1600,
      x: 0,
      y: 0,
    });
    expect(page.elements.some((element) => element.name === "图片可读性遮罩")).toBe(true);
    expect(page.elements.some((element) => element.name === "媒体页标题")).toBe(true);
    expect(getCanvasDocumentIssues(document)).toEqual([]);
  });

  it("生成结果可以通过现有导出器写成多页 PPTX", async () => {
    const structure = createTestPptStructure();
    structure.slides[1] = {
      ...structure.slides[1],
      role: "data",
      layoutIntent: "chart",
      contentBlocks: [
        {
          type: "chart",
          relationship: "comparison",
          takeaway: "方案 B 的转化率领先。",
          categories: ["方案 A", "方案 B"],
          series: [{ name: "转化率", values: [32, 47] }],
        },
      ],
    };
    const visualPlan = createTestPptVisualPlan();
    visualPlan.slides[1] = {
      ...visualPlan.slides[1],
      layoutVariant: "chart-insight",
      primaryVisual: "chart",
      composition: "data-led",
    };
    const document = renderPptStructureToCanvas(structure, visualPlan, "export-ready");

    const presentation = await createCanvasDocumentPresentation(document);
    const output = await presentation.write({ outputType: "uint8array" });
    const archive = await JSZip.loadAsync(output as Uint8Array);
    const slideFiles = Object.keys(archive.files).filter((name) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(name),
    );

    expect(slideFiles).toHaveLength(structure.slides.length);
    expect(
      Object.keys(archive.files).some((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name)),
    ).toBe(true);
    const firstSlide = await archive.file("ppt/slides/slide1.xml")?.async("string");
    expect(firstSlide).toContain(structure.slides[0].title);
    expect(firstSlide).not.toContain("<a:normAutofit");
  });
});
