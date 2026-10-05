'use client';

import { useEffect, useRef, useState } from 'react';
import { OrgBrand } from '@/components/ui/org-brand';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PivotTableChart from '@/components/charts/chart-types/pivot-table/PivotTableChart';
import { getPivotRenderProps } from '@/components/charts/chart-types/pivot-table/utils';
import type { PivotTableResponse } from '@/types/pivot-table';
import { cn } from '@/lib/utils';
import { TableChart } from '@/components/charts/chart-types/table/TableChart';
import { MapPreview } from '@/components/charts/chart-types/map/MapPreview';
import { type ChartTitleConfig } from '@/lib/chart-title-utils';
import { ChartTypes, type ChartDimension } from '@/types/charts';
import { CHART_DRILL_SOURCES } from '@/constants/analytics';
import { useDrillDownAnalytics } from '@/components/charts/useDrillDownAnalytics';
import type { FrozenChartConfig } from '@/types/reports';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useMapDrillPath } from '@/components/dashboard/widgets/chart/useMapDrillPath';
import { useChartWidgetTable } from '@/components/dashboard/widgets/chart/useChartWidgetTable';
import { useChartViewMetadata } from '@/components/dashboard/widgets/chart/useChartViewMetadata';
import { useChartViewData } from '@/components/dashboard/widgets/chart/useChartViewData';
import { ChartViewToolbar } from '@/components/dashboard/widgets/chart/ChartViewToolbar';
import { ChartViewTitleRow } from '@/components/dashboard/widgets/chart/ChartViewTitleRow';
import { showWidgetDrillToasts } from '@/components/dashboard/widgets/chart/drill-toasts';
import { MapDrillBreadcrumb } from '@/components/dashboard/widgets/chart/MapDrillBreadcrumb';
import { TableDrillBreadcrumb } from '@/components/dashboard/widgets/chart/TableDrillBreadcrumb';
import { buildChartWidgetOption } from '@/components/dashboard/widgets/chart/logic/chart-widget-option';
import {
  buildWidgetTableConfig,
  getChartWidgetErrorMessage,
} from '@/components/dashboard/widgets/chart/logic/chart-widget-table';
import { resolveWidgetRegionClick } from '@/components/dashboard/widgets/chart/logic/chart-widget-map';
import { buildChartWidgetExportHandlers } from '@/components/dashboard/widgets/chart/chart-widget-export';
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

  const {
    regions,
    chart,
    chartLoading,
    chartError,
    publicChartLoading,
    chartMetadata,
    metadataError,
    effectiveChart,
  } = useChartViewMetadata({ chartId, isPublicMode, publicToken, frozenChartConfig });

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

  const {
    filterHash,
    chartData,
    isLoading,
    isError,
    mutate,
    chartDataPayload,
    tableData,
    tableError,
    tableLoading,
    privateTableTotalRows,
    publicTableTotalRows,
    geojsonData,
    geojsonError,
    geojsonLoading,
    mapDataOverlay,
    mapError,
    mapLoading,
    mutateMapData,
    activeGeographicColumn,
  } = useChartViewData({
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
  });
  const previousFilterHash = useRef<string>(filterHash);

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
        <ChartViewToolbar
          chartId={chartId}
          onView={onView}
          isPublicMode={isPublicMode}
          chartType={effectiveChart?.chart_type}
          isFullscreen={isFullscreen}
          onDownloadImage={handleDownloadImage}
          onDownloadCSV={handleDownloadCSV}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}

      {/* Chart title row — hidden in fullscreen (title shown in overlay instead) */}
      <ChartViewTitleRow
        chartId={chartId}
        isFullscreen={isFullscreen}
        titleChartData={frozenChartConfig || (isPublicMode ? effectiveChart : chartMetadata)}
        config={config}
        onView={onView}
        isPublicMode={isPublicMode}
        frozenChartConfig={frozenChartConfig}
        snapshotId={snapshotId}
        commentStates={commentStates}
        onCommentStateChange={onCommentStateChange}
        autoOpenCommentChartId={autoOpenCommentChartId}
        canModerateComments={canModerateComments}
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
