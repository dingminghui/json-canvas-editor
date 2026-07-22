import { PropertiesPanel } from "@/editor/components/PropertiesPanel";
import type { PolygonElement, StarElement, TextElement } from "@/editor/types";
import { fireEvent, render, screen } from "@testing-library/react";

const polygon: PolygonElement = {
  cornerRadius: 0,
  fill: "#D8D4F5",
  height: 120,
  id: "polygon",
  locked: false,
  name: "多边形",
  opacity: 1,
  rotation: 0,
  sides: 3,
  stroke: "#6D5FD4",
  strokeWidth: 2,
  type: "polygon",
  visible: true,
  width: 120,
  x: 40,
  y: 50,
};

describe("PropertiesPanel shape fields", () => {
  it("updates text line height", () => {
    const text: TextElement = {
      align: "left",
      fill: "#111827",
      fontFamily: "noto-sans-sc",
      fontSize: 24,
      fontWeight: "400",
      height: 80,
      id: "text",
      lineHeight: 1.42,
      locked: false,
      name: "正文",
      opacity: 1,
      rotation: 0,
      text: "正文内容",
      type: "text",
      visible: true,
      width: 240,
      x: 40,
      y: 50,
    };
    const onUpdate = vi.fn();
    render(<PropertiesPanel isLocked={false} selectedElement={text} onUpdate={onUpdate} />);

    fireEvent.change(screen.getByLabelText("行高"), { target: { value: "1.6" } });
    expect(onUpdate).toHaveBeenCalledWith({ lineHeight: 1.6 });
  });

  it("shows polygon fields and commits integer sides", () => {
    const onUpdate = vi.fn();
    render(<PropertiesPanel isLocked={false} selectedElement={polygon} onUpdate={onUpdate} />);

    expect(screen.getByText("多边形", { selector: "[data-slot=badge]" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("边数"), { target: { value: "6" } });
    expect(onUpdate).toHaveBeenCalledWith({ sides: 6 });
  });

  it("updates a star outer radius together with its bounds", () => {
    const star: StarElement = {
      ...polygon,
      id: "star",
      innerRadius: 25,
      name: "星形",
      numPoints: 5,
      outerRadius: 60,
      type: "star",
    };
    const onUpdate = vi.fn();
    render(<PropertiesPanel isLocked={false} selectedElement={star} onUpdate={onUpdate} />);

    fireEvent.change(screen.getByLabelText("外半径"), { target: { value: "80" } });
    expect(onUpdate).toHaveBeenCalledWith({ height: 160, outerRadius: 80, width: 160 });
  });
});
