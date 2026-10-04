import type { ChartBuilderFormData, ChartMetric } from '@/types/charts';
import { ChartTypes } from '@/types/charts';
import type { ChartBuilderKind } from '@/components/charts/chart-types/default-customizations';

/** A metric is usable if it is an expression, a COUNT, or an aggregation over a column. */
export function isMetricValid(metric: ChartMetric): boolean {
  return !!(
    metric.column_expression ||
    (metric.aggregation && (metric.aggregation.toLowerCase() === 'count' || metric.column))
  );
}

function areAllMetricsValid(metrics: ChartMetric[]): boolean {
  return metrics.every(isMetricValid);
}

/** Charts saved before the metrics array existed: aggregate_function + aggregate_column. */
function isLegacyAggregateValid(config: ChartBuilderFormData): boolean {
  return !!(
    config.aggregate_function &&
    (config.aggregate_function === 'count' || config.aggregate_column)
  );
}

function isNumberConfigured(config: ChartBuilderFormData): boolean {
  const metric = config.metrics?.[0];
  return metric ? isMetricValid(metric) : isLegacyAggregateValid(config);
}

/** Map rule used for saving and by the edit page's preview: COUNT needs no value column. */
function isMapConfigured(config: ChartBuilderFormData): boolean {
  const metric = config.metrics?.[0];
  if (metric) {
    return !!(config.geographic_column && config.selected_geojson_id && isMetricValid(metric));
  }
  const needsValueColumn = config.aggregate_function?.toLowerCase() !== 'count';
  return !!(
    config.geographic_column &&
    (!needsValueColumn || config.value_column) &&
    config.aggregate_function &&
    config.selected_geojson_id
  );
}

/** Create page's preview rule for legacy maps: always wants a value column. PINNED-BUGS: differs from edit. */
function isMapReadyForCreatePreview(config: ChartBuilderFormData): boolean {
  if (config.metrics?.[0]) return isMapConfigured(config);
  return !!(
    config.geographic_column &&
    config.value_column &&
    config.aggregate_function &&
    config.selected_geojson_id
  );
}

/** Create page's preview rule for tables. PINNED-BUGS: the edit page treats any table as ready. */
function isTableReadyForCreatePreview(config: ChartBuilderFormData): boolean {
  const hasDimensions =
    (config.dimensions &&
      config.dimensions.length > 0 &&
      config.dimensions.some((d) => d.column)) ||
    !!config.dimension_column;
  if (hasDimensions) return true;
  if (config.metrics && config.metrics.length > 0) return areAllMetricsValid(config.metrics);
  return false;
}

function isPivotConfigured(config: ChartBuilderFormData): boolean {
  const hasRowDimensions = ((config.extra_config?.row_dimensions as string[]) || []).length > 0;
  const metrics = config.metrics || [];
  return hasRowDimensions && metrics.length > 0 && areAllMetricsValid(metrics);
}

const METRICS_ARRAY_CHART_TYPES: string[] = [ChartTypes.BAR, ChartTypes.LINE, ChartTypes.PIE];

/** Bar, line, pie (and unknown types): dimension + valid metrics, or the legacy single metric. */
function isDimensionChartConfigured(config: ChartBuilderFormData): boolean {
  const usesMetricsArray =
    METRICS_ARRAY_CHART_TYPES.includes(config.chart_type || '') &&
    config.metrics &&
    config.metrics.length > 0;
  if (usesMetricsArray) {
    return !!(config.dimension_column && areAllMetricsValid(config.metrics!));
  }
  return !!(config.dimension_column && isLegacyAggregateValid(config));
}

/** Is the chart configured enough to fetch preview data? */
export function isChartReady(config: ChartBuilderFormData, builder: ChartBuilderKind): boolean {
  if (!config.schema_name || !config.table_name || !config.chart_type) return false;

  switch (config.chart_type) {
    case ChartTypes.NUMBER:
      return isNumberConfigured(config);
    case ChartTypes.MAP:
      // PINNED-BUGS: create and edit builders differ (C-E7 / C-B3)
      return builder === 'create' ? isMapReadyForCreatePreview(config) : isMapConfigured(config);
    case ChartTypes.TABLE:
      // PINNED-BUGS: create and edit builders differ (C-E7 / C-B3)
      return builder === 'create' ? isTableReadyForCreatePreview(config) : true;
    case ChartTypes.PIVOT_TABLE:
      return isPivotConfigured(config);
    default:
      return isDimensionChartConfigured(config);
  }
}

/** Can the chart be saved? Same rule on the create and edit pages. */
export function canSaveChart(config: ChartBuilderFormData): boolean {
  if (!config.title || !config.chart_type || !config.schema_name || !config.table_name)
    return false;

  switch (config.chart_type) {
    case ChartTypes.NUMBER:
      return isNumberConfigured(config);
    case ChartTypes.MAP:
      return isMapConfigured(config);
    case ChartTypes.TABLE:
      return true;
    case ChartTypes.PIVOT_TABLE:
      return isPivotConfigured(config);
    default:
      return isDimensionChartConfigured(config); // PINNED-BUGS: "Removing the only bar metric leaves Save enabled"
  }
}
