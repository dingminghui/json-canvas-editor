import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorWorkspace } from "@/editor/components/EditorWorkspace";
import type { CanvasDocument, CanvasLeafElement } from "@/editor/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";

vi.mock("@/editor/components/CanvasStage", () => ({
  CanvasStage: () => <div data-testid="canvas-stage" />,
}));

vi.mock("@/editor/components/DocumentJsonPreviewDialog", () => ({
  DocumentJsonPreviewDialog: () => <button type="button">JSON</button>,
}));

const document: CanvasDocument = {
  description: "创建工具测试",
  elements: [],
  height: 300,
  id: "workspace-test",
  name: "创建工具测试",
  width: 400,
};

function renderWorkspace(
  onAddElement = vi.fn<(element: CanvasLeafElement, editText?: boolean) => void>(),
) {
  const result = render(
    <TooltipProvider>
      <EditorWorkspace
        canRedo={false}
        canUndo={false}
        document={document}
        editingText={null}
        fitMode={false}
        hoveredId={null}
        isSelectedLocked={false}
        manualZoom={1}
        selectedId={null}
        workspaceHandleRef={createRef()}
        onAddElement={onAddElement}
        onCancelTextEdit={vi.fn()}
        onCommitTextEdit={vi.fn()}
        onEditText={vi.fn()}
        onElementChange={vi.fn()}
        onElementPreview={vi.fn()}
        onRedo={vi.fn()}
        onSelect={vi.fn()}
        onSetFitMode={vi.fn()}
        onSetZoom={vi.fn()}
        onUndo={vi.fn()}
      />
    </TooltipProvider>,
  );

  const viewport = result.container.querySelector<HTMLElement>("[data-creation-active]");
  if (!viewport) throw new Error("Missing viewport");
  Object.defineProperties(viewport, {
    hasPointerCapture: { value: () => true },
    releasePointerCapture: { value: vi.fn() },
    setPointerCapture: { value: vi.fn() },
  });
  return { ...result, onAddElement, viewport };
}

describe("EditorWorkspace creation toolbar", () => {
  beforeEach(() => {
    class ResizeObserverMock {
      private readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe() {
        this.callback(
          [{ contentRect: { height: 600, width: 800 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }

      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("opens the upward shape menu and marks the active item", async () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "图形" }));
    expect(await screen.findByRole("button", { name: "矩形" })).toBeVisible();
    expect(screen.getByRole("button", { name: "星形" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "椭圆" }));
    expect(screen.getByRole("button", { name: "图形" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "图形" }));
    expect(await screen.findByRole("button", { name: "椭圆" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("draws one shape, selects it through add-element, and resets the tool", async () => {
    const { onAddElement, viewport } = renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "图形" }));
    fireEvent.click(await screen.findByRole("button", { name: "矩形" }));

    fireEvent.pointerDown(viewport, { button: 0, clientX: 250, clientY: 200, pointerId: 3 });
    fireEvent.pointerMove(viewport, { clientX: 370, clientY: 290, pointerId: 3 });
    fireEvent.pointerUp(viewport, { button: 0, clientX: 370, clientY: 290, pointerId: 3 });

    expect(onAddElement).toHaveBeenCalledWith(
      expect.objectContaining({ height: 90, type: "rect", width: 120, x: 50, y: 50 }),
      false,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "图形" })).toHaveAttribute("aria-pressed", "false"),
    );
  });

  it("creates a default text box on click and immediately requests text editing", () => {
    const { onAddElement, viewport } = renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "文本" }));

    fireEvent.pointerDown(viewport, { button: 0, clientX: 240, clientY: 200, pointerId: 5 });
    fireEvent.pointerUp(viewport, { button: 0, clientX: 240, clientY: 200, pointerId: 5 });

    expect(onAddElement).toHaveBeenCalledWith(
      expect.objectContaining({ height: 56, text: "新建文本", type: "text", width: 320 }),
      true,
    );
  });

  it("shows an accessible error for unsupported image files", async () => {
    const { container } = renderWorkspace();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("Missing image input");

    fireEvent.change(input, {
      target: { files: [new File(["bad"], "bad.gif", { type: "image/gif" })] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("仅支持 PNG、JPEG 或 WebP 图片");
  });

  it("decodes, scales, centers, and adds a valid image", async () => {
    class FileReaderMock {
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;
      result: string | ArrayBuffer | null = null;

      readAsDataURL() {
        this.result = "data:image/png;base64,dGVzdA==";
        this.onload?.();
      }
    }
    class ImageMock {
      naturalHeight = 900;
      naturalWidth = 1200;
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("FileReader", FileReaderMock);
    vi.stubGlobal("Image", ImageMock);

    const { container, onAddElement } = renderWorkspace();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("Missing image input");
    fireEvent.change(input, {
      target: { files: [new File(["image"], "photo.png", { type: "image/png" })] },
    });

    await waitFor(() =>
      expect(onAddElement).toHaveBeenCalledWith(
        expect.objectContaining({
          fit: "contain",
          height: 300,
          src: "data:image/png;base64,dGVzdA==",
          type: "image",
          width: 400,
        }),
      ),
    );
  });
});
