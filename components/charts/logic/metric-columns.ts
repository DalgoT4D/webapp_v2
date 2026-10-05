export const AGGREGATE_FUNCTIONS = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'count_distinct', label: 'Count Distinct' },
];

const NUMERIC_TYPES = [
  'integer',
  'bigint',
  'numeric',
  'double precision',
  'real',
  'float',
  'decimal',
];

/** Columns selectable for a given aggregation. COUNT allows `*`; non-count aggregations only numerics. */
export function getAvailableColumns(
  columns: Array<{ column_name: string; data_type: string }>,
  aggregation: string
) {
  if (aggregation === 'count') {
    return [...columns, { column_name: '*', data_type: 'any' }].map((col) => ({
      ...col,
      disabled: false,
    }));
  }
  if (aggregation === 'count_distinct') {
    return columns.map((col) => ({ ...col, disabled: false }));
  }
  return columns.map((col) => ({
    ...col,
    disabled: !NUMERIC_TYPES.includes(col.data_type.toLowerCase()),
  }));
}
