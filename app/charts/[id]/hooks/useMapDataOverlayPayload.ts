'use client';

import { useMemo } from 'react';

interface ChartExtraConfig {
  aggregate_column?: string;
  value_column?: string;
  aggregate_function?: string;
  filters?: Array<{
    column: string;
    operator: string;
    value: string;
  }>;
  pagination?: {
    enabled: boolean;
    page_size: number;
  };
  sort?: Array<{
    column: string;
    direction: 'asc' | 'desc';
  }>;
}

interface Chart {
  chart_type: string;
  schema_name: string;
  table_name: string;
  extra_config?: ChartExtraConfig;
}

interface MapDataOverlayPayload {
  schema_name: string;
  table_name: string;
  geographic_column: string;
  value_column: string | undefined;
  aggregate_function: string;
  filters: Record<string, string>;
  chart_filters: Array<{ column: string; operator: string; value: string }>;
  extra_config: {
    filters: Array<{ column: string; operator: string; value: string }>;
    pagination?: { enabled: boolean; page_size: number };
    sort?: Array<{ column: string; direction: 'asc' | 'desc' }>;
  };
}

/**
 * useMapDataOverlayPayload - Builds the payload for fetching map data overlay
 *
 * Returns null if the chart is not a map or required fields are missing
 */
export function useMapDataOverlayPayload(
  chart: Chart | null | undefined,
  activeGeographicColumn: string | null,
  filters: Record<string, string>
): MapDataOverlayPayload | null {
  return useMemo(() => {
    if (chart?.chart_type !== 'map' || !chart.extra_config || !activeGeographicColumn) {
      return null;
    }

    return {
      schema_name: chart.schema_name,
      table_name: chart.table_name,
      geographic_column: activeGeographicColumn,
      value_column: chart.extra_config.aggregate_column || chart.extra_config.value_column,
      aggregate_function: chart.extra_config.aggregate_function || 'sum',
      filters,
      chart_filters: chart.extra_config.filters || [],
      extra_config: {
        filters: chart.extra_config.filters || [],
        pagination: chart.extra_config.pagination,
        sort: chart.extra_config.sort,
      },
    };
  }, [chart, activeGeographicColumn, filters]);
}
