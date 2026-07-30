import { describe, expect, it } from "vitest";

import { getMaterialEvidenceIssues, matchMaterialEvidence } from "./evidence";
import { createMaterialPlanFixture } from "./test-fixtures";

describe("material evidence validation", () => {
  const source = [
    "# 内容工作台",
    "",
    "系统将 **JSON** 作为项目中唯一的事实来源，Markdown 仅用于人工确认。",
    "视觉模型只能选择已经注册的 StylePack 和 Recipe，不直接生成坐标。",
  ].join("\n");

  it("accepts a continuous verbatim excerpt", () => {
    expect(matchMaterialEvidence(source, "Markdown 仅用于人工确认")).toEqual({
      kind: "exact",
      score: 1,
    });
  });

  it("accepts Markdown, whitespace, and punctuation differences", () => {
    expect(
      matchMaterialEvidence(
        source,
        "系统将 JSON 作为项目中唯一的事实来源；\nMarkdown 仅用于人工确认",
      ).kind,
    ).toBe("normalized");
  });

  it("accepts a lightly condensed evidence excerpt", () => {
    expect(
      matchMaterialEvidence(
        source,
        "JSON 是项目唯一事实源，Markdown 用于人工确认。",
      ).kind,
    ).toBe("approximate");
  });

  it("rejects an unrelated excerpt and short ambiguous fuzzy matches", () => {
    expect(
      matchMaterialEvidence(source, "Pexels 图片会上传云端并自动公开分享").kind,
    ).toBe("missing");
    expect(matchMaterialEvidence(source, "云端分享").kind).toBe("missing");
  });

  it("reports only facts that cannot be traced back to the material", () => {
    const plan = createMaterialPlanFixture();
    plan.facts = [
      {
        ...plan.facts[0],
        sourceExcerpt: "JSON 是项目唯一事实源，Markdown 用于人工确认。",
      },
      {
        ...plan.facts[1],
        id: "F002",
        sourceExcerpt: "Pexels 图片会上传云端并自动公开分享",
      },
    ];

    expect(getMaterialEvidenceIssues(plan, source)).toEqual([
      "F002.sourceExcerpt 与材料缺少足够文本关联（已允许标点、换行、Markdown 格式和轻微改写差异）。",
    ]);
  });
});
