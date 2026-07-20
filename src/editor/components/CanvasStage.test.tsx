import { CanvasStage } from "@/editor/components/CanvasStage";
import type { CanvasDocument } from "@/editor/types";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

interface MockGestureHandlers {
  onDragEnd?: (event: { target: unknown }) => void;
  onDragMove?: (event: { target: unknown }) => void;
  onTransform?: (event: { target: unknown }) => void;
  onTransformEnd?: (event: { target: unknown }) => void;
  onWheel?: (event: { evt: WheelEvent; target: unknown }) => void;
}

interface MockClipContext {
  beginPath: () => void;
  closePath: () => void;
  roundRect: (x: number, y: number, width: number, height: number, radius: number) => void;
}

let imageGestureHandlers: MockGestureHandlers = {};
let imageClipFunc: ((context: MockClipContext) => void) | undefined;
let lastTextFontStyle: string | undefined;
let stageWheelHandler: MockGestureHandlers["onWheel"];
let transformerNodeSpies: ReturnType<typeof vi.fn>[] = [];

vi.mock("use-image", () => ({
  default: () => [undefined],
}));

vi.mock("react-konva", async () => {
  const React = await import("react");

  interface MockContainerProps extends MockGestureHandlers {
    children?: ReactNode;
    clipFunc?: (context: MockClipContext) => void;
    height?: number;
    name?: string;
    scaleX?: number;
    scaleY?: number;
    width?: number;
    x?: number;
    y?: number;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
  }

  interface MockRectProps {
    fill?: string;
    listening?: boolean;
  }

  const Container = React.forwardRef<HTMLDivElement, MockContainerProps>(function Container(
    {
      children,
      clipFunc,
      height,
      name,
      onClick,
      onDragEnd,
      onDragMove,
      onTransform,
      onTransformEnd,
      onWheel,
      width,
      x,
      y,
      scaleX,
      scaleY,
    },
    ref,
  ) {
    if (name === "photo") {
      imageGestureHandlers = { onDragEnd, onDragMove, onTransform, onTransformEnd };
      imageClipFunc = clipFunc;
    }
    if (onWheel) stageWheelHandler = onWheel;

    return (
      <div
        data-name={name}
        data-height={height}
        data-scale-x={scaleX}
        data-scale-y={scaleY}
        data-width={width}
        data-x={x}
        data-y={y}
        ref={ref}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onClick ? () => undefined : undefined}
      >
        {children}
      </div>
    );
  });

  const Rect = React.forwardRef<HTMLDivElement, MockRectProps>(function Rect(
    { fill, listening = true },
    ref,
  ) {
    return (
      <div
        data-listening={String(listening)}
        data-testid={fill === "#e5e3dd" ? "image-hit-area" : undefined}
        ref={ref}
      />
    );
  });

  const Transformer = React.forwardRef(function Transformer(_, ref) {
    const nodes = vi.fn();
    transformerNodeSpies.push(nodes);
    React.useImperativeHandle(ref, () => ({
      getLayer: () => ({ batchDraw: vi.fn() }),
      nodes,
    }));
    return null;
  });

  return {
    Group: Container,
    Image: () => null,
    Layer: Container,
    Rect,
    Stage: Container,
    Text: ({ fontStyle }: { fontStyle?: string }) => {
      lastTextFontStyle = fontStyle;
      return null;
    },
    Transformer,
  };
});

const document: CanvasDocument = {
  description: "图片命中区域测试",
  elements: [
    {
      cornerRadius: 12,
      fit: "cover",
      height: 120,
      id: "photo",
      locked: false,
      name: "主图片",
      opacity: 1,
      rotation: 0,
      src: "/images/photo.jpg",
      type: "image",
      visible: true,
      width: 180,
      x: 20,
      y: 20,
    },
  ],
  height: 300,
  id: "image-test",
  name: "图片测试模板",
  width: 400,
};

describe("CanvasStage", () => {
  beforeEach(() => {
    imageClipFunc = undefined;
    imageGestureHandlers = {};
    lastTextFontStyle = undefined;
    stageWheelHandler = undefined;
    transformerNodeSpies = [];
  });

  it("selects an image through its full-size hit area", () => {
    const onSelect = vi.fn();

    const { container } = render(
      <CanvasStage
        document={document}
        hoveredId={null}
        isSelectedLocked={false}
        selectedId={null}
        viewportHeight={620}
        viewportPosition={{ x: 160, y: 140 }}
        viewportWidth={720}
        zoom={1}
        onElementChange={vi.fn()}
        onElementPreview={vi.fn()}
        onSelect={onSelect}
        onZoomAtPoint={vi.fn()}
      />,
    );

    const hitArea = screen.getByTestId("image-hit-area");
    const stage = container.firstElementChild;
    const layer = stage?.firstElementChild;

    expect(hitArea).toHaveAttribute("data-listening", "true");
    expect(stage).toHaveAttribute("data-height", "620");
    expect(stage).toHaveAttribute("data-width", "720");
    expect(layer).toHaveAttribute("data-x", "160");
    expect(layer).toHaveAttribute("data-y", "140");

    fireEvent.click(hitArea);

    expect(onSelect).toHaveBeenCalledWith("photo");
  });

  it("clips image content to the configured rounded rectangle", () => {
    render(
      <CanvasStage
        document={document}
        hoveredId={null}
        isSelectedLocked={false}
        selectedId={null}
        viewportHeight={620}
        viewportPosition={{ x: 160, y: 140 }}
        viewportWidth={720}
        zoom={1}
        onElementChange={vi.fn()}
        onElementPreview={vi.fn()}
        onSelect={vi.fn()}
        onZoomAtPoint={vi.fn()}
      />,
    );

    const context = {
      beginPath: vi.fn(),
      closePath: vi.fn(),
      roundRect: vi.fn(),
    };
    imageClipFunc?.(context);

    expect(context.beginPath).toHaveBeenCalledOnce();
    expect(context.roundRect).toHaveBeenCalledWith(0, 0, 180, 120, 12);
    expect(context.closePath).toHaveBeenCalledOnce();
  });

  it("uses the selected numeric font weight when drawing text", () => {
    const textDocument: CanvasDocument = {
      ...document,
      elements: [
        {
          align: "left",
          fill: "#000000",
          fontSize: 24,
          fontWeight: "600",
          height: 40,
          id: "caption",
          locked: false,
          name: "说明",
          opacity: 1,
          rotation: 0,
          text: "说明文字",
          type: "text",
          visible: true,
          width: 160,
          x: 10,
          y: 10,
        },
      ],
    };

    render(
      <CanvasStage
        document={textDocument}
        hoveredId={null}
        isSelectedLocked={false}
        selectedId={null}
        viewportHeight={620}
        viewportPosition={{ x: 160, y: 140 }}
        viewportWidth={720}
        zoom={1}
        onElementChange={vi.fn()}
        onElementPreview={vi.fn()}
        onSelect={vi.fn()}
        onZoomAtPoint={vi.fn()}
      />,
    );

    expect(lastTextFontStyle).toBe("600");
  });

  it("does not attach editable transform handles to groups or hidden elements", () => {
    const groupedDocument: CanvasDocument = {
      ...document,
      elements: [
        {
          children: document.elements,
          id: "photo-group",
          locked: false,
          name: "图片组",
          type: "group",
          visible: true,
        },
      ],
    };
    const { rerender } = render(
      <CanvasStage
        document={groupedDocument}
        hoveredId={null}
        isSelectedLocked={false}
        selectedId="photo-group"
        viewportHeight={620}
        viewportPosition={{ x: 160, y: 140 }}
        viewportWidth={720}
        zoom={1}
        onElementChange={vi.fn()}
        onElementPreview={vi.fn()}
        onSelect={vi.fn()}
        onZoomAtPoint={vi.fn()}
      />,
    );

    expect(transformerNodeSpies.at(-1)).toHaveBeenLastCalledWith([]);

    rerender(
      <CanvasStage
        document={{
          ...document,
          elements: [{ ...document.elements[0], visible: false }],
        }}
        hoveredId={null}
        isSelectedLocked={false}
        selectedId="photo"
        viewportHeight={620}
        viewportPosition={{ x: 160, y: 140 }}
        viewportWidth={720}
        zoom={1}
        onElementChange={vi.fn()}
        onElementPreview={vi.fn()}
        onSelect={vi.fn()}
        onZoomAtPoint={vi.fn()}
      />,
    );

    expect(transformerNodeSpies.at(-1)).toHaveBeenLastCalledWith([]);
  });

  it("previews image dimensions live and normalizes scale after committing them", () => {
    const actionOrder: string[] = [];
    const onElementChange = vi.fn(() => actionOrder.push("commit"));
    const onElementPreview = vi.fn();
    let scaleX = 0.5;
    let scaleY = 0.75;
    const node = {
      rotation: () => 12.345,
      scaleX: (value?: number) => {
        if (value !== undefined) {
          actionOrder.push("reset-x");
          scaleX = value;
        }
        return scaleX;
      },
      scaleY: (value?: number) => {
        if (value !== undefined) {
          actionOrder.push("reset-y");
          scaleY = value;
        }
        return scaleY;
      },
      x: () => 36.789,
      y: () => 41.234,
    };

    render(
      <CanvasStage
        document={document}
        hoveredId={null}
        isSelectedLocked={false}
        selectedId="photo"
        viewportHeight={620}
        viewportPosition={{ x: 160, y: 140 }}
        viewportWidth={720}
        zoom={1}
        onElementChange={onElementChange}
        onElementPreview={onElementPreview}
        onSelect={vi.fn()}
        onZoomAtPoint={vi.fn()}
      />,
    );

    act(() => imageGestureHandlers.onTransform?.({ target: node }));

    expect(onElementPreview).toHaveBeenLastCalledWith("photo", {
      height: 90,
      rotation: 12.345,
      width: 90,
      x: 36.789,
      y: 41.234,
    });

    act(() => imageGestureHandlers.onTransformEnd?.({ target: node }));

    expect(onElementChange).toHaveBeenCalledOnce();
    expect(onElementChange).toHaveBeenCalledWith("photo", {
      height: 90,
      rotation: 12.345,
      width: 90,
      x: 36.789,
      y: 41.234,
    });
    expect(actionOrder).toEqual(["commit", "reset-x", "reset-y"]);
    expect(onElementPreview).toHaveBeenLastCalledWith("photo", null);
  });

  it("zooms around the current pointer position", () => {
    const onZoomAtPoint = vi.fn();
    const stage = {
      getPointerPosition: () => ({ x: 280, y: 190 }),
    };

    render(
      <CanvasStage
        document={document}
        hoveredId={null}
        isSelectedLocked={false}
        selectedId={null}
        viewportHeight={620}
        viewportPosition={{ x: 160, y: 140 }}
        viewportWidth={720}
        zoom={1}
        onElementChange={vi.fn()}
        onElementPreview={vi.fn()}
        onSelect={vi.fn()}
        onZoomAtPoint={onZoomAtPoint}
      />,
    );

    const wheelEvent = new WheelEvent("wheel", { cancelable: true, deltaY: -100 });
    act(() => stageWheelHandler?.({ evt: wheelEvent, target: { getStage: () => stage } }));

    expect(wheelEvent.defaultPrevented).toBe(true);
    expect(onZoomAtPoint).toHaveBeenCalledWith(expect.any(Number), { x: 280, y: 190 });
    expect(onZoomAtPoint.mock.calls[0][0]).toBeGreaterThan(1);
  });
});
