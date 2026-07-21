export const CANVAS_FONT_FAMILY_IDS = [
  "noto-sans-sc",
  "noto-serif-sc",
  "inter",
  "jetbrains-mono",
] as const;

export type CanvasFontFamily = (typeof CANVAS_FONT_FAMILY_IDS)[number];

export interface CanvasFontDefinition {
  id: CanvasFontFamily;
  label: string;
  primaryFamily: string;
  cssFamily: string;
}

export const DEFAULT_CANVAS_FONT_FAMILY: CanvasFontFamily = "noto-sans-sc";

export const CANVAS_FONT_FAMILIES: readonly CanvasFontDefinition[] = [
  {
    id: "noto-sans-sc",
    label: "Noto 黑体",
    primaryFamily: "Noto Sans SC Variable",
    cssFamily: '"Noto Sans SC Variable", "PingFang SC", sans-serif',
  },
  {
    id: "noto-serif-sc",
    label: "Noto 宋体",
    primaryFamily: "Noto Serif SC Variable",
    cssFamily: '"Noto Serif SC Variable", "Songti SC", serif',
  },
  {
    id: "inter",
    label: "Inter",
    primaryFamily: "Inter Variable",
    cssFamily: '"Inter Variable", "Noto Sans SC Variable", sans-serif',
  },
  {
    id: "jetbrains-mono",
    label: "JetBrains Mono",
    primaryFamily: "JetBrains Mono Variable",
    cssFamily: '"JetBrains Mono Variable", "Noto Sans SC Variable", monospace',
  },
];

const CANVAS_FONT_BY_ID = Object.fromEntries(
  CANVAS_FONT_FAMILIES.map((font) => [font.id, font]),
) as Record<CanvasFontFamily, CanvasFontDefinition>;

export function isCanvasFontFamily(value: string): value is CanvasFontFamily {
  return CANVAS_FONT_FAMILY_IDS.some((fontFamily) => fontFamily === value);
}

export function getCanvasFont(fontFamily: CanvasFontFamily): CanvasFontDefinition {
  return CANVAS_FONT_BY_ID[fontFamily];
}

export async function loadCanvasFont(
  fontFamily: CanvasFontFamily,
  fontWeight: string,
  text: string,
): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return;

  const font = getCanvasFont(fontFamily);
  const sampleText = text.trim() || "字体预览";

  try {
    await document.fonts.load(`${fontWeight} 16px "${font.primaryFamily}"`, sampleText);
  } catch {
    // The configured fallback stack remains usable when a font file fails to load.
  }
}
