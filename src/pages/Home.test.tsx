import { App } from "@/App";
import { TooltipProvider } from "@/components/ui/tooltip";
import { JsonCanvasEditor } from "@/editor/JsonCanvasEditor";
import { EDITOR_TEST_DOCUMENTS } from "@/test/fixtures/editor-documents";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/editor/components/CanvasStage", () => ({
  CanvasStage: ({
    document,
    editingElementId,
    hoveredId,
    onEditText,
    onElementChange,
    onElementPreview,
    onSelect,
    viewportHeight,
    viewportPosition,
    viewportWidth,
    zoom,
  }: {
    document: { name: string; elements: unknown[] };
    editingElementId: string | null;
    hoveredId: string | null;
    onEditText: (elementId: string) => void;
    onElementChange: (elementId: string, patch: { x: number }) => void;
    onElementPreview: (
      elementId: string,
      patch: { height?: number; width?: number; x?: number; y?: number } | null,
    ) => void;
    onSelect: (elementId: string) => void;
    viewportHeight: number;
    viewportPosition: { x: number; y: number };
    viewportWidth: number;
    zoom: number;
  }) => (
    <div
      data-hovered-id={hoveredId ?? ""}
      data-editing-id={editingElementId ?? ""}
      data-document={JSON.stringify(document)}
      data-testid="canvas-stage"
      data-viewport-x={viewportPosition.x}
      data-viewport-y={viewportPosition.y}
      data-viewport-height={viewportHeight}
      data-viewport-width={viewportWidth}
      data-zoom={zoom}
    >
      {document.name}
      <button onClick={() => onEditText("test-title")}>模拟双击文本</button>
      <button onClick={() => onSelect("test-title")}>模拟画布选择主标题</button>
      <button onClick={() => onSelect("test-disclaimer")}>模拟画布选择免责声明</button>
      <button
        onClick={() =>
          onElementPreview("test-title", {
            height: 55.678,
            width: 333.456,
            x: 83.456,
            y: 91.234,
          })
        }
      >
        模拟实时变换
      </button>
      <button
        onClick={() => {
          onElementChange("test-title", { x: 82.3456 });
          onElementPreview("test-title", null);
        }}
      >
        模拟画布变换
      </button>
    </div>
  ),
}));

vi.mock("@/editor/components/RichTextEditorOverlay", () => {
  function MockRichTextEditorOverlay({
    element,
    initialText,
    onCancel,
    onCommit,
    onReady,
  }: {
    element: { id: string };
    initialText: string;
    onCancel: () => void;
    onCommit: (elementId: string, markdown: string) => void;
    onReady: (elementId: string) => void;
  }) {
    useEffect(() => {
      onReady(element.id);
    }, [element.id, onReady]);

    return (
      <div data-testid="rich-text-editor">
        <span>{initialText}</span>
        <button onClick={() => onCommit(element.id, initialText)}>模拟原文提交</button>
        <button onClick={() => onCommit(element.id, "**已修改** ~~文本~~")}>模拟富文本提交</button>
        <button onClick={onCancel}>模拟取消编辑</button>
      </div>
    );
  }

  return { default: MockRichTextEditorOverlay };
});

function renderApp(initialEntry = "/test-longform") {
  const documentId = initialEntry.replace(/^\//, "");
  const editorDocument = EDITOR_TEST_DOCUMENTS.find((document) => document.id === documentId);

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      {editorDocument ? (
        <TooltipProvider>
          <JsonCanvasEditor
            defaultValue={[structuredClone(editorDocument)]}
            initialDocumentId={editorDocument.id}
          />
        </TooltipProvider>
      ) : (
        <App />
      )}
    </MemoryRouter>,
  );
}

describe("Home", () => {
  it("does not expose built-in content templates", async () => {
    renderApp("/");
    await screen.findByText("还没有内容项目");

    expect(screen.queryByText("已有内容模板")).not.toBeInTheDocument();
    expect(screen.queryByText("从模板开始")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /打开模板/ })).not.toBeInTheDocument();
  });

  it("opens the JSON structure detail page from the home page in the current tab", async () => {
    renderApp("/");
    await screen.findByText("还没有内容项目");

    const structureLink = screen.getByRole("link", { name: "结构详情" });
    expect(structureLink).toHaveAttribute("href", "/json-structure");
    expect(structureLink).not.toHaveAttribute("target");
    expect(structureLink).not.toHaveAttribute("rel");
  });

  it("renders the JSON structure detail route", () => {
    renderApp("/json-structure");

    expect(screen.getByRole("heading", { name: "JSON 结构详情" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "CanvasDocument" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "chart" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "table" })).toBeInTheDocument();
    expect(screen.getByText("documentType")).toBeInTheDocument();
    expect(screen.getByText("chartType")).toBeInTheDocument();
    expect(screen.getByText("headerStyle")).toBeInTheDocument();
    expect(screen.getByText("pointerLength")).toBeInTheDocument();
  });

  it("previews the current page definition as read-only JSON", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "查看页面结构 JSON" }));

    const dialog = screen.getByRole("dialog", { name: "页面结构" });
    const preview = screen.getByLabelText("当前页面 JSON");
    const pageDefinition = JSON.parse(preview.textContent ?? "") as {
      documentType: string;
      id: string;
      name: string;
      elements: unknown[];
    };

    expect(dialog).toHaveTextContent(/测试长画布 · 1080 × 5993/);
    expect(dialog).toHaveTextContent("只读预览");
    expect(dialog.querySelector('[data-slot="scroll-area"]')).toHaveAttribute(
      "data-scrollbars",
      "both",
    );
    expect(preview).toHaveClass("w-max", "min-w-full", "whitespace-pre");
    expect(pageDefinition.id).toBe("test-longform");
    expect(pageDefinition.documentType).toBe("longform");
    expect(pageDefinition.name).toBe("测试长画布");
    expect(pageDefinition.elements.length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("dialog", { name: "页面结构" })).not.toBeInTheDocument();
  });

  it("renders only the current longform document in the page list", async () => {
    renderApp();

    const layerHeading = screen.getByRole("heading", { name: "图层" });
    const pagesHeading = screen.getByRole("heading", { name: "页面" });
    const currentPageInfo = screen.getByRole("group", { name: "当前页面信息" });
    expect(layerHeading.parentElement).toHaveTextContent(/^图层$/);
    expect(pagesHeading.parentElement).toHaveTextContent(/^页面$/);
    expect(screen.getByRole("separator", { name: "调整页面与图层区域高度" })).toHaveAttribute(
      "aria-orientation",
      "horizontal",
    );
    expect(screen.getByText("选择一个元素")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-stage")).toHaveTextContent("测试长画布");
    expect(currentPageInfo).toHaveTextContent(/测试长画布1080 × 5993/);
    expect(screen.getByRole("button", { name: "导出图片" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^打开页面 / })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "打开页面 测试长画布" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("button", { name: "打开页面 测试演示文稿" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "切换模板" })).not.toBeInTheDocument();
    expect(screen.queryByText("01 · 1080 × 1080")).not.toBeInTheDocument();

    const layerPanel = layerHeading.closest('[data-slot="resizable-panel"]');
    const layerScrollArea = layerPanel?.querySelector('[data-slot="scroll-area"]');
    const titleActions = screen
      .getByRole("button", { name: "测试标题" })
      .closest('[data-slot="layer-row"]')
      ?.querySelector('[data-slot="layer-row-actions"]');

    expect(layerScrollArea).toHaveAttribute("data-scrollbars", "both");
    expect(titleActions).toHaveClass("sticky", "right-0");
  });

  it("renders only the current PPT detail page and its slides in the page list", async () => {
    const user = userEvent.setup();
    renderApp("/test-presentation");

    const currentPageInfo = screen.getByRole("group", { name: "当前页面信息" });

    expect(screen.getByTestId("canvas-stage")).toHaveTextContent("测试演示文稿");
    expect(currentPageInfo).toHaveTextContent(/测试演示文稿 \/ 01 欢迎页1600 × 900/);
    expect(screen.getAllByRole("button", { name: /^打开页面 / })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "打开页面 测试演示文稿" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.queryByRole("button", { name: "打开页面 测试长画布" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开幻灯片 01 欢迎页" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "打开幻灯片 03 核心问题" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "幻灯片总览" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "导出 PPT" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "打开幻灯片 03 核心问题" }));
    expect(screen.getByTestId("canvas-stage")).toHaveTextContent("测试演示文稿 / 03 核心问题");
    expect(screen.getByRole("button", { name: "核心问题标题" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "欢迎页标题" })).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "幻灯片总览" })[0]);
    expect(screen.getByText("幻灯片总览 · 3 页")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回当前幻灯片" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^编辑幻灯片 / })).toHaveLength(3);
  });

  it("does not scroll the layer list when an element is selected on the canvas", async () => {
    const user = userEvent.setup();
    renderApp();

    const viewport = screen
      .getByRole("heading", { name: "图层" })
      .closest('[data-slot="resizable-panel"]')
      ?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLDivElement | null;
    const disclaimerRow = document.querySelector(
      '[data-slot="layer-row"][data-element-id="test-disclaimer"]',
    ) as HTMLDivElement | null;

    if (!viewport || !disclaimerRow) throw new Error("未找到图层滚动测试节点");

    const scrollTo = vi.fn();
    Object.defineProperties(viewport, {
      scrollTo: { configurable: true, value: scrollTo },
    });

    await user.click(screen.getByRole("button", { name: "模拟画布选择免责声明" }));
    await waitFor(() => expect(disclaimerRow).toHaveAttribute("data-selected", "true"));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("does not expand a collapsed group when an element is selected on the canvas", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "收起 封面" }));
    expect(screen.queryByRole("button", { name: "测试标题" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "模拟画布选择主标题" }));

    expect(screen.queryByRole("button", { name: "测试标题" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开 封面" })).toBeVisible();
  });

  it("moves an offscreen canvas element into view when its layer is selected", async () => {
    const originalResizeObserver = globalThis.ResizeObserver;

    class ImmediateResizeObserver implements ResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}

      disconnect() {}

      observe(target: Element) {
        if (target.tagName !== "MAIN") return;
        this.callback(
          [{ contentRect: { height: 600, width: 800 }, target } as ResizeObserverEntry],
          this,
        );
      }

      unobserve() {}
    }

    globalThis.ResizeObserver = ImmediateResizeObserver;

    try {
      const user = userEvent.setup();
      renderApp();

      const canvas = screen.getByTestId("canvas-stage");
      await waitFor(() => expect(canvas).toHaveAttribute("data-viewport-width", "800"));
      const initialPosition = {
        x: Number(canvas.getAttribute("data-viewport-x")),
        y: Number(canvas.getAttribute("data-viewport-y")),
      };

      await user.click(screen.getByRole("button", { name: "测试标题" }));
      expect(canvas).toHaveAttribute("data-viewport-x", String(initialPosition.x));
      expect(canvas).toHaveAttribute("data-viewport-y", String(initialPosition.y));

      await user.click(screen.getByRole("button", { name: "免责声明" }));
      await waitFor(() =>
        expect(Number(canvas.getAttribute("data-viewport-y"))).toBeLessThan(-1_000),
      );
    } finally {
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  it("caps the fitted canvas preview width at 890 pixels", async () => {
    const originalResizeObserver = globalThis.ResizeObserver;

    class WideContainerResizeObserver implements ResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}

      disconnect() {}

      observe(target: Element) {
        if (target.tagName !== "MAIN") return;
        this.callback(
          [{ contentRect: { height: 900, width: 1_400 }, target } as ResizeObserverEntry],
          this,
        );
      }

      unobserve() {}
    }

    globalThis.ResizeObserver = WideContainerResizeObserver;

    try {
      renderApp();

      const canvas = screen.getByTestId("canvas-stage");
      await waitFor(() => expect(canvas).toHaveAttribute("data-viewport-width", "1400"));

      expect(Number(canvas.getAttribute("data-zoom")) * 1_080).toBeCloseTo(890);
    } finally {
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  it("highlights the matching canvas element while hovering a layer", async () => {
    const user = userEvent.setup();
    renderApp();

    const canvas = screen.getByTestId("canvas-stage");
    const layer = screen.getByRole("button", { name: "画布背景" });

    await user.hover(layer);
    expect(canvas).toHaveAttribute("data-hovered-id", "test-background");

    await user.unhover(layer);
    expect(canvas).toHaveAttribute("data-hovered-id", "");
  });

  it("collapses and expands a layer group", async () => {
    const user = userEvent.setup();
    renderApp();

    const groupButton = screen.getByRole("button", { name: "封面" });
    await user.click(groupButton);

    expect(groupButton.closest('[data-slot="layer-row"]')).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("button", { name: "封面背景" })).toBeInTheDocument();

    const childRow = screen
      .getByRole("button", { name: "封面背景" })
      .closest('[data-slot="layer-row"]');
    expect(childRow?.querySelector('[data-slot="layer-indent-spacer"]')).toHaveStyle({
      width: "12px",
    });

    await user.click(screen.getByRole("button", { name: "收起 封面" }));
    expect(screen.queryByRole("button", { name: "封面背景" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开 封面" }));
    expect(screen.getByRole("button", { name: "封面背景" })).toBeInTheDocument();
  });

  it("selects from the whole layer row without action buttons clicking through", async () => {
    const user = userEvent.setup();
    renderApp();

    const backgroundRow = screen
      .getByRole("button", { name: "画布背景" })
      .closest('[data-slot="layer-row"]');
    const titleRow = screen
      .getByRole("button", { name: "测试标题" })
      .closest('[data-slot="layer-row"]');
    if (!backgroundRow || !titleRow) throw new Error("未找到图层行");

    fireEvent.click(backgroundRow);
    expect(backgroundRow).toHaveAttribute("data-selected", "true");

    await user.click(screen.getByRole("button", { name: "测试标题" }));
    await user.hover(backgroundRow);
    await user.click(screen.getByRole("button", { name: "隐藏 画布背景" }));

    expect(titleRow).toHaveAttribute("data-selected", "true");
    expect(backgroundRow).toHaveAttribute("data-selected", "false");

    await user.click(screen.getByRole("button", { name: "解锁 画布背景" }));
    expect(titleRow).toHaveAttribute("data-selected", "true");
    expect(backgroundRow).toHaveAttribute("data-selected", "false");
  });

  it("feeds live transform dimensions back into the canvas without changing font size", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "测试标题" }));
    const nameInput = screen.getByLabelText("名称");

    expect(nameInput).toHaveValue("测试标题");

    await user.clear(nameInput);
    await user.type(nameInput, "封面标题");
    const canvasDocumentBeforePreview = screen.getByTestId("canvas-stage").dataset.document;
    await user.click(screen.getByRole("button", { name: "模拟实时变换" }));

    expect(screen.getByLabelText("X")).toHaveValue(83.46);
    expect(screen.getByLabelText("Y")).toHaveValue(91.23);
    expect(screen.getByLabelText("宽")).toHaveValue(333.46);
    expect(screen.getByLabelText("高")).toHaveValue(55.68);
    const canvasDocumentDuringPreview = screen.getByTestId("canvas-stage").dataset.document;
    expect(canvasDocumentDuringPreview).not.toBe(canvasDocumentBeforePreview);
    expect(canvasDocumentDuringPreview).toContain('"x":83.456');
    expect(canvasDocumentDuringPreview).toContain('"width":333.456');
    expect(canvasDocumentDuringPreview).toContain('"fontSize":49');

    await user.click(screen.getByRole("button", { name: "模拟画布变换" }));

    expect(screen.getByRole("heading", { name: "封面标题" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "封面标题" })).toBeInTheDocument();
    expect(screen.queryByText("属性")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "复制" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("X")).toHaveValue(82.35);
  });

  it("formats a valid rotation with degrees and restores the previous value for invalid text", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "测试标题" }));
    const rotationInput = screen.getByLabelText("角度");
    const rotationGroup = rotationInput.closest('[data-slot="scrubbable-number-input"]');
    const rotationTrigger = screen.getByRole("button", { name: "拖动调整角度" });

    expect(rotationInput).toHaveValue("0°");
    expect(screen.getByText("角度")).toBeVisible();
    expect(rotationGroup).not.toBeNull();
    expect(rotationTrigger).toHaveClass("cursor-ew-resize");
    expect(rotationTrigger.querySelector("svg")).toHaveClass("lucide-triangle-right");
    expect(rotationGroup?.firstElementChild).toBe(rotationTrigger);
    expect(rotationGroup?.lastElementChild).toBe(rotationInput);

    await user.click(rotationInput);
    await user.clear(rotationInput);
    await user.type(rotationInput, "12.345");
    await user.tab();

    expect(rotationInput).toHaveValue("12.35°");

    await user.click(rotationInput);
    await user.clear(rotationInput);
    await user.type(rotationInput, "无效内容");
    await user.tab();

    expect(rotationInput).toHaveValue("12.35°");
  });

  it("enforces minimum values for constrained numeric properties", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "测试标题" }));
    const fontSizeInput = screen.getByLabelText("字号");
    const lineHeightInput = screen.getByLabelText("行高");

    expect(lineHeightInput).toHaveValue(1.42);

    await user.clear(fontSizeInput);
    await user.type(fontSizeInput, "-5");
    await user.tab();

    expect(fontSizeInput).toHaveValue(8);

    await user.clear(lineHeightInput);
    await user.type(lineHeightInput, "0");
    await user.tab();

    expect(lineHeightInput).toHaveValue(0.5);
  });

  it("edits shape stroke and rounded corners from the properties panel", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "章节内容卡" }));

    const strokeWidthInput = screen.getByLabelText("描边宽度");
    const cornerRadiusInput = screen.getByLabelText("圆角");
    const strokeColorButton = screen.getByRole("button", { name: "描边颜色选择器" });

    expect(strokeWidthInput).toHaveValue(4);
    expect(cornerRadiusInput).toHaveValue(36);
    expect(strokeColorButton).toHaveTextContent("#CBD5E1");

    await user.clear(strokeWidthInput);
    await user.type(strokeWidthInput, "5");
    await user.tab();
    await user.clear(cornerRadiusInput);
    await user.type(cornerRadiusInput, "14");
    await user.tab();
    await user.click(strokeColorButton);
    fireEvent.change(await screen.findByRole("textbox", { name: "Hex 颜色" }), {
      target: { value: "#2948ab" },
    });

    expect(strokeWidthInput).toHaveValue(5);
    expect(cornerRadiusInput).toHaveValue(14);
    expect(strokeColorButton).toHaveTextContent("#2948AB");

    const backgroundRow = document.querySelector(
      '[data-slot="layer-row"][data-element-id="test-cover-background"]',
    );
    if (!backgroundRow) throw new Error("未找到背景图层");
    fireEvent.click(backgroundRow);

    expect(screen.getByLabelText("圆角")).toHaveValue(0);
  });

  it("changes the selected text box font as one undoable property update", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "测试标题" }));
    const fontSelect = screen.getByRole("combobox", { name: "字体" });

    expect(fontSelect).toHaveTextContent("Noto 黑体");
    expect(screen.getByRole("combobox", { name: "字重" })).toHaveTextContent("700");
    await user.click(fontSelect);
    await user.click(await screen.findByRole("option", { name: "Noto 宋体" }));

    expect(fontSelect).toHaveTextContent("Noto 宋体");
    await user.click(screen.getByRole("button", { name: "撤销" }));
    expect(fontSelect).toHaveTextContent("Noto 黑体");
  });

  it("previews an icon scrub live and records one undoable property update", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "测试标题" }));
    const xInput = screen.getByLabelText("X");
    const scrubTrigger = screen.getByRole("button", { name: "拖动调整X" });
    const initialX = Number(xInput.getAttribute("value"));
    let capturedPointerId: number | null = null;

    scrubTrigger.setPointerCapture = vi.fn((pointerId: number) => {
      capturedPointerId = pointerId;
    });
    scrubTrigger.releasePointerCapture = vi.fn(() => {
      capturedPointerId = null;
    });
    scrubTrigger.hasPointerCapture = vi.fn((pointerId: number) => capturedPointerId === pointerId);

    vi.useFakeTimers();
    fireEvent.pointerDown(scrubTrigger, {
      button: 0,
      clientX: 20,
      clientY: 20,
      isPrimary: true,
      pointerId: 3,
      pointerType: "mouse",
    });
    act(() => vi.advanceTimersByTime(250));
    fireEvent.pointerMove(scrubTrigger, {
      clientX: 44,
      clientY: 20,
      pointerId: 3,
      pointerType: "mouse",
    });

    expect(xInput).toHaveValue(initialX + 24);
    expect(screen.getByRole("button", { name: "撤销" })).toBeDisabled();

    fireEvent.pointerUp(scrubTrigger, { pointerId: 3, pointerType: "mouse" });
    expect(xInput).toHaveValue(initialX + 24);
    expect(screen.getByRole("button", { name: "撤销" })).toBeEnabled();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();

    await user.click(screen.getByRole("button", { name: "撤销" }));
    expect(xInput).toHaveValue(initialX);
    expect(screen.getByRole("button", { name: "撤销" })).toBeDisabled();
  });

  it("enters text editing from Enter or double click and commits one undoable session", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "测试标题" }));
    expect(screen.getByRole("textbox", { name: "文本内容" })).toHaveTextContent("测试标题");
    expect(screen.getByRole("textbox", { name: "文本内容" })).toHaveClass(
      "flex",
      "items-start",
      "overflow-x-hidden",
      "whitespace-pre-wrap",
      "break-words",
    );
    expect(screen.getByRole("textbox", { name: "文本内容" })).not.toHaveClass(
      "overflow-x-auto",
      "whitespace-nowrap",
    );

    fireEvent.keyDown(window, { key: "Enter" });
    expect(await screen.findByTestId("rich-text-editor")).toHaveTextContent("测试标题");
    await waitFor(() =>
      expect(screen.getByTestId("canvas-stage")).toHaveAttribute("data-editing-id", "test-title"),
    );

    await user.click(screen.getByRole("button", { name: "模拟富文本提交" }));
    expect(screen.queryByTestId("rich-text-editor")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "文本内容" })).toHaveTextContent("已修改 文本");

    await user.click(screen.getByRole("button", { name: "撤销" }));
    expect(screen.getByRole("textbox", { name: "文本内容" })).toHaveTextContent("测试标题");

    await user.click(screen.getByRole("button", { name: "模拟双击文本" }));
    expect(await screen.findByTestId("rich-text-editor")).toBeInTheDocument();
  });

  it("does not create history for an unchanged edit and cancels on Escape", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "测试标题" }));
    fireEvent.keyDown(window, { key: "Enter" });
    await user.click(await screen.findByRole("button", { name: "模拟原文提交" }));

    expect(screen.getByRole("button", { name: "撤销" })).toBeDisabled();

    fireEvent.keyDown(window, { key: "Enter" });
    expect(await screen.findByTestId("rich-text-editor")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByTestId("rich-text-editor")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "撤销" })).toBeDisabled();
  });

  it("commits color changes immediately without waiting for the popover to close", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "测试标题" }));
    const colorButton = screen.getByRole("button", { name: "文字颜色选择器" });
    await user.click(colorButton);

    fireEvent.change(await screen.findByRole("textbox", { name: "Hex 颜色" }), {
      target: { value: "#ff0000" },
    });

    expect(colorButton).toHaveTextContent("#FF0000");
    expect(screen.getByRole("button", { name: "撤销" })).toBeEnabled();

    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Hex 颜色" })).toBeNull());

    expect(colorButton).toHaveTextContent("#FF0000");
    expect(screen.getByRole("button", { name: "撤销" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "撤销" }));

    expect(colorButton).toHaveTextContent("#FFFFFF");
    expect(screen.getByRole("button", { name: "撤销" })).toBeDisabled();
  });

  it("shows only the action name in layer tooltips", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.hover(screen.getByRole("button", { name: "画布背景" }));
    await user.hover(screen.getByRole("button", { name: "隐藏 画布背景" }));

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("隐藏");
    expect(tooltip).not.toHaveTextContent("画布背景");
  });

  it("keeps only active hidden and locked layer actions visible outside hover", async () => {
    const user = userEvent.setup();
    renderApp();

    const backgroundHideButton = screen.getByRole("button", { name: "隐藏 画布背景" });
    const backgroundUnlockButton = screen.getByRole("button", { name: "解锁 画布背景" });

    expect(backgroundHideButton).toHaveClass("opacity-0", "pointer-events-none");
    expect(backgroundUnlockButton).toHaveClass("opacity-100", "pointer-events-auto");
    expect(backgroundUnlockButton.querySelector("svg")).toHaveClass("h-[15px]!", "w-[13px]!");

    const titleHideButton = screen.getByRole("button", { name: "隐藏 测试标题" });
    const titleLockButton = screen.getByRole("button", { name: "锁定 测试标题" });
    expect(titleHideButton).toHaveClass("opacity-0", "pointer-events-none");
    expect(titleLockButton).toHaveClass("opacity-0", "pointer-events-none");

    await user.hover(screen.getByRole("button", { name: "测试标题" }));
    await user.click(titleHideButton);

    const titleShowButton = screen.getByRole("button", { name: "显示 测试标题" });
    expect(titleShowButton).toHaveClass("opacity-100", "pointer-events-auto");
    expect(screen.getByRole("button", { name: "锁定 测试标题" })).toHaveClass("opacity-0");

    await user.click(titleShowButton);
    expect(screen.getByRole("button", { name: "隐藏 测试标题" })).toHaveClass("opacity-0");
  });

  it("pans the free canvas with the middle mouse button", () => {
    renderApp();

    const canvas = screen.getByTestId("canvas-stage");
    const viewport = canvas.parentElement;
    if (!viewport) throw new Error("未找到画板视口");

    Object.assign(viewport, {
      hasPointerCapture: () => true,
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });

    const initialX = Number(canvas.getAttribute("data-viewport-x"));
    const initialY = Number(canvas.getAttribute("data-viewport-y"));

    fireEvent.pointerDown(viewport, {
      button: 1,
      clientX: 100,
      clientY: 120,
      pointerId: 7,
    });
    fireEvent.pointerMove(viewport, {
      clientX: 148,
      clientY: 156,
      pointerId: 7,
    });

    expect(canvas).toHaveAttribute("data-viewport-x", String(initialX + 48));
    expect(canvas).toHaveAttribute("data-viewport-y", String(initialY + 36));
    expect(viewport).toHaveAttribute("data-panning", "true");

    fireEvent.pointerUp(viewport, { pointerId: 7 });
    expect(viewport).toHaveAttribute("data-panning", "false");
  });

  it("pans with a primary-button drag while Space is held", () => {
    renderApp();

    const canvas = screen.getByTestId("canvas-stage");
    const viewport = canvas.parentElement;
    if (!viewport) throw new Error("未找到画板视口");
    Object.assign(viewport, {
      hasPointerCapture: () => true,
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });

    const initialX = Number(canvas.getAttribute("data-viewport-x"));
    const initialY = Number(canvas.getAttribute("data-viewport-y"));
    fireEvent.pointerEnter(viewport);
    fireEvent.keyDown(window, { code: "Space" });
    expect(viewport).toHaveAttribute("data-pan-ready", "true");

    fireEvent.pointerDown(viewport, {
      button: 0,
      clientX: 100,
      clientY: 120,
      pointerId: 12,
    });
    fireEvent.pointerMove(viewport, { clientX: 130, clientY: 150, pointerId: 12 });
    expect(canvas).toHaveAttribute("data-viewport-x", String(initialX + 30));
    expect(canvas).toHaveAttribute("data-viewport-y", String(initialY + 30));

    fireEvent.pointerUp(viewport, { pointerId: 12 });
    fireEvent.keyUp(window, { code: "Space" });
    expect(viewport).toHaveAttribute("data-pan-ready", "false");
  });

  it("pans the free canvas in both axes with trackpad scrolling", () => {
    renderApp();

    const canvas = screen.getByTestId("canvas-stage");
    const initialX = Number(canvas.getAttribute("data-viewport-x"));
    const initialY = Number(canvas.getAttribute("data-viewport-y"));
    const initialZoom = canvas.getAttribute("data-zoom");

    const allowedDefault = fireEvent.wheel(canvas, { deltaX: 28, deltaY: -36 });

    expect(allowedDefault).toBe(false);
    expect(canvas).toHaveAttribute("data-viewport-x", String(initialX - 28));
    expect(canvas).toHaveAttribute("data-viewport-y", String(initialY + 36));
    expect(canvas).toHaveAttribute("data-zoom", initialZoom);
  });

  it("moves instead of zooming for ctrl-modified wheel input", () => {
    renderApp();

    const canvas = screen.getByTestId("canvas-stage");
    const initialY = Number(canvas.getAttribute("data-viewport-y"));
    const initialZoom = canvas.getAttribute("data-zoom");

    const allowedDefault = fireEvent.wheel(canvas, { ctrlKey: true, deltaY: -60 });

    expect(allowedDefault).toBe(false);
    expect(canvas).toHaveAttribute("data-viewport-y", String(initialY + 60));
    expect(canvas).toHaveAttribute("data-zoom", initialZoom);
  });

  it("does not pan the canvas or show a grab cursor for a primary-button drag", () => {
    renderApp();

    const canvas = screen.getByTestId("canvas-stage");
    const viewport = canvas.parentElement;
    if (!viewport) throw new Error("未找到画板视口");

    const initialX = Number(canvas.getAttribute("data-viewport-x"));
    const initialY = Number(canvas.getAttribute("data-viewport-y"));

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 240,
      clientY: 180,
      pointerId: 8,
    });
    fireEvent.pointerMove(viewport, {
      clientX: 206,
      clientY: 222,
      pointerId: 8,
    });

    expect(canvas).toHaveAttribute("data-viewport-x", String(initialX));
    expect(canvas).toHaveAttribute("data-viewport-y", String(initialY));
    expect(viewport).toHaveAttribute("data-pan-ready", "false");
    expect(viewport).toHaveAttribute("data-panning", "false");

    fireEvent.pointerUp(viewport, { pointerId: 8 });
    expect(viewport).toHaveAttribute("data-panning", "false");
  });
});
