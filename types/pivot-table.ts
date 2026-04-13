export interface PivotRow {
  row_labels: string[];
  is_subtotal: boolean;
  values: (number | null)[][]; // values[column_key_index][metric_index]
  row_total: (number | null)[]; // "Total" column — one value per metric
}

export interface PivotGrandTotalRow {
  values: (number | null)[][]; // grand total per column per metric
  row_total: (number | null)[]; // overall grand total per metric
}

export interface PivotTableResponse {
  column_keys: string[][]; // each inner array is one composite column key, e.g. ["Maharashtra", "Education"]
  column_dimension_names: string[]; // e.g. ["state_name", "program"]
  metric_headers: string[];
  rows: PivotRow[];
  grand_total: PivotGrandTotalRow | null;
  total_row_groups: number;
  page: number;
  page_size: number;
}

export interface PivotSort {
  column: string; // metric alias
  pivot_value?: string; // column group to sort by (omit = sort by row_total)
  direction: 'asc' | 'desc';
}
