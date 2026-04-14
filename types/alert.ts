export interface AlertFilter {
  column: string;
  operator: string;
  value: string;
}

export interface AlertMessagePlaceholder {
  key: string;
  aggregation: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';
  column: string | null;
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
  metric_id: number | null;
  metric_name: string | null;
  query_config: AlertQueryConfig;
  recipients: string[];
  message: string;
  group_message: string;
  message_placeholders: AlertMessagePlaceholder[];
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
  recipients: string[];
  num_recipients: number;
  message: string;
  fired: boolean;
  rows_returned: number;
  result_preview: Record<string, unknown>[];
  rendered_message: string;
  trigger_flow_run_id: string | null;
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
  rendered_message: string;
}

export interface TriggeredAlertEvent {
  id: number;
  alert_id: number;
  alert_name: string;
  metric_id: number | null;
  metric_name: string | null;
  rows_returned: number;
  num_recipients: number;
  rendered_message: string;
  result_preview: Record<string, unknown>[];
  trigger_flow_run_id: string | null;
  created_at: string;
}

export interface AlertFormData {
  name: string;
  metric_id?: number | null;
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
  recipients: string[];
  message: string;
  group_message?: string;
  message_placeholders?: AlertMessagePlaceholder[];
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
