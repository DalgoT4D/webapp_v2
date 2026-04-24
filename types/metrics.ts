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

export interface MetricCreate {
  name: string;
  description?: string;
  schema_name: string;
  table_name: string;
  column?: string;
  aggregation?: string;
  column_expression?: string;
}

export interface MetricUpdate {
  name?: string;
  description?: string;
  schema_name?: string;
  table_name?: string;
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

export interface MetricConsumersResponse {
  charts: { id: number; title: string; chart_type: string }[];
  kpis: { id: number; name: string }[];
}

export const AGGREGATION_OPTIONS = [
  { value: 'sum', label: 'SUM' },
  { value: 'avg', label: 'AVG' },
  { value: 'count', label: 'COUNT' },
  { value: 'min', label: 'MIN' },
  { value: 'max', label: 'MAX' },
  { value: 'count_distinct', label: 'COUNT DISTINCT' },
] as const;

export type AggregationType = (typeof AGGREGATION_OPTIONS)[number]['value'];
