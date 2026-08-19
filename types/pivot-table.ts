// ---------------------------------------------------------------------------
// Wire format (what the backend /chart-data/ pivot pipeline returns).
//
// The backend emits one self-describing cell per filled (row_key, col_key) slot.
// Each cell is tagged with (row_kind, col_kind) — the 3x3 grid region it belongs
// to. The frontend derives the rendered grid from these cells (see cellsToGrid).
// ---------------------------------------------------------------------------

export type PivotRowKind = 'data' | 'row_subtotal' | 'grand_total';
export type PivotColKind = 'leaf' | 'col_subtotal' | 'row_total';

export interface PivotCell {
  row_key: string[]; // real row-dim values; [] = grand total
  col_key: string[]; // real col-dim values; [] = row total (rightmost "Total")
  row_kind: PivotRowKind;
  col_kind: PivotColKind;
  values: (number | null)[]; // one per metric
}

export interface PivotTableResponse {
  row_dimension_names: string[]; // e.g. ["state_name", "district"]
  column_dimension_names: string[]; // e.g. ["month", "program"]
  metric_headers: string[];
  // Canonical, globally-sorted column axes. The backend sorts these by raw value
  // (ROLLUP output is row-major + sparse, so column order can't be derived here).
  column_keys: string[][]; // ordered leaf column keys
  column_subtotal_keys: string[][]; // ordered subtotal column keys ([] unless enabled)
  cells: PivotCell[];
}

// ---------------------------------------------------------------------------
// Internal grid (derived from the cells for rendering / CSV export).
//
// This is NOT a wire type — it is the row-major structure the table renderer and
// CSV exporter consume, rebuilt from the cells by cellsToGrid(). Kept separate so
// the rendering code can stay simple and positional.
// ---------------------------------------------------------------------------

export interface PivotRow {
  row_labels: string[];
  is_subtotal: boolean;
  values: (number | null)[][]; // values[column_key_index][metric_index]
  column_subtotal_values?: (number | null)[][]; // [subtotal_key_index][metric_index]
  row_total: (number | null)[]; // "Total" column — one value per metric
}

export interface PivotGrandTotalRow {
  values: (number | null)[][]; // grand total per column per metric
  column_subtotal_values?: (number | null)[][]; // grand total for column subtotals
  row_total: (number | null)[]; // overall grand total per metric
}

// Metadata for column subtotals positioning
export interface ColumnSubtotals {
  keys: string[][]; // parent column keys, e.g. [["CA"], ["TX"]]
  insert_after: number[]; // insert after column_keys[index] for each subtotal key
}

export interface PivotGrid {
  column_keys: string[][]; // each inner array is one composite leaf column key
  column_dimension_names: string[];
  metric_headers: string[];
  rows: PivotRow[];
  grand_total: PivotGrandTotalRow | null;
  column_subtotals?: ColumnSubtotals; // present when column subtotal cells exist
}
