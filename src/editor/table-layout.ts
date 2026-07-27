import type { TableElement } from "@/editor/types";

function getSafeDimension(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function getOffsets(sizes: number[], start = 0) {
  let offset = start;
  return sizes.map((size) => {
    const current = offset;
    offset += size;
    return current;
  });
}

export function isTableDataValid(element: TableElement): boolean {
  const columnIds = new Set(element.columns.map((column) => column.id));
  const rowIds = new Set(element.rows.map((row) => row.id));

  return (
    element.columns.length > 0 &&
    element.rows.length > 0 &&
    columnIds.size === element.columns.length &&
    rowIds.size === element.rows.length &&
    element.columns.every((column) => Number.isFinite(column.width) && column.width > 0) &&
    element.rows.every((row) => Number.isFinite(row.height) && row.height > 0)
  );
}

export function getTableLayout(element: TableElement) {
  const sourceColumnWidths = element.columns.map((column) => getSafeDimension(column.width));
  const sourceRowHeights = element.rows.map((row) => getSafeDimension(row.height));
  const sourceWidth = Math.max(
    1,
    sourceColumnWidths.reduce((sum, width) => sum + width, 0),
  );
  const headerSourceHeight = getSafeDimension(
    element.rows[0]?.height ?? element.height / Math.max(1, element.rows.length + 1),
  );
  const sourceHeight = Math.max(
    1,
    headerSourceHeight + sourceRowHeights.reduce((sum, height) => sum + height, 0),
  );
  const widthScale = getSafeDimension(element.width) / sourceWidth;
  const heightScale = getSafeDimension(element.height) / sourceHeight;
  const columnWidths = sourceColumnWidths.map((width) => width * widthScale);
  const rowHeights = sourceRowHeights.map((height) => height * heightScale);
  const headerHeight = headerSourceHeight * heightScale;

  return {
    columnWidths,
    columnX: getOffsets(columnWidths),
    headerHeight,
    rowHeights,
    rowY: getOffsets(rowHeights, headerHeight),
  };
}
