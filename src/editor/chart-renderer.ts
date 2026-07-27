import type { ChartElement, ChartSeries } from "@/editor/types";
import * as echarts from "echarts";

const MIN_RENDER_SIZE = 8;

export function getNativeChartSeries(element: ChartElement): ChartSeries[] {
  return element.chartType === "pie" ? element.series.slice(0, 1) : element.series;
}

export function isChartDataValid(element: ChartElement): boolean {
  const nativeSeries = getNativeChartSeries(element);
  const labels = nativeSeries[0]?.labels;
  if (!labels || labels.length === 0) return false;

  return nativeSeries.every(
    (series) =>
      series.labels.length > 0 &&
      series.values.length > 0 &&
      series.labels.length === series.values.length &&
      series.values.every(Number.isFinite) &&
      series.labels.every((label, index) => label === labels[index]),
  );
}

function getChartOption(element: ChartElement): echarts.EChartsCoreOption {
  const nativeSeries = getNativeChartSeries(element);
  const labels = nativeSeries[0]?.labels ?? [];
  const colors = element.colors.length > 0 ? element.colors : ["#4F46E5"];

  if (element.chartType === "pie") {
    const source = nativeSeries[0];
    return {
      animation: false,
      color: colors,
      legend: { bottom: 0, show: element.showLegend },
      series: [
        {
          data: source.labels.map((label, index) => ({
            name: label,
            value: source.values[index] ?? 0,
          })),
          label: { show: element.showValue },
          radius: ["0%", "68%"],
          type: "pie",
        },
      ],
      title: { left: "center", show: element.title.trim() !== "", text: element.title },
    };
  }

  return {
    animation: false,
    color: colors,
    grid: {
      bottom: element.showLegend ? 54 : 32,
      containLabel: true,
      left: 16,
      right: 18,
      top: 48,
    },
    legend: { bottom: 0, show: element.showLegend },
    series: nativeSeries.map((series) => ({
      data: series.values,
      label: { position: "top", show: element.showValue },
      name: series.name,
      smooth: element.chartType === "line",
      type: element.chartType,
    })),
    title: { left: "center", show: element.title.trim() !== "", text: element.title },
    tooltip: { show: false },
    xAxis: { data: labels, type: "category" },
    yAxis: { type: "value" },
  };
}

function drawFallbackChart(context: CanvasRenderingContext2D, element: ChartElement) {
  const width = context.canvas.width;
  const height = context.canvas.height;
  const colors = element.colors.length > 0 ? element.colors : ["#4F46E5"];
  const series = getNativeChartSeries(element);
  const source = series[0];

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#0F172A";
  context.font = "600 18px sans-serif";
  context.textAlign = "center";
  if (element.title.trim()) context.fillText(element.title, width / 2, 28);

  if (!source) return;

  if (element.chartType === "pie") {
    const total = source.values.reduce((sum, value) => sum + Math.max(0, value), 0);
    const radius = Math.max(12, Math.min(width, height) * 0.28);
    let startAngle = -Math.PI / 2;
    source.values.forEach((value, index) => {
      const angle = total > 0 ? (Math.max(0, value) / total) * Math.PI * 2 : 0;
      context.beginPath();
      context.moveTo(width / 2, height / 2 + 12);
      context.arc(width / 2, height / 2 + 12, radius, startAngle, startAngle + angle);
      context.closePath();
      context.fillStyle = colors[index % colors.length];
      context.fill();
      startAngle += angle;
    });
    return;
  }

  const chartLeft = 48;
  const chartRight = width - 20;
  const chartTop = 48;
  const chartBottom = height - 42;
  const maxValue = Math.max(1, ...series.flatMap((entry) => entry.values));
  context.strokeStyle = "#CBD5E1";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(chartLeft, chartTop);
  context.lineTo(chartLeft, chartBottom);
  context.lineTo(chartRight, chartBottom);
  context.stroke();

  if (element.chartType === "line") {
    series.forEach((entry, seriesIndex) => {
      context.strokeStyle = colors[seriesIndex % colors.length];
      context.lineWidth = 3;
      context.beginPath();
      entry.values.forEach((value, index) => {
        const x =
          chartLeft + (index / Math.max(1, entry.values.length - 1)) * (chartRight - chartLeft);
        const y = chartBottom - (value / maxValue) * (chartBottom - chartTop);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
    });
    return;
  }

  const labelCount = source.values.length;
  const slotWidth = (chartRight - chartLeft) / Math.max(1, labelCount);
  series.forEach((entry, seriesIndex) => {
    const barWidth = slotWidth / Math.max(1, series.length) - 6;
    entry.values.forEach((value, index) => {
      const x = chartLeft + index * slotWidth + seriesIndex * (barWidth + 6) + 6;
      const barHeight = (value / maxValue) * (chartBottom - chartTop);
      context.fillStyle = colors[seriesIndex % colors.length];
      context.fillRect(x, chartBottom - barHeight, Math.max(1, barWidth), barHeight);
    });
  });
}

function renderFallbackChartToDataUrl(element: ChartElement, pixelRatio: number): string | null {
  const canvas = globalThis.document?.createElement("canvas");
  if (!canvas) return null;

  canvas.width = Math.max(MIN_RENDER_SIZE, Math.round(element.width * pixelRatio));
  canvas.height = Math.max(MIN_RENDER_SIZE, Math.round(element.height * pixelRatio));
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.scale(pixelRatio, pixelRatio);
  drawFallbackChart(context, element);
  return canvas.toDataURL("image/png");
}

export function renderChartToDataUrl(element: ChartElement, pixelRatio = 2): string | null {
  const width = Math.max(MIN_RENDER_SIZE, Math.round(element.width * pixelRatio));
  const height = Math.max(MIN_RENDER_SIZE, Math.round(element.height * pixelRatio));
  let chart: echarts.ECharts | null = null;
  let container: HTMLDivElement | null = null;

  try {
    container = globalThis.document?.createElement("div") ?? null;
    if (!container || !isChartDataValid(element))
      return renderFallbackChartToDataUrl(element, pixelRatio);

    container.style.height = `${height}px`;
    container.style.left = "-10000px";
    container.style.position = "fixed";
    container.style.top = "-10000px";
    container.style.width = `${width}px`;
    globalThis.document.body.appendChild(container);

    chart = echarts.init(container, null, { height, renderer: "canvas", width });
    chart.setOption(getChartOption(element), true);
    return chart.getDataURL({ pixelRatio: 1, type: "png" });
  } catch {
    return renderFallbackChartToDataUrl(element, pixelRatio);
  } finally {
    chart?.dispose();
    container?.remove();
  }
}
