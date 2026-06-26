import type { Metric } from './metrics';
import type { NumberFormat } from '@/lib/formatters';

export type RAGStatus = 'green' | 'amber' | 'red';

export const RAG_COLORS: Record<
  RAGStatus,
  { bg: string; text: string; dot: string; label: string }
> = {
  green: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', label: 'On Track' },
  amber: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    label: 'Needs Attention',
  },
  red: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', label: 'Off Track' },
};

export const DIRECTION_OPTIONS = [
  { value: 'increase', label: 'Higher is better' },
  { value: 'decrease', label: 'Lower is better' },
] as const;

export const TIME_GRAIN_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
] as const;

export const METRIC_TYPE_TAG_OPTIONS = [
  { value: 'input', label: 'Input' },
  { value: 'output', label: 'Output' },
  { value: 'outcome', label: 'Outcome' },
  { value: 'impact', label: 'Impact' },
] as const;

/**
 * Display customizations for a KPI value. Mirrors the backend
 * ``NumberChartCustomizations`` schema — the same shape used by the number chart.
 * All fields optional; consumers must guard before reading.
 */
export interface KPICustomizations {
  numberFormat?: NumberFormat;
  decimalPlaces?: number;
  numberPrefix?: string;
  numberSuffix?: string;
}

/**
 * Typed container for ``KPI.extra_config``. Always present on responses (the
 * backend column has ``default=dict, null=False``). ``customizations`` inside
 * is optional — must be checked before reading.
 */
export interface KPIExtraConfig {
  customizations?: KPICustomizations;
}

export interface KPI {
  id: number;
  name: string;
  metric: Metric;
  target_value: number | null;
  direction: 'increase' | 'decrease';
  green_threshold_pct: number;
  amber_threshold_pct: number;
  time_grain: string;
  time_dimension_column: string | null;
  metric_type_tag: string | null;
  program_tags: string[];
  display_order: number;
  extra_config: KPIExtraConfig; // always present
  created_by?: string; // creator's email
  created_at: string;
  updated_at: string;
}

export interface KPICreate {
  metric_id: number;
  name?: string;
  target_value?: number;
  direction: string;
  green_threshold_pct?: number;
  amber_threshold_pct?: number;
  time_grain: string;
  time_dimension_column: string;
  metric_type_tag?: string;
  program_tags?: string[];
  extra_config: KPIExtraConfig; // required — form always sends it
}

export interface KPIUpdate {
  metric_id?: number;
  name?: string;
  target_value?: number;
  direction?: string;
  green_threshold_pct?: number;
  amber_threshold_pct?: number;
  time_grain?: string;
  time_dimension_column?: string | null;
  metric_type_tag?: string;
  program_tags?: string[];
  display_order?: number;
  extra_config: KPIExtraConfig; // required on every update
}

export interface KPIListResponse {
  data: KPI[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// KPI data response from /api/kpis/{id}/data/ (same shape as ChartDataResponse)
export interface KPIDataPayload {
  current_value: number | null;
  target_value: number | null;
  direction: string;
  rag_status: RAGStatus | null;
  time_grain: string;
  periods: { period: string; period_date: string | null; value: number | null }[];
  data_last_date: string | null;
  // Display customizations (surfaced so the dashboard widget / snapshot
  // viewer can format the current value without a second fetch). Null when
  // the KPI has no formatting configured.
  customizations: KPICustomizations | null;
}

export type NoteType = 'beneficiary_quote' | 'note';

export interface AnnotationEntry {
  id: number;
  note_type: NoteType;
  period_key: string;
  period_date: string | null;
  content: string;
  snapshot_value: number | null;
  snapshot_pop_change: number | null;
  created_by_email: string;
  last_modified_by_email: string;
  created_at: string;
  updated_at: string;
}

export interface AnnotationEntryCreate {
  note_type: NoteType;
  period_key: string;
  period_date?: string;
  content: string;
  snapshot_value?: number;
  snapshot_pop_change?: number;
}

export interface AnnotationEntryUpdate {
  note_type?: NoteType;
  period_key?: string;
  period_date?: string;
  content?: string;
  snapshot_value?: number;
  snapshot_pop_change?: number;
}
