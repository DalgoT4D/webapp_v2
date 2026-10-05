'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { PoweredByDalgoImage } from '@/components/ui/powered-by-dalgo-image';
import { OrgBrand } from '@/components/ui/org-brand';
import {
  AlertCircle,
  RefreshCw,
  Maximize2,
  Download,
  Loader2,
  FileImage,
  FileText,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import PivotTableChart from '@/components/charts/chart-types/pivot-table/PivotTableChart';
import { getPivotRenderProps } from '@/components/charts/chart-types/pivot-table/utils';
import type { PivotTableResponse } from '@/types/pivot-table';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import { apiGet, apiPublicPost } from '@/lib/api';
import {
  useChart,
  useChartDataPreview,
  useChartDataPreviewTotalRows,
  useMapDataOverlay,
  useGeoJSONData,
  useRegions,
  useRegionGeoJSONs,
} from '@/hooks/api/useChart';
import { transformMapDataOverlayPayload } from '@/components/charts/logic/map-overlay';
import { ChartTitleEditor } from './chart-title-editor';
import { TableChart } from '@/components/charts/chart-types/table/TableChart';
import { MapPreview } from '@/components/charts/chart-types/map/MapPreview';
import { type ChartTitleConfig } from '@/lib/chart-title-utils';
import { resolveDashboardFilters } from '@/lib/dashboard-filter-utils';
import { resolveDrillDownGeoJSON } from '@/lib/map-drilldown-utils';
import { ChartTypes, type ChartDataPayload, type ChartDimension } from '@/types/charts';
import { CHART_DRILL_SOURCES } from '@/constants/analytics';
import { useDrillDownAnalytics } from '@/components/charts/useDrillDownAnalytics';
import type { FrozenChartConfig } from '@/types/reports';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useMapDrillPath } from '@/components/dashboard/widgets/chart/useMapDrillPath';
import { useChartWidgetTable } from '@/components/dashboard/widgets/chart/useChartWidgetTable';
import { showWidgetDrillToasts } from '@/components/dashboard/widgets/chart/drill-toasts';
import { MapDrillBreadcrumb } from '@/components/dashboard/widgets/chart/MapDrillBreadcrumb';
import { TableDrillBreadcrumb } from '@/components/dashboard/widgets/chart/TableDrillBreadcrumb';
import { buildChartWidgetOption } from '@/components/dashboard/widgets/chart/logic/chart-widget-option';
import {
  buildWidgetTableConfig,
  getChartWidgetErrorMessage,
  getWidgetTableDimensions,
  toTableDrillFilters,
} from '@/components/dashboard/widgets/chart/logic/chart-widget-table';
import {
  buildWidgetMapOverlayPayload,
  collectDrillFilters,
  resolveWidgetMapLayer,
  resolveWidgetRegionClick,
} from '@/components/dashboard/widgets/chart/logic/chart-widget-map';
import { buildChartWidgetExportHandlers } from '@/components/dashboard/widgets/chart/chart-widget-export';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import * as echarts from 'echarts/core';
import {
  BarChart,
  LineChart,
  PieChart,
  GaugeChart,
  ScatterChart,
  HeatmapChart,
  MapChart,
} from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  ToolboxComponent,
  DataZoomComponent,
  VisualMapComponent,
  GeoComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { CommentPopover } from '@/components/reports/comment-popover';
import { findChartCommentStateBuggyChartIdLookup } from '@/components/reports/logic/comments';
import type { CommentStates } from '@/types/comments';

// Register necessary ECharts components
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GaugeChart,
  ScatterChart,
  HeatmapChart,
  MapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  ToolboxComponent,
  DataZoomComponent,
  VisualMapComponent,
  GeoComponent,
  CanvasRenderer,
]);

interface ChartElementViewProps {
  chartId: number;
  dashboardFilters?: Record<string, any>;
  dashboardFilterConfigs?: Array<{
    id: string;
    name: string;
    schema_name: string;
    table_name: string;
    column_name: string;
    filter_type: 'value' | 'numerical' | 'datetime';
    settings?: any;
  }>; // Dashboard filter configurations for resolution
  viewMode?: boolean;
  className?: string;
  isPublicMode?: boolean;
  publicToken?: string; // Required when isPublicMode=true
  config?: ChartTitleConfig; // For dashboard title configuration
  frozenChartConfig?: FrozenChartConfig; // Frozen chart config from report snapshot
  snapshotId?: number; // Report snapshot ID for comments
  commentStates?: CommentStates; // Comment states array with target_type and chart_id
  onCommentStateChange?: () => void; // Callback when comment state changes
  autoOpenCommentChartId?: string; // Chart ID whose comment popover should auto-open
  canModerateComments?: boolean; // Caller has Edit access on the parent report — enables moderator Delete
  orgLogoUrl?: string | null; // Organization logo URL for fullscreen overlay
  onView?: () => void; // Authenticated dashboard/report navigation to chart detail
}

export function ChartElementView({
  chartId,
  dashboardFilters = {},
  dashboardFilterConfigs = [],
  viewMode = true,
  className,
  isPublicMode = false,
  publicToken,
  config = {},
  frozenChartConfig,
  snapshotId,
  commentStates,
  onCommentStateChange,
  autoOpenCommentChartId,
  canModerateComments = false,
  orgLogoUrl,
  onView,
}: ChartElementViewProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null); // Separate ref for table charts
  const wrapperRef = useRef<HTMLDivElement>(null); // Wrapper ref for fullscreen (stable element)
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const mapChartInstance = useRef<echarts.ECharts | null>(null); // Separate ref for map charts
  const { drillDownPath, setDrillDownPath, handleDrillUp, handleDrillHome } = useMapDrillPath();

  // Container size for responsive legend
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Use unified fullscreen hook
  const { isFullscreen, toggleFullscreen } = useFullscreen('chart');

  // Check if this chart is a map early so we can skip regions fetch for non-map charts.
  // In report mode frozenChartConfig is available immediately; otherwise we wait for useChart.
  const mightBeMap = frozenChartConfig ? frozenChartConfig.chart_type === ChartTypes.MAP : true; // default to true for dashboard mode until chart metadata loads

  // Fetch regions data only for map charts
  const { data: privateRegions } = useRegions(!isPublicMode && mightBeMap ? 'IND' : null, 'state');

  // Use public regions API for public mode (only for map charts)
  const publicRegionsUrl =
    isPublicMode && publicToken && mightBeMap
      ? `/api/v1/public/regions/?country_code=IND&region_type=state`
      : null;

  const { data: publicRegions } = useSWR(publicRegionsUrl, async (url: string) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`);
    if (!response.ok) {
      throw new Error('Failed to fetch public regions');
    }
    return response.json();
  });

  const regions = isPublicMode ? publicRegions : privateRegions;

  // Fetch chart metadata to determine chart type (skip in public mode and report/frozen mode)
  const {
    data: chart,
    isLoading: chartLoading,
    error: chartError,
  } = useChart(isPublicMode || frozenChartConfig ? null : chartId);

  // Resolve dashboard filters to complete column information for maps and tables
  const resolvedDashboardFilters = useMemo(() => {
    if (Object.keys(dashboardFilters).length === 0 || dashboardFilterConfigs.length === 0) {
      return [];
    }
    return resolveDashboardFilters(dashboardFilters, dashboardFilterConfigs);
  }, [dashboardFilters, dashboardFilterConfigs]);

  // Create a unique identifier for when filters change to trigger instance recreation
  const filterHash = useMemo(() => JSON.stringify(dashboardFilters), [dashboardFilters]);
  const previousFilterHash = useRef<string>(filterHash);

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

  // Fetch chart metadata - public vs private mode
  const publicChartMetadataUrl =
    isPublicMode && publicToken && !frozenChartConfig
      ? `/api/v1/public/dashboards/${publicToken}/charts/${chartId}/`
      : null;

  const { data: publicChartMetadata, isLoading: publicChartLoading } = useSWR(
    publicChartMetadataUrl,
    isPublicMode
      ? async (url: string) => {
          const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.json();
        }
      : null,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0,
    }
  );

  // Private mode metadata (skip in report/frozen mode)
  const { data: chartMetadata, error: metadataError } = useSWR(
    !isPublicMode && !frozenChartConfig ? `/api/charts/${chartId}` : null,
    apiGet,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0,
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
    }
  );

  // Use frozen config in report mode, public metadata in public mode, or chart in private mode
  const effectiveChart = frozenChartConfig || (isPublicMode ? publicChartMetadata : chart);

  const {
    tablePage,
    setTablePage,
    tablePageSize,
    handleTablePageSizeChange,
    tableDrillDownState,
    handleTableRowClick,
    handleTableDrillUp,
    currentDimensionColumn,
  } = useChartWidgetTable(effectiveChart);

  // Drill-down engagement on a chart embedded in a dashboard. Disabled on public
  // share links and report snapshots — those are anonymous surfaces covered by
  // PUBLIC_DASHBOARD_VIEWED / report events, not by per-chart engagement events.
  useDrillDownAnalytics({
    chartId,
    chartType: effectiveChart?.chart_type,
    source: CHART_DRILL_SOURCES.DASHBOARD,
    mapLevel: drillDownPath.length,
    tableLevel: tableDrillDownState?.currentLevel ?? null,
    enabled: !isPublicMode && !frozenChartConfig,
  });

  // Determine chart type using effective chart
  const isTableChart = effectiveChart?.chart_type === ChartTypes.TABLE;
  const isPivotTableChart = effectiveChart?.chart_type === ChartTypes.PIVOT_TABLE;
  const isMapChart = effectiveChart?.chart_type === ChartTypes.MAP;

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

  // Get the actual error message with improved messaging
  const rawErrorMessage =
    metadataError?.message ||
    (isTableChart
      ? tableError?.message
      : isMapChart
        ? mapError?.message || geojsonError?.message
        : isError?.message) ||
    'Chart configuration needs adjustment';

  const errorMessage = getChartWidgetErrorMessage(rawErrorMessage);

  // Handle region click for drill-down (rebuilt every render: the chart effect lists it as a dependency)
  const handleRegionClick = (regionName: string) => {
    const click = resolveWidgetRegionClick(
      {
        chart: effectiveChart,
        legacyGateChart: chart, // MODE-DRIFT: private-page chart only
        regions,
        drillDownPath,
        activeGeographicColumn,
        regionName,
      },
      'view'
    );
    if (!click) return;
    showWidgetDrillToasts(click.toasts);
    if (click.nextLevel) setDrillDownPath([...drillDownPath, click.nextLevel]);
  };

  // Initialize and update chart
  useEffect(() => {
    if (!chartRef.current) {
      return undefined;
    }

    // Check if filters changed and we need to recreate the chart instance
    const filtersChanged = previousFilterHash.current !== filterHash;

    // Get the appropriate data source based on chart type
    let activeChartData;

    if (isMapChart) {
      // Maps now use MapPreview component, skip manual ECharts creation
      return undefined;
    } else {
      activeChartData = chartData;
    }

    if (filtersChanged && chartInstance.current && activeChartData?.echarts_config) {
      chartInstance.current.dispose();
      chartInstance.current = null;
      previousFilterHash.current = filterHash;
    }

    // Initialize chart instance if it doesn't exist
    if (!chartInstance.current) {
      try {
        chartInstance.current = echarts.init(chartRef.current, null, {
          renderer: 'canvas',
        });
      } catch (error) {
        console.error('Failed to create chart instance:', error);
        return undefined;
      }
    }

    // Only proceed with config if we have valid echarts_config
    if (!activeChartData?.echarts_config) {
      // Clear chart but don't dispose instance
      if (chartInstance.current) {
        chartInstance.current.clear();
      }
      return undefined;
    }

    // Styled option: legend for the container size, HTML title, labels/axes/tooltip, formatting
    const styledConfig = buildChartWidgetOption({
      baseConfig: activeChartData.echarts_config,
      chartType: effectiveChart?.chart_type,
      customizations: effectiveChart?.extra_config?.customizations || {},
      containerSize,
      variant: 'view',
    });

    try {
      // Force notMerge to ensure axis title styling is applied
      chartInstance.current.setOption(styledConfig, true);

      // Click event listeners for non-map charts only (maps use MapPreview component)
      if (!isMapChart) {
        // Add any non-map click handlers here if needed
      }

      // Ensure the chart is properly sized after setting options
      chartInstance.current.resize();
    } catch (error) {
      console.error('Error setting chart option for chart', chartId, error);
    }

    // Handle resize
    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    // Resize observer for container changes - also tracks container size for responsive legends
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          // Update container size state for responsive legends
          setContainerSize((prev) => {
            if (prev.width !== width || prev.height !== height) {
              return { width, height };
            }
            return prev;
          });
          chartInstance.current?.resize();
        }
      }
    });

    resizeObserver.observe(chartRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [
    chartData,
    mapDataOverlay,
    geojsonData,
    isMapChart,
    chartId,
    filterHash,
    drillDownPath,
    handleRegionClick,
    isFullscreen, // Add fullscreen state to trigger chart resize
    containerSize, // Update when container size changes for responsive legends
  ]);

  // Re-fetch data when filters change (dashboard mode only).
  // In report mode, SWR keys already include filterHash so refetch is automatic.
  useEffect(() => {
    if (!frozenChartConfig) {
      mutate();
    }
  }, [dashboardFilters, mutate, chartId, frozenChartConfig]);

  // Re-fetch map data when filters change (dashboard mode only, same reason as above)
  useEffect(() => {
    if (isMapChart && mutateMapData && !frozenChartConfig) {
      mutateMapData();
    }
  }, [dashboardFilters, mutateMapData, chartId, isMapChart, frozenChartConfig]);

  // Cleanup on unmount and when chartId changes
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [chartId]);

  const handleRefresh = () => {
    mutate();
  };

  // Handle map chart ready callback to capture the ECharts instance
  const handleMapChartReady = (chart: echarts.ECharts) => {
    mapChartInstance.current = chart;
  };

  const { handleDownloadImage, handleDownloadCSV } = buildChartWidgetExportHandlers({
    chartId,
    effectiveChart,
    chartMetadata,
    frozenChartConfig,
    chartData,
    chartDataPayload,
    dashboardFilters,
    isPublicMode,
    publicToken,
    isTableChart,
    isPivotTableChart,
    isMapChart,
    orgLogoUrl,
    tableRef,
    chartInstance,
    mapChartInstance,
  });

  const handleToggleFullscreen = () => {
    // Use wrapper ref for stable fullscreen (prevents exit on drill down)
    // For tables/pivots, use tableRef; for all charts (including maps), use wrapperRef
    const targetRef = isTableChart || isPivotTableChart ? tableRef.current : wrapperRef.current;
    if (!targetRef) return;

    toggleFullscreen(targetRef);
  };

  // Handle chart resize when fullscreen state changes
  useEffect(() => {
    // Trigger chart resize after fullscreen change
    const resizeTimer = setTimeout(() => {
      if (!isTableChart && !isPivotTableChart) {
        // Only resize ECharts instances, not tables/pivots
        if (chartInstance.current) {
          chartInstance.current.resize();
        }
        if (mapChartInstance.current) {
          mapChartInstance.current.resize();
        }
      }
      // Tables/pivots don't need explicit resize - they automatically adjust with CSS flexbox
    }, 100);

    return () => clearTimeout(resizeTimer);
  }, [isFullscreen, isTableChart, isPivotTableChart]);

  if (
    isLoading ||
    (!isPublicMode && chartLoading) ||
    // In public mode, wait for chart metadata to load before evaluating chart type or data
    (isPublicMode && publicChartLoading) ||
    (isTableChart && tableLoading) ||
    (isMapChart && (mapLoading || geojsonLoading))
  ) {
    return (
      <div className={cn('relative w-full h-full min-h-[300px]', className)}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-sm text-muted-foreground">
              {isTableChart && tableLoading
                ? 'Loading table data...'
                : isMapChart && (mapLoading || geojsonLoading)
                  ? geojsonLoading
                    ? 'Loading map boundaries...'
                    : 'Loading map data...'
                  : 'Loading chart...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (
    isError ||
    chartError ||
    (isTableChart && tableError) ||
    (isMapChart && (mapError || geojsonError)) ||
    (!isTableChart && !isMapChart && !chartData) ||
    (isMapChart && (!mapDataOverlay || !geojsonData))
  ) {
    return (
      <div className={cn('h-full flex flex-col items-center justify-start pt-20 p-4', className)}>
        <div className="w-full max-w-md">
          <div className="flex items-center p-4 border border-red-200 rounded-lg bg-red-50 shadow-lg">
            <AlertCircle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Chart Error</p>
              <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="mt-3 h-8 text-xs border-red-300 text-red-700 hover:bg-red-100"
                data-testid={`dashboard-chart-retry-btn-${chartId}`}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'h-full relative group flex flex-col min-h-0',
        className,
        isFullscreen && '!h-screen !w-screen !bg-white p-4'
      )}
      style={{
        ...(isFullscreen && {
          backgroundColor: 'white !important',
          background: 'white !important',
        }),
      }}
    >
      {/* Fullscreen overlay: org branding + chart title + powered by */}
      {isFullscreen && (
        <>
          <div className="flex-shrink-0 flex items-center justify-between px-2 pb-2 pointer-events-none">
            {/* Left: org logo + name */}
            <OrgBrand logoUrl={orgLogoUrl} />
            {/* Center: chart title */}
            <span className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-gray-800 truncate max-w-[50%]">
              {effectiveChart?.title}
            </span>
          </div>
        </>
      )}

      {/* View toolbar: reveal on hover/focus, and keep visible on touch devices. */}
      {viewMode && !frozenChartConfig && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
          <div className="flex gap-1 bg-white/90 backdrop-blur rounded-md shadow-sm p-1">
            {onView && !isPublicMode && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title="View Chart"
                aria-label="View Chart"
                onClick={onView}
                data-testid={`dashboard-chart-view-btn-${chartId}`}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Download"
                  data-testid={`dashboard-chart-download-trigger-${chartId}`}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={handleDownloadImage}
                  className="cursor-pointer"
                  data-testid={`dashboard-chart-download-png-${chartId}`}
                >
                  <FileImage className="w-4 h-4 mr-2" />
                  <span>Download as PNG</span>
                </DropdownMenuItem>
                {effectiveChart?.chart_type !== ChartTypes.NUMBER && (
                  <DropdownMenuItem
                    onClick={handleDownloadCSV}
                    className="cursor-pointer"
                    data-testid={`dashboard-chart-download-csv-${chartId}`}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    <span>Export Data as CSV</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleFullscreen}
              className="h-7 w-7 p-0"
              title="Fullscreen"
              data-testid={`dashboard-chart-fullscreen-btn-${chartId}`}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          {isFullscreen && (
            <div className="pointer-events-none pr-2">
              <PoweredByDalgoImage imageClassName="max-h-9" />
            </div>
          )}
        </div>
      )}

      {/* Chart title row — hidden in fullscreen (title shown in overlay instead) */}
      <div
        className={cn('flex items-start gap-2 px-2 pt-2 flex-shrink-0', isFullscreen && 'hidden')}
      >
        <div className="flex-1 min-w-0">
          <ChartTitleEditor
            chartData={frozenChartConfig || (isPublicMode ? effectiveChart : chartMetadata)}
            config={config}
            onTitleChange={() => {}} // Read-only in view mode
            isEditMode={false}
          />
        </div>
        {onView && !isPublicMode && frozenChartConfig && (
          <div className="flex-shrink-0 mt-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              title="View Chart"
              aria-label="View Chart"
              onClick={onView}
              data-testid={`dashboard-chart-view-btn-${chartId}`}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {frozenChartConfig && snapshotId && (
          <div className="flex-shrink-0 mt-0.5">
            <CommentPopover
              snapshotId={snapshotId}
              targetType="chart"
              chartId={chartId}
              state={findChartCommentStateBuggyChartIdLookup(commentStates, chartId)}
              triggerClassName="h-7 w-7 p-0"
              onStateChange={onCommentStateChange}
              autoOpen={autoOpenCommentChartId === String(chartId)}
              canModerate={canModerateComments}
            />
          </div>
        )}
      </div>

      {/* Drill-down navigation for maps */}
      {isMapChart && drillDownPath.length > 0 && (
        <MapDrillBreadcrumb
          chartId={chartId}
          drillDownPath={drillDownPath}
          onHome={handleDrillHome}
          onDrillUp={handleDrillUp}
        />
      )}

      {/* Chart container */}
      {isPivotTableChart ? (
        <div ref={tableRef} className="w-full flex-1 h-full overflow-auto p-2">
          {chartData?.data ? (
            <PivotTableChart
              data={chartData.data as unknown as PivotTableResponse}
              {...getPivotRenderProps(effectiveChart?.extra_config)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : 'No data available'}
            </div>
          )}
        </div>
      ) : isTableChart ? (
        <div
          ref={tableRef}
          className={cn(
            'w-full flex-1 h-full flex flex-col',
            isFullscreen && '!h-full !min-h-[90vh] !bg-white'
          )}
          style={{
            ...(isFullscreen && {
              backgroundColor: 'white !important',
              background: 'white !important',
            }),
          }}
        >
          {/* Breadcrumb navigation for drill-down */}
          {tableDrillDownState && (
            <TableDrillBreadcrumb
              chartId={chartId}
              appliedFilters={tableDrillDownState.appliedFilters}
              onBack={handleTableDrillUp}
            />
          )}
          <div className="flex-1 overflow-hidden min-h-0 p-4">
            <TableChart
              data={Array.isArray(tableData?.data) ? tableData.data : []}
              config={buildWidgetTableConfig(
                effectiveChart?.extra_config,
                tableData?.columns,
                tableDrillDownState
              )}
              isLoading={tableLoading}
              error={tableError}
              pagination={
                tableData?.data?.length > 0
                  ? {
                      page: tablePage,
                      pageSize: tablePageSize,
                      total: isPublicMode ? publicTableTotalRows || 0 : privateTableTotalRows || 0,
                      onPageChange: setTablePage,
                      onPageSizeChange: handleTablePageSizeChange,
                    }
                  : undefined
              }
              onRowClick={handleTableRowClick}
              drillDownEnabled={effectiveChart?.extra_config?.dimensions?.some(
                (dim: ChartDimension) => dim.enable_drill_down === true
              )}
              currentDimensionColumn={currentDimensionColumn}
            />
          </div>
        </div>
      ) : isMapChart ? (
        <div
          ref={chartRef}
          className={cn(
            'w-full flex-1 h-full min-h-[200px]',
            isFullscreen && '!h-full !min-h-[90vh] !bg-white'
          )}
          style={{
            padding: viewMode ? '8px' : '0',
            ...(isFullscreen && {
              backgroundColor: 'white !important',
              background: 'white !important',
            }),
          }}
        >
          <MapPreview
            geojsonData={geojsonData?.geojson_data}
            geojsonLoading={geojsonLoading}
            geojsonError={geojsonError}
            mapData={mapDataOverlay?.data}
            mapDataLoading={mapLoading}
            mapDataError={mapError}
            title=""
            valueColumn={
              effectiveChart?.extra_config?.metrics?.[0]?.alias ||
              effectiveChart?.extra_config?.aggregate_column
            }
            customizations={effectiveChart?.extra_config?.customizations}
            onRegionClick={handleRegionClick}
            drillDownPath={drillDownPath}
            onDrillUp={handleDrillUp}
            onDrillHome={handleDrillHome}
            showBreadcrumbs={false}
            onChartReady={handleMapChartReady}
          />
        </div>
      ) : (
        <div className="flex-1 w-full h-full overflow-visible">
          <div
            ref={chartRef}
            className={cn(
              'chart-container w-full h-full',
              isFullscreen && '!h-full !min-h-[90vh] !bg-white'
            )}
            style={{
              ...(isFullscreen && {
                backgroundColor: 'white !important',
                background: 'white !important',
              }),
            }}
          />
        </div>
      )}
    </div>
  );
}
