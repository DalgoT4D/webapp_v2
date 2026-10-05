'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';
import PivotTableChart from '@/components/charts/chart-types/pivot-table/PivotTableChart';
import { getPivotRenderProps } from '@/components/charts/chart-types/pivot-table/utils';
import type { PivotTableResponse } from '@/types/pivot-table';
import { useChart } from '@/hooks/api/useCharts';
import {
  useChartDataPreview,
  useChartDataPreviewTotalRows,
  useMapDataOverlay,
  useGeoJSONData,
  useRegions,
  useRegionGeoJSONs,
} from '@/hooks/api/useChart';
import useSWR from 'swr';
import { apiGet } from '@/lib/api';
import { ChartTitleEditor } from './chart-title-editor';
import { TableChart } from '@/components/charts/chart-types/table/TableChart';
import { MapPreview } from '@/components/charts/chart-types/map/MapPreview';
import type { ChartTitleConfig } from '@/lib/chart-title-utils';
import {
  resolveDashboardFilters,
  formatAsChartFilters,
  type DashboardFilterConfig,
} from '@/lib/dashboard-filter-utils';
import { resolveDrillDownGeoJSON } from '@/lib/map-drilldown-utils';
import { ChartTypes, type ChartDataPayload, type ChartDimension } from '@/types/charts';
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
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, GaugeChart, ScatterChart, MapChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  VisualMapComponent,
  GeoComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Register necessary ECharts components
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GaugeChart,
  ScatterChart,
  MapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  VisualMapComponent,
  GeoComponent,
  CanvasRenderer,
]);

interface ChartElementBuilderProps {
  chartId: number;
  config: any & ChartTitleConfig;
  onRemove: () => void;
  onUpdate: (config: any & ChartTitleConfig) => void;
  isResizing?: boolean;
  isEditMode?: boolean;
  appliedFilters?: Record<string, any>;
  dashboardFilterConfigs?: DashboardFilterConfig[];
}

export function ChartElementBuilder({
  chartId,
  config,
  onRemove,
  onUpdate,
  isResizing,
  isEditMode = true,
  appliedFilters = {},
  dashboardFilterConfigs = [],
}: ChartElementBuilderProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isResizingRef = useRef(isResizing); // Track isResizing for ResizeObserver
  const { drillDownPath, setDrillDownPath, handleDrillUp, handleDrillHome } = useMapDrillPath();

  // Container size for responsive legend
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Keep isResizingRef in sync for ResizeObserver
  useEffect(() => {
    isResizingRef.current = isResizing;
  }, [isResizing]);

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

  // Handle title configuration updates
  const handleTitleChange = (titleConfig: ChartTitleConfig) => {
    onUpdate({
      ...config,
      ...titleConfig,
    });
  };

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

  // Initialize chart instance once
  useEffect(() => {
    // Use a small delay to ensure DOM is ready and container has dimensions
    const initTimer = setTimeout(() => {
      if (chartRef.current && !chartInstance.current) {
        const { width, height } = chartRef.current.getBoundingClientRect();

        // Only initialize if container has dimensions
        if (width > 0 && height > 0) {
          chartInstance.current = echarts.init(chartRef.current);
        }
      }
    }, 50);

    // Cleanup only on unmount
    return () => {
      clearTimeout(initTimer);
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []); // Empty dependency array - only run on mount/unmount

  // Update chart data separately
  useEffect(() => {
    // Get the appropriate data source based on chart type
    const activeChartData = isMapChart
      ? { geojson: geojsonData?.geojson_data, data: mapDataOverlay }
      : chartData;

    let chartConfig;

    // Maps now use MapPreview component, skip manual ECharts creation
    if (isMapChart) {
      return; // Early return for map charts
    }

    // Use regular echarts_config for non-map charts
    chartConfig = activeChartData?.echarts_config;

    // If we have data but no chart instance yet, try to initialize
    if (!chartInstance.current && chartRef.current && chartConfig) {
      const { width, height } = chartRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) {
        chartInstance.current = echarts.init(chartRef.current);
      }
    }

    if (chartInstance.current && chartConfig) {
      const modifiedConfig = buildChartWidgetOption({
        baseConfig: chartConfig,
        chartType: chart?.chart_type,
        customizations: chart?.extra_config?.customizations || {},
        containerSize,
        variant: 'builder',
      });

      // Set chart option with animation disabled for better performance
      chartInstance.current.setOption(modifiedConfig, {
        notMerge: true,
        lazyUpdate: false,
        silent: false,
      });

      // Click event listeners for non-map charts only (maps use MapPreview component)
      if (!isMapChart) {
        // Add any non-map click handlers here if needed
      }

      // Force resize after setting options to ensure proper rendering
      setTimeout(() => {
        if (chartInstance.current) {
          chartInstance.current.resize();
        }
      }, 100);
    }
  }, [
    chartData,
    mapDataOverlay,
    geojsonData,
    chart,
    chartId,
    isLoading,
    filterHash,
    isMapChart,
    isLineChart,
    isBarChart,
    isPieChart,
    isNumberChart,
    drillDownPath,
    handleRegionClick,
    containerSize, // Update when container size changes for responsive legends
  ]); // Update when data, filters, or container size change

  // Handle window resize and container resize - separate from chart data changes
  useEffect(() => {
    let resizeTimeoutId: NodeJS.Timeout | null = null;

    const handleResize = () => {
      if (chartInstance.current) {
        // Clear any pending resize
        if (resizeTimeoutId) {
          clearTimeout(resizeTimeoutId);
        }

        // Debounce resize calls
        resizeTimeoutId = setTimeout(() => {
          if (chartInstance.current) {
            chartInstance.current.resize();
          }
        }, 100);
      }
    };

    // Handle window resize
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
    };
  }, []); // No dependencies to avoid infinite loops

  // Handle container resize using ResizeObserver - separate effect
  // OPTIMIZED: Debounce containerSize state updates to prevent re-renders during resize
  // The chart data effect depends on containerSize, so updating it on every frame causes
  // massive lag (entire chart config recalculates). Only update state when resize settles.
  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;
    let rafId: number | null = null;
    let containerSizeTimeoutId: NodeJS.Timeout | null = null;
    // Trailing-debounce timer + latest size for the "active resize" path (see below).
    let activeResizeTimer: NodeJS.Timeout | null = null;
    let latestSize = { width: 0, height: 0 };
    // While a chart is being dragged-to-resize, the ResizeObserver fires ~60×/sec.
    // Re-laying-out ECharts on every one of those frames competes with react-grid-layout's
    // placeholder/handle updates on the main thread and makes the resize feel laggy
    // ("ghost lags"). Instead we trailing-debounce the ECharts resize: during continuous
    // dragging the timer keeps resetting so ECharts never re-layouts mid-motion (snappy
    // ghost), and it fires only when the pointer pauses or the drag ends — always using the
    // latest real container size, so the chart still re-fits correctly. Idle changes (mount,
    // screen-size switch, neighbour reflow) resize immediately.
    const ACTIVE_RESIZE_SETTLE_MS = 60;

    if (chartRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver((entries) => {
        // Cancel any pending animation frame
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        // Cancel any pending containerSize state update
        if (containerSizeTimeoutId) {
          clearTimeout(containerSizeTimeoutId);
        }

        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            latestSize = { width, height };

            if (isResizingRef.current) {
              // ACTIVE RESIZE: trailing-debounce so ECharts doesn't re-layout every frame.
              if (activeResizeTimer) {
                clearTimeout(activeResizeTimer);
              }
              activeResizeTimer = setTimeout(() => {
                if (chartInstance.current) {
                  chartInstance.current.resize({
                    width: Math.floor(latestSize.width),
                    height: Math.floor(latestSize.height),
                  });
                }
              }, ACTIVE_RESIZE_SETTLE_MS);
            } else {
              // IDLE: immediate visual resize via RAF — no React state, no re-renders
              rafId = requestAnimationFrame(() => {
                if (chartInstance.current) {
                  chartInstance.current.resize({
                    width: Math.floor(width),
                    height: Math.floor(height),
                  });
                }
              });

              // DEBOUNCED: update containerSize state once the resize settles
              containerSizeTimeoutId = setTimeout(() => {
                setContainerSize((prev) => {
                  if (prev.width !== width || prev.height !== height) {
                    return { width, height };
                  }
                  return prev;
                });
              }, 150); // Wait for resize to settle before updating state
            }
          }
        }
      });

      resizeObserver.observe(chartRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (containerSizeTimeoutId) {
        clearTimeout(containerSizeTimeoutId);
      }
      if (activeResizeTimer) {
        clearTimeout(activeResizeTimer);
      }
    };
  }, []); // No dependencies to avoid re-creating observer

  // Handle resize when isResizing prop changes - final cleanup after drag stops
  useEffect(() => {
    if (!isResizing && chartInstance.current && chartRef.current) {
      // Clear any pending resize
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      // Quick final resize after drag stops
      resizeTimeoutRef.current = setTimeout(() => {
        if (chartInstance.current && chartRef.current) {
          const { width, height } = chartRef.current.getBoundingClientRect();
          chartInstance.current.resize({
            width: Math.floor(width),
            height: Math.floor(height),
          });
          // Also update containerSize state for responsive legend recalculation
          setContainerSize((prev) => {
            if (prev.width !== width || prev.height !== height) {
              return { width, height };
            }
            return prev;
          });
        }
      }, 50); // Fast response
    }

    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [isResizing]);

  return (
    <div className="h-full w-full relative">
      {/* Action buttons moved to dashboard level for proper drag-cancel behavior */}
      <Card className="h-full w-full flex flex-col">
        <CardContent className="p-2 flex-1 flex flex-col min-h-0">
          {/* Chart Title Editor */}
          <ChartTitleEditor
            chartData={chart}
            config={config}
            onTitleChange={handleTitleChange}
            isEditMode={isEditMode}
            className="flex-shrink-0"
          />

          {/* Drill-down navigation for maps */}
          {isMapChart && drillDownPath.length > 0 && (
            <MapDrillBreadcrumb
              chartId={chartId}
              drillDownPath={drillDownPath}
              onHome={handleDrillHome}
              onDrillUp={handleDrillUp}
            />
          )}

          {/* Chart Content */}
          <div className="flex-1 w-full h-full">
            {isLoading ? (
              <div className="relative w-full h-full min-h-[300px]">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-sm text-muted-foreground">
                      {chart?.chart_type === ChartTypes.TABLE
                        ? 'Loading table data...'
                        : chart?.chart_type === ChartTypes.MAP
                          ? 'Loading map...'
                          : 'Loading chart...'}
                    </p>
                  </div>
                </div>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-start h-full pt-20">
                <div className="w-full max-w-md px-4">
                  <div className="flex items-center p-4 border border-red-200 rounded-lg bg-red-50 shadow-lg">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-800">Chart Error</p>
                      <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : chart?.chart_type === ChartTypes.PIVOT_TABLE ? (
              <div className="w-full h-full">
                {dataLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : chartData?.data ? (
                  <PivotTableChart
                    data={chartData.data as unknown as PivotTableResponse}
                    {...getPivotRenderProps(chart.extra_config)}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            ) : chart?.chart_type === ChartTypes.TABLE ? (
              <div className="flex flex-col h-full">
                {/* Breadcrumb navigation for drill-down */}
                {tableDrillDownState && (
                  <TableDrillBreadcrumb
                    chartId={chartId}
                    appliedFilters={tableDrillDownState.appliedFilters}
                    onBack={handleTableDrillUp}
                  />
                )}
                <div className="flex-1 overflow-auto">
                  <TableChart
                    data={Array.isArray(tableData?.data) ? tableData.data : []}
                    config={buildWidgetTableConfig(
                      chart?.extra_config,
                      tableData?.columns,
                      tableDrillDownState
                    )}
                    isLoading={tableLoading}
                    error={tableError}
                    pagination={
                      tableTotalRows && tableData?.data?.length > 0
                        ? {
                            page: tablePage,
                            pageSize: tablePageSize,
                            total: tableTotalRows || 0,
                            onPageChange: setTablePage,
                            onPageSizeChange: handleTablePageSizeChange,
                          }
                        : undefined
                    }
                    onRowClick={handleTableRowClick}
                    drillDownEnabled={chart?.extra_config?.dimensions?.some(
                      (dim: ChartDimension) => dim.enable_drill_down === true
                    )}
                    currentDimensionColumn={currentDimensionColumn}
                  />
                </div>
              </div>
            ) : chart?.chart_type === ChartTypes.MAP ? (
              <MapPreview
                geojsonData={geojsonData?.geojson_data}
                geojsonLoading={geojsonLoading}
                geojsonError={geojsonError}
                mapData={mapDataOverlay?.data}
                mapDataLoading={mapLoading}
                mapDataError={mapError}
                title=""
                valueColumn={
                  chart?.extra_config?.metrics?.[0]?.alias || chart?.extra_config?.aggregate_column
                }
                customizations={chart?.extra_config?.customizations}
                onRegionClick={handleRegionClick}
                drillDownPath={drillDownPath}
                onDrillUp={handleDrillUp}
                onDrillHome={handleDrillHome}
                showBreadcrumbs={false}
                isResizing={isResizing}
              />
            ) : (
              <div ref={chartRef} className="chart-container w-full h-full" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
