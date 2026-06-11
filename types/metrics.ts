// Metric types

export interface Metric {
  id: number;
  name: string;
  description: string | null;
  schema_name: string;
  table_name: string;
  column: string | null;
  aggregation: string | null;
  column_expression: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetricPayload {
  name: string;
  description?: string;
  schema_name: string;
  table_name: string;
  column?: string;
  aggregation?: string;
  column_expression?: string;
}

export interface MetricListResponse {
  data: Metric[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface MetricPreviewResponse {
  value: number | null;
  error: string | null;
}

export interface MetricConsumerAlert {
  id: number;
  name: string;
  alert_type: string;
}

export interface MetricConsumersResponse {
  charts: { id: number; title: string; chart_type: string }[];
  kpis: { id: number; name: string }[];
  alerts: MetricConsumerAlert[];
}

export const AGGREGATION_OPTIONS = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Avg' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
  { value: 'count_distinct', label: 'Count Distinct' },
] as const;

export type AggregationType = (typeof AGGREGATION_OPTIONS)[number]['value'];

export type MetricMode = 'simple' | 'calculated';

export interface MetricPreviewDefinitionRequest {
  schema_name: string;
  table_name: string;
  column?: string;
  aggregation?: string;
  column_expression?: string;
}
