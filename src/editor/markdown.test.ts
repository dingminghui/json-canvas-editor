import {
  markdownToDisplayText,
  markdownToInlineHtml,
  markdownToPlainText,
  renderMarkdownToCanvas,
} from "@/editor/markdown";
import type { TextElement } from "@/editor/types";

const renderMock = vi.hoisted(() => vi.fn());

vi.mock("render-tag", () => ({ render: renderMock }));

describe("Markdown text helpers", () => {
  it("renders the supported inline GFM marks", () => {
    expect(markdownToInlineHtml("普通 **加粗** *斜体* ~~删除~~")).toBe(
      "普通 <strong>加粗</strong> <em>斜体</em> <del>删除</del>",
    );
  });

  it("keeps line breaks for canvas display and collapses them in the property summary", () => {
    const markdown = "第一行\n**第二行**";

    expect(markdownToInlineHtml(markdown)).toBe("第一行<br><strong>第二行</strong>");
    expect(markdownToDisplayText(markdown)).toBe("第一行\n第二行");
    expect(markdownToPlainText(markdown)).toBe("第一行 第二行");
  });

  it("flattens unsupported links, images, inline code, and raw HTML to safe text", () => {
    const html = markdownToInlineHtml(
      "[链接](https://example.com) ![替代文字](photo.jpg) `代码` <b>原始标签</b>",
    );

    expect(html).toBe("链接 替代文字 代码 &lt;b&gt;原始标签&lt;/b&gt;");
    expect(html).not.toContain("href");
    expect(html).not.toContain("<img");
  });

  it("supports nested combinations without exposing Markdown punctuation in summaries", () => {
    const markdown = "***粗斜体*** 和 **~~粗删除~~**";

    expect(markdownToInlineHtml(markdown)).toContain("<em><strong>粗斜体</strong></em>");
    expect(markdownToInlineHtml(markdown)).toContain("<strong><del>粗删除</del></strong>");
    expect(markdownToPlainText(markdown)).toBe("粗斜体 和 粗删除");
  });

  it("renders Plate font colors while keeping unrelated raw HTML escaped", () => {
    const markdown = '<span style="color: #ff0000;">红色</span> <b>原始标签</b>';

    expect(markdownToInlineHtml(markdown)).toBe(
      '<span class="canvas-text-color" style="color: #ff0000;">红色</span> &lt;b&gt;原始标签&lt;/b&gt;',
    );
    expect(markdownToPlainText(markdown)).toBe("红色 <b>原始标签</b>");
  });

  it("keeps colored strike-through segments identifiable for canvas rendering", () => {
    expect(
      markdownToInlineHtml('~~默认颜色 <span style="color: #ff0000;">局部颜色</span> 默认颜色~~'),
    ).toBe(
      '<del>默认颜色 </del><span class="canvas-text-color" style="color: #ff0000;"><del>局部颜色</del></span><del> 默认颜色</del>',
    );
  });

  it("renders a normalized colored strike-through with the decoration inside its color", () => {
    const markdown = '安静<span style="color: #4f46e5; text-decoration: line-through;">地</span>';

    expect(markdownToInlineHtml(markdown)).toBe(
      '安静<span class="canvas-text-color" style="color: #4f46e5;"><del>地</del></span>',
    );
    expect(markdownToPlainText(markdown)).toBe("安静地");
  });

  it("lets canvas strike-through decorations inherit each text leaf's color", () => {
    const element = {
      align: "left",
      fill: "#1f3f36",
      fontSize: 48,
      fontWeight: "600",
      height: 100,
      id: "colored-strike",
      locked: false,
      name: "局部彩色删除线",
      opacity: 1,
      rotation: 0,
      text: '安静<span style="color: #ec4899; text-decoration: line-through;">地</span>',
      type: "text",
      visible: true,
      width: 240,
      x: 0,
      y: 0,
    } satisfies TextElement;

    renderMock.mockReturnValue({
      canvas: document.createElement("canvas"),
      height: element.height,
    });

    renderMarkdownToCanvas(element);

    expect(renderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining(
          ".canvas-text del {\n        text-decoration: line-through;\n      }",
        ),
      }),
    );
    expect(renderMock.mock.lastCall?.[0].html).not.toContain("text-decoration-color: currentcolor");
  });
});
