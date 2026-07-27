import { getExportFileName } from "@/editor/export-file";
import { createCanvasDocumentPresentation } from "@/editor/pptx-export";
import type { CanvasDocument } from "@/editor/types";
import JSZip from "jszip";

const document: CanvasDocument = {
  description: "PPT 导出测试",
  documentType: "pptx",
  elements: [
    {
      children: [
        {
          cornerRadius: 0,
          fill: "#ffffff",
          height: 900,
          id: "slide-background",
          locked: true,
          name: "幻灯片背景",
          opacity: 1,
          rotation: 0,
          stroke: "transparent",
          strokeWidth: 0,
          type: "rect",
          visible: true,
          width: 1600,
          x: 0,
          y: 0,
        },
        {
          align: "left",
          fill: "#123456",
          fontFamily: "noto-sans-sc",
          fontSize: 60,
          fontWeight: "700",
          height: 120,
          id: "slide-title",
          lineHeight: 1.25,
          locked: false,
          name: "页面标题",
          opacity: 1,
          rotation: 0,
          text: "导出文本正常显示",
          type: "text",
          visible: true,
          width: 1000,
          x: 100,
          y: 120,
        },
        {
          align: "left",
          fill: "#000000",
          fontFamily: "noto-sans-sc",
          fontSize: 30,
          fontWeight: "400",
          height: 80,
          id: "hidden-text",
          lineHeight: 1.2,
          locked: false,
          name: "隐藏文本",
          opacity: 1,
          rotation: 0,
          text: "不应导出",
          type: "text",
          visible: false,
          width: 400,
          x: 100,
          y: 300,
        },
        {
          chartType: "bar",
          colors: ["#25645F"],
          height: 260,
          id: "native-chart",
          locked: false,
          name: "原生图表",
          opacity: 1,
          rotation: 0,
          series: [{ labels: ["控制", "风险"], name: "评分", values: [78, 54] }],
          showLegend: false,
          showValue: true,
          title: "评估评分",
          type: "chart",
          visible: true,
          width: 460,
          x: 100,
          y: 360,
        },
        {
          cellStyle: {
            align: "center",
            borderColor: "#CBD5E1",
            borderWidth: 1,
            color: "#334155",
            fill: "#FFFFFF",
            fontFamily: "noto-sans-sc",
            fontSize: 16,
            fontWeight: "400",
            valign: "middle",
          },
          columns: [
            { id: "table-col-1", name: "节点", width: 160 },
            { id: "table-col-2", name: "动作", width: 260 },
          ],
          headerStyle: {
            align: "center",
            borderColor: "#CBD5E1",
            borderWidth: 1,
            color: "#FFFFFF",
            fill: "#25645F",
            fontFamily: "noto-sans-sc",
            fontSize: 16,
            fontWeight: "700",
            valign: "middle",
          },
          height: 140,
          id: "native-table",
          locked: false,
          name: "原生表格",
          opacity: 1,
          rotation: 0,
          rows: [
            {
              cells: { "table-col-1": "1–4 周", "table-col-2": "检查技巧" },
              height: 42,
              id: "table-row-1",
            },
          ],
          type: "table",
          visible: true,
          width: 420,
          x: 620,
          y: 360,
        },
      ],
      id: "slide-1",
      locked: false,
      name: "第一页",
      type: "group",
      visible: true,
    },
  ],
  height: 900,
  id: "ppt-export-test",
  name: 'PPT / 导出："测试"',
  width: 1600,
};

describe("PPTX export", () => {
  it("writes visible text with valid line spacing and a CJK-safe font", async () => {
    const presentation = await createCanvasDocumentPresentation(document);
    const output = await presentation.write({ outputType: "uint8array" });
    const archive = await JSZip.loadAsync(output as Uint8Array);
    const slideXml = await archive.file("ppt/slides/slide1.xml")?.async("string");

    expect(slideXml).toBeDefined();
    expect(slideXml).toContain("<a:t>导出文本正常显示</a:t>");
    expect(slideXml).not.toContain("不应导出");
    expect(slideXml).toContain('<a:spcPct val="125000"/>');
    expect(slideXml).not.toContain('<a:spcPct val="12500000"/>');
    expect(slideXml).toContain('typeface="Microsoft YaHei"');
    expect(slideXml).toContain('name="页面标题"');
  });

  it("fails early when no visible slide group can be exported", async () => {
    await expect(
      createCanvasDocumentPresentation({
        ...document,
        elements: document.elements.map((element) => ({ ...element, visible: false })),
      }),
    ).rejects.toThrow("does not contain any visible slide groups");
  });

  it("creates filesystem-safe export names", () => {
    expect(getExportFileName(document)).toBe("PPT-导出-测试.pptx");
  });

  it("exports semantic charts and tables as native PPT objects", async () => {
    const presentation = await createCanvasDocumentPresentation(document);
    const output = await presentation.write({ outputType: "uint8array" });
    const archive = await JSZip.loadAsync(output as Uint8Array);
    const slideXml = await archive.file("ppt/slides/slide1.xml")?.async("string");
    const chartFileName = Object.keys(archive.files).find((fileName) =>
      /^ppt\/charts\/chart\d+\.xml$/.test(fileName),
    );
    const embeddingFileName = Object.keys(archive.files).find((fileName) =>
      /^ppt\/embeddings\/Microsoft_Excel_Worksheet\d+\.xlsx$/.test(fileName),
    );

    expect(chartFileName).toBeDefined();
    expect(embeddingFileName).toBeDefined();
    expect(slideXml).toContain("<a:tbl>");
    expect(slideXml).toContain("<a:t>检查技巧</a:t>");
  });
});
