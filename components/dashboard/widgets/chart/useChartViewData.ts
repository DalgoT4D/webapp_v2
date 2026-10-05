'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { apiGet, apiPublicPost } from '@/lib/api';
import {
  useChartDataPreview,
  useChartDataPreviewTotalRows,
  useGeoJSONData,
  useMapDataOverlay,
  useRegionGeoJSONs,
} from '@/hooks/api/useChart';
import { transformMapDataOverlayPayload } from '@/components/charts/logic/map-overlay';
import { resolveDashboardFilters } from '@/lib/dashboard-filter-utils';
import { resolveDrillDownGeoJSON } from '@/lib/map-drilldown-utils';
import { ChartTypes, type ChartDataPayload } from '@/types/charts';
import type { FrozenChartConfig } from '@/types/reports';
import type { TableDrillDownState } from '@/components/charts/logic/payload';
import {
  buildWidgetMapOverlayPayload,
  collectDrillFilters,
  resolveWidgetMapLayer,
  type WidgetChartLike,
  type WidgetMapDrillLevel,
} from './logic/chart-widget-map';
import { getWidgetTableDimensions, toTableDrillFilters } from './logic/chart-widget-table';

interface ChartViewDataOptions {
  chartId: number;
  isPublicMode: boolean;
  publicToken?: string;
  frozenChartConfig?: FrozenChartConfig;
  snapshotId?: number;
  dashboardFilters: Record<string, unknown>;
  dashboardFilterConfigs: Parameters<typeof resolveDashboardFilters>[1];
  effectiveChart: (WidgetChartLike & { computation_type?: string }) | undefined;
  isTableChart: boolean;
  isMapChart: boolean;
  tablePage: number;
  tablePageSize: number;
  tableDrillDownState: TableDrillDownState | null;
  drillDownPath: WidgetMapDrillLevel[];
}

/** Every request a view chart widget makes (GET / report POST / public fetch; table; map), by mode. */
export function useChartViewData({
  chartId,
  isPublicMode,
  publicToken,
  frozenChartConfig,
  snapshotId,
  dashboardFilters,
  dashboardFilterConfigs,
  effectiveChart,
  isTableChart,
  isMapChart,
  tablePage,
  tablePageSize,
  tableDrillDownState,
  drillDownPath,
}: ChartViewDataOptions) {
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

  // For table charts - public vs private mode
  const publicTableDataUrl =
    isPublicMode && publicToken && isTableChart
      ? isPublicReport
        ? `/api/v1/public/reports/${publicToken}/charts/${chartId}/data-preview/`
        : `/api/v1/public/dashboards/${publicToken}/charts/${chartId}/data-preview/`
      : null;

  const {
    data: publicTableData,
    error: publicTableError,
    isLoading: publicTableLoading,
  } = useSWR(
    publicTableDataUrl
      ? isPublicReport
        ? [publicTableDataUrl, tablePage, tablePageSize, dashboardFilters]
        : [publicTableDataUrl, chartDataPayload, tablePage, tablePageSize, dashboardFilters]
      : null,
    isPublicMode && isTableChart
      ? isPublicReport
        ? async ([url, page, size, filters]: [string, number, number, Record<string, any>]) => {
            // Public report: GET — server builds payload from frozen config
            const qp = new URLSearchParams({
              page: (page - 1).toString(),
              limit: size.toString(),
            });
            if (Object.keys(filters).length > 0) {
              qp.append('dashboard_filters', JSON.stringify(filters));
            }
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002'}${url}?${qp}`
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return response.json();
          }
        : async ([url, payload, page, size, filters]: [
            string,
            ChartDataPayload,
            number,
            number,
            Record<string, any>,
          ]) => {
            // Public dashboard: POST with payload (unchanged)
            const qp = new URLSearchParams({
              page: (page - 1).toString(),
              limit: size.toString(),
            });
            if (Object.keys(filters).length > 0) {
              qp.append('dashboard_filters', JSON.stringify(filters));
            }
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002'}${url}?${qp}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              }
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return response.json();
          }
      : null,
    { revalidateOnFocus: false, revalidateOnReconnect: false, refreshInterval: 0 }
  );

  // Private mode table data. In report mode, only fetch once snapshotId is
  // available — don't fall back to the live-chart endpoint while it's still
  // missing.
  const isTableReadyToFetch = frozenChartConfig ? !!snapshotId : true;
  const {
    data: privateTableData,
    error: privateTableError,
    isLoading: privateTableLoading,
  } = useChartDataPreview(
    !isPublicMode && isTableChart && isTableReadyToFetch ? chartDataPayload : null,
    tablePage,
    tablePageSize,
    dashboardFilters,
    frozenChartConfig ? snapshotId : null,
    chartId
  );

  // Get total rows for table pagination (private mode, only for table charts)
  const { data: privateTableTotalRows } = useChartDataPreviewTotalRows(
    !isPublicMode && isTableChart && isTableReadyToFetch ? chartDataPayload : null,
    dashboardFilters,
    frozenChartConfig ? snapshotId : null,
    chartId
  );

  // Get total rows for table pagination (public mode)
  const publicTableTotalRowsUrl =
    isPublicMode && publicToken && isTableChart
      ? isPublicReport
        ? `/api/v1/public/reports/${publicToken}/charts/${chartId}/total-rows/`
        : `/api/v1/public/dashboards/${publicToken}/charts/${chartId}/data-preview/total-rows/`
      : null;

  const { data: publicTableTotalRowsData } = useSWR(
    publicTableTotalRowsUrl
      ? isPublicReport
        ? [publicTableTotalRowsUrl, dashboardFilters]
        : [publicTableTotalRowsUrl, chartDataPayload, dashboardFilters]
      : null,
    isPublicMode && isTableChart
      ? isPublicReport
        ? async ([url, filters]: [string, Record<string, any>]) => {
            // Public report: GET — server builds payload from frozen config
            const qp = new URLSearchParams();
            if (Object.keys(filters).length > 0) {
              qp.append('dashboard_filters', JSON.stringify(filters));
            }
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002'}${url}${qp.toString() ? `?${qp}` : ''}`
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return response.json();
          }
        : async ([url, payload, filters]: [string, ChartDataPayload, Record<string, any>]) => {
            // Public dashboard: POST with payload (unchanged)
            const qp = new URLSearchParams();
            if (Object.keys(filters).length > 0) {
              qp.append('dashboard_filters', JSON.stringify(filters));
            }
            return apiPublicPost(url, payload, qp);
          }
      : null,
    { revalidateOnFocus: false, revalidateOnReconnect: false, refreshInterval: 0 }
  );

  const publicTableTotalRows = publicTableTotalRowsData?.total_rows;

  // Use appropriate table data based on mode
  const tableData = isPublicMode ? publicTableData : privateTableData;
  const tableError = isPublicMode ? publicTableError : privateTableError;
  const tableLoading = isPublicMode ? publicTableLoading : privateTableLoading;

  // Get the current drill-down region ID for dynamic geojson fetching
  const currentDrillDownRegionId =
    drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1].region_id : null;

  // Fetch geojsons for the current drill-down region - use public API for public mode
  const {
    data: privateRegionGeojsons,
    error: privateRegionGeojsonsError,
    isLoading: privateRegionGeojsonsLoading,
  } = useRegionGeoJSONs(!isPublicMode ? currentDrillDownRegionId : null);

  // Use public geojsons API for public mode
  const publicGeojsonsUrl =
    isPublicMode && publicToken && currentDrillDownRegionId
      ? `/api/v1/public/regions/${currentDrillDownRegionId}/geojsons/`
      : null;

  const {
    data: publicRegionGeojsons,
    error: publicRegionGeojsonsError,
    isLoading: publicRegionGeojsonsLoading,
  } = useSWR(publicGeojsonsUrl, async (url: string) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`);
    if (!response.ok) {
      throw new Error('Failed to fetch public geojsons');
    }
    return response.json();
  });

  const regionGeojsons = isPublicMode ? publicRegionGeojsons : privateRegionGeojsons;
  const regionGeojsonsError = isPublicMode ? publicRegionGeojsonsError : privateRegionGeojsonsError;
  const regionGeojsonsLoading = isPublicMode
    ? publicRegionGeojsonsLoading
    : privateRegionGeojsonsLoading;

  // For map charts, determine which geojson and data to fetch based on drill-down state
  const activeDrillDownLevel =
    drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1] : null;
  const drillDownGeojsonResolution = resolveDrillDownGeoJSON({
    isDrillDownActive: Boolean(activeDrillDownLevel),
    regionId: currentDrillDownRegionId,
    regionGeojsons,
    regionGeojsonsLoading,
    regionGeojsonsError,
    fallbackGeojsonId: activeDrillDownLevel?.geojson_id,
  });
  const { activeGeojsonId, activeGeographicColumn } = resolveWidgetMapLayer(
    effectiveChart,
    drillDownPath,
    drillDownGeojsonResolution.geojsonId
  );

  // Build data overlay payload for map charts based on current level
  // Include filters for drill-down selections - flatten all parent selections
  const filters = collectDrillFilters(drillDownPath);

  const mapDataOverlayPayload = useMemo(
    () =>
      buildWidgetMapOverlayPayload(
        effectiveChart,
        activeGeographicColumn,
        filters,
        dashboardFilters
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same dependency list as before (filters is new each render)
    [
      effectiveChart?.chart_type,
      effectiveChart?.schema_name,
      effectiveChart?.table_name,
      effectiveChart?.extra_config,
      activeGeographicColumn,
      filters,
      dashboardFilters,
    ]
  );

  // Fetch GeoJSON data - public vs private mode
  const publicGeojsonUrl =
    isPublicMode && publicToken && activeGeojsonId && isMapChart
      ? `/api/v1/public/geojsons/${activeGeojsonId}/`
      : null;

  const {
    data: publicGeojsonData,
    error: publicGeojsonError,
    isLoading: publicGeojsonLoading,
  } = useSWR(
    publicGeojsonUrl,
    isPublicMode && isMapChart
      ? async (url: string) => {
          const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`);
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          return response.json();
        }
      : null,
    { revalidateOnFocus: false, revalidateOnReconnect: false, refreshInterval: 0 }
  );

  // Private mode geojson data
  const {
    data: privateGeojsonData,
    error: privateGeojsonError,
    isLoading: privateGeojsonLoading,
  } = useGeoJSONData(!isPublicMode ? activeGeojsonId : null);

  // Use appropriate geojson data based on mode
  const geojsonData = isPublicMode ? publicGeojsonData : privateGeojsonData;
  const geojsonDataError = isPublicMode ? publicGeojsonError : privateGeojsonError;
  const geojsonDataLoading = isPublicMode ? publicGeojsonLoading : privateGeojsonLoading;
  const geojsonError = regionGeojsonsError || geojsonDataError;
  const geojsonLoading = drillDownGeojsonResolution.isResolving || geojsonDataLoading;

  // Fetch map data overlay - public vs private mode
  // Apply same payload transformation as useMapDataOverlay (handles count, builds metrics)
  const transformedPublicMapPayload = useMemo(
    () => (isPublicMode ? transformMapDataOverlayPayload(mapDataOverlayPayload) : null),
    [isPublicMode, mapDataOverlayPayload]
  );

  const publicMapDataUrl =
    isPublicMode && publicToken && transformedPublicMapPayload && isMapChart
      ? isPublicReport
        ? `/api/v1/public/reports/${publicToken}/charts/${chartId}/map-data/`
        : `/api/v1/public/dashboards/${publicToken}/charts/${chartId}/map-data/`
      : null;

  const {
    data: publicMapData,
    error: publicMapError,
    isLoading: publicMapLoading,
    mutate: mutatePublicMapData,
  } = useSWR(
    publicMapDataUrl ? [publicMapDataUrl, JSON.stringify(transformedPublicMapPayload)] : null,
    isPublicMode && isMapChart
      ? async (key: string | [string, string]) => {
          const url = Array.isArray(key) ? key[0] : key;
          return apiPublicPost(url, transformedPublicMapPayload);
        }
      : null,
    { revalidateOnFocus: false, revalidateOnReconnect: false, refreshInterval: 0 }
  );

  // Private mode map data — dashboards and reports resolve dashboard filters
  // differently server-side, so they route to different endpoints.
  // In report mode, only fetch once snapshotId is available — don't fall
  // back to the live-dashboard endpoint while it's still missing.
  const isMapReadyToFetch = frozenChartConfig ? !!snapshotId : true;
  const {
    data: privateMapDataOverlay,
    error: privateMapError,
    isLoading: privateMapLoading,
    mutate: mutatePrivateMapData,
  } = useMapDataOverlay(
    !isPublicMode && isMapReadyToFetch ? mapDataOverlayPayload : null,
    frozenChartConfig ? snapshotId : null,
    chartId
  );

  // Use appropriate map data based on mode
  const mapDataOverlay = isPublicMode ? publicMapData : privateMapDataOverlay;
  const mapError = isPublicMode ? publicMapError : privateMapError;
  const mapLoading = isPublicMode ? publicMapLoading : privateMapLoading;
  const mutateMapData = isPublicMode ? mutatePublicMapData : mutatePrivateMapData;

  return {
    filterHash,
    chartData,
    isLoading,
    isError,
    mutate,
    chartDataPayload,
    isPublicReport,
    tableData,
    tableError,
    tableLoading,
    privateTableTotalRows,
    publicTableTotalRows,
    regionGeojsonsError,
    geojsonData,
    geojsonError,
    geojsonLoading,
    mapDataOverlay,
    mapError,
    mapLoading,
    mutateMapData,
    activeGeographicColumn,
  };
}
