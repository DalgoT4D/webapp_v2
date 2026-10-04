/** A warehouse column as the data panel normalizes it (`column_name` and `name` are the same value). */
export interface NormalizedColumn {
  column_name: string;
  data_type: string;
  name: string;
}

/** A column as a Combobox item. */
export interface ColumnItem {
  value: string;
  label: string;
  data_type: string;
}
