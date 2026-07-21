import { Editor } from "@/components/ui/editor";
import { FontColorToolbarButton } from "@/components/ui/font-color-toolbar-button";
import { MarkToolbarButton } from "@/components/ui/mark-toolbar-button";
import { Toolbar } from "@/components/ui/toolbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import RichTextEditorOverlay, {
  ConfiguredMarkdownPlugin,
  markdownToSupportedInlineSource,
  normalizeSerializedMarkdown,
} from "@/editor/components/RichTextEditorOverlay";
import type { TextElement } from "@/editor/types";
import { BoldPlugin, ItalicPlugin, StrikethroughPlugin } from "@platejs/basic-nodes/react";
import { FontColorPlugin } from "@platejs/basic-styles/react";
import { MarkdownPlugin } from "@platejs/markdown";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { KEYS, SingleBlockPlugin } from "platejs";
import { createPlateEditor, Plate } from "platejs/react";

const element: TextElement = {
  align: "center",
  fill: "#123456",
  fontSize: 24,
  fontWeight: "600",
  height: 80,
  id: "caption",
  locked: false,
  name: "说明",
  opacity: 0.8,
  rotation: 12,
  text: "**原始**\n~~文本~~",
  type: "text",
  visible: true,
  width: 200,
  x: 10,
  y: 20,
};

const richTextPlugins = [
  SingleBlockPlugin,
  BoldPlugin,
  ItalicPlugin,
  StrikethroughPlugin,
  FontColorPlugin,
  ConfiguredMarkdownPlugin,
];

function createRichTextEditor(markdown: string) {
  return createPlateEditor({
    plugins: richTextPlugins,
    value: (editor) =>
      editor.getApi(MarkdownPlugin).markdown.deserialize(markdownToSupportedInlineSource(markdown)),
  });
}

function renderOverlay({
  initialText = element.text,
  onCancel = vi.fn(),
  onCommit = vi.fn(),
  onReady = vi.fn(),
  targetElement = element,
}: {
  initialText?: string;
  onCancel?: () => void;
  onCommit?: (elementId: string, markdown: string) => void;
  onReady?: (elementId: string) => void;
  targetElement?: TextElement;
} = {}) {
  const view = render(
    <TooltipProvider>
      <RichTextEditorOverlay
        element={targetElement}
        initialText={initialText}
        viewportPosition={{ x: 100, y: 50 }}
        zoom={2}
        onCancel={onCancel}
        onCommit={onCommit}
        onReady={onReady}
      />
    </TooltipProvider>,
  );

  return { ...view, onCancel, onCommit, onReady };
}

describe("RichTextEditorOverlay", () => {
  it("positions the editor over the transformed canvas element", () => {
    const { onReady } = renderOverlay();

    expect(screen.getByLabelText("编辑 说明")).toHaveStyle({
      height: "80px",
      left: "120px",
      opacity: "0.8",
      top: "90px",
      transform: "scale(2) rotate(12deg)",
      width: "200px",
    });
    expect(screen.getByRole("textbox", { name: "富文本内容" })).toHaveStyle({
      color: "#123456",
      fontSize: "24px",
      fontWeight: "600",
      textAlign: "center",
    });
    expect(onReady).toHaveBeenCalledWith("caption");
  });

  it("focuses the editor with a visible caret when editing starts", async () => {
    renderOverlay();
    const textbox = screen.getByRole("textbox", { name: "富文本内容" });

    await waitFor(() => {
      expect(textbox).toHaveFocus();
    });
  });

  it("preserves marks, colors, and soft breaks through Markdown round trips", () => {
    const editor = createRichTextEditor("原始\n文本");
    editor.tf.select({
      anchor: { offset: 0, path: [0, 0] },
      focus: { offset: 2, path: [0, 0] },
    });
    editor.tf.toggleMark(KEYS.bold);
    editor.tf.addMarks({ [KEYS.color]: "#ff0000" });

    const markdown = editor.getApi(MarkdownPlugin).markdown.serialize().replace(/\n$/, "");
    const reopened = createRichTextEditor(markdown);
    const firstText = reopened.children[0]?.children[0];

    expect(markdown).toBe('**<span style="color: #ff0000;">原始</span>**\\\n文本');
    expect(firstText).toMatchObject({ bold: true, color: "#ff0000", text: "原始" });
    expect(reopened.api.string([])).toBe("原始\n文本");
  });

  it("round trips a partially colored strikethrough without exposing Markdown syntax", () => {
    const editor = createRichTextEditor("安静地");
    editor.tf.select({
      anchor: { offset: 0, path: [0, 0] },
      focus: { offset: 3, path: [0, 0] },
    });
    editor.tf.toggleMark(KEYS.strikethrough);
    editor.tf.select({
      anchor: { offset: 2, path: [0, 0] },
      focus: { offset: 3, path: [0, 0] },
    });
    editor.tf.addMarks({ [KEYS.color]: "#4f46e5" });

    const markdown = editor.getApi(MarkdownPlugin).markdown.serialize().replace(/\n$/, "");
    const reopened = createRichTextEditor(markdown);

    const reopenedMarkdown = reopened
      .getApi(MarkdownPlugin)
      .markdown.serialize()
      .replace(/\n$/, "");

    expect(reopened.children[0]?.children).toEqual([
      { strikethrough: true, text: "安静" },
      { color: "#4f46e5", strikethrough: true, text: "地" },
    ]);
    expect(reopenedMarkdown).toBe(markdown);
    expect(reopened.api.string([])).toBe("安静地");
  });

  it("does not expose strike markers when only the colored text is struck", () => {
    const editor = createRichTextEditor("安静地");
    editor.tf.select({
      anchor: { offset: 2, path: [0, 0] },
      focus: { offset: 3, path: [0, 0] },
    });
    editor.tf.toggleMark(KEYS.strikethrough);
    editor.tf.addMarks({ [KEYS.color]: "#4f46e5" });

    const rawMarkdown = editor.getApi(MarkdownPlugin).markdown.serialize().replace(/\n$/, "");
    const markdown = normalizeSerializedMarkdown(rawMarkdown);
    const reopened = createRichTextEditor(markdown);
    const reopenedFromLegacySource = createRichTextEditor(rawMarkdown);

    expect(rawMarkdown).toBe('安静~~<span style="color: #4f46e5;">地</span>~~');
    expect(markdown).toBe(
      '安静<span style="color: #4f46e5; text-decoration: line-through;">地</span>',
    );
    expect(reopenedFromLegacySource.api.string([])).toBe("安静地");
    expect(reopenedFromLegacySource.children).toEqual(reopened.children);
    expect(reopened.api.string([])).toBe("安静地");
    expect(reopened.children[0]?.children).toEqual([
      { text: "安静" },
      { color: "#4f46e5", strikethrough: true, text: "地" },
    ]);
  });

  it("applies toolbar marks to the active selection immediately", async () => {
    const editor = createRichTextEditor("原始文本");
    editor.tf.select({
      anchor: { offset: 0, path: [0, 0] },
      focus: { offset: 2, path: [0, 0] },
    });
    render(
      <TooltipProvider>
        <Plate editor={editor}>
          <Editor aria-label="测试编辑器" />
          <Toolbar>
            <MarkToolbarButton aria-label="测试加粗" nodeType={KEYS.bold}>
              B
            </MarkToolbarButton>
          </Toolbar>
        </Plate>
      </TooltipProvider>,
    );

    const button = screen.getByRole("radio", { name: "测试加粗" });
    fireEvent.mouseDown(button);
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText("原始").closest("strong")).not.toBeNull());
  });

  it("renders italic text immediately with font synthesis enabled", async () => {
    const editor = createRichTextEditor("原始文本");
    editor.tf.select({
      anchor: { offset: 0, path: [0, 0] },
      focus: { offset: 2, path: [0, 0] },
    });
    render(
      <TooltipProvider>
        <Plate editor={editor}>
          <Editor aria-label="斜体测试编辑器" style={{ fontSynthesis: "weight style" }} />
          <Toolbar>
            <MarkToolbarButton aria-label="测试斜体" nodeType={KEYS.italic}>
              I
            </MarkToolbarButton>
          </Toolbar>
        </Plate>
      </TooltipProvider>,
    );

    const button = screen.getByRole("radio", { name: "测试斜体" });
    fireEvent.mouseDown(button);
    fireEvent.click(button);

    await waitFor(() => {
      const italic = screen.getByText("原始").closest("em");
      expect(italic).not.toBeNull();
    });
  });

  it("applies a custom color synchronously to the saved selection", async () => {
    const editor = createRichTextEditor("原始文本");
    editor.tf.select({
      anchor: { offset: 0, path: [0, 0] },
      focus: { offset: 2, path: [0, 0] },
    });
    render(
      <TooltipProvider>
        <Plate editor={editor}>
          <Toolbar>
            <FontColorToolbarButton nodeType={KEYS.color}>
              <span>测试颜色</span>
            </FontColorToolbarButton>
          </Toolbar>
        </Plate>
      </TooltipProvider>,
    );

    const colorButton = screen.getByRole("radio", { name: "测试颜色" });
    fireEvent.pointerDown(colorButton, { button: 0, ctrlKey: false });
    fireEvent.click(colorButton);
    fireEvent.mouseDown(colorButton);
    const colorInput = await screen.findByRole("textbox", { name: "Hex 颜色" });
    fireEvent.change(colorInput, { target: { value: "#ff0000" } });

    await waitFor(() =>
      expect(editor.children[0]?.children[0]).toMatchObject({
        color: "#ff0000",
        text: "原始",
      }),
    );
  });

  it("repairs duplicate legacy soft-break escapes without adding new ones", () => {
    expect(markdownToSupportedInlineSource("原始\\\\\n文本")).toBe("原始\\\n文本");
  });

  it("commits the exact original Markdown when the user made no edit", () => {
    const { onCommit } = renderOverlay();
    const toolbar = document.createElement("div");
    toolbar.dataset.canvasRichTextToolbar = "true";
    document.body.append(toolbar);

    fireEvent.pointerDown(toolbar);
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.pointerDown(document.body);

    expect(onCommit).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledWith("caption", element.text);
    toolbar.remove();
  });

  it("keeps the editor open while interacting with a portaled color menu", () => {
    const { onCommit } = renderOverlay();
    const popup = document.createElement("div");
    popup.dataset.canvasRichTextPopup = "true";
    document.body.append(popup);

    fireEvent.pointerDown(popup);

    expect(onCommit).not.toHaveBeenCalled();
    popup.remove();
  });

  it("cancels with Escape and commits with Cmd/Ctrl + Enter", () => {
    const cancel = renderOverlay();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "富文本内容" }), {
      key: "Escape",
    });

    expect(cancel.onCancel).toHaveBeenCalledOnce();
    expect(cancel.onCommit).not.toHaveBeenCalled();

    const commit = renderOverlay();
    fireEvent.keyDown(screen.getAllByRole("textbox", { name: "富文本内容" }).at(-1)!, {
      ctrlKey: true,
      key: "Enter",
    });

    expect(commit.onCommit).toHaveBeenCalledWith("caption", element.text);
    expect(commit.onCancel).not.toHaveBeenCalled();
  });
});
