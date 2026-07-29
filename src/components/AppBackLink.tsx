import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface AppBackLinkProps {
  children: ReactNode;
  className?: string;
  iconOnly?: boolean;
  to: string;
  variant?: "ghost" | "outline";
}

export function AppBackLink({
  children,
  className,
  iconOnly = false,
  to,
  variant = "ghost",
}: AppBackLinkProps) {
  return (
    <Button
      asChild
      className={cn("self-center", className)}
      size={iconOnly ? "icon-sm" : "sm"}
      variant={variant}
    >
      <Link to={to}>
        <ArrowLeft data-icon={iconOnly ? undefined : "inline-start"} />
        <span className={cn(iconOnly ? "sr-only" : "leading-none")}>{children}</span>
      </Link>
    </Button>
  );
}
