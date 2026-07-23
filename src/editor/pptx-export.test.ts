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
});
