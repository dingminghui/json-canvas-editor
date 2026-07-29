import type { CanvasFontFamily } from "@/editor/fonts";
import type { PptVisualPlanV2 } from "@/features/ai-ppt/schema";

export interface ResolvedCanvasTheme {
  colors: {
    accent: string;
    accentForeground: string;
    background: string;
    border: string;
    foreground: string;
    muted: string;
    primary: string;
    primaryForeground: string;
    surface: string;
    surfaceForeground: string;
  };
  cornerRadius: number;
  fonts: {
    body: CanvasFontFamily;
    heading: CanvasFontFamily;
  };
  designSystem: PptVisualPlanV2["designSystem"];
  style: PptVisualPlanV2["theme"]["style"];
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function relativeLuminance(hex: string): number {
  const channels = hexToRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(left: string, right: string): number {
  const leftLuminance = relativeLuminance(left);
  const rightLuminance = relativeLuminance(right);
  return (
    (Math.max(leftLuminance, rightLuminance) + 0.05) /
    (Math.min(leftLuminance, rightLuminance) + 0.05)
  );
}

function ensureReadableForeground(candidate: string, background: string): string {
  if (contrastRatio(candidate, background) >= 4.5) return candidate;
  return contrastRatio("#111827", background) >= contrastRatio("#FFFFFF", background)
    ? "#111827"
    : "#FFFFFF";
}

export function resolveCanvasTheme(
  theme: PptVisualPlanV2["theme"],
  designSystem: PptVisualPlanV2["designSystem"],
): ResolvedCanvasTheme {
  const foreground = ensureReadableForeground(theme.foregroundColor, theme.backgroundColor);
  return {
    colors: {
      accent: theme.accentColor,
      accentForeground: ensureReadableForeground(foreground, theme.accentColor),
      background: theme.backgroundColor,
      border: theme.borderColor,
      foreground,
      muted: ensureReadableForeground(theme.mutedColor, theme.backgroundColor),
      primary: theme.primaryColor,
      primaryForeground: ensureReadableForeground(foreground, theme.primaryColor),
      surface: theme.surfaceColor,
      surfaceForeground: ensureReadableForeground(foreground, theme.surfaceColor),
    },
    cornerRadius: {
      rounded: 28,
      soft: 14,
      square: 0,
    }[theme.cornerStyle],
    fonts: {
      body: theme.bodyFont,
      heading: theme.headingFont,
    },
    designSystem,
    style: theme.style,
  };
}
