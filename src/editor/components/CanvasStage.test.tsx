import { CanvasStage } from "@/editor/components/CanvasStage";
import type { CanvasDocument } from "@/editor/types";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

interface MockGestureHandlers {
  onDragEnd?: (event: { target: unknown }) => void;
  onDragMove?: (event: { target: unknown }) => void;
  onTransform?: (event: { target: unknown }) => void;
  onTransformEnd?: (event: { target: unknown }) => void;
  onPointerDown?: (event: {
    evt: PointerEvent;
    pointerId: number;
    target: { getStage: () => unknown };
  }) => void;
  onPointerLeave?: () => void;
  onPointerMove?: (event: { target: { getStage: () => unknown } }) => void;
}

interface MockTextRenderProps extends MockGestureHandlers {
  draggable?: boolean;
  onDblClick?: (event: { cancelBubble: boolean }) => void;
  visible?: boolean;
}

interface MockTransformerProps {
  anchorCornerRadius?: number;
  anchorSize?: number;
  anchorStrokeWidth?: number;
  borderStrokeWidth?: number;
  keepRatio?: boolean;
  padding?: number;
  resizeEnabled?: boolean;
  rotateAnchorOffset?: number;
}

interface MockClipContext {
  beginPath: () => void;
  closePath: () => void;
  roundRect: (x: number, y: number, width: number, height: number, radius: number) => void;
}

interface MockImageRenderProps {
  crop?: { height: number; width: number; x: number; y: number };
  height?: number;
  listening?: boolean;
  width?: number;
  x?: number;
  y?: number;
}

let imageGestureHandlers: MockGestureHandlers = {};
let imageClipFunc: ((context: MockClipContext) => void) | undefined;
let imageRenderProps: MockImageRenderProps = {};
let loadedImage: { height: number; width: number } | undefined;
let lastTextFontFamily: string | undefined;
let lastTextFontStyle: string | undefined;
let textGestureHandlers: MockGestureHandlers = {};
let textRenderProps: MockTextRenderProps = {};
let stagePointerHandlers: Pick<
  MockGestureHandlers,
  "onPointerDown" | "onPointerLeave" | "onPointerMove"
> = {};
let hoverTransformerProps: MockTransformerProps = {};
let selectionTransformerProps: MockTransformerProps = {};
let transformerNodeSpies: ReturnType<typeof vi.fn>[] = [];

vi.mock("use-image", () => ({
  default: () => [loadedImage],
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
    cornerRadius?: number;
    fill?: string;
    listening?: boolean;
    name?: string;
    stroke?: string;
    strokeWidth?: number;
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
      onPointerDown,
      onPointerLeave,
      onPointerMove,
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
    if (onPointerDown || onPointerLeave || onPointerMove) {
      stagePointerHandlers = { onPointerDown, onPointerLeave, onPointerMove };
    }

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
    { cornerRadius, fill, listening = true, name, stroke, strokeWidth },
    ref,
  ) {
    return (
      <div
        data-corner-radius={cornerRadius}
        data-listening={String(listening)}
        data-stroke={stroke}
        data-stroke-width={strokeWidth}
        data-testid={fill === "#e5e3dd" ? "image-hit-area" : name ? `rect-${name}` : undefined}
        ref={ref}
      />
    );
  });

  const Transformer = React.forwardRef(function Transformer(props: MockTransformerProps, ref) {
    const nodes = vi.fn();
    transformerNodeSpies.push(nodes);
    if (props.resizeEnabled === false) hoverTransformerProps = props;
    else selectionTransformerProps = props;
    React.useImperativeHandle(ref, () => ({
      getLayer: () => ({ batchDraw: vi.fn() }),
      nodes,
    }));
    return null;
  });

  return {
    Group: Container,
    Image: (props: MockImageRenderProps) => {
      if (props.listening === false) imageRenderProps = props;
      return null;
    },
    Layer: Container,
    Rect,
    Stage: Container,
    Text: ({
      draggable,
      fontFamily,
      fontStyle,
      onDblClick,
      onTransform,
      onTransformEnd,
      visible,
    }: {
      draggable?: boolean;
      fontFamily?: string;
      fontStyle?: string;
      onDblClick?: MockTextRenderProps["onDblClick"];
      onTransform?: MockGestureHandlers["onTransform"];
      onTransformEnd?: MockGestureHandlers["onTransformEnd"];
      visible?: boolean;
    }) => {
      lastTextFontFamily = fontFamily;
      lastTextFontStyle = fontStyle;
      textGestureHandlers = { onTransform, onTransformEnd };
      textRenderProps = { draggable, onDblClick, visible };
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
    imageRenderProps = {};
    loadedImage = undefined;
    lastTextFontFamily = undefined;
    lastTextFontStyle = undefined;
    textGestureHandlers = {};
    textRenderProps = {};
    stagePointerHandlers = {};
    hoverTransformerProps = {};
    selectionTransformerProps = {};
    transformerNodeSpies = [];
  });

  it("selects an image through its full-size hit area", () => {
    const onSelect = vi.fn();

    const { container } = render(
      <CanvasStage
        document={document}
        editingElementId={null}
        hoveredId={null}
        isSelectedLocked={false}
        selectedId={null}
        viewportHeight={620}
        viewportPosition={{ x: 160, y: 140 }}
        viewportWidth={720}
        zoom={1}
        onEditText={vi.fn()}
        onElementChange={vi.fn()}
        onElementPreview={vi.fn()}
        onSelect={onSelect}
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
        editingElementId={null}
        hoveredId={null}
        isSelectedLocked={false}
        selectedId={null}
        viewportHeight={620}
        viewportPosition={{ x: 160, y: 140 }}
        viewportWidth={720}
        zoom={1}
        onEditText={vi.fn()}
        onElementChange={vi.fn()}
        onElementPreview={vi.fn()}
        onSelect={vi.fn()}
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

  it("renders rectangle stroke and rounded corners from the document definition", () => {
    const rectDocument: CanvasDocument = {
      ...document,
      elements: [
        {
          cornerRadius: 18,
          fill: "#ffffff",
          height: 80,
          id: "card",
          locked: false,
          name: "描边卡片",
          opacity: 1,
          rotation: 0,
          stroke: "#2948ab",
          strokeWidth: 5,
          type: "rect",
          visible: true,
          width: 160,
          x: 20,
          y: 20,
        },
      ],
    };

    render(
      <CanvasStage
        document={rectDocument}
        editingElementId={null}
        hoveredId={null}
        isSelectedLocked={false}
        selectedId={null}
        viewportHeight={620}
        viewportPosition={{ x: 160, y: 140 }}
        viewportWidth={720}
        zoom={1}
        onEditText={vi.fn()}
        onElementChange={vi.fn()}
        onElementPreview={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByTestId("rect-card")).toHaveAttribute("data-corner-radius", "18");
    expect(screen.getByTestId("rect-card")).toHaveAttribute("data-stroke", "#2948ab");
    expect(screen.getByTestId("rect-card")).toHaveAttribute("data-stroke-width", "5");
  });

  it("crops a cover image into the element frame instead of overflowing its client bounds", () => {
    const imageElement = document.elements[0];
    if (imageElement.type !== "image") throw new Error("图片测试文档缺少图片元素");
    loadedImage = { height: 400, width: 400 };

    render(
      <CanvasStage
        document={{
          ...document,
          elements: [{ ...imageElement, height: 100, width: 200 }],
        }}
        editingElementId={null}
        hoveredId={null}
        isSelectedLocked={false}
        selectedId="photo"
        viewportHeight={620}
        viewportPosition={{ x: 160, y: 140 }}
        viewportWidth={720}
        zoom={1}
        onEditText={vi.fn()}
        onElementChange={vi.fn()}
        onElementPreview={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(imageRenderProps).toMatchObject({
      crop: { height: 200, width: 400, x: 0, y: 100 },
      height: 100,
      width: 200,
      x: 0,
      y: 0,
    });
  });

  it("uses the selected numeric font weight when drawing text", () => {
    const textDocument: CanvasDocument = {
      ...document,
      elements: [
        {
          align: "left",
          fill: "#000000",
          fontFamily: "noto-serif-sc",
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
        editingElementId={null}
        hoveredId={null}
        isSelectedLocked={false}
        selectedId={null}
        viewportHeight={620}
        viewportPosition={{ x: 160, y: 140 }}
        viewportWidth={720}
        zoom={1}
        onEditText={vi.fn()}
        onElementChange={vi.fn()}
        onElementPreview={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(lastTextFontStyle).toBe("600");
    expect(lastTextFontFamily).toBe('"Noto Serif SC Variable", "Songti SC", serif');
  });

  it("opens unlocked text on double click and hides its canvas node while editing", () => {
    const textDocument: CanvasDocument = {
      ...document,
      elements: [
        {
          align: "left",
          fill: "#000000",
          fontFamily: "noto-sans-sc",
          fontSize: 24,
          fontWeight: "600",
          height: 80,
          id: "caption",
          locked: false,
          name: "说明",
          opacity: 1,
          rotation: 0,
          text: "**可编辑**文本",
          type: "text",
          visible: true,
          width: 200,
          x: 10,
          y: 10,
        },
      ],
    };
    const onEditText = vi.fn();
    const sharedProps = {
      document: textDocument,
      hoveredId: null,
      isSelectedLocked: false,
      selectedId: "caption",
      viewportHeight: 620,
      viewportPosition: { x: 160, y: 140 },
      viewportWidth: 720,
      zoom: 1,
      onEditText,
      onElementChange: vi.fn(),
      onElementPreview: vi.fn(),
      onSelect: vi.fn(),
    };
    const { rerender } = render(<CanvasStage {...sharedProps} editingElementId={null} />);
    const event = { cancelBubble: false };

    act(() => textRenderProps.onDblClick?.(event));

    expect(event.cancelBubble).toBe(true);
    expect(onEditText).toHaveBeenCalledWith("caption");
    expect(textRenderProps.draggable).toBe(true);

    rerender(<CanvasStage {...sharedProps} editingElementId="caption" />);

    expect(textRenderProps.visible).toBe(false);
    expect(textRenderProps.draggable).toBe(false);
    expect(transformerNodeSpies.at(-1)).toHaveBeenLastCalledWith([]);

    onEditText.mockClear();
    rerender(
      <CanvasStage
        {...sharedProps}
        document={{
          ...textDocument,
          elements: [{ ...textDocument.elements[0], locked: true }],
        }}
        editingElementId={null}
        isSelectedLocked
      />,
    );
    act(() => textRenderProps.onDblClick?.({ cancelBubble: false }));

    expect(onEditText).not.toHaveBeenCalled();
  });

  it("reflows text using real dimensions instead of stretching its glyphs", () => {
    const textDocument: CanvasDocument = {
      ...document,
      elements: [
        {
          align: "left",
          fill: "#000000",
          fontFamily: "noto-sans-sc",
          fontSize: 24,
          fontWeight: "600",
          height: 80,
          id: "caption",
          locked: false,
          name: "说明",
          opacity: 1,
          rotation: 0,
          text: "一段需要重新排版的说明文字",
          type: "text",
          visible: true,
          width: 200,
          x: 10,
          y: 10,
        },
      ],
    };
    const onElementChange = vi.fn();
    const onElementPreview = vi.fn();
    let width = 200;
    let height = 80;
    let scaleX = 0.5;
    let scaleY = 0.75;
    const node = {
      height: (value?: number) => {
        if (value !== undefined) height = value;
        return height;
      },
      rotation: () => 5,
      scaleX: (value?: number) => {
        if (value !== undefined) scaleX = value;
        return scaleX;
      },
      scaleY: (value?: number) => {
        if (value !== undefined) scaleY = value;
        return scaleY;
      },
      width: (value?: number) => {
        if (value !== undefined) width = value;
        return width;
      },
      x: () => 24,
      y: () => 36,
    };

    render(
      <CanvasStage
        document={textDocument}
        editingElementId={null}
        hoveredId={null}
        isSelectedLocked={false}
        selectedId="caption"
        viewportHeight={620}
        viewportPosition={{ x: 160, y: 140 }}
        viewportWidth={720}
        zoom={1}
        onEditText={vi.fn()}
        onElementChange={onElementChange}
        onElementPreview={onElementPreview}
        onSelect={vi.fn()}
      />,
    );

    act(() => textGestureHandlers.onTransform?.({ target: node }));

    expect(width).toBe(100);
    expect(height).toBe(60);
    expect(scaleX).toBe(1);
    expect(scaleY).toBe(1);
    expect(onElementPreview).toHaveBeenLastCalledWith("caption", {
      height: 60,
      rotation: 5,
      width: 100,
      x: 24,
      y: 36,
    });

    act(() => textGestureHandlers.onTransformEnd?.({ target: node }));

    expect(onElementChange).toHaveBeenCalledWith("caption", {
      height: 60,
      rotation: 5,
      width: 100,
      x: 24,
      y: 36,
    });
    expect(onElementPreview).toHaveBeenLastCalledWith("caption", null);
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
        editingElementId={null}
        hoveredId={null}
        isSelectedLocked={false}
        selectedId="photo-group"
        viewportHeight={620}
        viewportPosition={{ x: 160, y: 140 }}
        viewportWidth={720}
        zoom={1}
        onEditText={vi.fn()}
        onElementChange={vi.fn()}
        onElementPreview={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(transformerNodeSpies.at(-1)).toHaveBeenLastCalledWith([]);

    rerender(
      <CanvasStage
        document={{
          ...document,
          elements: [{ ...document.elements[0], visible: false }],
        }}
        editingElementId={null}
        hoveredId={null}
        isSelectedLocked={false}
        selectedId="photo"
        viewportHeight={620}
        viewportPosition={{ x: 160, y: 140 }}
        viewportWidth={720}
        zoom={1}
        onEditText={vi.fn()}
        onElementChange={vi.fn()}
        onElementPreview={vi.fn()}
        onSelect={vi.fn()}
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
        editingElementId={null}
        hoveredId={null}
        isSelectedLocked={false}
        selectedId="photo"
        viewportHeight={620}
        viewportPosition={{ x: 160, y: 140 }}
        viewportWidth={720}
        zoom={1}
        onEditText={vi.fn()}
        onElementChange={onElementChange}
        onElementPreview={onElementPreview}
        onSelect={vi.fn()}
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
    expect(actionOrder).toEqual(["reset-x", "reset-y", "commit"]);
    expect(onElementPreview).toHaveBeenLastCalledWith("photo", null);
  });

  it("keeps hover and selection chrome at fixed screen sizes while zoom changes", () => {
    const sharedProps = {
      document,
      editingElementId: null,
      hoveredId: null,
      isSelectedLocked: false,
      selectedId: "photo",
      viewportHeight: 620,
      viewportPosition: { x: 160, y: 140 },
      viewportWidth: 720,
      onEditText: vi.fn(),
      onElementChange: vi.fn(),
      onElementPreview: vi.fn(),
      onSelect: vi.fn(),
    };
    const { rerender } = render(<CanvasStage {...sharedProps} zoom={0.5} />);

    expect(hoverTransformerProps).toMatchObject({
      borderStrokeWidth: 1.25,
      padding: 2,
    });
    expect(selectionTransformerProps).toMatchObject({
      anchorCornerRadius: 4,
      anchorSize: 12,
      anchorStrokeWidth: 1,
      borderStrokeWidth: 1.5,
      keepRatio: false,
      rotateAnchorOffset: 28,
    });

    rerender(<CanvasStage {...sharedProps} zoom={2} />);

    expect(hoverTransformerProps).toMatchObject({
      borderStrokeWidth: 1.25,
      padding: 2,
    });
    expect(selectionTransformerProps).toMatchObject({
      anchorCornerRadius: 4,
      anchorSize: 12,
      anchorStrokeWidth: 1,
      borderStrokeWidth: 1.5,
      rotateAnchorOffset: 28,
    });
  });

  it("starts panning only when the primary pointer is over empty or locked content", () => {
    const onPanReadyChange = vi.fn();
    const onPanStart = vi.fn();
    const stage = { getStage: () => stage };
    const element = { draggable: () => true, getParent: () => stage, getStage: () => stage };
    const lockedBackground = {
      draggable: () => false,
      getParent: () => stage,
      getStage: () => stage,
    };

    render(
      <CanvasStage
        document={document}
        editingElementId={null}
        hoveredId={null}
        isSelectedLocked={false}
        selectedId={null}
        viewportHeight={620}
        viewportPosition={{ x: 160, y: 140 }}
        viewportWidth={720}
        zoom={2}
        onEditText={vi.fn()}
        onElementChange={vi.fn()}
        onElementPreview={vi.fn()}
        onPanReadyChange={onPanReadyChange}
        onPanStart={onPanStart}
        onSelect={vi.fn()}
      />,
    );

    act(() => stagePointerHandlers.onPointerMove?.({ target: stage }));
    expect(onPanReadyChange).toHaveBeenLastCalledWith(true);

    act(() => stagePointerHandlers.onPointerMove?.({ target: element }));
    expect(onPanReadyChange).toHaveBeenLastCalledWith(false);

    const blankPointerEvent = new PointerEvent("pointerdown", {
      button: 0,
      cancelable: true,
      clientX: 280,
      clientY: 190,
    });
    act(() =>
      stagePointerHandlers.onPointerDown?.({
        evt: blankPointerEvent,
        pointerId: 9,
        target: stage,
      }),
    );

    expect(blankPointerEvent.defaultPrevented).toBe(false);
    expect(onPanStart).toHaveBeenCalledWith(9, { x: 280, y: 190 });

    act(() =>
      stagePointerHandlers.onPointerDown?.({
        evt: new PointerEvent("pointerdown", { button: 0 }),
        pointerId: 10,
        target: lockedBackground,
      }),
    );
    expect(onPanStart).toHaveBeenLastCalledWith(10, { x: 0, y: 0 });

    act(() =>
      stagePointerHandlers.onPointerDown?.({
        evt: new PointerEvent("pointerdown", { button: 0 }),
        pointerId: 11,
        target: element,
      }),
    );
    act(() =>
      stagePointerHandlers.onPointerDown?.({
        evt: new PointerEvent("pointerdown", { button: 2 }),
        pointerId: 12,
        target: stage,
      }),
    );

    expect(onPanStart).toHaveBeenCalledTimes(2);

    act(() => stagePointerHandlers.onPointerLeave?.());
    expect(onPanReadyChange).toHaveBeenLastCalledWith(false);
  });
});
