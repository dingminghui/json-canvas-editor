import {
  createMaterialEvidenceText,
  normalizeMaterialEvidenceText,
} from "@/features/ai-ppt/material-evidence";

describe("PPT 材料纯文本证据视图", () => {
  it("移除 Markdown 样式但保留文本内容与块边界", () => {
    const markdown = [
      "# 病例信息",
      "",
      "**患者：** 57岁男性",
      "",
      "- **诊断：** 肝硬化",
      "- AFP **3197.5 ng/mL** (↑)",
    ].join("\n");

    expect(createMaterialEvidenceText(markdown)).toBe(
      ["病例信息", "患者： 57岁男性", "", "诊断： 肝硬化", "AFP 3197.5 ng/mL (↑)"].join("\n"),
    );
  });

  it("比较时忽略 Markdown 与空白差异但保留省略号", () => {
    expect(normalizeMaterialEvidenceText("**患者：** 57岁男性")).toBe(
      normalizeMaterialEvidenceText("患者：  57岁男性"),
    );
    expect(normalizeMaterialEvidenceText("患者：...肝硬化")).toContain("...");
  });
});
