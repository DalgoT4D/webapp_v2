'use client';

import type { RefObject } from 'react';
import { Loader2 } from 'lucide-react';
import type * as echarts from 'echarts/core';
import PivotTableChart from '@/components/charts/chart-types/pivot-table/PivotTableChart';
import { getPivotRenderProps } from '@/components/charts/chart-types/pivot-table/utils';
import type { PivotTableResponse } from '@/types/pivot-table';
import { TableChart } from '@/components/charts/chart-types/table/TableChart';
import { MapPreview, type MapChartInstance } from '@/components/charts/chart-types/map/MapPreview';
import type { ChartDimension } from '@/types/charts';
import { cn } from '@/lib/utils';
import { TableDrillBreadcrumb } from '@/components/dashboard/widgets/chart/TableDrillBreadcrumb';
import { buildWidgetTableConfig } from '@/components/dashboard/widgets/chart/logic/chart-widget-table';
import type { useChartViewData } from '@/components/dashboard/widgets/chart/useChartViewData';
import type { useChartWidgetTable } from '@/components/dashboard/widgets/chart/useChartWidgetTable';
import type { useMapDrillPath } from '@/components/dashboard/widgets/chart/useMapDrillPath';
import type { useViewChartLifecycle } from '@/components/dashboard/widgets/chart/useViewChartLifecycle';

interface ChartViewBodyProps {
  chartId: number;
  effectiveChart: Parameters<typeof useViewChartLifecycle>[0]['effectiveChart'];
  isPivotTableChart: boolean;
  isTableChart: boolean;
  isMapChart: boolean;
  isFullscreen: boolean;
  isPublicMode: boolean;
  viewMode: boolean;
  tableRef: RefObject<HTMLDivElement | null>;
  chartRef: RefObject<HTMLDivElement | null>;
  viewData: ReturnType<typeof useChartViewData>;
  table: ReturnType<typeof useChartWidgetTable>;
  drill: ReturnType<typeof useMapDrillPath>;
  onRegionClick: (regionName: string) => void;
  onMapChartReady: (chart: MapChartInstance) => void;
}

/** The view widget's content: pivot, table (+ drill breadcrumb), map, or the ECharts div. */
export function ChartViewBody({
  chartId,
  effectiveChart,
  isPivotTableChart,
  isTableChart,
  isMapChart,
  isFullscreen,
  isPublicMode,
  viewMode,
  tableRef,
  chartRef,
  viewData,
  table,
  drill,
  onRegionClick,
  onMapChartReady,
}: ChartViewBodyProps) {
  const {
    chartData,
    isLoading,
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
  } = viewData;
  const {
    tablePage,
    setTablePage,
    tablePageSize,
    handleTablePageSizeChange,
    tableDrillDownState,
    handleTableRowClick,
    handleTableDrillUp,
    currentDimensionColumn,
  } = table;
  const { drillDownPath, handleDrillUp, handleDrillHome } = drill;
  const handleRegionClick = onRegionClick;
  const handleMapChartReady = onMapChartReady;

  return isPivotTableChart ? (
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
  );
}
