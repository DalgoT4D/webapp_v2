import type { ChartBuilderFormData, ChartDataPayload } from '@/types/charts';

/**
 * Check if form data is complete enough to generate chart data for preview.
 * Used to determine if we should fetch chart preview data.
 */
export function isChartDataReady(formData: ChartBuilderFormData): boolean {
  if (!formData.schema_name || !formData.table_name || !formData.chart_type) {
    return false;
  }

  if (formData.chart_type === 'number') {
    return !!(
      formData.aggregate_function &&
      (formData.aggregate_function === 'count' || formData.aggregate_column)
    );
  }

  if (formData.chart_type === 'map') {
    return !!(
      formData.geographic_column &&
      formData.value_column &&
      formData.aggregate_function &&
      formData.selected_geojson_id
    );
  }

  // For bar/line/pie/table charts with multiple metrics
  if (
    ['bar', 'line', 'pie', 'table'].includes(formData.chart_type || '') &&
    formData.metrics &&
    formData.metrics.length > 0
  ) {
    return !!(
      formData.dimension_column &&
      formData.metrics.every(
        (metric) =>
          metric.aggregation && (metric.aggregation.toLowerCase() === 'count' || metric.column)
      )
    );
  }

  // For single metric charts (legacy)
  return !!(
    formData.dimension_column &&
    formData.aggregate_function &&
    (formData.aggregate_function === 'count' || formData.aggregate_column)
  );
}

/**
 * Check if form data is valid for saving/creating a chart.
 * More strict than isChartDataReady - requires title as well.
 */
export function isChartFormValid(formData: ChartBuilderFormData): boolean {
  if (!formData.title || !formData.chart_type || !formData.schema_name || !formData.table_name) {
    return false;
  }

  if (formData.chart_type === 'number') {
    const needsAggregateColumn = formData.aggregate_function !== 'count';
    return !!(formData.aggregate_function && (!needsAggregateColumn || formData.aggregate_column));
  }

  if (formData.chart_type === 'map') {
    // Count(*) doesn't need a value_column
    const needsValueColumn = formData.aggregate_function?.toLowerCase() !== 'count';
    return !!(
      formData.geographic_column &&
      (!needsValueColumn || formData.value_column) &&
      formData.aggregate_function &&
      formData.selected_geojson_id
    );
  }

  if (formData.chart_type === 'table') {
    return true; // Tables just need schema, table, title which are already checked above
  }

  // For bar/line/pie charts with multiple metrics
  if (
    ['bar', 'line', 'pie'].includes(formData.chart_type || '') &&
    formData.metrics &&
    formData.metrics.length > 0
  ) {
    return !!(
      formData.dimension_column &&
      formData.metrics.every(
        (metric) =>
          metric.aggregation && (metric.aggregation.toLowerCase() === 'count' || metric.column)
      )
    );
  }

  // Legacy single metric approach
  const needsAggregateColumn = formData.aggregate_function !== 'count';
  return !!(
    formData.dimension_column &&
    formData.aggregate_function &&
    (!needsAggregateColumn || formData.aggregate_column)
  );
}

/**
 * Build the chart data payload for fetching chart preview data.
 * Returns null if the form data is not ready.
 */
export function buildChartDataPayload(formData: ChartBuilderFormData): ChartDataPayload | null {
  if (!isChartDataReady(formData)) {
    return null;
  }

  return {
    chart_type: formData.chart_type!,
    computation_type: formData.computation_type!,
    schema_name: formData.schema_name!,
    table_name: formData.table_name!,
    ...(formData.x_axis_column && { x_axis: formData.x_axis_column }),
    ...(formData.y_axis_column && { y_axis: formData.y_axis_column }),
    ...(formData.dimension_column && { dimension_col: formData.dimension_column }),
    ...(formData.aggregate_column && { aggregate_col: formData.aggregate_column }),
    ...(formData.aggregate_function && { aggregate_func: formData.aggregate_function }),
    ...(formData.extra_dimension_column && {
      extra_dimension: formData.extra_dimension_column,
    }),
    // Multiple metrics for bar/line charts
    ...(formData.metrics && { metrics: formData.metrics }),
    ...(formData.geographic_column && { geographic_column: formData.geographic_column }),
    ...(formData.value_column && { value_column: formData.value_column }),
    ...(formData.selected_geojson_id && { selected_geojson_id: formData.selected_geojson_id }),
    ...(formData.chart_type === 'map' &&
      formData.layers?.[0]?.geojson_id && {
        selected_geojson_id: formData.layers[0].geojson_id,
      }),
    ...(formData.chart_type === 'map' && {
      ...(formData.geographic_column && { dimension_col: formData.geographic_column }),
      ...((formData.aggregate_column || formData.value_column) && {
        aggregate_col: formData.aggregate_column || formData.value_column,
      }),
    }),
    customizations: formData.customizations,
    extra_config: {
      filters: formData.filters,
      pagination: formData.pagination,
      sort: formData.sort,
      time_grain: formData.time_grain,
    },
  };
}
