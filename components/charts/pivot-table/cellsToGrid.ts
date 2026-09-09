import type {
  PivotTableResponse,
  PivotCell,
  PivotGrid,
  PivotRow,
  PivotGrandTotalRow,
} from '@/types/pivot-table';

/**
 * Rebuild the row-major render grid from the backend's flat cells[] response.
 *
 * The backend emits one self-describing cell per (row_key, col_key) slot, tagged
 * with (row_kind, col_kind), plus the canonical sorted column axes. This derives
 * the positional structures the table renderer and CSV exporter consume:
 *   - column_keys        the backend's sorted leaf column axis (used as-is)
 *   - rows               one per data/row_subtotal row_key, values[col][metric]
 *   - column_subtotals   subtotal column keys + where they slot between leaves
 *   - grand_total        the grand-total row_key, split the same way
 *
 * Column order comes from the backend (sorted by raw value) — it cannot be derived
 * from the row-major, possibly-sparse cell stream. Rows keep first-appearance
 * order, which does match the backend's row ordering.
 *
 * The steps are small, single-purpose helpers below; cellsToGrid just wires them.
 */

// NUL separator for composite-key map lookups — cannot occur in warehouse string
// values, so distinct keys like ['a','b c'] and ['a b','c'] never collide.
const KEY_SEP = '\u0000';
const keyStr = (key: string[]): string => key.join(KEY_SEP);

/** The value slots every grid entry shares: a leaf grid, an optional subtotal
 *  grid, and the row_total column. A data row and the grand-total row are both
 *  this shape (a row just adds labels on top). */
interface GridSlots {
  values: (number | null)[][]; // [leafColIndex][metricIndex]
  column_subtotal_values?: (number | null)[][]; // [subtotalColIndex][metricIndex]
  row_total: (number | null)[]; // one per metric
}

/** An ordered axis of column keys plus a fast index lookup. */
interface ColumnAxis {
  keys: string[][];
  indexOf: (key: string[]) => number | undefined;
}

/** Wrap a backend-provided (already sorted) key list with an index lookup. */
function makeColumnAxis(keys: string[][]): ColumnAxis {
  const position = new Map<string, number>();
  keys.forEach((key, i) => position.set(keyStr(key), i));
  return { keys, indexOf: (key) => position.get(keyStr(key)) };
}

/** Fresh, fully null-filled value slots sized to the current axes. */
function emptySlots(leaf: ColumnAxis, sub: ColumnAxis, metricCount: number): GridSlots {
  const nulls = (): (number | null)[] => Array(metricCount).fill(null);
  const slots: GridSlots = {
    values: leaf.keys.map(nulls),
    row_total: nulls(),
  };
  if (sub.keys.length > 0) slots.column_subtotal_values = sub.keys.map(nulls);
  return slots;
}

/** Drop one cell's metric values into its slot (leaf cell / subtotal / row_total). */
function placeCell(slots: GridSlots, cell: PivotCell, leaf: ColumnAxis, sub: ColumnAxis): void {
  if (cell.col_kind === 'leaf') {
    const i = leaf.indexOf(cell.col_key);
    if (i !== undefined) slots.values[i] = cell.values;
  } else if (cell.col_kind === 'col_subtotal') {
    const i = sub.indexOf(cell.col_key);
    if (i !== undefined && slots.column_subtotal_values) {
      slots.column_subtotal_values[i] = cell.values;
    }
  } else {
    slots.row_total = cell.values;
  }
}

/** For each subtotal key, the last leaf index whose prefix matches it (where the
 *  subtotal column slots in). -1 if no leaf matches. */
function subtotalInsertPositions(leafKeys: string[][], subKeys: string[][]): number[] {
  return subKeys.map((sub) => {
    let last = -1;
    leafKeys.forEach((leaf, i) => {
      if (sub.every((value, level) => leaf[level] === value)) last = i;
    });
    return last;
  });
}

export function cellsToGrid(response: PivotTableResponse): PivotGrid {
  const { cells, column_dimension_names, metric_headers, column_keys, column_subtotal_keys } =
    response;
  const metricCount = metric_headers.length;

  const leaf = makeColumnAxis(column_keys ?? []);
  const sub = makeColumnAxis(column_subtotal_keys ?? []);

  const rows: PivotRow[] = [];
  const rowIndexById = new Map<string, number>();
  let grandTotal: PivotGrandTotalRow | null = null;

  for (const cell of cells) {
    if (cell.row_kind === 'grand_total') {
      if (!grandTotal) grandTotal = emptySlots(leaf, sub, metricCount);
      placeCell(grandTotal, cell, leaf, sub);
      continue;
    }

    // row_kind is 'data' or 'row_subtotal' — one grid row per distinct row_key.
    const id = `${cell.row_kind}${keyStr(cell.row_key)}`;
    let index = rowIndexById.get(id);
    if (index === undefined) {
      index = rows.length;
      rowIndexById.set(id, index);
      rows.push({
        row_labels: cell.row_key,
        is_subtotal: cell.row_kind === 'row_subtotal',
        ...emptySlots(leaf, sub, metricCount),
      });
    }
    placeCell(rows[index], cell, leaf, sub);
  }

  const grid: PivotGrid = {
    column_keys: leaf.keys,
    column_dimension_names,
    metric_headers,
    rows,
    grand_total: grandTotal,
  };
  if (sub.keys.length > 0) {
    grid.column_subtotals = {
      keys: sub.keys,
      insert_after: subtotalInsertPositions(leaf.keys, sub.keys),
    };
  }
  return grid;
}
