import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CanvasElementPatch,
  ChartElement,
  ChartSeries,
  ChartType,
  TableCellStyle,
  TableColumn,
  TableElement,
  TableRow,
} from "@/editor/types";
import { cn } from "@/lib/utils";
import { BarChart3, Grid2X2, Plus, Rows3, Table2, Trash2 } from "lucide-react";
import { useId, useState } from "react";

const CONTROL_CLASS_NAME =
  "w-full rounded-[calc(var(--radius-sm)-3px)] border-transparent bg-[color-mix(in_oklch,var(--muted)_76%,var(--card))] text-xs shadow-none focus-visible:border-ring";
const LABEL_CLASS_NAME = "text-xs text-muted-foreground";
const GRID_INPUT_CLASS_NAME =
  "h-8 rounded-none border-0 border-r border-b bg-background px-2 text-xs shadow-none focus-visible:relative focus-visible:z-10 focus-visible:ring-2";
const CHART_COLORS = ["#4F46E5", "#059669", "#F59E0B", "#DC2626", "#0284C7", "#7C3AED"];
const TWO_DECIMAL_DIMENSION_PATTERN = /^\d*(?:\.\d{0,2})?$/;
const NUMBER_INPUT_CLASS_NAME =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none";

function createSemanticId(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${suffix}`;
}

function roundToTwoDecimals(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatDimension(value: number) {
  return Number.isFinite(value) ? String(roundToTwoDecimals(value)) : "";
}

function TableDimensionInput({
  "aria-label": ariaLabel,
  className,
  minValue,
  value,
  onChange,
}: {
  "aria-label": string;
  className?: string;
  minValue: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState<string | null>(null);
  const displayValue = draftValue ?? formatDimension(value);
  const numericValue = Number(displayValue);
  const invalid =
    displayValue.trim() === "" || !Number.isFinite(numericValue) || numericValue < minValue;

  function commit(rawValue: string) {
    const nextValue = Number(rawValue);
    if (!Number.isFinite(nextValue)) return;
    onChange(Math.max(minValue, roundToTwoDecimals(nextValue)));
  }

  return (
    <Input
      aria-invalid={invalid}
      aria-label={ariaLabel}
      className={cn(NUMBER_INPUT_CLASS_NAME, className)}
      inputMode="decimal"
      min={minValue}
      step={0.01}
      type="number"
      value={displayValue}
      onBlur={() => {
        if (draftValue !== null) commit(draftValue);
        setDraftValue(null);
      }}
      onChange={(event) => {
        const nextValue = event.currentTarget.value;
        if (!TWO_DECIMAL_DIMENSION_PATTERN.test(nextValue)) return;
        setDraftValue(nextValue);
        if (nextValue !== "") commit(nextValue);
      }}
      onFocus={() => setDraftValue(formatDimension(value))}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") setDraftValue(null);
      }}
    />
  );
}

function getChartColor(colors: string[], index: number) {
  return colors[index] ?? CHART_COLORS[index % CHART_COLORS.length];
}

function setChartColor(colors: string[], index: number, color: string) {
  const nextColors = Array.from({ length: Math.max(colors.length, index + 1) }, (_, colorIndex) =>
    getChartColor(colors, colorIndex),
  );
  nextColors[index] = color;
  return nextColors;
}

function patchChartSeries(
  series: ChartSeries[],
  index: number,
  patch: Partial<ChartSeries>,
): ChartSeries[] {
  return series.map((entry, seriesIndex) =>
    seriesIndex === index ? { ...entry, ...patch } : entry,
  );
}

function createChartSeries(element: ChartElement): ChartSeries {
  const labels = element.series[0]?.labels ?? ["类别 1"];
  return {
    labels: [...labels],
    name: `系列 ${element.series.length + 1}`,
    values: labels.map(() => 0),
  };
}

function ChartTypeSelect({
  disabled,
  value,
  onChange,
}: {
  disabled: boolean;
  value: ChartType;
  onChange: (value: ChartType) => void;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <label className={LABEL_CLASS_NAME} htmlFor={id}>
        图表类型
      </label>
      <Select
        disabled={disabled}
        value={value}
        onValueChange={(next) => onChange(next as ChartType)}
      >
        <SelectTrigger className={CONTROL_CLASS_NAME} id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="bar">柱状图</SelectItem>
            <SelectItem value="line">折线图</SelectItem>
            <SelectItem value="pie">饼图</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function BooleanSelect({
  disabled,
  label,
  value,
  onChange,
}: {
  disabled: boolean;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <label className={LABEL_CLASS_NAME} htmlFor={id}>
        {label}
      </label>
      <Select
        disabled={disabled}
        value={String(value)}
        onValueChange={(next) => onChange(next === "true")}
      >
        <SelectTrigger className={CONTROL_CLASS_NAME} id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="true">显示</SelectItem>
            <SelectItem value="false">隐藏</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function ColorSwatch({
  disabled,
  label,
  value,
  onChange,
}: {
  disabled: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ColorPicker disabled={disabled} value={value} onChange={onChange}>
      <Button
        aria-label={`${label}颜色`}
        className="size-7 rounded-sm border-black/10 p-0 shadow-none"
        disabled={disabled}
        size="icon-sm"
        style={{ backgroundColor: value }}
        type="button"
        variant="outline"
      />
    </ColorPicker>
  );
}

interface ChartDraftSeries {
  name: string;
  values: string[];
}

interface ChartDataDraft {
  colors: string[];
  labels: string[];
  series: ChartDraftSeries[];
}

function createChartDraft(element: ChartElement): ChartDataDraft {
  const labels = element.series[0]?.labels.length > 0 ? [...element.series[0].labels] : ["类别 1"];
  const sourceSeries =
    element.series.length > 0
      ? element.series
      : [{ labels, name: "系列 1", values: labels.map(() => 0) }];

  return {
    colors: Array.from(
      { length: element.chartType === "pie" ? labels.length : sourceSeries.length },
      (_, index) => getChartColor(element.colors, index),
    ),
    labels,
    series: sourceSeries.map((series) => ({
      name: series.name,
      values: labels.map((_, index) =>
        Number.isFinite(series.values[index]) ? String(series.values[index]) : "0",
      ),
    })),
  };
}

function ChartDataEditorContent({
  chartType,
  element,
  onCancel,
  onCommit,
}: {
  chartType: ChartType;
  element: ChartElement;
  onCancel: () => void;
  onCommit: (series: ChartSeries[], colors: string[]) => void;
}) {
  const [draft, setDraft] = useState(() => createChartDraft(element));
  const hasInvalidValues = draft.series.some((series) =>
    series.values.some((value) => value.trim() === "" || !Number.isFinite(Number(value))),
  );

  function addCategory() {
    setDraft((current) => ({
      ...current,
      colors:
        chartType === "pie"
          ? [...current.colors, getChartColor(current.colors, current.labels.length)]
          : current.colors,
      labels: [...current.labels, `类别 ${current.labels.length + 1}`],
      series: current.series.map((series) => ({
        ...series,
        values: [...series.values, "0"],
      })),
    }));
  }

  function removeCategory(index: number) {
    setDraft((current) => {
      if (current.labels.length <= 1) return current;
      return {
        ...current,
        colors:
          chartType === "pie"
            ? current.colors.filter((_, colorIndex) => colorIndex !== index)
            : current.colors,
        labels: current.labels.filter((_, labelIndex) => labelIndex !== index),
        series: current.series.map((series) => ({
          ...series,
          values: series.values.filter((_, valueIndex) => valueIndex !== index),
        })),
      };
    });
  }

  function addSeries() {
    setDraft((current) => ({
      ...current,
      colors: [...current.colors, getChartColor(current.colors, current.series.length)],
      series: [
        ...current.series,
        {
          name: `系列 ${current.series.length + 1}`,
          values: current.labels.map(() => "0"),
        },
      ],
    }));
  }

  function removeSeries(index: number) {
    setDraft((current) => {
      if (current.series.length <= 1) return current;
      return {
        ...current,
        colors: current.colors.filter((_, colorIndex) => colorIndex !== index),
        series: current.series.filter((_, seriesIndex) => seriesIndex !== index),
      };
    });
  }

  function updateLabel(index: number, value: string) {
    setDraft((current) => ({
      ...current,
      labels: current.labels.map((label, labelIndex) => (labelIndex === index ? value : label)),
    }));
  }

  function updateSeries(index: number, patch: Partial<ChartDraftSeries>) {
    setDraft((current) => ({
      ...current,
      series: current.series.map((series, seriesIndex) =>
        seriesIndex === index ? { ...series, ...patch } : series,
      ),
    }));
  }

  function updateValue(seriesIndex: number, valueIndex: number, value: string) {
    setDraft((current) => ({
      ...current,
      series: current.series.map((series, index) =>
        index === seriesIndex
          ? {
              ...series,
              values: series.values.map((entry, index) => (index === valueIndex ? value : entry)),
            }
          : series,
      ),
    }));
  }

  function commit() {
    if (hasInvalidValues) return;
    onCommit(
      draft.series.map((series) => ({
        labels: [...draft.labels],
        name: series.name.trim() || "未命名系列",
        values: series.values.map(Number),
      })),
      draft.colors,
    );
  }

  const visibleSeries = chartType === "pie" ? draft.series.slice(0, 1) : draft.series;
  const gridTemplateColumns = `132px repeat(${visibleSeries.length}, minmax(132px, 1fr)) 36px`;

  return (
    <>
      <DialogHeader className="border-b px-5 py-4 pr-12">
        <DialogTitle>编辑图表数据</DialogTitle>
        <DialogDescription>
          {draft.labels.length} 个类目 · {visibleSeries.length} 个系列
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Button size="sm" type="button" variant="outline" onClick={addCategory}>
          <Rows3 aria-hidden="true" data-icon="inline-start" />
          添加类目
        </Button>
        {chartType !== "pie" ? (
          <Button size="sm" type="button" variant="outline" onClick={addSeries}>
            <Plus aria-hidden="true" data-icon="inline-start" />
            添加系列
          </Button>
        ) : null}
        <span
          className={cn(
            "ml-auto text-xs text-muted-foreground",
            hasInvalidValues && "text-destructive",
          )}
          role="status"
        >
          {hasInvalidValues ? "存在无效数值" : "数据有效"}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-muted/25 p-4">
        <div
          className="grid min-w-max overflow-hidden rounded-sm border border-r-0 border-b-0 bg-background"
          style={{ gridTemplateColumns }}
        >
          <div className="flex h-10 items-center border-r border-b bg-muted px-2 text-xs text-muted-foreground">
            类目
          </div>
          {visibleSeries.map((series, seriesIndex) => (
            <div
              className="flex h-10 min-w-0 items-center gap-1.5 border-r border-b bg-muted px-1.5"
              key={`series-${seriesIndex}`}
            >
              {chartType !== "pie" ? (
                <ColorSwatch
                  disabled={false}
                  label={`系列 ${seriesIndex + 1}`}
                  value={draft.colors[seriesIndex]}
                  onChange={(color) =>
                    setDraft((current) => ({
                      ...current,
                      colors: setChartColor(current.colors, seriesIndex, color),
                    }))
                  }
                />
              ) : null}
              <Input
                aria-label={`系列 ${seriesIndex + 1} 名称`}
                className="h-7 min-w-20 rounded-sm border-transparent bg-background px-2 text-xs shadow-none"
                value={series.name}
                onChange={(event) => updateSeries(seriesIndex, { name: event.currentTarget.value })}
              />
              {chartType !== "pie" ? (
                <Button
                  aria-label={`删除系列 ${seriesIndex + 1}`}
                  disabled={visibleSeries.length <= 1}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                  onClick={() => removeSeries(seriesIndex)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          ))}
          <div className="border-r border-b bg-muted" />

          {draft.labels.map((label, labelIndex) => [
            chartType === "pie" ? (
              <div
                className="flex h-8 items-center gap-1.5 border-r border-b bg-background px-1.5"
                key={`label-${labelIndex}`}
              >
                <ColorSwatch
                  disabled={false}
                  label={`类目 ${labelIndex + 1}`}
                  value={draft.colors[labelIndex]}
                  onChange={(color) =>
                    setDraft((current) => ({
                      ...current,
                      colors: setChartColor(current.colors, labelIndex, color),
                    }))
                  }
                />
                <Input
                  aria-label={`类目 ${labelIndex + 1}`}
                  className="h-7 rounded-none border-0 px-1.5 text-xs shadow-none focus-visible:ring-2"
                  value={label}
                  onChange={(event) => updateLabel(labelIndex, event.currentTarget.value)}
                />
              </div>
            ) : (
              <Input
                aria-label={`类目 ${labelIndex + 1}`}
                className={GRID_INPUT_CLASS_NAME}
                key={`label-${labelIndex}`}
                value={label}
                onChange={(event) => updateLabel(labelIndex, event.currentTarget.value)}
              />
            ),
            ...visibleSeries.map((series, seriesIndex) => {
              const value = series.values[labelIndex] ?? "";
              const invalid = value.trim() === "" || !Number.isFinite(Number(value));
              return (
                <Input
                  aria-invalid={invalid}
                  aria-label={`类目 ${labelIndex + 1} 系列 ${seriesIndex + 1} 数值`}
                  className={cn(GRID_INPUT_CLASS_NAME, "font-mono")}
                  key={`value-${labelIndex}-${seriesIndex}`}
                  inputMode="decimal"
                  value={value}
                  onChange={(event) =>
                    updateValue(seriesIndex, labelIndex, event.currentTarget.value)
                  }
                />
              );
            }),
            <div
              className="flex h-8 items-center justify-center border-r border-b bg-background"
              key={`actions-${labelIndex}`}
            >
              <Button
                aria-label={`删除类目 ${labelIndex + 1}`}
                disabled={draft.labels.length <= 1}
                size="icon-xs"
                type="button"
                variant="ghost"
                onClick={() => removeCategory(labelIndex)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>,
          ])}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t px-5 py-3.5">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button disabled={hasInvalidValues} type="button" onClick={commit}>
          应用数据
        </Button>
      </div>
    </>
  );
}

function ChartDataEditor({
  disabled,
  element,
  onUpdate,
}: {
  disabled: boolean;
  element: ChartElement;
  onUpdate: (patch: CanvasElementPatch) => void;
}) {
  const [open, setOpen] = useState(false);
  const categoryCount = element.series[0]?.labels.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="h-8 w-full justify-between rounded-sm px-2.5 text-xs font-normal"
          disabled={disabled}
          type="button"
          variant="outline"
        >
          <span className="flex items-center gap-2">
            <Grid2X2 aria-hidden="true" className="size-3.5 text-muted-foreground" />
            编辑数据
          </span>
          <span className="text-muted-foreground">
            {categoryCount} ×{" "}
            {element.chartType === "pie"
              ? Math.min(1, element.series.length)
              : element.series.length}
          </span>
        </Button>
      </DialogTrigger>
      {open ? (
        <DialogContent className="flex h-[min(680px,calc(100vh-48px))] w-[min(920px,calc(100vw-48px))] max-w-none flex-col overflow-hidden p-0">
          <ChartDataEditorContent
            chartType={element.chartType}
            element={element}
            onCancel={() => setOpen(false)}
            onCommit={(series, colors) => {
              onUpdate({ colors, series });
              setOpen(false);
            }}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export function ChartFields({
  disabled,
  element,
  onUpdate,
}: {
  disabled: boolean;
  element: ChartElement;
  onUpdate: (patch: CanvasElementPatch) => void;
}) {
  const titleId = useId();

  function addSeries() {
    const nextSeries = createChartSeries(element);
    onUpdate({
      colors: [...element.colors, getChartColor(element.colors, element.series.length)],
      series: [...element.series, nextSeries],
    });
  }

  function removeSeries(index: number) {
    if (element.series.length <= 1) return;
    onUpdate({
      colors: element.colors.filter((_, colorIndex) => colorIndex !== index),
      series: element.series.filter((_, seriesIndex) => seriesIndex !== index),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        <ChartTypeSelect
          disabled={disabled}
          value={element.chartType}
          onChange={(chartType) => onUpdate({ chartType })}
        />
        <label className="flex flex-col gap-2 text-xs text-muted-foreground" htmlFor={titleId}>
          标题
          <Input
            className={CONTROL_CLASS_NAME}
            disabled={disabled}
            id={titleId}
            value={element.title}
            onChange={(event) => onUpdate({ title: event.currentTarget.value })}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <BooleanSelect
            disabled={disabled}
            label="图例"
            value={element.showLegend}
            onChange={(showLegend) => onUpdate({ showLegend })}
          />
          <BooleanSelect
            disabled={disabled}
            label="数值"
            value={element.showValue}
            onChange={(showValue) => onUpdate({ showValue })}
          />
        </div>
      </div>

      {element.chartType !== "pie" ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className={LABEL_CLASS_NAME}>系列</span>
            <Button
              aria-label="添加系列"
              disabled={disabled}
              size="icon-xs"
              type="button"
              variant="ghost"
              onClick={addSeries}
            >
              <Plus aria-hidden="true" />
            </Button>
          </div>
          <div className="overflow-hidden rounded-sm border">
            {element.series.map((series, index) => (
              <div
                className="grid grid-cols-[28px_minmax(0,1fr)_28px] items-center gap-1.5 border-b p-1.5 last:border-b-0"
                key={`${element.id}-series-${index}`}
              >
                <ColorSwatch
                  disabled={disabled}
                  label={`系列 ${index + 1}`}
                  value={getChartColor(element.colors, index)}
                  onChange={(color) =>
                    onUpdate({ colors: setChartColor(element.colors, index, color) })
                  }
                />
                <Input
                  aria-label={`系列 ${index + 1} 名称`}
                  className="h-7 rounded-sm border-transparent bg-muted/70 px-2 text-xs shadow-none"
                  disabled={disabled}
                  value={series.name}
                  onChange={(event) =>
                    onUpdate({
                      series: patchChartSeries(element.series, index, {
                        name: event.currentTarget.value,
                      }),
                    })
                  }
                />
                <Button
                  aria-label={`删除系列 ${index + 1}`}
                  disabled={disabled || element.series.length <= 1}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                  onClick={() => removeSeries(index)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            ))}
            {element.series.length === 0 ? (
              <Button
                className="h-9 w-full rounded-none text-xs"
                disabled={disabled}
                type="button"
                variant="ghost"
                onClick={addSeries}
              >
                <Plus aria-hidden="true" data-icon="inline-start" />
                添加系列
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <ChartDataEditor disabled={disabled} element={element} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

interface TableDataDraft {
  columns: TableColumn[];
  rows: TableRow[];
}

function createTableDraft(element: TableElement): TableDataDraft {
  const columns =
    element.columns.length > 0
      ? element.columns.map((column) => ({ ...column }))
      : [{ id: createSemanticId(`${element.id}-column`), name: "列 1", width: 160 }];
  const rows =
    element.rows.length > 0
      ? element.rows.map((row) => ({ ...row, cells: { ...row.cells } }))
      : [
          {
            cells: Object.fromEntries(columns.map((column) => [column.id, ""])),
            height: 56,
            id: createSemanticId(`${element.id}-row`),
          },
        ];
  return { columns, rows };
}

function TableDataEditorContent({
  element,
  onCancel,
  onCommit,
}: {
  element: TableElement;
  onCancel: () => void;
  onCommit: (draft: TableDataDraft) => void;
}) {
  const [draft, setDraft] = useState(() => createTableDraft(element));
  const hasInvalidDimensions =
    draft.columns.some((column) => !Number.isFinite(column.width) || column.width < 24) ||
    draft.rows.some((row) => !Number.isFinite(row.height) || row.height < 20);
  const gridTemplateColumns = `116px repeat(${draft.columns.length}, 180px)`;

  function addColumn() {
    setDraft((current) => {
      const columnId = createSemanticId(`${element.id}-column`);
      return {
        columns: [
          ...current.columns,
          { id: columnId, name: `列 ${current.columns.length + 1}`, width: 160 },
        ],
        rows: current.rows.map((row) => ({
          ...row,
          cells: { ...row.cells, [columnId]: "" },
        })),
      };
    });
  }

  function removeColumn(columnId: string) {
    setDraft((current) => {
      if (current.columns.length <= 1) return current;
      return {
        columns: current.columns.filter((column) => column.id !== columnId),
        rows: current.rows.map((row) => {
          const { [columnId]: _removed, ...cells } = row.cells;
          return { ...row, cells };
        }),
      };
    });
  }

  function addRow() {
    setDraft((current) => ({
      ...current,
      rows: [
        ...current.rows,
        {
          cells: Object.fromEntries(current.columns.map((column) => [column.id, ""])),
          height: current.rows[0]?.height ?? 56,
          id: createSemanticId(`${element.id}-row`),
        },
      ],
    }));
  }

  function removeRow(rowId: string) {
    setDraft((current) => {
      if (current.rows.length <= 1) return current;
      return { ...current, rows: current.rows.filter((row) => row.id !== rowId) };
    });
  }

  function updateColumn(columnId: string, patch: Partial<TableColumn>) {
    setDraft((current) => ({
      ...current,
      columns: current.columns.map((column) =>
        column.id === columnId ? { ...column, ...patch } : column,
      ),
    }));
  }

  function updateRow(rowId: string, patch: Partial<TableRow>) {
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    }));
  }

  function updateCell(rowId: string, columnId: string, value: string) {
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row) =>
        row.id === rowId ? { ...row, cells: { ...row.cells, [columnId]: value } } : row,
      ),
    }));
  }

  return (
    <>
      <DialogHeader className="border-b px-5 py-4 pr-12">
        <DialogTitle>编辑表格数据</DialogTitle>
        <DialogDescription>
          {draft.rows.length} 行 · {draft.columns.length} 列
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Button size="sm" type="button" variant="outline" onClick={addRow}>
          <Rows3 aria-hidden="true" data-icon="inline-start" />
          添加行
        </Button>
        <Button size="sm" type="button" variant="outline" onClick={addColumn}>
          <Plus aria-hidden="true" data-icon="inline-start" />
          添加列
        </Button>
        <span
          className={cn(
            "ml-auto text-xs text-muted-foreground",
            hasInvalidDimensions && "text-destructive",
          )}
          role="status"
        >
          {hasInvalidDimensions ? "行列尺寸无效" : "结构有效"}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-muted/25 p-4">
        <div
          className="grid min-w-max overflow-hidden rounded-sm border border-r-0 border-b-0 bg-background"
          style={{ gridTemplateColumns }}
        >
          <div className="flex min-h-16 items-center justify-center border-r border-b bg-muted text-xs text-muted-foreground">
            行
          </div>
          {draft.columns.map((column, columnIndex) => (
            <div
              className="flex min-h-16 min-w-0 items-center gap-1.5 border-r border-b bg-muted p-1.5"
              key={column.id}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Input
                  aria-label={`第 ${columnIndex + 1} 列名称`}
                  className="h-7 rounded-sm border-transparent bg-background px-2 text-xs shadow-none"
                  value={column.name}
                  onChange={(event) => updateColumn(column.id, { name: event.currentTarget.value })}
                />
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  宽
                  <TableDimensionInput
                    aria-label={`第 ${columnIndex + 1} 列宽`}
                    className="h-6 rounded-sm border-transparent bg-background px-1.5 font-mono text-[11px] shadow-none"
                    minValue={24}
                    value={column.width}
                    onChange={(width) => updateColumn(column.id, { width })}
                  />
                </div>
              </div>
              <Button
                aria-label={`删除第 ${columnIndex + 1} 列`}
                disabled={draft.columns.length <= 1}
                size="icon-xs"
                type="button"
                variant="ghost"
                onClick={() => removeColumn(column.id)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          ))}

          {draft.rows.map((row, rowIndex) => [
            <div
              className="flex h-10 items-center gap-1 border-r border-b bg-muted px-1"
              key={`row-control-${row.id}`}
            >
              <span className="w-4 text-center font-mono text-[11px] text-muted-foreground">
                {rowIndex + 1}
              </span>
              <span className="text-[11px] text-muted-foreground">高</span>
              <TableDimensionInput
                aria-label={`第 ${rowIndex + 1} 行高`}
                className="h-7 w-11 flex-none rounded-sm border-transparent bg-background px-1 font-mono text-[11px] shadow-none"
                minValue={20}
                value={row.height}
                onChange={(height) => updateRow(row.id, { height })}
              />
              <Button
                aria-label={`删除第 ${rowIndex + 1} 行`}
                disabled={draft.rows.length <= 1}
                size="icon-xs"
                type="button"
                variant="ghost"
                onClick={() => removeRow(row.id)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>,
            ...draft.columns.map((column, columnIndex) => (
              <Input
                aria-label={`第 ${rowIndex + 1} 行第 ${columnIndex + 1} 列`}
                className={cn(GRID_INPUT_CLASS_NAME, "h-10")}
                key={`${row.id}-${column.id}`}
                value={row.cells[column.id] ?? ""}
                onChange={(event) => updateCell(row.id, column.id, event.currentTarget.value)}
              />
            )),
          ])}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t px-5 py-3.5">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button disabled={hasInvalidDimensions} type="button" onClick={() => onCommit(draft)}>
          应用数据
        </Button>
      </div>
    </>
  );
}

function TableDataEditor({
  disabled,
  element,
  onUpdate,
}: {
  disabled: boolean;
  element: TableElement;
  onUpdate: (patch: CanvasElementPatch) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="h-8 w-full justify-between rounded-sm px-2.5 text-xs font-normal"
          disabled={disabled}
          type="button"
          variant="outline"
        >
          <span className="flex items-center gap-2">
            <Table2 aria-hidden="true" className="size-3.5 text-muted-foreground" />
            编辑表格
          </span>
          <span className="text-muted-foreground">
            {element.rows.length} × {element.columns.length}
          </span>
        </Button>
      </DialogTrigger>
      {open ? (
        <DialogContent className="flex h-[min(680px,calc(100vh-48px))] w-[min(980px,calc(100vw-48px))] max-w-none flex-col overflow-hidden p-0">
          <TableDataEditorContent
            element={element}
            onCancel={() => setOpen(false)}
            onCommit={({ columns, rows }) => {
              onUpdate({ columns, rows });
              setOpen(false);
            }}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function StyleColorControl({
  disabled,
  label,
  value,
  onChange,
}: {
  disabled: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-xs text-muted-foreground">
      {label}
      <ColorPicker disabled={disabled} value={value} onChange={onChange}>
        <Button
          className="h-8 w-full justify-start gap-2 rounded-sm border-transparent bg-muted/70 px-2 font-mono text-xs font-normal shadow-none"
          disabled={disabled}
          type="button"
          variant="outline"
        >
          <span
            aria-hidden="true"
            className="size-5 rounded-sm border border-black/10"
            style={{ backgroundColor: value }}
          />
          {value.toUpperCase()}
        </Button>
      </ColorPicker>
    </label>
  );
}

function patchTableStyle(
  element: TableElement,
  key: "cellStyle" | "headerStyle",
  patch: Partial<TableCellStyle>,
): CanvasElementPatch {
  return { [key]: { ...element[key], ...patch } } as CanvasElementPatch;
}

export function TableFields({
  disabled,
  element,
  onUpdate,
}: {
  disabled: boolean;
  element: TableElement;
  onUpdate: (patch: CanvasElementPatch) => void;
}) {
  const fontSizeId = useId();
  const borderWidthId = useId();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Table2 aria-hidden="true" className="size-3.5" />
          <span>{element.rows.length} 行</span>
          <span>·</span>
          <span>{element.columns.length} 列</span>
        </div>
        <TableDataEditor disabled={disabled} element={element} onUpdate={onUpdate} />
      </div>

      <div className="flex flex-col gap-2.5 border-t pt-4">
        <div className="flex items-center gap-2">
          <BarChart3 aria-hidden="true" className="size-3.5 text-muted-foreground" />
          <span className={LABEL_CLASS_NAME}>表格样式</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StyleColorControl
            disabled={disabled}
            label="表头填充"
            value={element.headerStyle.fill}
            onChange={(fill) => onUpdate(patchTableStyle(element, "headerStyle", { fill }))}
          />
          <StyleColorControl
            disabled={disabled}
            label="单元格填充"
            value={element.cellStyle.fill}
            onChange={(fill) => onUpdate(patchTableStyle(element, "cellStyle", { fill }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-2 text-xs text-muted-foreground" htmlFor={fontSizeId}>
            字号
            <Input
              className={cn(CONTROL_CLASS_NAME, "font-mono")}
              disabled={disabled}
              id={fontSizeId}
              min={8}
              type="number"
              value={element.cellStyle.fontSize}
              onChange={(event) =>
                onUpdate(
                  patchTableStyle(element, "cellStyle", {
                    fontSize: Math.max(8, Number(event.currentTarget.value)),
                  }),
                )
              }
            />
          </label>
          <label
            className="flex flex-col gap-2 text-xs text-muted-foreground"
            htmlFor={borderWidthId}
          >
            边框
            <Input
              className={cn(CONTROL_CLASS_NAME, "font-mono")}
              disabled={disabled}
              id={borderWidthId}
              min={0}
              type="number"
              value={element.cellStyle.borderWidth}
              onChange={(event) =>
                onUpdate(
                  patchTableStyle(element, "cellStyle", {
                    borderWidth: Math.max(0, Number(event.currentTarget.value)),
                  }),
                )
              }
            />
          </label>
        </div>
      </div>
    </div>
  );
}
