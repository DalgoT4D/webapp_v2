// ── Metric Definition ───────────────────────────────────────────────────────

export interface MetricDefinition {
  id: number;
  name: string;
  schema_name: string;
  table_name: string;
  column: string;
  aggregation: string;

  time_column: string | null;
  time_grain: 'month' | 'quarter' | 'year';

  target_value: number | null;
  amber_threshold_pct: number;
  green_threshold_pct: number;

  program_tag: string;
  metric_type_tag: string;

  trend_periods: number;
  display_order: number;

  created_at: string;
  updated_at: string;
}

export interface MetricCreate {
  name: string;
  schema_name: string;
  table_name: string;
  column: string;
  aggregation: string;

  time_column?: string | null;
  time_grain?: string;

  target_value?: number | null;
  amber_threshold_pct?: number;
  green_threshold_pct?: number;

  program_tag?: string;
  metric_type_tag?: string;

  trend_periods?: number;
  display_order?: number;
}

export type MetricUpdate = Partial<MetricCreate>;

// ── Metric Live Data ────────────────────────────────────────────────────────

export interface TrendPoint {
  period: string;
  value: number | null;
}

export type RAGStatus = 'green' | 'amber' | 'red' | 'grey';

export interface MetricDataPoint {
  metric_id: number;
  current_value: number | null;
  rag_status: RAGStatus;
  achievement_pct: number | null;
  trend: TrendPoint[];
  error?: string | null;
}

// ── Annotations ─────────────────────────────────────────────────────────────

export interface MetricAnnotation {
  id: number;
  period_key: string;
  rationale: string;
  quote_text: string;
  quote_attribution: string;
  created_at: string;
  updated_at: string;
}

export interface AnnotationCreate {
  period_key: string;
  rationale?: string;
  quote_text?: string;
  quote_attribution?: string;
}
