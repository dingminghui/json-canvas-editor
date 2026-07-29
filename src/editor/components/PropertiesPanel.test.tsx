import { PropertiesPanel } from "@/editor/components/PropertiesPanel";
import type {
  ChartElement,
  PolygonElement,
  StarElement,
  TableElement,
  TextElement,
} from "@/editor/types";
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

function createTableElementForTest(): TableElement {
  return {
    cellStyle: {
      align: "center",
      borderColor: "#CBD5E1",
      borderWidth: 1,
      color: "#334155",
      fill: "#FFFFFF",
      fontFamily: "noto-sans-sc",
      fontSize: 16,
      fontWeight: "400",
      valign: "middle",
    },
    columns: [
      { id: "col-1", name: "指标", width: 160 },
      { id: "col-2", name: "当前值", width: 160 },
    ],
    headerStyle: {
      align: "center",
      borderColor: "#CBD5E1",
      borderWidth: 1,
      color: "#0F172A",
      fill: "#E2E8F0",
      fontFamily: "noto-sans-sc",
      fontSize: 18,
      fontWeight: "700",
      valign: "middle",
    },
    height: 180,
    id: "table",
    locked: false,
    name: "表格",
    opacity: 1,
    rotation: 0,
    rows: [{ cells: { "col-1": "转化率", "col-2": "24%" }, height: 56, id: "row-1" }],
    type: "table",
    visible: true,
    width: 320,
    x: 40,
    y: 50,
  };
}

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
    expect(screen.getByRole("button", { name: "拖动调整X" })).toHaveTextContent("X");
    expect(screen.getByRole("button", { name: "拖动调整Y" })).toHaveTextContent("Y");
    expect(screen.getByRole("button", { name: "拖动调整宽" }).querySelector("svg")).not.toHaveClass(
      "rotate-90",
    );
    expect(screen.getByRole("button", { name: "拖动调整高" }).querySelector("svg")).toHaveClass(
      "rotate-90",
    );
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

  it("edits chart data as a structured matrix without exposing rotation", () => {
    const chart: ChartElement = {
      chartType: "bar",
      colors: ["#4F46E5"],
      height: 320,
      id: "chart",
      locked: false,
      name: "图表",
      opacity: 1,
      rotation: 0,
      series: [{ labels: ["Q1", "Q2"], name: "销售额", values: [120, 180] }],
      showLegend: true,
      showValue: true,
      title: "季度销售趋势",
      type: "chart",
      visible: true,
      width: 520,
      x: 40,
      y: 50,
    };
    const onUpdate = vi.fn();
    render(<PropertiesPanel isLocked={false} selectedElement={chart} onUpdate={onUpdate} />);

    expect(screen.queryByLabelText("角度")).not.toBeInTheDocument();
    expect(screen.getByLabelText("图表类型")).toHaveClass("w-full");
    expect(screen.getByLabelText("图例")).toHaveClass("w-full");
    expect(screen.getByLabelText("数值")).toHaveClass("w-full");
    expect(screen.getByLabelText("系列 1 名称")).toHaveValue("销售额");

    fireEvent.click(screen.getByRole("button", { name: /编辑数据/ }));
    fireEvent.change(screen.getByLabelText("类目 1"), { target: { value: "第一季度" } });
    fireEvent.change(screen.getByLabelText("类目 1 系列 1 数值"), {
      target: { value: "125" },
    });
    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "应用数据" }));
    expect(onUpdate).toHaveBeenCalledWith({
      colors: ["#4F46E5"],
      series: [{ labels: ["第一季度", "Q2"], name: "销售额", values: [125, 180] }],
    });
  });

  it("shows all table cell style controls for headers and body cells", () => {
    const table = createTableElementForTest();
    const onUpdate = vi.fn();
    render(<PropertiesPanel isLocked={false} selectedElement={table} onUpdate={onUpdate} />);

    expect(screen.getByText("表头样式")).toBeVisible();
    expect(screen.getByText("单元格样式")).toBeVisible();
    expect(screen.getAllByLabelText("背景色")).toHaveLength(2);
    expect(screen.getAllByLabelText("文字色")).toHaveLength(2);
    expect(screen.getAllByLabelText("字体")).toHaveLength(2);
    expect(screen.getAllByLabelText("字重")).toHaveLength(2);
    expect(screen.getAllByLabelText("字号")).toHaveLength(2);
    expect(screen.getAllByLabelText("水平对齐")).toHaveLength(2);
    expect(screen.getAllByLabelText("垂直对齐")).toHaveLength(2);
    expect(screen.getAllByLabelText("边框宽度")).toHaveLength(2);
    expect(screen.getAllByLabelText("边框色")).toHaveLength(2);

    fireEvent.change(screen.getAllByLabelText("字号")[0], { target: { value: "20" } });
    expect(onUpdate).toHaveBeenCalledWith({
      headerStyle: { ...table.headerStyle, fontSize: 20 },
    });

    fireEvent.change(screen.getAllByLabelText("边框宽度")[1], { target: { value: "2" } });
    expect(onUpdate).toHaveBeenCalledWith({
      cellStyle: { ...table.cellStyle, borderWidth: 2 },
    });
  });

  it("edits table headers, cells, and dimensions as a structured matrix", () => {
    const table = createTableElementForTest();
    const onUpdate = vi.fn();
    render(<PropertiesPanel isLocked={false} selectedElement={table} onUpdate={onUpdate} />);

    expect(screen.getByRole("button", { name: /编辑表格/ })).toHaveTextContent("1 × 2");
    fireEvent.click(screen.getByRole("button", { name: /编辑表格/ }));
    fireEvent.change(screen.getByLabelText("第 2 列名称"), { target: { value: "目标值" } });
    fireEvent.change(screen.getByLabelText("第 1 行第 2 列"), { target: { value: "28%" } });
    const columnWidthInput = screen.getByLabelText("第 2 列宽");
    const rowHeightInput = screen.getByLabelText("第 1 行高");
    expect(columnWidthInput).toHaveAttribute("step", "0.01");
    expect(columnWidthInput.className).toContain("[&::-webkit-inner-spin-button]:appearance-none");

    fireEvent.focus(columnWidthInput);
    fireEvent.change(columnWidthInput, { target: { value: "160.123" } });
    expect(columnWidthInput).toHaveValue(160);
    fireEvent.change(columnWidthInput, { target: { value: "160.25" } });
    expect(columnWidthInput).toHaveValue(160.25);

    fireEvent.focus(rowHeightInput);
    fireEvent.change(rowHeightInput, { target: { value: "64.126" } });
    expect(rowHeightInput).toHaveValue(56);
    fireEvent.change(rowHeightInput, { target: { value: "64.12" } });
    expect(rowHeightInput).toHaveValue(64.12);
    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "应用数据" }));
    expect(onUpdate).toHaveBeenCalledWith({
      columns: [
        { id: "col-1", name: "指标", width: 160 },
        { id: "col-2", name: "目标值", width: 160.25 },
      ],
      rows: [{ cells: { "col-1": "转化率", "col-2": "28%" }, height: 64.12, id: "row-1" }],
    });
  });
});
