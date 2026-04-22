// ── Metric primitive types
//
// A Metric is a reusable, saved aggregation — the building block consumed
// by KPIs (see ./kpis.ts), charts, and alerts. Two creation modes:
//
//   Simple — one or more (agg, column) terms combined via an arithmetic
//            formula over term IDs. E.g. `t1 - t2`, `(t1 / t2) * 100`.
//   SQL    — a raw SQL scalar expression, validated server-side against the
//            warehouse before save.
//
// Legacy `MetricDefinition` / `MetricAnnotation` types that conflated the
// primitive with the tracked layer have moved to `types/kpis.ts` under the
// `KPI` + `KPIEntry` names.

export type Aggregation = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'count_distinct';

export interface MetricTerm {
  id: string;
  agg: Aggregation;
  column: string;
}

export interface MetricFilter {
  column: string;
  operator: string;
  value: string;
}

export interface Metric {
  id: number;
  name: string;
  description: string;
  tags: string[];

  schema_name: string;
  table_name: string;
  time_column: string | null;
  default_time_grain: 'month' | 'quarter' | 'year';

  creation_mode: 'simple' | 'sql';
  simple_terms: MetricTerm[];
  simple_formula: string;
  sql_expression: string;
  filters: MetricFilter[];

  created_at: string;
  updated_at: string;
}

export interface MetricCreate {
  name: string;
  description?: string;
  tags?: string[];

  schema_name: string;
  table_name: string;
  time_column?: string | null;
  default_time_grain?: 'month' | 'quarter' | 'year';

  creation_mode?: 'simple' | 'sql';
  simple_terms?: MetricTerm[];
  simple_formula?: string;
  sql_expression?: string;
  filters?: MetricFilter[];
}

export type MetricUpdate = Partial<MetricCreate>;

export interface MetricReferences {
  metric_id: number;
  kpi_count: number;
  alert_count: number;
  chart_count: number;
  kpi_ids: number[];
  alert_ids: number[];
}

export interface MetricDetail {
  metric: Metric;
  references: MetricReferences;
}

export interface MetricDataPoint {
  metric_id: number;
  current_value: number | null;
  trend: { period: string; value: number | null }[];
  error?: string | null;
}

export interface ValidateSqlRequest {
  schema_name: string;
  table_name: string;
  sql_expression: string;
  filters?: MetricFilter[];
}

export interface ValidateSqlResponse {
  ok: boolean;
  value: number | null;
  error: string | null;
  query_executed: string | null;
}
