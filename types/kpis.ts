// ── KPI types (the tracked layer — what the UI formerly called "Metric")
//
// A KPI wraps a Metric (the reusable primitive — see ./metrics.ts) with a
// target, direction, RAG thresholds, trend config, tags, and annotations.

import type { Metric } from './metrics';

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

export type RAGStatus = 'green' | 'amber' | 'red' | 'grey';

export interface TrendPoint {
  period: string;
  value: number | null;
}

// ── KPI ──────────────────────────────────────────────────────────────────────

export interface KPI {
  id: number;
  // The underlying Metric primitive (schema/table/aggregation lives here).
  metric: Metric;

  target_value: number | null;
  direction: 'increase' | 'decrease';
  amber_threshold_pct: number;
  green_threshold_pct: number;

  trend_grain: 'month' | 'quarter' | 'year';
  trend_periods: number;

  metric_type_tag: string;
  program_tag: string;
  tags: string[];
  display_order: number;

  created_at: string;
  updated_at: string;
}

// When creating a KPI the caller may either reference an existing Metric
// (`metric_id`) OR embed a new Metric definition that is created inline
// (`inline_metric`). Mirrors the backend's `KPICreate` schema.
export interface KPICreate {
  metric_id?: number | null;
  inline_metric?: import('./metrics').MetricCreate | null;

  target_value?: number | null;
  direction?: 'increase' | 'decrease';
  amber_threshold_pct?: number;
  green_threshold_pct?: number;

  trend_grain?: 'month' | 'quarter' | 'year';
  trend_periods?: number;

  metric_type_tag?: string;
  program_tag?: string;
  tags?: string[];
  display_order?: number;
}

export type KPIUpdate = Partial<Omit<KPICreate, 'metric_id' | 'inline_metric'>>;

export interface KPIDataPoint {
  kpi_id: number;
  current_value: number | null;
  rag_status: RAGStatus;
  achievement_pct: number | null;
  trend: TrendPoint[];
  period_over_period_delta: number | null;
  period_over_period_pct: number | null;
  last_pipeline_update: string | null;
  error?: string | null;
}

// ── KPI Entries (annotations timeline) ───────────────────────────────────────

export interface KPIEntry {
  id: number;
  entry_type: 'comment' | 'quote';
  period_key: string;
  content: string;
  attribution: string;
  snapshot_value: number | null;
  snapshot_rag: RAGStatus | '';
  snapshot_achievement_pct: number | null;
  created_by_name: string;
  created_at: string;
}

export interface KPIEntryCreate {
  entry_type: 'comment' | 'quote';
  period_key: string;
  content: string;
  attribution?: string;
}

export interface LatestKPIEntry {
  kpi_id: number;
  entry: KPIEntry;
}
