// Aggregate functions for metrics
export const AGGREGATE_FUNCTIONS = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'count_distinct', label: 'Count Distinct' },
] as const;

// Filter operators
export const FILTER_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not equals' },
  { value: 'greater_than', label: 'Greater than (>)' },
  { value: 'greater_than_equal', label: 'Greater or equal (>=)' },
  { value: 'less_than', label: 'Less than (<)' },
  { value: 'less_than_equal', label: 'Less or equal (<=)' },
  { value: 'like', label: 'Like' },
  { value: 'like_case_insensitive', label: 'Like (case insensitive)' },
  { value: 'in', label: 'In' },
  { value: 'not_in', label: 'Not in' },
  { value: 'is_null', label: 'Is null' },
  { value: 'is_not_null', label: 'Is not null' },
] as const;

// Pagination options
export const PAGINATION_OPTIONS = [
  { value: '__none__', label: 'No pagination' },
  { value: '20', label: '20 items' },
  { value: '50', label: '50 items' },
  { value: '100', label: '100 items' },
  { value: '200', label: '200 items' },
] as const;

// Sort direction options
export const SORT_DIRECTIONS = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
] as const;

// Numeric column types for aggregation validation
export const NUMERIC_COLUMN_TYPES = [
  'integer',
  'bigint',
  'numeric',
  'double precision',
  'real',
  'float',
  'decimal',
] as const;

// DateTime column types for time grain
export const DATETIME_COLUMN_TYPES = [
  'timestamp',
  'timestamptz',
  'date',
  'datetime',
  'time',
] as const;

// Type exports
export type AggregateFunction = (typeof AGGREGATE_FUNCTIONS)[number]['value'];
export type FilterOperator = (typeof FILTER_OPERATORS)[number]['value'];
export type SortDirection = (typeof SORT_DIRECTIONS)[number]['value'];
