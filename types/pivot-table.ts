export interface PivotRow {
  row_labels: string[];
  is_subtotal: boolean;
  values: (number | null)[][]; // values[column_key_index][metric_index]
  column_subtotal_values?: (number | null)[][]; // column_subtotal_values[subtotal_key_index][metric_index]
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

export interface PivotTableResponse {
  column_keys: string[][]; // each inner array is one composite column key, e.g. ["Maharashtra", "Education"]
  column_dimension_names: string[]; // e.g. ["state_name", "program"]
  metric_headers: string[];
  rows: PivotRow[];
  grand_total: PivotGrandTotalRow | null;
  column_subtotals?: ColumnSubtotals; // present when show_column_subtotals is enabled
  total_row_groups: number;
  page: number;
  page_size: number;
}

export interface PivotSort {
  column: string; // metric alias
  pivot_value?: string; // column group to sort by (omit = sort by row_total)
  direction: 'asc' | 'desc';
}
