import { Toolbar } from "@/components/ui/toolbar";
import { cn } from "@/lib/utils";
import {
  FloatingPortal,
  flip,
  offset,
  shift,
  useFloatingToolbar,
  useFloatingToolbarState,
  type FloatingToolbarState,
} from "@platejs/floating";
import { useComposedRef } from "@udecode/cn";
import { useEditorId, useEventEditorValue } from "platejs/react";
import * as React from "react";

export function FloatingToolbar({
  children,
  className,
  state,
  ...props
}: React.ComponentProps<typeof Toolbar> & {
  state?: FloatingToolbarState;
}) {
  const editorId = useEditorId();
  const focusedEditorId = useEventEditorValue("focus");
  const floatingToolbarState = useFloatingToolbarState({
    editorId,
    focusedEditorId,
    ...state,
    floatingOptions: {
      middleware: [
        offset(6),
        flip({
          fallbackPlacements: ["top-start", "top-end", "bottom-start", "bottom-end"],
          padding: 8,
        }),
        shift({ padding: 8 }),
      ],
      placement: "top",
      strategy: "fixed",
      ...state?.floatingOptions,
    },
  });
  const {
    clickOutsideRef,
    hidden,
    props: rootProps,
    ref: floatingRef,
  } = useFloatingToolbar(floatingToolbarState);
  const ref = useComposedRef<HTMLDivElement>(props.ref, floatingRef);

  if (hidden) return null;

  return (
    <FloatingPortal>
      <div ref={clickOutsideRef} data-canvas-rich-text-toolbar="true">
        <Toolbar
          {...props}
          {...rootProps}
          ref={ref}
          className={cn(
            "z-50 max-w-[80vw] gap-px overflow-x-auto rounded-md border bg-popover p-1 whitespace-nowrap opacity-100 shadow-md",
            className,
          )}
        >
          {children}
        </Toolbar>
      </div>
    </FloatingPortal>
  );
}
