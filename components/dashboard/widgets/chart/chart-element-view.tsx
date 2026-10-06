'use client';

import { useRef, useState } from 'react';
import { OrgBrand } from '@/components/ui/org-brand';
import { type ChartTitleConfig } from '@/lib/chart-title-utils';
import { cn } from '@/lib/utils';
import { ChartTypes } from '@/types/charts';
import { CHART_DRILL_SOURCES } from '@/constants/analytics';
import { useDrillDownAnalytics } from '@/components/charts/useDrillDownAnalytics';
import type { FrozenChartConfig } from '@/types/reports';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useMapDrillPath } from '@/components/dashboard/widgets/chart/useMapDrillPath';
import { useChartWidgetTable } from '@/components/dashboard/widgets/chart/useChartWidgetTable';
import { useChartViewMetadata } from '@/components/dashboard/widgets/chart/useChartViewMetadata';
import { useChartViewData } from '@/components/dashboard/widgets/chart/useChartViewData';
import { useViewChartLifecycle } from '@/components/dashboard/widgets/chart/useViewChartLifecycle';
import { ChartViewToolbar } from '@/components/dashboard/widgets/chart/ChartViewToolbar';
import { ChartViewTitleRow } from '@/components/dashboard/widgets/chart/ChartViewTitleRow';
import {
  ChartViewLoading,
  ChartViewError,
} from '@/components/dashboard/widgets/chart/ChartViewStates';
import { ChartViewBody } from '@/components/dashboard/widgets/chart/ChartViewBody';
import { showWidgetDrillToasts } from '@/components/dashboard/widgets/chart/drill-toasts';
import { MapDrillBreadcrumb } from '@/components/dashboard/widgets/chart/MapDrillBreadcrumb';
import { getChartWidgetErrorMessage } from '@/components/dashboard/widgets/chart/logic/chart-widget-table';
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
import type { MapChartInstance } from '@/components/charts/chart-types/map/MapPreview';

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
  const mapChartInstance = useRef<MapChartInstance | null>(null); // Separate ref for map charts
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

  const table = useChartWidgetTable(effectiveChart);
  const { tableDrillDownState } = table;

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

  const viewData = useChartViewData({
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
    tablePage: table.tablePage,
    tablePageSize: table.tablePageSize,
    tableDrillDownState,
    drillDownPath,
  });
  const {
    filterHash,
    chartData,
    isLoading,
    isError,
    mutate,
    chartDataPayload,
    tableError,
    tableLoading,
    geojsonData,
    geojsonError,
    geojsonLoading,
    mapDataOverlay,
    mapError,
    mapLoading,
    mutateMapData,
    activeGeographicColumn,
  } = viewData;
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

  useViewChartLifecycle({
    chartId,
    chartRef,
    chartInstance,
    mapChartInstance,
    previousFilterHash,
    filterHash,
    chartData,
    mapDataOverlay,
    geojsonData,
    mutate,
    mutateMapData,
    effectiveChart,
    isMapChart,
    isTableChart,
    isPivotTableChart,
    drillDownPath,
    handleRegionClick,
    isFullscreen,
    containerSize,
    setContainerSize,
    dashboardFilters,
    frozenChartConfig,
  });

  const handleRefresh = () => {
    mutate();
  };

  // Handle map chart ready callback to capture the ECharts instance
  const handleMapChartReady = (chart: MapChartInstance) => {
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

  if (
    isLoading ||
    (!isPublicMode && chartLoading) ||
    // In public mode, wait for chart metadata to load before evaluating chart type or data
    (isPublicMode && publicChartLoading) ||
    (isTableChart && tableLoading) ||
    (isMapChart && (mapLoading || geojsonLoading))
  ) {
    return (
      <ChartViewLoading
        className={className}
        isTableChart={isTableChart}
        tableLoading={tableLoading}
        isMapChart={isMapChart}
        mapLoading={mapLoading}
        geojsonLoading={geojsonLoading}
      />
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
      <ChartViewError
        className={className}
        chartId={chartId}
        errorMessage={errorMessage}
        onRetry={handleRefresh}
      />
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

      <ChartViewBody
        chartId={chartId}
        effectiveChart={effectiveChart}
        isPivotTableChart={isPivotTableChart}
        isTableChart={isTableChart}
        isMapChart={isMapChart}
        isFullscreen={isFullscreen}
        isPublicMode={isPublicMode}
        viewMode={viewMode}
        tableRef={tableRef}
        chartRef={chartRef}
        viewData={viewData}
        table={table}
        drill={{ drillDownPath, setDrillDownPath, handleDrillUp, handleDrillHome }}
        onRegionClick={handleRegionClick}
        onMapChartReady={handleMapChartReady}
      />
    </div>
  );
}
