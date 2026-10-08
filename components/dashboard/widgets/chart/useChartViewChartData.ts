import { useMemo } from 'react';
import useSWR from 'swr';
import { apiGet } from '@/lib/api';
import { resolveDashboardFilters } from '@/lib/dashboard-filter-utils';
import { ChartTypes, type ChartDataPayload } from '@/types/charts';
import type { FrozenChartConfig } from '@/types/reports';
import type { TableDrillDownState } from '@/components/charts/logic/payload';
import type { WidgetChartLike } from './logic/chart-widget-map';
import { getWidgetTableDimensions, toTableDrillFilters } from './logic/chart-widget-table';

export interface ChartViewChartDataOptions {
  chartId: number;
  isPublicMode: boolean;
  publicToken?: string;
  frozenChartConfig?: FrozenChartConfig;
  snapshotId?: number;
  dashboardFilters: Record<string, unknown>;
  dashboardFilterConfigs: Parameters<typeof resolveDashboardFilters>[1];
  effectiveChart: (WidgetChartLike & { computation_type?: string }) | undefined;
  tableDrillDownState: TableDrillDownState | null;
}

/** Chart data by mode: GET (dashboard), report POST (snapshot), public fetch; plus the payload CSV export and tables share. */
export function useChartViewChartData({
  chartId,
  isPublicMode,
  publicToken,
  frozenChartConfig,
  snapshotId,
  dashboardFilters,
  dashboardFilterConfigs,
  effectiveChart,
  tableDrillDownState,
}: ChartViewChartDataOptions) {
  // Resolve dashboard filters to complete column information for maps and tables
  const resolvedDashboardFilters = useMemo(() => {
    if (Object.keys(dashboardFilters).length === 0 || dashboardFilterConfigs.length === 0) {
      return [];
    }
    return resolveDashboardFilters(dashboardFilters, dashboardFilterConfigs);
  }, [dashboardFilters, dashboardFilterConfigs]);

  // Create a unique identifier for when filters change to trigger instance recreation
  const filterHash = useMemo(() => JSON.stringify(dashboardFilters), [dashboardFilters]);

  // Build query params with filters
  const queryParams = new URLSearchParams();
  if (Object.keys(dashboardFilters).length > 0) {
    queryParams.append('dashboard_filters', JSON.stringify(dashboardFilters));
  }

  // Use public API endpoint if in public mode, otherwise use regular API
  const apiUrl =
    isPublicMode && publicToken
      ? `/api/v1/public/dashboards/${publicToken}/charts/${chartId}/data${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      : `/api/charts/${chartId}/data/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  // Custom fetcher for public mode
  const fetcher = isPublicMode
    ? async (url: string) => {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`);
        if (!response.ok) {
          throw new Error('Failed to fetch chart data');
        }
        const data = await response.json();
        return data;
      }
    : apiGet;

  // Fetch chart data with filters (skip for map and table charts - they use specialized endpoints)
  // Only fetch when we know the chart type and it's not a map or table
  // Skip in report mode — reports use the POST endpoint with frozenChartConfig instead
  const shouldFetchChartData =
    effectiveChart && !frozenChartConfig
      ? effectiveChart.chart_type !== ChartTypes.MAP &&
        effectiveChart.chart_type !== ChartTypes.TABLE
      : false;
  const {
    data: chartDataGet,
    isLoading: isLoadingGet,
    error: isErrorGet,
    mutate: mutateGet,
  } = useSWR(shouldFetchChartData ? apiUrl : null, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: 0, // Disable auto-refresh
    // Don't retry on 404 errors
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      // Never retry on 404
      if (error?.message?.includes('404') || error?.message?.includes('not found')) {
        return;
      }
      // Only retry up to 3 times for other errors
      if (retryCount >= 3) return;

      // Retry after 1 second
      setTimeout(() => revalidate({ retryCount }), 1000);
    },
    onSuccess: (data) => {
      // Chart data fetched successfully
    },
    onError: (error) => {
      console.error('Error fetching chart data:', error);
    },
  });

  // Build chartDataPayload for ALL chart types (for CSV export and table data) - use useMemo to update when drill-down state changes
  const chartDataPayload: ChartDataPayload | null = useMemo(
    () =>
      effectiveChart
        ? {
            chart_type: effectiveChart.chart_type,
            computation_type: effectiveChart.computation_type as 'raw' | 'aggregated',
            schema_name: effectiveChart.schema_name,
            table_name: effectiveChart.table_name,
            x_axis: effectiveChart.extra_config?.x_axis_column,
            y_axis: effectiveChart.extra_config?.y_axis_column,
            // For map charts, use geographic_column as dimension_col
            dimension_col:
              effectiveChart.chart_type === ChartTypes.MAP
                ? effectiveChart.extra_config?.geographic_column
                : effectiveChart.extra_config?.dimension_column,
            // For map charts, use value_column or aggregate_column
            aggregate_col:
              effectiveChart.chart_type === ChartTypes.MAP
                ? effectiveChart.extra_config?.value_column ||
                  effectiveChart.extra_config?.aggregate_column
                : effectiveChart.extra_config?.aggregate_column,
            aggregate_func: effectiveChart.extra_config?.aggregate_function || 'sum',
            extra_dimension: effectiveChart.extra_config?.extra_dimension_column,
            // ✅ FIX: Include dimensions array for table charts with drill-down support
            ...(effectiveChart.chart_type === ChartTypes.TABLE && {
              dimensions: getWidgetTableDimensions(
                effectiveChart.extra_config,
                tableDrillDownState
              ),
            }),
            metrics: effectiveChart.extra_config?.metrics,
            geographic_column: effectiveChart.extra_config?.geographic_column,
            value_column: effectiveChart.extra_config?.value_column,
            selected_geojson_id: effectiveChart.extra_config?.selected_geojson_id,
            customizations: effectiveChart.extra_config?.customizations,
            extra_config: {
              filters: [
                // Include chart-level filters
                ...(effectiveChart.extra_config?.filters || []),
                // Add drill-down filters from tableDrillDownState
                ...(effectiveChart.chart_type === ChartTypes.TABLE
                  ? toTableDrillFilters(tableDrillDownState)
                  : []),
              ],
              pagination: effectiveChart.extra_config?.pagination,
              sort: effectiveChart.extra_config?.sort,
            },
            // Dashboard filters are sent via the `dashboard_filters` query
            // string and resolved server-side (same as the chart-data and
            // table-preview endpoints), so they are not injected here.
          }
        : null,
    [effectiveChart, tableDrillDownState, resolvedDashboardFilters, dashboardFilters]
  );

  // Report/frozen mode: fetch chart data via POST with inline config (no chart ID needed)
  const isPublicReport = isPublicMode && !!frozenChartConfig;
  const shouldFetchReportChartData =
    !!frozenChartConfig && !!chartDataPayload && !!effectiveChart
      ? effectiveChart.chart_type !== 'map' && effectiveChart.chart_type !== 'table'
      : false;

  const {
    data: chartDataPost,
    isLoading: isLoadingPost,
    error: isErrorPost,
    mutate: mutatePost,
  } = useSWR(
    shouldFetchReportChartData ? ['report-chart-data', chartId, filterHash] : null,
    shouldFetchReportChartData
      ? isPublicReport
        ? async () => {
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002'}/api/v1/public/reports/${publicToken}/charts/${chartId}/data/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return response.json();
          }
        : () =>
            apiGet(
              `/api/reports/${snapshotId}/charts/${chartId}/data/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
            )
      : null,
    { revalidateOnFocus: false, revalidateOnReconnect: false, refreshInterval: 0 }
  );

  // Unified chart data — one source is always null depending on mode
  const chartData = chartDataPost ?? chartDataGet;
  const isLoading = isLoadingPost || isLoadingGet;
  const isError = isErrorPost || isErrorGet;
  const mutate = frozenChartConfig ? mutatePost : mutateGet;

  return { filterHash, chartData, isLoading, isError, mutate, chartDataPayload, isPublicReport };
}
