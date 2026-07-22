import {
  createElementFromDrag,
  createImageElement,
  getImagePlacement,
} from "@/editor/element-creation";
import type { CanvasDocument } from "@/editor/types";

const document: CanvasDocument = {
  description: "测试",
  elements: [],
  height: 600,
  id: "test-page",
  name: "测试页面",
  width: 800,
};

describe("element creation", () => {
  it("normalizes reverse corner dragging and clamps the end to the page", () => {
    expect(
      createElementFromDrag("rect", { x: 300, y: 260 }, { x: 120, y: 80 }, document, "rect-1"),
    ).toMatchObject({ height: 180, type: "rect", width: 180, x: 120, y: 80 });

    expect(
      createElementFromDrag(
        "ellipse",
        { x: 760, y: 560 },
        { x: 900, y: 900 },
        document,
        "ellipse-1",
      ),
    ).toMatchObject({ height: 40, type: "ellipse", width: 40, x: 760, y: 560 });
  });

  it("ignores accidental shape drags shorter than eight pixels", () => {
    expect(
      createElementFromDrag("rect", { x: 100, y: 100 }, { x: 104, y: 103 }, document, "tiny"),
    ).toBeNull();
  });

  it("creates every shape with the fixed defaults", () => {
    const rect = createElementFromDrag(
      "rect",
      { x: 20, y: 20 },
      { x: 120, y: 90 },
      document,
      "rect",
    );
    const ellipse = createElementFromDrag(
      "ellipse",
      { x: 20, y: 20 },
      { x: 120, y: 90 },
      document,
      "ellipse",
    );
    const line = createElementFromDrag(
      "line",
      { x: 120, y: 80 },
      { x: 20, y: 30 },
      document,
      "line",
    );
    const arrow = createElementFromDrag(
      "arrow",
      { x: 20, y: 30 },
      { x: 120, y: 80 },
      document,
      "arrow",
    );
    const polygon = createElementFromDrag(
      "polygon",
      { x: 200, y: 200 },
      { x: 260, y: 200 },
      document,
      "polygon",
    );
    const star = createElementFromDrag(
      "star",
      { x: 300, y: 200 },
      { x: 350, y: 200 },
      document,
      "star",
    );

    expect(rect).toMatchObject({
      cornerRadius: 0,
      fill: "#E5E7EB",
      stroke: "#6B7280",
      strokeWidth: 2,
      type: "rect",
    });
    expect(ellipse).toMatchObject({
      fill: "#E5E7EB",
      stroke: "#6B7280",
      strokeWidth: 2,
      type: "ellipse",
    });
    expect(line).toMatchObject({
      lineCap: "round",
      points: [100, 50, 0, 0],
      stroke: "#4B5563",
      strokeWidth: 3,
      type: "line",
    });
    expect(arrow).toMatchObject({
      pointerLength: 14,
      pointerWidth: 12,
      stroke: "#4B5563",
      type: "arrow",
    });
    expect(polygon).toMatchObject({
      cornerRadius: 0,
      fill: "#E5E7EB",
      height: 120,
      sides: 3,
      stroke: "#6B7280",
      type: "polygon",
      width: 120,
    });
    expect(star).toMatchObject({
      fill: "#E5E7EB",
      innerRadius: 21,
      numPoints: 5,
      outerRadius: 50,
      stroke: "#6B7280",
      type: "star",
    });
  });

  it("keeps radial shapes inside the page", () => {
    expect(
      createElementFromDrag("star", { x: 20, y: 20 }, { x: 200, y: 20 }, document, "star-edge"),
    ).toMatchObject({ height: 40, outerRadius: 20, width: 40, x: 0, y: 0 });
  });

  it("creates default and dragged text boxes", () => {
    expect(
      createElementFromDrag("text", { x: 700, y: 580 }, { x: 701, y: 581 }, document, "text-click"),
    ).toMatchObject({
      height: 56,
      lineHeight: 1.04,
      text: "新建文本",
      type: "text",
      width: 320,
      x: 480,
      y: 544,
    });
    expect(
      createElementFromDrag("text", { x: 300, y: 250 }, { x: 120, y: 100 }, document, "text-drag"),
    ).toMatchObject({ height: 150, type: "text", width: 180, x: 120, y: 100 });
  });

  it("scales and centers images without upscaling", () => {
    expect(
      getImagePlacement({ height: 900, width: 1200 }, document, {
        bottom: 500,
        left: 100,
        right: 700,
        top: 100,
      }),
    ).toEqual({ height: 360, width: 480, x: 160, y: 120 });

    expect(
      createImageElement(
        "image-1",
        "data:image/png;base64,test",
        { height: 100, width: 160 },
        document,
        { bottom: 400, left: 200, right: 600, top: 200 },
      ),
    ).toMatchObject({ fit: "contain", height: 100, type: "image", width: 160, x: 320, y: 250 });
  });
});
