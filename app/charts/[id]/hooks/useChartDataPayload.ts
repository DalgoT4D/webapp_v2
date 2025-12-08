'use client';

import { useMemo } from 'react';
import type {
  ChartDataPayload,
  ChartFilter,
  ChartPagination,
  ChartSort,
  ChartMetric,
} from '@/types/charts';

interface Chart {
  chart_type: string;
  computation_type?: 'raw' | 'aggregated';
  schema_name: string;
  table_name: string;
  extra_config?: {
    x_axis_column?: string;
    y_axis_column?: string;
    dimension_column?: string;
    aggregate_column?: string;
    aggregate_function?: string;
    extra_dimension_column?: string;
    geographic_column?: string;
    value_column?: string;
    selected_geojson_id?: number;
    layers?: Array<{ geojson_id?: number }>;
    table_columns?: string[];
    customizations?: Record<string, unknown>;
    time_grain?: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | null;
    metrics?: ChartMetric[];
    filters?: ChartFilter[];
    pagination?: ChartPagination;
    sort?: ChartSort[];
  };
}

/**
 * useChartDataPayload - Builds the chart data payload from chart configuration
 *
 * Extracts all the payload building logic from ChartDetailClient to keep it clean
 */
export function useChartDataPayload(chart: Chart | null | undefined): ChartDataPayload | null {
  return useMemo(() => {
    if (!chart) return null;

    const computationType = chart.computation_type || 'aggregated';

    const basePayload: ChartDataPayload = {
      chart_type: chart.chart_type,
      computation_type: computationType,
      schema_name: chart.schema_name,
      table_name: chart.table_name,
      x_axis: chart.extra_config?.x_axis_column,
      y_axis: chart.extra_config?.y_axis_column,
      dimension_col: chart.extra_config?.dimension_column,
      aggregate_col: chart.extra_config?.aggregate_column,
      aggregate_func: chart.extra_config?.aggregate_function || 'sum',
      extra_dimension: chart.extra_config?.extra_dimension_column,
      geographic_column: chart.extra_config?.geographic_column,
      value_column: chart.extra_config?.value_column,
      selected_geojson_id: getSelectedGeojsonId(chart),
      customizations: (chart.extra_config?.customizations as Record<string, any>) || {},
      metrics: chart.extra_config?.metrics,
      extra_config: {
        time_grain: chart.extra_config?.time_grain,
        filters: chart.extra_config?.filters,
        pagination: chart.extra_config?.pagination,
        sort: chart.extra_config?.sort,
      },
    };

    // Add map-specific fields
    if (chart.chart_type === 'map') {
      basePayload.dimension_col = chart.extra_config?.geographic_column;
      basePayload.aggregate_col =
        chart.extra_config?.aggregate_column || chart.extra_config?.value_column;
    }

    return basePayload;
  }, [chart]);
}

/**
 * Helper to get the selected geojson ID from chart config
 */
function getSelectedGeojsonId(chart: Chart): number | undefined {
  if (chart.extra_config?.selected_geojson_id) {
    return chart.extra_config.selected_geojson_id;
  }

  if (chart.chart_type === 'map' && chart.extra_config?.layers?.[0]?.geojson_id) {
    return chart.extra_config.layers[0].geojson_id;
  }

  return undefined;
}
