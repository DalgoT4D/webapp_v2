import { useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { apiGet } from '@/lib/api';
import { useChart } from '@/hooks/api/useCharts';
import {
  useChartDataPreview,
  useChartDataPreviewTotalRows,
  useMapDataOverlay,
  useGeoJSONData,
  useRegions,
  useRegionGeoJSONs,
} from '@/hooks/api/useChart';
import {
  resolveDashboardFilters,
  formatAsChartFilters,
  type DashboardFilterConfig,
} from '@/lib/dashboard-filter-utils';
import { resolveDrillDownGeoJSON } from '@/lib/map-drilldown-utils';
import { ChartTypes, type ChartDataPayload } from '@/types/charts';
import type { useMapDrillPath } from '@/components/dashboard/widgets/chart/useMapDrillPath';
import { useChartWidgetTable } from '@/components/dashboard/widgets/chart/useChartWidgetTable';
import { showWidgetDrillToasts } from '@/components/dashboard/widgets/chart/drill-toasts';
import {
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

type MapDrill = ReturnType<typeof useMapDrillPath>;

interface BuilderChartDataOptions {
  chartId: number;
  appliedFilters: Record<string, any>;
  dashboardFilterConfigs: DashboardFilterConfig[];
  drillDownPath: MapDrill['drillDownPath'];
  setDrillDownPath: MapDrill['setDrillDownPath'];
}

/**
 * Every request the builder's chart widget makes (chart, table preview + total, map regions,
 * geojson, overlay) and the derived loading / error state. Moved verbatim from chart-element-builder.
 * `handleRegionClick` is rebuilt every render on purpose: the instance hook's update effect lists it.
 */
export function useBuilderChartData({
  chartId,
  appliedFilters,
  dashboardFilterConfigs,
  drillDownPath,
  setDrillDownPath,
}: BuilderChartDataOptions) {
  // Resolve dashboard filters to complete column information for maps and tables
  const resolvedDashboardFilters = useMemo(() => {
    if (Object.keys(appliedFilters).length === 0 || dashboardFilterConfigs.length === 0) {
      return [];
    }
    return resolveDashboardFilters(appliedFilters, dashboardFilterConfigs);
  }, [appliedFilters, dashboardFilterConfigs]);

  const {
    data: chart,
    isLoading: chartLoading,
    isError: chartError,
    error: chartFetchError,
  } = useChart(chartId);

  const {
    tablePage,
    setTablePage,
    tablePageSize,
    handleTablePageSizeChange,
    tableDrillDownState,
    handleTableRowClick,
    handleTableDrillUp,
    currentDimensionColumn,
  } = useChartWidgetTable(chart);

  // Create a unique identifier for when filters change to trigger data refetch
  const filterHash = useMemo(() => JSON.stringify(appliedFilters), [appliedFilters]);

  // Build query params with filters
  const queryParams = new URLSearchParams();
  if (Object.keys(appliedFilters).length > 0) {
    queryParams.append('dashboard_filters', JSON.stringify(appliedFilters));
  }

  const apiUrl = `/api/charts/${chartId}/data/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  // Determine if this is a map chart
  const isMapChart = useMemo(() => {
    return chart ? chart.chart_type === ChartTypes.MAP : false;
  }, [chart]);

  const isPieChart = useMemo(() => {
    return chart ? chart.chart_type === ChartTypes.PIE : false;
  }, [chart]);

  const isNumberChart = useMemo(() => {
    return chart ? chart.chart_type === ChartTypes.NUMBER : false;
  }, [chart]);

  const isLineChart = chart?.chart_type === ChartTypes.LINE;
  const isBarChart = chart?.chart_type === ChartTypes.BAR;

  // Determine current level for drill-down
  const currentLevel = drillDownPath.length;
  // Build data overlay payload for map charts based on current level
  // Include filters for drill-down selections - flatten all parent selections
  const filters = collectDrillFilters(drillDownPath);

  // Fetch regions data for dynamic geojson lookup
  const { data: regions } = useRegions('IND', 'state');

  // Get the current drill-down region ID for dynamic geojson fetching
  const currentDrillDownRegionId =
    drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1].region_id : null;

  // Fetch geojsons for the current drill-down region (e.g., Karnataka districts)
  const {
    data: regionGeojsons,
    error: regionGeojsonsError,
    isLoading: regionGeojsonsLoading,
  } = useRegionGeoJSONs(currentDrillDownRegionId);

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
    chart,
    drillDownPath,
    drillDownGeojsonResolution.geojsonId
  );

  // Now that activeGeographicColumn is defined, create the map data overlay payload
  const mapDataOverlayPayload = useMemo(
    () => buildWidgetMapOverlayPayload(chart, activeGeographicColumn, filters, appliedFilters),
    [
      chart?.chart_type,
      chart?.schema_name,
      chart?.table_name,
      chart?.extra_config,
      activeGeographicColumn,
      filters,
      appliedFilters, // Use raw appliedFilters (filter_id -> value mapping)
    ]
  );

  // Log map payload only when drill down is active
  useEffect(() => {
    if (isMapChart && mapDataOverlayPayload && drillDownPath.length > 0) {
      console.log(
        `🗺️ Map data overlay for ${drillDownPath[drillDownPath.length - 1]?.name || 'region'}`
      );
    }
  }, [isMapChart, mapDataOverlayPayload, drillDownPath]);

  // Now fetch the data that depends on the above variables
  const {
    data: geojsonData,
    error: geojsonDataError,
    isLoading: geojsonDataLoading,
  } = useGeoJSONData(activeGeojsonId);

  const geojsonError = regionGeojsonsError || geojsonDataError;
  const geojsonLoading = drillDownGeojsonResolution.isResolving || geojsonDataLoading;

  // Fetch map data using the working map-data-overlay endpoint
  const {
    data: mapDataOverlay,
    error: mapError,
    isLoading: mapLoading,
    mutate: mutateMapData,
  } = useMapDataOverlay(mapDataOverlayPayload);

  // Keep important drill down logging for debugging
  useEffect(() => {
    if (drillDownPath.length > 0) {
      console.log(
        `🗺️ Map drill down active: Level ${currentLevel}, GeoJSON ID: ${activeGeojsonId}`
      );
    }
  }, [drillDownPath.length, currentLevel, activeGeojsonId]);

  // Fetch chart data with filters (skip for map and table charts - they use specialized endpoints)
  const shouldFetchChartData = chart
    ? chart.chart_type !== ChartTypes.MAP && chart.chart_type !== ChartTypes.TABLE
    : false; // Don't fetch if chart is not loaded yet

  const {
    data: chartData,
    isLoading: dataLoading,
    error: dataError,
    mutate: mutateChartData,
  } = useSWR(shouldFetchChartData ? apiUrl : null, apiGet, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: 0, // Disable auto-refresh
    // Don't retry on 404 errors or data generation errors
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      // Never retry on 404 or data generation errors
      if (
        error?.message?.includes('404') ||
        error?.message?.includes('not found') ||
        error?.message?.includes('Error generating chart data')
      ) {
        return;
      }
      // Only retry up to 1 time for other errors (reduced from 3)
      if (retryCount >= 1) return;

      // Retry after 1 second
      setTimeout(() => revalidate({ retryCount }), 1000);
    },
    onSuccess: (data) => {
      // Chart data fetched successfully
    },
    onError: (error) => {
      // Only log errors for non-map charts since maps should use specialized endpoints
      if (chart?.chart_type !== ChartTypes.MAP) {
        console.error(
          `❌ [${chart?.chart_type?.toUpperCase()}] Error fetching data for chart ${chartId}:`,
          {
            chart_type: chart?.chart_type,
            filters: appliedFilters,
            apiUrl,
            error: error.message,
            shouldFetch: shouldFetchChartData,
          }
        );
      }
    },
  });

  // For table charts, also fetch raw data using data preview API
  const chartDataPayload: ChartDataPayload | null = useMemo(() => {
    if (chart?.chart_type === ChartTypes.TABLE && chart) {
      const formattedFilters = formatAsChartFilters(
        resolvedDashboardFilters.filter(
          (filter) =>
            filter.schema_name === chart.schema_name && filter.table_name === chart.table_name
        )
      );

      return {
        chart_type: chart.chart_type,
        computation_type: chart.computation_type as 'raw' | 'aggregated',
        schema_name: chart.schema_name,
        table_name: chart.table_name,
        x_axis: chart.extra_config?.x_axis_column,
        y_axis: chart.extra_config?.y_axis_column,
        dimension_col: chart.extra_config?.dimension_column,
        aggregate_col: chart.extra_config?.aggregate_column,
        aggregate_func: chart.extra_config?.aggregate_function || 'sum',
        extra_dimension: chart.extra_config?.extra_dimension_column,
        // ✅ FIX: Include dimensions array for table charts with drill-down support
        ...(chart.chart_type === ChartTypes.TABLE && {
          dimensions: getWidgetTableDimensions(chart.extra_config, tableDrillDownState),
        }),
        metrics: chart.extra_config?.metrics,
        extra_config: {
          filters: [
            ...(chart.extra_config?.filters || []),
            // Add drill-down filters from tableDrillDownState
            ...(chart.chart_type === ChartTypes.TABLE
              ? toTableDrillFilters(tableDrillDownState)
              : []),
            ...formattedFilters,
          ],
          pagination: chart.extra_config?.pagination,
          sort: chart.extra_config?.sort,
        },
        // Remove dashboard_filters since we're using filters in extra_config now
      };
    }
    return null;
  }, [chart, resolvedDashboardFilters, chartId, tableDrillDownState]);

  const {
    data: tableData,
    error: tableError,
    isLoading: tableLoading,
    mutate: mutateTableData,
  } = useChartDataPreview(chartDataPayload, tablePage, tablePageSize, appliedFilters);

  // Get total rows for table pagination
  const { data: tableTotalRows } = useChartDataPreviewTotalRows(chartDataPayload, appliedFilters);

  // Compute derived state
  const isLoading =
    chartLoading ||
    (chart?.chart_type === ChartTypes.TABLE
      ? tableLoading
      : isMapChart
        ? mapLoading || geojsonLoading
        : dataLoading);
  const isError =
    chartError ||
    (chart?.chart_type === ChartTypes.TABLE
      ? tableError
      : isMapChart
        ? mapError || geojsonError
        : dataError);

  // Get the actual error message with improved messaging
  const rawErrorMessage =
    chartFetchError?.message ||
    (chart?.chart_type === ChartTypes.TABLE
      ? tableError?.message
      : isMapChart
        ? mapError?.message || geojsonError?.message
        : dataError?.message) ||
    'Chart configuration needs adjustment';

  const errorMessage = getChartWidgetErrorMessage(rawErrorMessage);

  // Handle region click for drill-down (rebuilt every render: the chart effect lists it as a dependency)
  const handleRegionClick = (regionName: string) => {
    const click = resolveWidgetRegionClick(
      { chart, legacyGateChart: chart, regions, drillDownPath, activeGeographicColumn, regionName },
      'builder'
    );
    if (!click) return;
    showWidgetDrillToasts(click.toasts);
    if (click.nextLevel) setDrillDownPath([...drillDownPath, click.nextLevel]);
  };

  // Force refetch when filters change
  useEffect(() => {
    if (Object.keys(appliedFilters).length > 0) {
      mutateChartData();
    }
  }, [appliedFilters, mutateChartData, chartId]);

  // Force refetch for map data when filters change (same behavior as regular charts)
  useEffect(() => {
    if (isMapChart && Object.keys(appliedFilters).length > 0 && mutateMapData) {
      mutateMapData();
    }
  }, [appliedFilters, mutateMapData, chartId, isMapChart]);

  // Force refetch for table data when filters change
  useEffect(() => {
    if (
      chart?.chart_type === ChartTypes.TABLE &&
      Object.keys(appliedFilters).length > 0 &&
      mutateTableData
    ) {
      mutateTableData();
    }
  }, [appliedFilters, mutateTableData, chartId, chart?.chart_type]);

  useEffect(() => {
    // Chart config availability check
  }, [chart, chartData, chartId, appliedFilters]);

  return {
    chart,
    isMapChart,
    isPieChart,
    isNumberChart,
    isLineChart,
    isBarChart,
    filterHash,
    tablePage,
    setTablePage,
    tablePageSize,
    handleTablePageSizeChange,
    tableDrillDownState,
    handleTableRowClick,
    handleTableDrillUp,
    currentDimensionColumn,
    geojsonData,
    geojsonLoading,
    geojsonError,
    mapDataOverlay,
    mapLoading,
    mapError,
    chartData,
    dataLoading,
    tableData,
    tableLoading,
    tableError,
    tableTotalRows,
    isLoading,
    isError,
    errorMessage,
    handleRegionClick,
  };
}

export type BuilderChartData = ReturnType<typeof useBuilderChartData>;
