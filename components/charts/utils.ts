import type { ChartBuilderFormData, ChartMetric } from '@/types/charts';

// Chart-builder tab values → stable analytics labels. The raw Radix tab values
// ('configuration', 'chart', …) are UI details that could be renamed; these
// labels are the analytics contract and must not change once shipped.
// Both the create page (app/charts/new/configure) and the edit page
// (app/charts/[id]/edit) render the same tabs, so the map is shared.
export const CHART_BUILDER_TAB_ANALYTICS: Record<string, string> = {
  // Left panel
  configuration: 'data_configuration',
  styling: 'chart_styling',
  // Right panel (preview)
  chart: 'preview_chart',
  data: 'preview_data',
};

// The three ways a measure can be defined — same vocabulary as the MetricsSelector
// mode tabs, and the same values MetricsSelector/KpiMetricStep send as
// `metric_type` on METRIC_CREATED. One name for one concept across all events.
export const METRIC_TYPES = {
  // Pulled from the metrics library (Saved tab).
  SAVED: 'saved',
  // A one-off SQL expression typed into the builder, not saved to the library.
  CALCULATED: 'calculated',
  // Plain aggregation over a column (COUNT/SUM/…).
  SIMPLE: 'simple',
} as const;

export type MetricType = (typeof METRIC_TYPES)[keyof typeof METRIC_TYPES];

function getMetricType(metric: ChartMetric): MetricType {
  if (metric.saved_metric_id != null) return METRIC_TYPES.SAVED;
  if (metric.column_expression != null) return METRIC_TYPES.CALCULATED;
  return METRIC_TYPES.SIMPLE;
}

// Analytics properties describing HOW a chart's measures were built, for
// CHART_CREATED / CHART_UPDATED. Only categorical values and counts — never the
// alias, column, or expression text, which are warehouse-derived (PII rule in
// .claude/rules/analytics.md).
// `metric_types` is an array because one chart can mix types; PostHog breaks
// arrays down per element, so a breakdown gives "charts using a saved metric"
// without needing a separate boolean per type. Deduped + sorted so the same mix
// always yields the same breakdown value regardless of the order added.
// Note: map charts configure their measure via aggregate_column/aggregate_function
// rather than `metrics`, so they legitimately report metric_count: 0.
export function getMetricAnalyticsProps(metrics?: ChartMetric[] | null) {
  const list = metrics ?? [];
  return {
    metric_count: list.length,
    metric_types: Array.from(new Set(list.map(getMetricType))).sort(),
  };
}

// Was drill-down configured on this chart? Answers "do authors set it up", which is
// a different question from CHART_DRILLED_DOWN ("do viewers use it") — join the two
// to find charts configured for drill-down that nobody ever drills.
//
// Both drillable chart types are covered, they just store the config differently:
//   map   → the existing `drill_down_enabled` config field (simplified/legacy system)
//           OR geographic_hierarchy.drill_down_levels (dynamic system). This is the
//           same expression the payload builder uses in ChartBuilder.tsx — kept
//           identical on purpose so the event can never disagree with what was saved.
//   table → extra_config.dimensions[].enable_drill_down (per-dimension toggle, and
//           tables have no `drill_down_enabled` field of their own).
// Non-drillable types (bar/line/pie/number/pivot) always report false.
export function isDrillDownEnabled(formData: ChartBuilderFormData): boolean {
  if (formData.chart_type === 'map') {
    return Boolean(
      formData.drill_down_enabled ||
        (formData.geographic_hierarchy?.drill_down_levels?.length || 0) > 0
    );
  }
  if (formData.chart_type === 'table') {
    return Boolean(formData.dimensions?.some((dimension) => dimension.enable_drill_down === true));
  }
  return false;
}

// Distinct saved-metric ids a chart consumes — one METRIC_USED per id.
// Deduped because the same saved metric can be added to a chart twice.
export function getUsedSavedMetricIds(metrics?: ChartMetric[] | null): number[] {
  return Array.from(
    new Set(
      (metrics ?? [])
        .map((metric) => metric.saved_metric_id)
        .filter((id): id is number => id != null)
    )
  );
}

// Saved metrics newly attached by this edit — pass `previous` when updating an
// existing chart so re-saving (e.g. after only a colour tweak) doesn't re-fire
// METRIC_USED for metrics that were already on the chart. Mirrors the KPI form,
// which fires METRIC_USED only when the KPI is pointed at a different metric.
export function getNewlyUsedSavedMetricIds(
  metrics?: ChartMetric[] | null,
  previous?: ChartMetric[] | null
): number[] {
  const before = new Set(getUsedSavedMetricIds(previous));
  return getUsedSavedMetricIds(metrics).filter((id) => !before.has(id));
}
