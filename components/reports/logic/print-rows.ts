// Height of one dashboard grid row in the print capture.
export const PRINT_ROW_HEIGHT_PX = 20;
export const MIN_PRINT_CHART_HEIGHT_PX = 300;
// Without a floor, a short text/image widget (small `h`) can compute to a
// near-zero height, letting its content overflow rather than render at all.
export const MIN_PRINT_TEXT_HEIGHT_PX = 60;

export interface PrintLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PrintRow {
  y: number;
  items: PrintLayoutItem[];
}

/** Rows for the print/PDF view: same-y items side by side (left to right), rows top to bottom; filters skipped. */
export function groupLayoutByRows(
  layoutConfig: PrintLayoutItem[],
  components: Record<string, { type?: string } | undefined>
): PrintRow[] {
  const filtered = layoutConfig.filter((item) => {
    const component = components[item.i];
    return component && component.type !== 'filter';
  });

  const byY = new Map<number, PrintLayoutItem[]>();
  for (const item of filtered) {
    const row = byY.get(item.y) || [];
    row.push(item);
    byY.set(item.y, row);
  }

  const rows: PrintRow[] = [];
  for (const [y, items] of byY) {
    items.sort((a, b) => a.x - b.x);
    rows.push({ y, items });
  }
  rows.sort((a, b) => a.y - b.y);

  return rows;
}

/** Chart card content height in print. */
export function getPrintChartHeight(h: number): number {
  return Math.max(h * PRINT_ROW_HEIGHT_PX, MIN_PRINT_CHART_HEIGHT_PX);
}

/** Text/image widget height in print. */
export function getPrintTextHeight(h: number): number {
  return Math.max(h * PRINT_ROW_HEIGHT_PX, MIN_PRINT_TEXT_HEIGHT_PX);
}
