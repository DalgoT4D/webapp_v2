import type { ChartMetric } from '@/types/charts';

/** Display name for COUNT(*) — matches the auto-prefilled metric. */
export const DEFAULT_METRIC_ALIAS = 'Total Count';

/** Second line of a metric row's trigger: the expression (first 40 chars) or AGG(column). */
export function summaryOf(metric: ChartMetric): string {
  return metric.column_expression
    ? metric.column_expression.slice(0, 40)
    : `${(metric.aggregation || '').toUpperCase()}(${metric.column || '*'})`;
}

/** Auto display name for a Simple metric: "Total Count" for count-all-rows, else AGG(column). */
export function autoLabel(agg?: string | null, col?: string | null): string {
  const a = (agg || 'count').toLowerCase();
  if (a === 'count' && (!col || col === '*')) return DEFAULT_METRIC_ALIAS;
  return `${a.toUpperCase()}(${col || '*'})`;
}
