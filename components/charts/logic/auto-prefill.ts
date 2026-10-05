import type { ChartBuilderFormData } from '@/types/charts';

/**
 * True when the chart already has data fields, so auto-prefill must leave it alone.
 * Same rule in the create page's prefill effect and ChartDataConfigurationV3's.
 */
export function hasExistingChartConfig(config: ChartBuilderFormData): boolean {
  return !!(
    config.dimension_column ||
    config.aggregate_column ||
    config.geographic_column ||
    config.x_axis_column ||
    config.y_axis_column ||
    config.table_columns?.length ||
    (config.metrics && config.metrics.length > 0)
  );
}

/** MapDataConfigurationV3's narrower rule (value_column counts, axis/table fields don't). */
export function hasExistingMapConfig(config: ChartBuilderFormData): boolean {
  return !!(
    config.geographic_column ||
    config.value_column ||
    config.aggregate_column ||
    (config.metrics && config.metrics.length > 0)
  );
}
