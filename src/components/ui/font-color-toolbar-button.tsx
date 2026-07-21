import { ColorPicker } from "@/components/ui/color-picker";
import { ToolbarButton } from "@/components/ui/toolbar";
import { useEditorRef, useEditorSelector } from "platejs/react";
import * as React from "react";

export function FontColorToolbarButton({
  children,
  defaultColor = "#000000",
  nodeType,
  tooltip,
}: {
  children: React.ReactNode;
  defaultColor?: string;
  nodeType: string;
  tooltip?: string;
}) {
  const editor = useEditorRef();
  const activeColor = useEditorSelector(
    (currentEditor) => currentEditor.api.mark(nodeType) as string | undefined,
    [nodeType],
  );
  const [open, setOpen] = React.useState(false);
  const selectionRef = React.useRef(editor.selection);

  const preserveSelection = React.useCallback(() => {
    if (!editor.selection) return;

    selectionRef.current = {
      anchor: {
        offset: editor.selection.anchor.offset,
        path: [...editor.selection.anchor.path],
      },
      focus: {
        offset: editor.selection.focus.offset,
        path: [...editor.selection.focus.path],
      },
    };
  }, [editor]);

  const applyColor = React.useCallback(
    (color: string) => {
      const selection = selectionRef.current ?? editor.selection;
      if (!selection) return;

      editor.tf.select(selection);
      editor.tf.addMarks({ [nodeType]: color });
    },
    [editor, nodeType],
  );

  const clearColor = React.useCallback(() => {
    const selection = selectionRef.current ?? editor.selection;
    if (!selection) return;

    editor.tf.select(selection);
    editor.tf.removeMarks(nodeType);
  }, [editor, nodeType]);

  return (
    <ColorPicker
      open={open}
      value={activeColor ?? defaultColor}
      onChange={applyColor}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen && selectionRef.current) {
          editor.tf.select(selectionRef.current);
          editor.tf.focus();
        }
      }}
      onReset={clearColor}
    >
      <ToolbarButton
        aria-label={tooltip}
        pressed={open}
        tooltip={tooltip}
        onMouseDown={(event) => {
          event.preventDefault();
          preserveSelection();
        }}
        onPointerDown={preserveSelection}
      >
        {children}
      </ToolbarButton>
    </ColorPicker>
  );
}
