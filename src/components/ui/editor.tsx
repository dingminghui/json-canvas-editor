import { cn } from "@/lib/utils";
import { PlateContainer, PlateContent, type PlateContentProps } from "platejs/react";
import * as React from "react";

export function EditorContainer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <PlateContainer
      className={cn(
        "relative size-full cursor-text select-text overflow-y-auto caret-primary selection:bg-primary/20 focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

type EditorProps = PlateContentProps;

export const Editor = ({
  className,
  ref,
  ...props
}: EditorProps & { ref?: React.RefObject<HTMLDivElement | null> }) => (
  <PlateContent
    ref={ref}
    className={cn(
      "relative min-h-full w-full cursor-text select-text overflow-x-hidden whitespace-break-spaces break-words focus-visible:outline-none",
      className,
    )}
    disableDefaultStyles
    {...props}
  />
);

Editor.displayName = "Editor";
