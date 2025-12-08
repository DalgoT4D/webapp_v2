'use client';

import { useState, useRef, useEffect } from 'react';
import {
  useChart,
  useChartData,
  useChartDataPreview,
  useChartDataPreviewTotalRows,
  useGeoJSONData,
  useMapDataOverlay,
  useRegionGeoJSONs,
  useRegions,
} from '@/hooks/api/useChart';
import { Card, CardContent } from '@/components/ui/card';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import type * as echarts from 'echarts';

// Local hooks
import {
  useChartDataPayload,
  useMapDrillDown,
  useTablePagination,
  useMapFilterToasts,
  useMapDataOverlayPayload,
} from './hooks';

// Local components
import {
  ChartDetailHeader,
  ChartRenderer,
  PermissionDenied,
  ChartDetailLoading,
  ChartDetailError,
} from './components';

interface ChartDetailClientProps {
  chartId: number;
}

export function ChartDetailClient({ chartId }: ChartDetailClientProps) {
  // Core hooks
  const { hasPermission } = useUserPermissions();
  const { data: chart, error: chartError, isLoading: chartLoading } = useChart(chartId);
  const { data: regions } = useRegions('IND', 'state');
  const chartDataPayload = useChartDataPayload(chart);
  const hasEditPermission = hasPermission('can_edit_charts');

  // Table pagination
  const tablePagination = useTablePagination();

  // Map drill-down region tracking
  const drillDownRegionIdRef = useRef<number | null>(null);
  const { data: regionGeojsons } = useRegionGeoJSONs(drillDownRegionIdRef.current);

  // Map drill-down state
  const drillDown = useMapDrillDown({
    chartType: chart?.chart_type,
    extraConfig: chart?.extra_config,
    regions,
    regionGeojsons,
    hasEditPermission,
    chartId,
  });

  // Update region ID ref for geojson fetching
  useEffect(() => {
    const regionId =
      drillDown.drillDownPath.length > 0
        ? drillDown.drillDownPath[drillDown.drillDownPath.length - 1].region_id || null
        : null;
    drillDownRegionIdRef.current = regionId;
  }, [drillDown.drillDownPath]);

  // Chart data hooks
  const isMapChart = chart?.chart_type === 'map';
  const isTableChart = chart?.chart_type === 'table';

  const chartData = useChartData(!isMapChart ? chartDataPayload : null);
  const tableData = useChartDataPreview(
    isTableChart ? chartDataPayload : null,
    tablePagination.page,
    tablePagination.pageSize
  );
  const { data: tableDataTotalRows } = useChartDataPreviewTotalRows(
    isTableChart ? chartDataPayload : null
  );

  // Map data hooks
  const geojsonResult = useGeoJSONData(drillDown.activeGeojsonId);
  const mapDataOverlayPayload = useMapDataOverlayPayload(
    chart,
    drillDown.activeGeographicColumn,
    drillDown.filters
  );
  const mapDataOverlay = useMapDataOverlay(mapDataOverlayPayload);

  // Map filter toasts
  useMapFilterToasts({
    chartType: chart?.chart_type,
    filters: chart?.extra_config?.filters,
    geojsonData: geojsonResult.data?.geojson_data,
    geojsonLoading: geojsonResult.isLoading,
    geojsonError: geojsonResult.error,
    chartId,
    hasEditPermission,
  });

  // Chart refs for export
  const [chartElement, setChartElement] = useState<HTMLElement | null>(null);
  const [chartInstance, setChartInstance] = useState<echarts.ECharts | null>(null);
  const chartContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chartContentRef.current) {
      setChartElement(chartContentRef.current);
    }
  }, [chart, chartData.data, mapDataOverlay.data]);

  // Early returns for state handling (after all hooks)
  if (!hasPermission('can_view_charts')) {
    return <PermissionDenied />;
  }

  if (chartLoading) {
    return <ChartDetailLoading />;
  }

  if (chartError || !chart) {
    return <ChartDetailError />;
  }

  // Build props for child components
  const mapProps = isMapChart
    ? {
        geojsonData: geojsonResult.data?.geojson_data,
        geojsonLoading: geojsonResult.isLoading,
        geojsonError: geojsonResult.error,
        mapData: mapDataOverlay.data?.data,
        mapDataLoading: mapDataOverlay.isLoading,
        mapDataError: mapDataOverlay.error,
        valueColumn:
          chart.extra_config?.metrics?.[0]?.alias || chart.extra_config?.aggregate_column,
        customizations: chart.extra_config?.customizations || {},
        drillDownPath: drillDown.drillDownPath,
        onRegionClick: drillDown.handleRegionClick,
        onDrillUp: drillDown.handleDrillUp,
        onDrillHome: drillDown.handleDrillHome,
      }
    : undefined;

  const tableProps = isTableChart
    ? {
        data: Array.isArray(tableData.data?.data) ? tableData.data.data : [],
        columns: tableData.data?.columns || [],
        tableColumns: chart.extra_config?.table_columns || [],
        sort: chart.extra_config?.sort || [],
        pagination: chart.extra_config?.pagination || { enabled: true, page_size: 20 },
        isLoading: tableData.isLoading,
        error: tableData.error,
        paginationConfig:
          chartDataPayload && tableData.data
            ? {
                page: tablePagination.page,
                pageSize: tablePagination.pageSize,
                total: tableDataTotalRows || 0,
                onPageChange: tablePagination.setPage,
                onPageSizeChange: tablePagination.handlePageSizeChange,
              }
            : undefined,
      }
    : undefined;

  const regularChartProps =
    !isMapChart && !isTableChart
      ? {
          config: chartData.data?.echarts_config,
          isLoading: chartData.isLoading,
          error: chartData.error,
          onChartReady: setChartInstance,
        }
      : undefined;

  return (
    <div className="container mx-auto p-6">
      <ChartDetailHeader
        chartId={chartId}
        chartTitle={chart.title}
        chartType={chart.chart_type}
        hasEditPermission={hasEditPermission}
        chartElement={chartElement}
        chartInstance={chartInstance}
        chartDataPayload={chartDataPayload}
        tableElement={isTableChart ? chartContentRef.current : undefined}
      />

      <Card className="h-[75vh]">
        <CardContent className="h-full p-6" ref={chartContentRef}>
          <ChartRenderer
            chartType={chart.chart_type}
            mapProps={mapProps}
            tableProps={tableProps}
            regularChartProps={regularChartProps}
          />
        </CardContent>
      </Card>
    </div>
  );
}
