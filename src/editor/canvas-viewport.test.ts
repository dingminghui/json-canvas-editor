import { findCanvasElementBounds, getViewportPositionToReveal } from "@/editor/canvas-viewport";
import type { CanvasElement } from "@/editor/types";

const elements: CanvasElement[] = [
  {
    id: "section",
    type: "group",
    name: "章节",
    visible: true,
    locked: false,
    children: [
      {
        id: "rotated-card",
        type: "rect",
        name: "旋转卡片",
        visible: true,
        locked: false,
        x: 100,
        y: 200,
        width: 100,
        height: 40,
        rotation: 90,
        opacity: 1,
        fill: "#fff",
        cornerRadius: 0,
      },
      {
        id: "caption",
        type: "text",
        name: "说明",
        visible: true,
        locked: false,
        x: 240,
        y: 360,
        width: 120,
        height: 40,
        rotation: 0,
        opacity: 1,
        text: "说明",
        fontSize: 16,
        fontWeight: "400",
        align: "left",
        fill: "#111",
      },
    ],
  },
];

describe("canvas viewport helpers", () => {
  it("calculates rotated leaf and descendant group bounds", () => {
    expect(findCanvasElementBounds(elements, "rotated-card")).toEqual({
      bottom: 300,
      left: 60,
      right: 100,
      top: 200,
    });
    expect(findCanvasElementBounds(elements, "section")).toEqual({
      bottom: 400,
      left: 60,
      right: 360,
      top: 200,
    });
  });

  it("keeps the viewport still when the selected element is already visible", () => {
    expect(
      getViewportPositionToReveal(
        { bottom: 200, left: 100, right: 200, top: 100 },
        { height: 600, width: 800 },
        { x: 50, y: 50 },
        1,
      ),
    ).toBeNull();
  });

  it("centers an offscreen element in the usable canvas area", () => {
    expect(
      getViewportPositionToReveal(
        { bottom: 1100, left: 100, right: 200, top: 1000 },
        { height: 600, width: 800 },
        { x: 50, y: 50 },
        1,
      ),
    ).toEqual({ x: 250, y: -730 });
  });
});
