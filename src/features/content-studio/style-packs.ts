import type { StylePackId } from "./schema";

export interface StylePack {
  id: StylePackId;
  name: string;
  description: string;
  fonts: {
    display: string;
    body: string;
    mono: string;
  };
  colors: {
    canvas: string;
    surface: string;
    surfaceMuted: string;
    text: string;
    textMuted: string;
    primary: string;
    secondary: string;
    accent: string;
    positive: string;
    warning: string;
    negative: string;
    line: string;
  };
  typeScale: {
    hero: number;
    title: number;
    heading: number;
    body: number;
    label: number;
    caption: number;
  };
  spacing: {
    page: number;
    section: number;
    block: number;
    inline: number;
  };
  shape: {
    radius: number;
    borderWidth: number;
    shadow: {
      color: string;
      opacity: number;
      blur: number;
      offsetX: number;
      offsetY: number;
    };
  };
  backgroundMotif: "grid" | "rules" | "halo" | "paper" | "bands" | "registration";
  chart: {
    palette: string[];
    axisColor: string;
    gridColor: string;
    labelColor: string;
  };
  diagram: {
    nodeFill: string;
    nodeStroke: string;
    edgeColor: string;
    emphasisFill: string;
  };
  image: {
    treatment: "full-bleed" | "framed" | "duotone-overlay" | "editorial-crop" | "hard-crop";
    overlayColor: string;
    overlayOpacity: number;
    radius: number;
  };
}

const baseTypeScale = {
  hero: 72,
  title: 48,
  heading: 30,
  body: 20,
  label: 15,
  caption: 12,
};

const baseSpacing = {
  page: 72,
  section: 48,
  block: 28,
  inline: 14,
};

export const STYLE_PACKS = {
  "editorial-swiss": {
    id: "editorial-swiss",
    name: "Editorial Swiss",
    description: "强网格、极简色彩与杂志式留白，适合观点与叙事。",
    fonts: { display: "Arial", body: "Arial", mono: "Menlo" },
    colors: {
      canvas: "#F5F4EF",
      surface: "#FFFFFF",
      surfaceMuted: "#E9E8E2",
      text: "#111111",
      textMuted: "#686762",
      primary: "#111111",
      secondary: "#ECEAE3",
      accent: "#FF4D2E",
      positive: "#16835D",
      warning: "#C87900",
      negative: "#CB3434",
      line: "#C7C4BA",
    },
    typeScale: { ...baseTypeScale, hero: 80, title: 52 },
    spacing: { ...baseSpacing, page: 80 },
    shape: {
      radius: 0,
      borderWidth: 1,
      shadow: { color: "#000000", opacity: 0, blur: 0, offsetX: 0, offsetY: 0 },
    },
    backgroundMotif: "rules",
    chart: {
      palette: ["#FF4D2E", "#111111", "#AAA79E", "#2A7187", "#E1A12A"],
      axisColor: "#111111",
      gridColor: "#D8D5CD",
      labelColor: "#43423F",
    },
    diagram: {
      nodeFill: "#FFFFFF",
      nodeStroke: "#111111",
      edgeColor: "#686762",
      emphasisFill: "#FF4D2E",
    },
    image: {
      treatment: "editorial-crop",
      overlayColor: "#111111",
      overlayOpacity: 0,
      radius: 0,
    },
  },
  "modern-corporate": {
    id: "modern-corporate",
    name: "Modern Corporate",
    description: "克制的蓝色体系、清晰层级和柔和卡片，适合商业汇报。",
    fonts: { display: "Aptos Display", body: "Aptos", mono: "Menlo" },
    colors: {
      canvas: "#F3F7FB",
      surface: "#FFFFFF",
      surfaceMuted: "#E7EEF7",
      text: "#122033",
      textMuted: "#5B6A7E",
      primary: "#175CD3",
      secondary: "#DCE8FB",
      accent: "#12A0A6",
      positive: "#16875F",
      warning: "#D08100",
      negative: "#D43B45",
      line: "#C9D5E5",
    },
    typeScale: { ...baseTypeScale, hero: 68, title: 44 },
    spacing: baseSpacing,
    shape: {
      radius: 16,
      borderWidth: 1,
      shadow: { color: "#16355C", opacity: 0.14, blur: 18, offsetX: 0, offsetY: 8 },
    },
    backgroundMotif: "bands",
    chart: {
      palette: ["#175CD3", "#12A0A6", "#7A5AF8", "#F79009", "#4E5BA6"],
      axisColor: "#5B6A7E",
      gridColor: "#DCE5F0",
      labelColor: "#344054",
    },
    diagram: {
      nodeFill: "#FFFFFF",
      nodeStroke: "#9CB6D9",
      edgeColor: "#6683A8",
      emphasisFill: "#DCE8FB",
    },
    image: {
      treatment: "framed",
      overlayColor: "#175CD3",
      overlayOpacity: 0,
      radius: 16,
    },
  },
  "dark-tech": {
    id: "dark-tech",
    name: "Dark Tech",
    description: "深色界面、荧光强调与精密网格，适合技术与未来主题。",
    fonts: { display: "Arial", body: "Arial", mono: "Menlo" },
    colors: {
      canvas: "#071018",
      surface: "#0D1A25",
      surfaceMuted: "#132636",
      text: "#EDF8FF",
      textMuted: "#91AABD",
      primary: "#38E8C6",
      secondary: "#163F49",
      accent: "#65A7FF",
      positive: "#38E8C6",
      warning: "#FFD166",
      negative: "#FF6577",
      line: "#244658",
    },
    typeScale: { ...baseTypeScale, hero: 76, title: 48 },
    spacing: baseSpacing,
    shape: {
      radius: 10,
      borderWidth: 1,
      shadow: { color: "#38E8C6", opacity: 0.16, blur: 20, offsetX: 0, offsetY: 5 },
    },
    backgroundMotif: "grid",
    chart: {
      palette: ["#38E8C6", "#65A7FF", "#B482FF", "#FFD166", "#FF6577"],
      axisColor: "#91AABD",
      gridColor: "#1D3A4A",
      labelColor: "#C8DFEC",
    },
    diagram: {
      nodeFill: "#0D1A25",
      nodeStroke: "#38E8C6",
      edgeColor: "#65A7FF",
      emphasisFill: "#163F49",
    },
    image: {
      treatment: "duotone-overlay",
      overlayColor: "#071018",
      overlayOpacity: 0.28,
      radius: 10,
    },
  },
  "data-journalism": {
    id: "data-journalism",
    name: "Data Journalism",
    description: "新闻图表感、高信息密度与注释优先，适合数据故事。",
    fonts: { display: "Georgia", body: "Arial", mono: "Menlo" },
    colors: {
      canvas: "#FBFAF6",
      surface: "#FFFFFF",
      surfaceMuted: "#F0EFE9",
      text: "#202020",
      textMuted: "#696964",
      primary: "#1C5D99",
      secondary: "#DCE8F0",
      accent: "#E85D3F",
      positive: "#2D8260",
      warning: "#C48220",
      negative: "#C43D3D",
      line: "#CDCCC6",
    },
    typeScale: { ...baseTypeScale, hero: 64, title: 42, body: 18, caption: 13 },
    spacing: { ...baseSpacing, block: 22 },
    shape: {
      radius: 3,
      borderWidth: 1,
      shadow: { color: "#000000", opacity: 0.06, blur: 8, offsetX: 0, offsetY: 3 },
    },
    backgroundMotif: "paper",
    chart: {
      palette: ["#1C5D99", "#E85D3F", "#6A9C78", "#E5B94A", "#7B6DAB"],
      axisColor: "#51514E",
      gridColor: "#D9D8D1",
      labelColor: "#383835",
    },
    diagram: {
      nodeFill: "#FFFFFF",
      nodeStroke: "#777770",
      edgeColor: "#777770",
      emphasisFill: "#DCE8F0",
    },
    image: {
      treatment: "editorial-crop",
      overlayColor: "#202020",
      overlayOpacity: 0,
      radius: 3,
    },
  },
  "warm-editorial": {
    id: "warm-editorial",
    name: "Warm Editorial",
    description: "温暖纸张色、衬线标题和柔和层次，适合文化与品牌叙事。",
    fonts: { display: "Georgia", body: "Arial", mono: "Menlo" },
    colors: {
      canvas: "#F3EBDD",
      surface: "#FFFDF8",
      surfaceMuted: "#E8D9C6",
      text: "#342820",
      textMuted: "#776A60",
      primary: "#884C38",
      secondary: "#E6C7AF",
      accent: "#C26D3C",
      positive: "#697D4B",
      warning: "#B3833F",
      negative: "#A4473C",
      line: "#CBB9A6",
    },
    typeScale: { ...baseTypeScale, hero: 74, title: 48 },
    spacing: { ...baseSpacing, page: 76, section: 52 },
    shape: {
      radius: 8,
      borderWidth: 1,
      shadow: { color: "#6D4B34", opacity: 0.12, blur: 14, offsetX: 0, offsetY: 7 },
    },
    backgroundMotif: "halo",
    chart: {
      palette: ["#884C38", "#697D4B", "#D39B55", "#526D78", "#B46B6B"],
      axisColor: "#776A60",
      gridColor: "#DACABC",
      labelColor: "#55473D",
    },
    diagram: {
      nodeFill: "#FFFDF8",
      nodeStroke: "#A88872",
      edgeColor: "#9B7A65",
      emphasisFill: "#E6C7AF",
    },
    image: {
      treatment: "framed",
      overlayColor: "#884C38",
      overlayOpacity: 0.08,
      radius: 8,
    },
  },
  "brutalist-poster": {
    id: "brutalist-poster",
    name: "Brutalist Poster",
    description: "粗黑描边、硬切色块和海报式排版，适合高冲击表达。",
    fonts: { display: "Arial Black", body: "Arial", mono: "Menlo" },
    colors: {
      canvas: "#F6F0DC",
      surface: "#FFFDF5",
      surfaceMuted: "#F1D53D",
      text: "#0B0B0B",
      textMuted: "#4A4840",
      primary: "#0B0B0B",
      secondary: "#F1D53D",
      accent: "#FF4B32",
      positive: "#46A46B",
      warning: "#F1D53D",
      negative: "#FF4B32",
      line: "#0B0B0B",
    },
    typeScale: { ...baseTypeScale, hero: 88, title: 56, heading: 34 },
    spacing: { ...baseSpacing, inline: 12 },
    shape: {
      radius: 0,
      borderWidth: 4,
      shadow: { color: "#0B0B0B", opacity: 1, blur: 0, offsetX: 9, offsetY: 9 },
    },
    backgroundMotif: "registration",
    chart: {
      palette: ["#FF4B32", "#F1D53D", "#0B0B0B", "#46A46B", "#4694E8"],
      axisColor: "#0B0B0B",
      gridColor: "#AFA98F",
      labelColor: "#0B0B0B",
    },
    diagram: {
      nodeFill: "#FFFDF5",
      nodeStroke: "#0B0B0B",
      edgeColor: "#0B0B0B",
      emphasisFill: "#F1D53D",
    },
    image: {
      treatment: "hard-crop",
      overlayColor: "#FF4B32",
      overlayOpacity: 0,
      radius: 0,
    },
  },
} satisfies Record<StylePackId, StylePack>;

export const STYLE_PACK_LIST = Object.values(STYLE_PACKS);

export const getStylePack = (id: StylePackId): StylePack => STYLE_PACKS[id];
