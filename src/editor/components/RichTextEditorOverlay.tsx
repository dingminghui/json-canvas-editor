import { Editor, EditorContainer } from "@/components/ui/editor";
import { FloatingToolbar } from "@/components/ui/floating-toolbar";
import { FontColorToolbarButton } from "@/components/ui/font-color-toolbar-button";
import { MarkToolbarButton } from "@/components/ui/mark-toolbar-button";
import { getCanvasFont } from "@/editor/fonts";
import type { CanvasPoint, TextElement } from "@/editor/types";
import { BoldPlugin, ItalicPlugin, StrikethroughPlugin } from "@platejs/basic-nodes/react";
import { FontColorPlugin } from "@platejs/basic-styles/react";
import {
  convertChildrenDeserialize,
  getStyleValue,
  MarkdownPlugin,
  remarkMdx,
  stripMarkdownBlocks,
} from "@platejs/markdown";
import { Baseline, Bold, Italic, Strikethrough } from "lucide-react";
import { KEYS, SingleBlockPlugin } from "platejs";
import { Plate, usePlateEditor } from "platejs/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import remarkGfm from "remark-gfm";

interface RichTextEditorOverlayProps {
  element: TextElement;
  initialText: string;
  viewportPosition: CanvasPoint;
  zoom: number;
  onCancel: () => void;
  onCommit: (elementId: string, markdown: string) => void;
  onReady: (elementId: string) => void;
}

export const ConfiguredMarkdownPlugin = MarkdownPlugin.configure({
  options: {
    plainMarks: [KEYS.code],
    remarkPlugins: [remarkGfm, remarkMdx],
    rules: {
      a: {
        deserialize: (node, decoration, options) =>
          convertChildrenDeserialize(node.children, decoration, options) as never,
      },
      img: {
        deserialize: (node) => ({ text: node.alt ?? "" }) as never,
      },
      span: {
        mark: true,
        deserialize: (node, decoration, options) => {
          const color = getStyleValue(node, "color");
          const textDecoration = getStyleValue(node, "text-decoration");

          return convertChildrenDeserialize(
            node.children,
            {
              ...decoration,
              color,
              strikethrough:
                decoration.strikethrough || textDecoration?.includes("line-through") || undefined,
            },
            options,
          ) as never;
        },
      },
    },
  },
});

const COLORED_STRIKETHROUGH_RE = /~~<span style="color: (#[\da-f]{6});">([^<]*)<\/span>~~/gi;

function normalizeColoredStrikethroughs(markdown: string): string {
  return markdown.replace(
    COLORED_STRIKETHROUGH_RE,
    '<span style="color: $1; text-decoration: line-through;">$2</span>',
  );
}

export function normalizeSerializedMarkdown(markdown: string): string {
  return normalizeColoredStrikethroughs(markdown.replaceAll("\u200B", "").replace(/\n$/, ""));
}

export function markdownToSupportedInlineSource(markdown: string): string {
  return normalizeColoredStrikethroughs(stripMarkdownBlocks(markdown))
    .replace(/(?:\\){2,}\n/g, "\\\n")
    .replace(/\n{2,}/g, "\n");
}

export default function RichTextEditorOverlay({
  element,
  initialText,
  viewportPosition,
  zoom,
  onCancel,
  onCommit,
  onReady,
}: RichTextEditorOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(false);
  const isReadyRef = useRef(false);
  const hasUserEditedRef = useRef(false);
  const editor = usePlateEditor({
    plugins: [
      SingleBlockPlugin,
      BoldPlugin,
      ItalicPlugin,
      StrikethroughPlugin,
      FontColorPlugin,
      ConfiguredMarkdownPlugin,
    ],
    value: (currentEditor) =>
      currentEditor
        .getApi(MarkdownPlugin)
        .markdown.deserialize(markdownToSupportedInlineSource(initialText)),
  });

  useLayoutEffect(() => {
    isReadyRef.current = true;
    editor.tf.focus({ edge: "endEditor", retries: 5 });
    onReady(element.id);
  }, [editor, element.id, onReady]);

  const finishEditing = useCallback(
    (mode: "cancel" | "commit") => {
      if (finishedRef.current) return;
      finishedRef.current = true;

      if (mode === "cancel") {
        onCancel();
        return;
      }

      const markdown = hasUserEditedRef.current
        ? normalizeSerializedMarkdown(editor.getApi(MarkdownPlugin).markdown.serialize())
        : initialText;
      onCommit(element.id, markdown);
    },
    [editor, element.id, initialText, onCancel, onCommit],
  );

  useEffect(() => {
    function handleOutsidePointerDown(event: globalThis.PointerEvent) {
      if (!(event.target instanceof Element)) return;
      const target = event.target;
      if (
        rootRef.current?.contains(target) ||
        target.closest?.('[data-canvas-rich-text-toolbar="true"]') ||
        target.closest?.('[data-canvas-rich-text-popup="true"]')
      ) {
        return;
      }
      finishEditing("commit");
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
  }, [finishEditing]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      finishEditing("cancel");
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      finishEditing("commit");
    }
  }

  function stopPointerPropagation(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  const boldWeight = Math.max(700, Number(element.fontWeight));

  return (
    <div
      aria-label={`编辑 ${element.name}`}
      className="absolute z-[4] origin-top-left"
      ref={rootRef}
      style={{
        height: element.height,
        left: viewportPosition.x + element.x * zoom,
        opacity: element.opacity,
        top: viewportPosition.y + element.y * zoom,
        transform: `scale(${zoom}) rotate(${element.rotation}deg)`,
        width: element.width,
      }}
      onPointerDown={stopPointerPropagation}
    >
      <Plate
        editor={editor}
        onValueChange={() => {
          if (isReadyRef.current) hasUserEditedRef.current = true;
        }}
      >
        <EditorContainer className="rounded-[3px] bg-transparent ring-2 ring-primary ring-offset-1 ring-offset-transparent">
          <Editor
            aria-label="富文本内容"
            className="flex min-h-full flex-col justify-center overflow-y-auto rounded-[3px] [&_em]:italic [&_p]:m-0 [&_s]:line-through [&_s]:decoration-current [&_strong]:[font-weight:var(--canvas-rich-bold-weight,700)]"
            style={
              {
                "--canvas-rich-bold-weight": boldWeight,
                color: element.fill,
                fontFamily: getCanvasFont(element.fontFamily).cssFamily,
                fontSize: element.fontSize,
                fontSynthesis: "weight style",
                fontWeight: element.fontWeight,
                lineHeight: element.lineHeight,
                textAlign: element.align,
              } as CSSProperties
            }
            onKeyDown={handleKeyDown}
          />
        </EditorContainer>

        <FloatingToolbar aria-label="文字格式">
          <MarkToolbarButton aria-label="加粗" nodeType={KEYS.bold} tooltip="加粗">
            <Bold aria-hidden="true" />
          </MarkToolbarButton>
          <MarkToolbarButton aria-label="斜体" nodeType={KEYS.italic} tooltip="斜体">
            <Italic aria-hidden="true" />
          </MarkToolbarButton>
          <MarkToolbarButton aria-label="删除线" nodeType={KEYS.strikethrough} tooltip="删除线">
            <Strikethrough aria-hidden="true" />
          </MarkToolbarButton>
          <FontColorToolbarButton
            defaultColor={element.fill}
            nodeType={KEYS.color}
            tooltip="文字颜色"
          >
            <Baseline aria-hidden="true" />
            <span className="sr-only">文字颜色</span>
          </FontColorToolbarButton>
        </FloatingToolbar>
      </Plate>
    </div>
  );
}
