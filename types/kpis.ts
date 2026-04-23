import type { Metric } from './metrics';

export type RAGStatus = 'green' | 'amber' | 'red';

export const RAG_COLORS: Record<RAGStatus, { bg: string; text: string; label: string }> = {
  green: { bg: 'bg-green-100', text: 'text-green-700', label: 'On Track' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'At Risk' },
  red: { bg: 'bg-red-100', text: 'text-red-700', label: 'Off Track' },
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
  trend_periods: number;
  metric_type_tag: string | null;
  program_tags: string[];
  display_order: number;
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
  time_dimension_column?: string;
  trend_periods?: number;
  metric_type_tag?: string;
  program_tags?: string[];
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
  trend_periods?: number;
  metric_type_tag?: string;
  program_tags?: string[];
  display_order?: number;
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
  periods: { period: string; value: number | null }[];
}
