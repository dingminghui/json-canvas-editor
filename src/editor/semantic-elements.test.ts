import { isChartDataValid } from "@/editor/chart-renderer";
import { PPT_TEMPLATE_DOCUMENT } from "@/editor/ppt-template";
import { getTableLayout, isTableDataValid } from "@/editor/table-layout";
import type { ChartElement, TableElement } from "@/editor/types";

const chart: ChartElement = {
  chartType: "bar",
  colors: ["#4F46E5", "#059669"],
  height: 320,
  id: "chart",
  locked: false,
  name: "图表",
  opacity: 1,
  rotation: 0,
  series: [
    { labels: ["Q1", "Q2"], name: "实际", values: [120, 180] },
    { labels: ["Q1", "Q2"], name: "目标", values: [150, 170] },
  ],
  showLegend: true,
  showValue: true,
  title: "季度趋势",
  type: "chart",
  visible: true,
  width: 520,
  x: 40,
  y: 50,
};

const table: TableElement = {
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
    { id: "col-1", name: "指标", width: 120 },
    { id: "col-2", name: "值", width: 280 },
  ],
  headerStyle: {
    align: "center",
    borderColor: "#CBD5E1",
    borderWidth: 1,
    color: "#0F172A",
    fill: "#E2E8F0",
    fontFamily: "noto-sans-sc",
    fontSize: 16,
    fontWeight: "700",
    valign: "middle",
  },
  height: 180,
  id: "table",
  locked: false,
  name: "表格",
  opacity: 1,
  rotation: 0,
  rows: [
    { cells: { "col-1": "转化率", "col-2": "24%" }, height: 40, id: "row-1" },
    { cells: { "col-1": "访问量", "col-2": "18,420" }, height: 60, id: "row-2" },
  ],
  type: "table",
  visible: true,
  width: 600,
  x: 40,
  y: 50,
};

describe("semantic element data", () => {
  it("includes bar, line, and pie chart examples in PPT template 2", () => {
    const assessmentSlide = PPT_TEMPLATE_DOCUMENT.elements.find(
      (element) => element.type === "group" && element.id === "ppt2-slide-5",
    );
    if (!assessmentSlide || assessmentSlide.type !== "group") {
      throw new Error("assessment slide is missing");
    }

    const chartTypes = assessmentSlide.children
      .filter((element) => element.type === "chart")
      .map((element) => element.chartType);

    expect(chartTypes).toEqual(["bar", "line", "pie"]);
  });

  it("requires shared chart categories for native bar and line charts", () => {
    expect(isChartDataValid(chart)).toBe(true);
    expect(
      isChartDataValid({
        ...chart,
        series: [chart.series[0], { ...chart.series[1], labels: ["一季度", "二季度"] }],
      }),
    ).toBe(false);
  });

  it("validates only the first series used by native pie charts", () => {
    expect(
      isChartDataValid({
        ...chart,
        chartType: "pie",
        series: [chart.series[0], { labels: [], name: "未使用系列", values: [] }],
      }),
    ).toBe(true);
  });

  it("shares one stable table layout between canvas and image rendering", () => {
    expect(isTableDataValid(table)).toBe(true);

    const layout = getTableLayout(table);
    expect(layout.columnWidths).toEqual([180, 420]);
    expect(layout.columnX).toEqual([0, 180]);
    expect(layout.headerHeight).toBeCloseTo(51.43, 2);
    expect(layout.rowY[0]).toBe(layout.headerHeight);
    expect(layout.rowY[1]).toBeCloseTo(102.86, 2);
  });

  it("keeps fallback layout finite for invalid imported dimensions", () => {
    const invalidTable = {
      ...table,
      columns: [{ ...table.columns[0], width: Number.NaN }],
      rows: [{ ...table.rows[0], height: 0 }],
    };

    expect(isTableDataValid(invalidTable)).toBe(false);
    expect(getTableLayout(invalidTable).columnWidths.every(Number.isFinite)).toBe(true);
    expect(getTableLayout(invalidTable).rowHeights.every(Number.isFinite)).toBe(true);
  });
});
