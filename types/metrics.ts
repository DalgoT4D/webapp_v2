// ── Constants ───────────────────────────────────────────────────────────────

export const METRIC_TYPES = ['Input', 'Output', 'Outcome', 'Impact'] as const;

export const METRIC_TYPE_DESCRIPTIONS: Record<string, string> = {
  Input: 'Resources put into the program (staff, funding, materials)',
  Output: 'Direct products of program activities (trainings held, people served)',
  Outcome: 'Changes in participants or conditions (knowledge gained, behavior change)',
  Impact: 'Long-term, broad effects on community or society',
};

export const METRIC_TYPE_ICONS: Record<string, string> = {
  Input: '\u{1F4E5}',
  Output: '\u{1F4E4}',
  Outcome: '\u{1F3AF}',
  Impact: '\u{1F4A5}',
};

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

  direction: 'increase' | 'decrease';
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

  direction?: 'increase' | 'decrease';
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

export interface LatestAnnotationEntry extends MetricAnnotation {
  metric_id: number;
}

// ── Metric Entries (timeline) ──────────────────────────────────────────────

export interface MetricEntry {
  id: number;
  entry_type: 'comment' | 'quote';
  period_key: string;
  content: string;
  attribution: string;
  snapshot_value: number | null;
  snapshot_rag: RAGStatus;
  snapshot_achievement_pct: number | null;
  created_by_name: string;
  created_at: string;
}

export interface EntryCreate {
  entry_type: 'comment' | 'quote';
  period_key: string;
  content: string;
  attribution?: string;
}
