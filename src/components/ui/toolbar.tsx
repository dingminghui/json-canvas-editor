import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Toolbar as ToolbarPrimitive } from "radix-ui";
import * as React from "react";

const toolbarButtonVariants = cva(
  "inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-checked:bg-accent aria-checked:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-background",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Toolbar({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.Root>) {
  return (
    <ToolbarPrimitive.Root
      className={cn("relative flex select-none items-center", className)}
      {...props}
    />
  );
}

type ToolbarButtonProps = Omit<
  React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.ToggleItem>,
  "value"
> &
  VariantProps<typeof toolbarButtonVariants> & {
    pressed?: boolean;
    tooltip?: React.ReactNode;
  };

export function ToolbarButton({
  children,
  className,
  pressed,
  tooltip,
  variant,
  ...props
}: ToolbarButtonProps) {
  const button =
    typeof pressed === "boolean" ? (
      <ToolbarPrimitive.ToggleGroup type="single" value={pressed ? "active" : ""}>
        <ToolbarPrimitive.ToggleItem
          className={cn(toolbarButtonVariants({ variant }), className)}
          value="active"
          {...props}
        >
          {children}
        </ToolbarPrimitive.ToggleItem>
      </ToolbarPrimitive.ToggleGroup>
    ) : (
      <ToolbarPrimitive.Button
        className={cn(toolbarButtonVariants({ variant }), className)}
        {...props}
      >
        {children}
      </ToolbarPrimitive.Button>
    );

  if (!tooltip) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent sideOffset={4}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
