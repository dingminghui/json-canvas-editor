import { App } from "@/App";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";

vi.mock("@/editor/components/CanvasStage", () => ({
  CanvasStage: ({
    document,
    editingElementId,
    hoveredId,
    onEditText,
    onElementChange,
    onElementPreview,
    onPanReadyChange,
    onPanStart,
    onSelect,
    viewportHeight,
    viewportPosition,
    viewportWidth,
  }: {
    document: { name: string };
    editingElementId: string | null;
    hoveredId: string | null;
    onEditText: (elementId: string) => void;
    onElementChange: (elementId: string, patch: { x: number }) => void;
    onElementPreview: (
      elementId: string,
      patch: { height?: number; width?: number; x?: number; y?: number } | null,
    ) => void;
    onPanReadyChange: (ready: boolean) => void;
    onPanStart: (pointerId: number, point: { x: number; y: number }) => void;
    onSelect: (elementId: string) => void;
    viewportHeight: number;
    viewportPosition: { x: number; y: number };
    viewportWidth: number;
  }) => (
    <div
      data-hovered-id={hoveredId ?? ""}
      data-editing-id={editingElementId ?? ""}
      data-testid="canvas-stage"
      data-viewport-x={viewportPosition.x}
      data-viewport-y={viewportPosition.y}
      data-viewport-height={viewportHeight}
      data-viewport-width={viewportWidth}
      onPointerDown={(event) => {
        onPanReadyChange(true);
        onPanStart(event.pointerId, { x: event.clientX, y: event.clientY });
      }}
    >
      {document.name}
      <button onClick={() => onEditText("story-title")}>模拟双击文本</button>
      <button onClick={() => onSelect("story-title")}>模拟画布选择主标题</button>
      <button onClick={() => onSelect("story-footer-copyright")}>模拟画布选择版权信息</button>
      <button
        onClick={() =>
          onElementPreview("story-title", {
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
          onElementChange("story-title", { x: 82.3456 });
          onElementPreview("story-title", null);
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

describe("Home", () => {
  it("previews the current page definition as read-only JSON", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "查看页面结构 JSON" }));

    const dialog = screen.getByRole("dialog", { name: "页面结构" });
    const preview = screen.getByLabelText("当前页面 JSON");
    const pageDefinition = JSON.parse(preview.textContent ?? "") as {
      id: string;
      name: string;
      elements: unknown[];
    };

    expect(dialog).toHaveTextContent(/肾脏觉醒之路 · 1080 × \d+/);
    expect(dialog).toHaveTextContent("只读预览");
    expect(dialog.querySelector('[data-slot="scroll-area"]')).toHaveAttribute(
      "data-scrollbars",
      "both",
    );
    expect(preview).toHaveClass("w-max", "min-w-full", "whitespace-pre");
    expect(pageDefinition.id).toBe("kidney-awakening-story");
    expect(pageDefinition.name).toBe("肾脏觉醒之路");
    expect(pageDefinition.elements.length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("dialog", { name: "页面结构" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "打开页面 淋巴瘤转化之路" }));
    await user.click(screen.getByRole("button", { name: "查看页面结构 JSON" }));

    const nextPreview = JSON.parse(screen.getByLabelText("当前页面 JSON").textContent ?? "") as {
      id: string;
      name: string;
    };
    expect(nextPreview).toMatchObject({
      id: "lymphoma-transformation-story",
      name: "淋巴瘤转化之路",
    });
  });

  it("renders both stories with the kidney case selected by default", () => {
    render(<App />);

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
    expect(screen.getByTestId("canvas-stage")).toHaveTextContent("肾脏觉醒之路");
    expect(currentPageInfo).toHaveTextContent(/肾脏觉醒之路1080 × \d+/);
    expect(screen.getAllByRole("button", { name: /^打开页面 / })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "打开页面 肾脏觉醒之路" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "打开页面 淋巴瘤转化之路" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.queryByRole("button", { name: "切换模板" })).not.toBeInTheDocument();
    expect(screen.queryByText("01 · 1080 × 1080")).not.toBeInTheDocument();

    const layerPanel = layerHeading.closest('[data-slot="resizable-panel"]');
    const layerScrollArea = layerPanel?.querySelector('[data-slot="scroll-area"]');
    const titleActions = screen
      .getByRole("button", { name: "主标题" })
      .closest('[data-slot="layer-row"]')
      ?.querySelector('[data-slot="layer-row-actions"]');

    expect(layerScrollArea).toHaveAttribute("data-scrollbars", "both");
    expect(titleActions).toHaveClass("sticky", "right-0");
  });

  it("centers a canvas-selected layer only when it is outside the visible layer viewport", async () => {
    const user = userEvent.setup();
    render(<App />);

    const viewport = screen
      .getByRole("heading", { name: "图层" })
      .closest('[data-slot="resizable-panel"]')
      ?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLDivElement | null;
    const titleRow = document.querySelector(
      '[data-slot="layer-row"][data-element-id="story-title"]',
    ) as HTMLDivElement | null;
    const copyrightRow = document.querySelector(
      '[data-slot="layer-row"][data-element-id="story-footer-copyright"]',
    ) as HTMLDivElement | null;

    if (!viewport || !titleRow || !copyrightRow) throw new Error("未找到图层滚动测试节点");

    const scrollTo = vi.fn();
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 200 },
      scrollLeft: { configurable: true, value: 12, writable: true },
      scrollTo: { configurable: true, value: scrollTo },
      scrollTop: { configurable: true, value: 20, writable: true },
    });
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
      bottom: 300,
      height: 200,
      left: 0,
      right: 240,
      top: 100,
      width: 240,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    vi.spyOn(titleRow, "getBoundingClientRect").mockReturnValue({
      bottom: 172,
      height: 32,
      left: 0,
      right: 240,
      top: 140,
      width: 240,
      x: 0,
      y: 140,
      toJSON: () => ({}),
    });
    vi.spyOn(copyrightRow, "getBoundingClientRect").mockReturnValue({
      bottom: 532,
      height: 32,
      left: 0,
      right: 240,
      top: 500,
      width: 240,
      x: 0,
      y: 500,
      toJSON: () => ({}),
    });

    await user.click(screen.getByRole("button", { name: "模拟画布选择主标题" }));
    await waitFor(() => expect(titleRow).toHaveAttribute("data-selected", "true"));
    expect(scrollTo).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "模拟画布选择版权信息" }));
    await waitFor(() =>
      expect(scrollTo).toHaveBeenCalledWith({
        behavior: "smooth",
        left: 12,
        top: 336,
      }),
    );
  });

  it("reveals a canvas-selected layer inside a collapsed group", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "收起 开篇" }));
    expect(screen.queryByRole("button", { name: "主标题" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "模拟画布选择主标题" }));

    const title = await screen.findByRole("button", { name: "主标题" });
    expect(title.closest('[data-slot="layer-row"]')).toHaveAttribute("data-selected", "true");
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
      render(<App />);

      const canvas = screen.getByTestId("canvas-stage");
      await waitFor(() => expect(canvas).toHaveAttribute("data-viewport-width", "800"));
      const initialPosition = {
        x: Number(canvas.getAttribute("data-viewport-x")),
        y: Number(canvas.getAttribute("data-viewport-y")),
      };

      await user.click(screen.getByRole("button", { name: "主标题" }));
      expect(canvas).toHaveAttribute("data-viewport-x", String(initialPosition.x));
      expect(canvas).toHaveAttribute("data-viewport-y", String(initialPosition.y));

      await user.click(screen.getByRole("button", { name: "版权信息" }));
      await waitFor(() =>
        expect(Number(canvas.getAttribute("data-viewport-y"))).toBeLessThan(-1_000),
      );
    } finally {
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  it("highlights the matching canvas element while hovering a layer", async () => {
    const user = userEvent.setup();
    render(<App />);

    const canvas = screen.getByTestId("canvas-stage");
    const layer = screen.getByRole("button", { name: "纸张背景" });

    await user.hover(layer);
    expect(canvas).toHaveAttribute("data-hovered-id", "story-background");

    await user.unhover(layer);
    expect(canvas).toHaveAttribute("data-hovered-id", "");
  });

  it("collapses and expands a layer group", async () => {
    const user = userEvent.setup();
    render(<App />);

    const groupButton = screen.getByRole("button", { name: "开篇" });
    await user.click(groupButton);

    expect(groupButton.closest('[data-slot="layer-row"]')).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("button", { name: "病例声明" })).toBeInTheDocument();

    const childRow = screen
      .getByRole("button", { name: "病例声明" })
      .closest('[data-slot="layer-row"]');
    expect(childRow?.querySelector('[data-slot="layer-indent-spacer"]')).toHaveStyle({
      width: "12px",
    });

    await user.click(screen.getByRole("button", { name: "收起 开篇" }));
    expect(screen.queryByRole("button", { name: "病例声明" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开 开篇" }));
    expect(screen.getByRole("button", { name: "病例声明" })).toBeInTheDocument();
  });

  it("selects from the whole layer row without action buttons clicking through", async () => {
    const user = userEvent.setup();
    render(<App />);

    const backgroundRow = screen
      .getByRole("button", { name: "纸张背景" })
      .closest('[data-slot="layer-row"]');
    const titleRow = screen
      .getByRole("button", { name: "主标题" })
      .closest('[data-slot="layer-row"]');
    if (!backgroundRow || !titleRow) throw new Error("未找到图层行");

    fireEvent.click(backgroundRow);
    expect(backgroundRow).toHaveAttribute("data-selected", "true");

    await user.click(screen.getByRole("button", { name: "主标题" }));
    await user.hover(backgroundRow);
    await user.click(screen.getByRole("button", { name: "隐藏 纸张背景" }));

    expect(titleRow).toHaveAttribute("data-selected", "true");
    expect(backgroundRow).toHaveAttribute("data-selected", "false");

    await user.click(screen.getByRole("button", { name: "解锁 纸张背景" }));
    expect(titleRow).toHaveAttribute("data-selected", "true");
    expect(backgroundRow).toHaveAttribute("data-selected", "false");
  });

  it("edits the element name and shows position values with at most two decimals", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "主标题" }));
    const nameInput = screen.getByLabelText("名称");

    expect(nameInput).toHaveValue("主标题");

    await user.clear(nameInput);
    await user.type(nameInput, "封面标题");
    await user.click(screen.getByRole("button", { name: "模拟实时变换" }));

    expect(screen.getByLabelText("X")).toHaveValue(83.46);
    expect(screen.getByLabelText("Y")).toHaveValue(91.23);
    expect(screen.getByLabelText("宽")).toHaveValue(333.46);
    expect(screen.getByLabelText("高")).toHaveValue(55.68);

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
    render(<App />);

    await user.click(screen.getByRole("button", { name: "主标题" }));
    const rotationInput = screen.getByLabelText("角度");
    const rotationGroup = rotationInput.closest('[data-slot="input-group"]');
    const rotationAddon = rotationGroup?.querySelector('[data-slot="input-group-addon"]');

    expect(rotationInput).toHaveValue("0°");
    expect(screen.getByText("角度")).toBeVisible();
    expect(rotationGroup).not.toBeNull();
    expect(rotationAddon).toHaveAttribute("data-align", "inline-start");
    expect(rotationGroup?.lastElementChild).toBe(rotationAddon);

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
    render(<App />);

    await user.click(screen.getByRole("button", { name: "主标题" }));
    const fontSizeInput = screen.getByLabelText("字号");

    await user.clear(fontSizeInput);
    await user.type(fontSizeInput, "-5");
    await user.tab();

    expect(fontSizeInput).toHaveValue(8);
  });

  it("changes the selected text box font as one undoable property update", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "主标题" }));
    const fontSelect = screen.getByRole("combobox", { name: "字体" });

    expect(fontSelect).toHaveTextContent("Noto 宋体");
    expect(screen.getByRole("combobox", { name: "字重" })).toHaveTextContent("700");
    await user.click(fontSelect);
    await user.click(await screen.findByRole("option", { name: "Noto 黑体" }));

    expect(fontSelect).toHaveTextContent("Noto 黑体");
    await user.click(screen.getByRole("button", { name: "撤销" }));
    expect(fontSelect).toHaveTextContent("Noto 宋体");
  });

  it("enters text editing from Enter or double click and commits one undoable session", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "主标题" }));
    expect(screen.getByRole("textbox", { name: "文本内容" })).toHaveTextContent(
      '当"老年常态"不是常态',
    );
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
    expect(await screen.findByTestId("rich-text-editor")).toHaveTextContent('当"老年常态"不是常态');
    await waitFor(() =>
      expect(screen.getByTestId("canvas-stage")).toHaveAttribute("data-editing-id", "story-title"),
    );

    await user.click(screen.getByRole("button", { name: "模拟富文本提交" }));
    expect(screen.queryByTestId("rich-text-editor")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "文本内容" })).toHaveTextContent("已修改 文本");

    await user.click(screen.getByRole("button", { name: "撤销" }));
    expect(screen.getByRole("textbox", { name: "文本内容" })).toHaveTextContent(
      '当"老年常态"不是常态',
    );

    await user.click(screen.getByRole("button", { name: "模拟双击文本" }));
    expect(await screen.findByTestId("rich-text-editor")).toBeInTheDocument();
  });

  it("does not create history for an unchanged edit and cancels on Escape", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "主标题" }));
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
    render(<App />);

    await user.click(screen.getByRole("button", { name: "主标题" }));
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

    expect(colorButton).toHaveTextContent("#24382F");
    expect(screen.getByRole("button", { name: "撤销" })).toBeDisabled();
  });

  it("shows only the action name in layer tooltips", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.hover(screen.getByRole("button", { name: "纸张背景" }));
    await user.hover(screen.getByRole("button", { name: "隐藏 纸张背景" }));

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("隐藏");
    expect(tooltip).not.toHaveTextContent("纸张背景");
  });

  it("keeps only active hidden and locked layer actions visible outside hover", async () => {
    const user = userEvent.setup();
    render(<App />);

    const backgroundHideButton = screen.getByRole("button", { name: "隐藏 纸张背景" });
    const backgroundUnlockButton = screen.getByRole("button", { name: "解锁 纸张背景" });

    expect(backgroundHideButton).toHaveClass("opacity-0", "pointer-events-none");
    expect(backgroundUnlockButton).toHaveClass("opacity-100", "pointer-events-auto");
    expect(backgroundUnlockButton.querySelector("svg")).toHaveClass("h-[15px]!", "w-[13px]!");

    const titleHideButton = screen.getByRole("button", { name: "隐藏 主标题" });
    const titleLockButton = screen.getByRole("button", { name: "锁定 主标题" });
    expect(titleHideButton).toHaveClass("opacity-0", "pointer-events-none");
    expect(titleLockButton).toHaveClass("opacity-0", "pointer-events-none");

    await user.hover(screen.getByRole("button", { name: "主标题" }));
    await user.click(titleHideButton);

    const titleShowButton = screen.getByRole("button", { name: "显示 主标题" });
    expect(titleShowButton).toHaveClass("opacity-100", "pointer-events-auto");
    expect(screen.getByRole("button", { name: "锁定 主标题" })).toHaveClass("opacity-0");

    await user.click(titleShowButton);
    expect(screen.getByRole("button", { name: "隐藏 主标题" })).toHaveClass("opacity-0");
  });

  it("pans the free canvas with the middle mouse button", () => {
    render(<App />);

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

  it("pans the canvas by dragging an empty area with the primary mouse button", () => {
    render(<App />);

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

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 240,
      clientY: 180,
      pointerId: 8,
    });
    expect(viewport).toHaveAttribute("data-panning", "false");

    fireEvent.pointerMove(viewport, {
      clientX: 206,
      clientY: 222,
      pointerId: 8,
    });

    expect(canvas).toHaveAttribute("data-viewport-x", String(initialX - 34));
    expect(canvas).toHaveAttribute("data-viewport-y", String(initialY + 42));
    expect(viewport).toHaveAttribute("data-pan-ready", "true");
    expect(viewport).toHaveAttribute("data-panning", "true");

    fireEvent.pointerUp(viewport, { pointerId: 8 });
    expect(viewport).toHaveAttribute("data-panning", "false");
  });
});
