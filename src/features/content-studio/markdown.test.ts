import { describe, expect, it } from "vitest";

import { parseContentMarkdown, serializeContentDocument } from "./markdown";
import { createContentDocumentFixture, createMaterialPlanFixture } from "./test-fixtures";

describe("ContentDocument Markdown", () => {
  it("round-trips natural and structured blocks through canonical Markdown", () => {
    const document = createContentDocumentFixture();
    document.sections[1].blocks.push(
      {
        id: "B005",
        type: "bullet-list",
        items: ["内容先行", "样式后置"],
        evidenceRefs: ["F001"],
      },
      {
        id: "B006",
        type: "numbered-list",
        items: ["确认内容", "选择载体"],
        evidenceRefs: ["F001"],
      },
      {
        id: "B007",
        type: "comparison",
        left: { heading: "PPT", items: ["逐页推进"] },
        right: { heading: "长图", items: ["连续阅读"] },
        evidenceRefs: ["F003"],
      },
      {
        id: "B008",
        type: "process",
        steps: [
          { title: "内容确认", description: "应用 Markdown" },
          { title: "视觉规划", description: "选择注册 ID" },
        ],
        evidenceRefs: ["F004"],
      },
      {
        id: "B009",
        type: "table",
        columns: ["层", "职责"],
        rows: [["内容", "事实"], ["视觉", "表达"]],
        evidenceRefs: ["F001"],
      },
      {
        id: "B010",
        type: "diagram",
        relationship: "process",
        nodes: [{ id: "content", label: "内容" }, { id: "canvas", label: "Canvas" }],
        edges: [{ from: "content", to: "canvas", label: "渲染" }],
        evidenceRefs: ["F004"],
      },
    );
    const source = serializeContentDocument(document);
    const result = parseContentMarkdown(source, createMaterialPlanFixture());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document).toEqual(document);
    expect(result.markdown).toBe(source);
  });

  it("rejects duplicate block IDs", () => {
    const source = serializeContentDocument(createContentDocumentFixture()).replace(
      "block:B004",
      "block:B003",
    );
    const result = parseContentMarkdown(source, createMaterialPlanFixture());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.some((issue) => issue.message.includes("唯一"))).toBe(true);
  });

  it("rejects an evidence reference missing from the material plan", () => {
    const source = serializeContentDocument(createContentDocumentFixture()).replace(
      "evidence:F001",
      "evidence:F999",
    );
    const result = parseContentMarkdown(source, createMaterialPlanFixture());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.some((issue) => issue.message.includes("F999"))).toBe(true);
  });

  it("rejects damaged structured fences and invalid frontmatter", () => {
    const source = serializeContentDocument(createContentDocumentFixture());
    const brokenFence = parseContentMarkdown(
      source.replace("```content-block", "```json"),
      createMaterialPlanFixture(),
    );
    expect(brokenFence.success).toBe(false);
    const brokenYaml = parseContentMarkdown(
      source.replace("title: 从材料到视觉产物", "title: ["),
      createMaterialPlanFixture(),
    );
    expect(brokenYaml.success).toBe(false);
  });

  it("rejects unsupported block-level Markdown inside a paragraph block", () => {
    const source = serializeContentDocument(createContentDocumentFixture()).replace(
      "ContentDocument 保存稳定语义，Markdown 只承担人工确认和交换格式。",
      "### 未声明的子标题",
    );
    const result = parseContentMarkdown(source, createMaterialPlanFixture());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.some((issue) => issue.message.includes("不支持"))).toBe(true);
  });
});
