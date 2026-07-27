import { getCanvasFont } from "@/editor/fonts";
import { getTableLayout } from "@/editor/table-layout";
import type { TableCellStyle, TableElement } from "@/editor/types";

function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  style: TableCellStyle,
) {
  context.fillStyle = style.color;
  context.font = `${style.fontWeight} ${style.fontSize}px ${getCanvasFont(style.fontFamily).cssFamily}`;
  context.textAlign = style.align;
  context.textBaseline = "middle";

  const textX =
    style.align === "center" ? x + width / 2 : style.align === "right" ? x + width - 8 : x + 8;
  context.fillText(text, textX, y + height / 2, Math.max(1, width - 16));
}

function drawCell(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  style: TableCellStyle,
) {
  context.fillStyle = style.fill;
  context.fillRect(x, y, width, height);
  if (style.borderWidth > 0) {
    context.strokeStyle = style.borderColor;
    context.lineWidth = style.borderWidth;
    context.strokeRect(x, y, width, height);
  }
  drawText(context, text, x, y, width, height, style);
}

export function renderTableToDataUrl(element: TableElement, pixelRatio = 2): string | null {
  const canvas = globalThis.document?.createElement("canvas");
  if (!canvas) return null;

  canvas.width = Math.max(8, Math.round(element.width * pixelRatio));
  canvas.height = Math.max(8, Math.round(element.height * pixelRatio));
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.scale(pixelRatio, pixelRatio);
  const layout = getTableLayout(element);

  for (const [columnIndex, column] of element.columns.entries()) {
    drawCell(
      context,
      column.name,
      layout.columnX[columnIndex],
      0,
      layout.columnWidths[columnIndex],
      layout.headerHeight,
      element.headerStyle,
    );
  }

  for (const [rowIndex, row] of element.rows.entries()) {
    for (const [columnIndex, column] of element.columns.entries()) {
      drawCell(
        context,
        row.cells[column.id] ?? "",
        layout.columnX[columnIndex],
        layout.rowY[rowIndex],
        layout.columnWidths[columnIndex],
        layout.rowHeights[rowIndex],
        element.cellStyle,
      );
    }
  }

  return canvas.toDataURL("image/png");
}
