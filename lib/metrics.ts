import type { Metric } from '@/types/metrics';

/**
 * Human-readable formula for a metric — e.g. `SUM(amount)`, `COUNT(*)`, or the
 * raw `column_expression` for Calculated metrics.
 */
export function formatMetricExpression(
  metric: Pick<Metric, 'column' | 'aggregation' | 'column_expression'>
): string {
  if (metric.column_expression) return metric.column_expression;
  if (metric.aggregation === 'count' && !metric.column) return 'COUNT(*)';
  return `${(metric.aggregation || '').toUpperCase()}(${metric.column ?? ''})`;
}
