import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface EditorIconButtonProps {
  label: string;
  tooltip?: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  pressed?: boolean;
  onPress: () => void;
}

export function EditorIconButton({
  label,
  tooltip,
  children,
  className,
  disabled = false,
  pressed,
  onPress,
}: EditorIconButtonProps) {
  return (
    <Tooltip delayDuration={450}>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          aria-pressed={pressed}
          className={cn(pressed && "bg-accent text-primary", className)}
          disabled={disabled}
          size="icon-sm"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation();
            onPress();
          }}
        >
          <span className="grid place-items-center [&_svg]:size-[15px]" data-icon="inline-start">
            {children}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent className="text-xs" side="top" sideOffset={6}>
        {tooltip ?? label}
      </TooltipContent>
    </Tooltip>
  );
}
