import { AppBackLink } from "@/components/AppBackLink";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileJson2 } from "lucide-react";

interface FieldRow {
  field: string;
  type: string;
  meaning: string;
  appliesTo?: string;
}

interface FieldSection {
  title: string;
  description: string;
  rows: FieldRow[];
}

const DOCUMENT_FIELDS: FieldRow[] = [
  {
    field: "id",
    type: "string",
    meaning: "文档唯一 ID，也是路由、状态缓存和导出文件命名的基础标识。",
  },
  { field: "name", type: "string", meaning: "文档显示名称，用于首页卡片、画布标题和导出标题。" },
  {
    field: "description",
    type: "string",
    meaning: "文档说明文字，主要用于模板列表和结构预览中的辅助描述。",
  },
  {
    field: "documentType",
    type: '"longform" | "pptx"',
    meaning: "文档类型。longform 表示单张长画布；pptx 表示顶层 group 会按幻灯片页导出。",
  },
  { field: "width", type: "number", meaning: "画布宽度，单位为画布像素。" },
  { field: "height", type: "number", meaning: "画布高度，单位为画布像素。" },
  {
    field: "elements",
    type: "CanvasElement[]",
    meaning: "画布顶层元素列表。longform 直接渲染这些元素；pptx 顶层通常是 slide group。",
  },
];

const SHARED_FIELDS: FieldRow[] = [
  { field: "type", type: "string", meaning: "元素类型判别字段，决定渲染器、属性面板和导出映射。" },
  {
    field: "id",
    type: "string",
    meaning: "元素唯一 ID，用于选择、图层树、更新 patch、复制和删除。",
  },
  { field: "name", type: "string", meaning: "元素在图层树中展示的名称。" },
  { field: "visible", type: "boolean", meaning: "是否参与画板显示和导出。" },
  { field: "locked", type: "boolean", meaning: "是否禁止选择后的编辑、拖动和属性修改。" },
  { field: "x", type: "number", meaning: "元素左上角 X 坐标。", appliesTo: "叶子元素" },
  { field: "y", type: "number", meaning: "元素左上角 Y 坐标。", appliesTo: "叶子元素" },
  { field: "width", type: "number", meaning: "元素外框宽度。", appliesTo: "叶子元素" },
  { field: "height", type: "number", meaning: "元素外框高度。", appliesTo: "叶子元素" },
  {
    field: "rotation",
    type: "number",
    meaning: "旋转角度，单位为度。chart/table 固定为 0，不支持旋转。",
    appliesTo: "叶子元素",
  },
  { field: "opacity", type: "number", meaning: "透明度，范围 0 到 1。", appliesTo: "叶子元素" },
  {
    field: "fill",
    type: "string",
    meaning: "填充色或文字颜色，使用 CSS 色值。",
    appliesTo: "部分元素",
  },
  { field: "stroke", type: "string", meaning: "描边颜色，使用 CSS 色值。", appliesTo: "图形/线条" },
  {
    field: "strokeWidth",
    type: "number",
    meaning: "描边宽度，单位为画布像素。",
    appliesTo: "图形/线条",
  },
];

const ELEMENT_SECTIONS: FieldSection[] = [
  {
    title: "group",
    description: "组合元素。PPT 文档中，顶层 group 代表一页幻灯片。",
    rows: [
      {
        field: "children",
        type: "CanvasElement[]",
        meaning: "子元素列表，会继承父级 visible/locked 效果。",
      },
    ],
  },
  {
    title: "text",
    description: "文本元素，支持受限 Markdown 富文本。",
    rows: [
      {
        field: "text",
        type: "string",
        meaning: "文本内容，支持加粗、斜体、删除线、换行和颜色 span。",
      },
      {
        field: "fontFamily",
        type: "CanvasFontFamily",
        meaning: "字体族枚举，例如 inter 或 noto-sans-sc。",
      },
      { field: "fontSize", type: "number", meaning: "字号，单位为画布像素。" },
      { field: "fontWeight", type: '"400" | "500" | "600" | "700" | "800"', meaning: "字重。" },
      { field: "lineHeight", type: "number", meaning: "无单位行高倍率，作用于每一行文本框。" },
      { field: "align", type: '"left" | "center" | "right"', meaning: "水平对齐方式。" },
      { field: "fill", type: "string", meaning: "文本颜色。" },
    ],
  },
  {
    title: "rect / circle / ellipse",
    description: "基础几何图形。",
    rows: [
      { field: "cornerRadius", type: "number", meaning: "圆角半径，仅 rect 使用。" },
      { field: "fill", type: "string", meaning: "图形填充色。" },
      { field: "stroke", type: "string", meaning: "图形描边色。" },
      { field: "strokeWidth", type: "number", meaning: "图形描边宽度。" },
    ],
  },
  {
    title: "line / arrow",
    description: "线段和箭头元素。",
    rows: [
      {
        field: "points",
        type: "number[]",
        meaning: "相对元素左上角的点坐标数组，例如 [x1, y1, x2, y2]。",
      },
      { field: "lineCap", type: '"butt" | "round" | "square"', meaning: "线端样式。" },
      { field: "pointerLength", type: "number", meaning: "箭头长度，仅 arrow 使用。" },
      { field: "pointerWidth", type: "number", meaning: "箭头宽度，仅 arrow 使用。" },
    ],
  },
  {
    title: "polygon / star",
    description: "多边形和星形元素。",
    rows: [
      { field: "sides", type: "number", meaning: "多边形边数，仅 polygon 使用，最小值为 3。" },
      { field: "cornerRadius", type: "number", meaning: "多边形顶点圆角，仅 polygon 使用。" },
      { field: "numPoints", type: "number", meaning: "星形角点数量，仅 star 使用。" },
      { field: "innerRadius", type: "number", meaning: "星形内半径，仅 star 使用。" },
      { field: "outerRadius", type: "number", meaning: "星形外半径，仅 star 使用。" },
    ],
  },
  {
    title: "image",
    description: "图片元素。",
    rows: [
      { field: "src", type: "string", meaning: "图片地址或 data URL。" },
      {
        field: "fit",
        type: '"cover" | "contain"',
        meaning: "图片适配方式：cover 裁切铺满，contain 完整包含。",
      },
      { field: "cornerRadius", type: "number", meaning: "图片圆角半径。" },
    ],
  },
  {
    title: "chart",
    description: "语义图表元素。画板使用 ECharts 图片预览，PPTX 优先映射为原生图表。",
    rows: [
      {
        field: "chartType",
        type: '"bar" | "line" | "pie"',
        meaning: "图表类型：柱状图、折线图或饼图。",
      },
      { field: "title", type: "string", meaning: "图表标题。" },
      { field: "showLegend", type: "boolean", meaning: "是否显示图例。" },
      { field: "showValue", type: "boolean", meaning: "是否显示数值标签。" },
      { field: "colors", type: "string[]", meaning: "系列或扇区颜色列表。" },
      {
        field: "series",
        type: "ChartSeries[]",
        meaning: "图表数据系列。饼图导出 v1 只使用第一组 series。",
      },
      { field: "series.name", type: "string", meaning: "系列名称，用于图例和 PPT 图表数据表。" },
      { field: "series.labels", type: "string[]", meaning: "分类标签或饼图扇区名称。" },
      { field: "series.values", type: "number[]", meaning: "与 labels 对齐的数值列表。" },
    ],
  },
  {
    title: "table",
    description: "语义表格元素。画板原生绘制单元格，PPTX 优先映射为原生表格。",
    rows: [
      { field: "columns", type: "TableColumn[]", meaning: "列定义列表。" },
      {
        field: "columns.id",
        type: "string",
        meaning: "列唯一 ID，row.cells 会按这个 ID 存取单元格文本。",
      },
      { field: "columns.name", type: "string", meaning: "列名称，主要用于右侧数据面板。" },
      { field: "columns.width", type: "number", meaning: "列宽，单位为画布像素。" },
      { field: "rows", type: "TableRow[]", meaning: "行定义列表。" },
      { field: "rows.id", type: "string", meaning: "行唯一 ID。" },
      { field: "rows.height", type: "number", meaning: "行高，单位为画布像素。" },
      {
        field: "rows.cells",
        type: "Record<string, string>",
        meaning: "单元格文本映射，key 为 columns.id。",
      },
      { field: "headerStyle", type: "TableCellStyle", meaning: "首行样式。" },
      { field: "cellStyle", type: "TableCellStyle", meaning: "普通单元格样式。" },
    ],
  },
  {
    title: "TableCellStyle",
    description: "表格单元格样式结构。",
    rows: [
      { field: "fill", type: "string", meaning: "单元格背景色。" },
      { field: "color", type: "string", meaning: "单元格文字颜色。" },
      { field: "fontFamily", type: "CanvasFontFamily", meaning: "单元格字体族。" },
      { field: "fontSize", type: "number", meaning: "单元格字号。" },
      {
        field: "fontWeight",
        type: '"400" | "500" | "600" | "700" | "800"',
        meaning: "单元格字重。",
      },
      { field: "align", type: '"left" | "center" | "right"', meaning: "水平对齐方式。" },
      { field: "valign", type: '"top" | "middle" | "bottom"', meaning: "垂直对齐方式。" },
      { field: "borderColor", type: "string", meaning: "边框颜色。" },
      { field: "borderWidth", type: "number", meaning: "边框宽度。" },
    ],
  },
];

function FieldTable({ rows }: { rows: FieldRow[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-muted/70 text-xs text-muted-foreground">
          <tr>
            <th className="w-[180px] border-b border-border px-4 py-3 font-medium">字段</th>
            <th className="w-[220px] border-b border-border px-4 py-3 font-medium">类型/取值</th>
            <th className="border-b border-border px-4 py-3 font-medium">含义</th>
            <th className="w-[140px] border-b border-border px-4 py-3 font-medium">适用范围</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-b border-border/70 last:border-b-0" key={row.field}>
              <td className="px-4 py-3 align-top font-mono text-xs text-foreground">{row.field}</td>
              <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground">
                {row.type}
              </td>
              <td className="px-4 py-3 align-top leading-6 text-foreground">{row.meaning}</td>
              <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                {row.appliesTo ?? "通用"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ section }: { section: FieldSection }) {
  return (
    <section className="flex flex-col gap-3" id={section.title}>
      <div className="flex items-center gap-3">
        <h2 className="m-0 text-lg font-semibold">{section.title}</h2>
        <Badge variant="secondary">{section.rows.length} 个字段</Badge>
      </div>
      <p className="m-0 max-w-3xl text-sm leading-6 text-muted-foreground">{section.description}</p>
      <FieldTable rows={section.rows} />
    </section>
  );
}

export function JsonStructurePage() {
  return (
    <main className="h-dvh bg-background text-foreground">
      <ScrollArea className="h-full">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-9 px-10 py-8">
          <header className="flex items-start justify-between gap-8 border-b border-border pb-7">
            <div className="flex max-w-3xl flex-col gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileJson2 aria-hidden="true" size={18} strokeWidth={1.75} />
                画布 JSON 数据协议
              </div>
              <h1 className="m-0 text-3xl font-semibold tracking-normal">JSON 结构详情</h1>
              <p className="m-0 text-sm leading-6 text-muted-foreground">
                这里解释编辑器当前支持的文档、图层、基础图形、图片、图表和表格字段。坐标与尺寸统一使用画布像素，PPTX
                导出时再转换为 PowerPoint 单位。
              </p>
            </div>
            <AppBackLink iconOnly to="/" variant="outline">
              返回首页
            </AppBackLink>
          </header>

          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h2 className="m-0 text-lg font-semibold">CanvasDocument</h2>
              <Badge variant="secondary">{DOCUMENT_FIELDS.length} 个字段</Badge>
            </div>
            <p className="m-0 max-w-3xl text-sm leading-6 text-muted-foreground">
              文档是编辑器的顶层 JSON。长图文档直接包含画板元素；PPT 文档的顶层元素按 slide group
              组织，导出时每个 slide group 对应一页 PowerPoint。
            </p>
            <FieldTable rows={DOCUMENT_FIELDS} />
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h2 className="m-0 text-lg font-semibold">共享字段</h2>
              <Badge variant="secondary">{SHARED_FIELDS.length} 个字段</Badge>
            </div>
            <p className="m-0 max-w-3xl text-sm leading-6 text-muted-foreground">
              这些字段构成元素的通用身份、可见性和变换模型。group
              只拥有身份与层级字段；其他叶子元素拥有坐标、尺寸和透明度。
            </p>
            <FieldTable rows={SHARED_FIELDS} />
          </section>

          {ELEMENT_SECTIONS.map((section) => (
            <Section key={section.title} section={section} />
          ))}
        </div>
      </ScrollArea>
    </main>
  );
}
