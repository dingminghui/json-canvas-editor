import type {
  CanvasDocument,
  CanvasElement,
  GroupElement,
  RectElement,
  TextElement,
} from "@/editor/types";

function rect(overrides: Partial<RectElement> & Pick<RectElement, "id" | "name">): RectElement {
  return {
    cornerRadius: 0,
    fill: "#FFFFFF",
    height: 120,
    locked: false,
    opacity: 1,
    rotation: 0,
    stroke: "transparent",
    strokeWidth: 0,
    type: "rect",
    visible: true,
    width: 240,
    x: 0,
    y: 0,
    ...overrides,
  };
}

function text(overrides: Partial<TextElement> & Pick<TextElement, "id" | "name">): TextElement {
  return {
    align: "left",
    fill: "#FFFFFF",
    fontFamily: "noto-sans-sc",
    fontSize: 49,
    fontWeight: "700",
    height: 80,
    lineHeight: 1.42,
    locked: false,
    opacity: 1,
    rotation: 0,
    text: "测试标题",
    type: "text",
    visible: true,
    width: 420,
    x: 452,
    y: 155,
    ...overrides,
  };
}

function group(id: string, name: string, children: CanvasElement[]): GroupElement {
  return { children, id, locked: false, name, type: "group", visible: true };
}

const longformDocument: CanvasDocument = {
  description: "用于编辑器交互测试的最小长画布。",
  documentType: "longform",
  elements: [
    rect({
      fill: "#F4F4F5",
      height: 5993,
      id: "test-background",
      locked: true,
      name: "画布背景",
      width: 1080,
    }),
    group("test-cover-group", "封面", [
      rect({
        fill: "#1E293B",
        height: 860,
        id: "test-cover-background",
        name: "封面背景",
        width: 1080,
      }),
      text({ id: "test-title", name: "测试标题" }),
    ]),
    group("test-chapter-group", "章节一", [
      rect({
        cornerRadius: 36,
        fill: "#FFFFFF",
        height: 586,
        id: "test-chapter-card",
        name: "章节内容卡",
        stroke: "#CBD5E1",
        strokeWidth: 4,
        width: 950,
        x: 58,
        y: 1320,
      }),
      text({
        fill: "#0F172A",
        fontSize: 30,
        height: 100,
        id: "test-chapter-text",
        name: "章节正文",
        text: "用于验证图层跨组移动。",
        width: 700,
        x: 100,
        y: 1400,
      }),
    ]),
    text({
      fill: "#475569",
      fontSize: 18,
      fontWeight: "400",
      height: 82,
      id: "test-disclaimer",
      name: "免责声明",
      text: "测试说明文字。",
      width: 940,
      x: 70,
      y: 5861,
    }),
  ],
  height: 5993,
  id: "test-longform",
  name: "测试长画布",
  width: 1080,
};

function presentationPage(
  id: string,
  name: string,
  titleId: string,
  titleName: string,
  pageNumber: string,
): GroupElement {
  return group(id, name, [
    rect({
      fill: "#F8FAFC",
      height: 900,
      id: `${id}-background`,
      locked: true,
      name: `${name}背景`,
      width: 1600,
    }),
    text({
      fill: "#0F172A",
      id: titleId,
      name: titleName,
      text: name.replace(/^\d+\s*/, ""),
      x: 120,
      y: 100,
    }),
    text({
      fill: "#64748B",
      fontSize: 18,
      fontWeight: "400",
      height: 32,
      id: `${id}-page-number`,
      name: `${name}页码`,
      text: pageNumber,
      width: 120,
      x: 1360,
      y: 820,
    }),
  ]);
}

const presentationDocument: CanvasDocument = {
  description: "用于编辑器交互测试的最小演示文稿。",
  documentType: "pptx",
  elements: [
    presentationPage("test-slide-1", "01 欢迎页", "test-slide-1-title", "欢迎页标题", "01 / 03"),
    presentationPage("test-slide-2", "02 议程", "test-slide-2-title", "议程标题", "02 / 03"),
    presentationPage(
      "test-slide-3",
      "03 核心问题",
      "test-slide-3-title",
      "核心问题标题",
      "03 / 03",
    ),
  ],
  height: 900,
  id: "test-presentation",
  name: "测试演示文稿",
  width: 1600,
};

export const EDITOR_TEST_DOCUMENTS: CanvasDocument[] = [longformDocument, presentationDocument];
