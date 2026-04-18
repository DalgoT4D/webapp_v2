export interface AlertFilter {
  column: string;
  operator: string;
  value: string;
}

export interface AlertQueryConfig {
  schema_name: string;
  table_name: string;
  filters: AlertFilter[];
  filter_connector: 'AND' | 'OR';
  aggregation: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';
  measure_column: string | null;
  group_by_column: string | null;
  condition_operator: string;
  condition_value: number;
}

export interface Alert {
  id: number;
  name: string;
  query_config: AlertQueryConfig;
  cron: string;
  recipients: string[];
  message: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_evaluated_at: string | null;
  last_fired_at: string | null;
  fire_streak: number;
}

export interface AlertEvaluation {
  id: number;
  query_config: AlertQueryConfig;
  query_executed: string;
  cron: string;
  recipients: string[];
  num_recipients: number;
  message: string;
  fired: boolean;
  rows_returned: number;
  error_message: string | null;
  created_at: string;
}

export interface AlertTestResult {
  would_fire: boolean;
  total_rows: number;
  results: Record<string, unknown>[];
  page: number;
  page_size: number;
  query_executed: string;
}

export interface AlertFormData {
  name: string;
  query_config: {
    schema_name: string;
    table_name: string;
    filters: AlertFilter[];
    filter_connector: 'AND' | 'OR';
    aggregation: string;
    measure_column: string | null;
    group_by_column: string | null;
    condition_operator: string;
    condition_value: number | '';
  };
  cron: string;
  cronScheduleType: string;
  cronDaysOfWeek: string[];
  cronTimeOfDay: string;
  recipients: string[];
  message: string;
}

export const AGGREGATION_OPTIONS = [
  { value: 'SUM', label: 'Sum' },
  { value: 'AVG', label: 'Average' },
  { value: 'COUNT', label: 'Count' },
  { value: 'MIN', label: 'Minimum' },
  { value: 'MAX', label: 'Maximum' },
] as const;

export const CONDITION_OPERATORS = [
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: '=', label: '=' },
  { value: '!=', label: '!=' },
] as const;

export const NUMERIC_FILTER_OPERATORS = [
  { value: '=', label: '=' },
  { value: '!=', label: '!=' },
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
] as const;

export const TEXT_FILTER_OPERATORS = [
  { value: '=', label: '=' },
  { value: '!=', label: '!=' },
  { value: 'contains', label: 'Contains' },
  { value: 'not contains', label: 'Not Contains' },
] as const;

export const DATE_FILTER_OPERATORS = [
  { value: '=', label: '=' },
  { value: '!=', label: '!=' },
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
] as const;

export const BOOLEAN_FILTER_OPERATORS = [
  { value: 'is true', label: 'Is True' },
  { value: 'is false', label: 'Is False' },
] as const;

// Map warehouse data types to filter operator sets
export function getFilterOperatorsForDataType(
  dataType: string
): readonly { value: string; label: string }[] {
  const lower = dataType.toLowerCase();

  if (['boolean', 'bool'].some((t) => lower.includes(t))) {
    return BOOLEAN_FILTER_OPERATORS;
  }

  if (['timestamp', 'datetime', 'date', 'time'].some((t) => lower.includes(t))) {
    return DATE_FILTER_OPERATORS;
  }

  if (
    [
      'integer',
      'bigint',
      'numeric',
      'decimal',
      'double',
      'real',
      'float',
      'money',
      'int',
      'smallint',
    ].some((t) => lower.includes(t))
  ) {
    return NUMERIC_FILTER_OPERATORS;
  }

  return TEXT_FILTER_OPERATORS;
}
