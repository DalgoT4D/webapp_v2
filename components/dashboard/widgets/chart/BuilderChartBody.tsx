'use client';

import type { RefObject } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import PivotTableChart from '@/components/charts/chart-types/pivot-table/PivotTableChart';
import { getPivotRenderProps } from '@/components/charts/chart-types/pivot-table/utils';
import type { PivotTableResponse } from '@/types/pivot-table';
import { TableChart } from '@/components/charts/chart-types/table/TableChart';
import { MapPreview } from '@/components/charts/chart-types/map/MapPreview';
import { ChartTypes, type ChartDimension } from '@/types/charts';
import { TableDrillBreadcrumb } from '@/components/dashboard/widgets/chart/TableDrillBreadcrumb';
import { buildWidgetTableConfig } from '@/components/dashboard/widgets/chart/logic/chart-widget-table';
import type { BuilderChartData } from '@/components/dashboard/widgets/chart/useBuilderChartData';
import type { useMapDrillPath } from '@/components/dashboard/widgets/chart/useMapDrillPath';

type MapDrill = ReturnType<typeof useMapDrillPath>;

interface BuilderChartBodyProps {
  chartId: number;
  chartRef: RefObject<HTMLDivElement | null>;
  data: BuilderChartData;
  drillDownPath: MapDrill['drillDownPath'];
  handleDrillUp: MapDrill['handleDrillUp'];
  handleDrillHome: MapDrill['handleDrillHome'];
  isResizing?: boolean;
}

/** The builder widget's content: loading, error, pivot, table (+ drill breadcrumb), map, or the ECharts div. */
export function BuilderChartBody({
  chartId,
  chartRef,
  data,
  drillDownPath,
  handleDrillUp,
  handleDrillHome,
  isResizing,
}: BuilderChartBodyProps) {
  const {
    chart,
    isLoading,
    isError,
    errorMessage,
    dataLoading,
    chartData,
    tableDrillDownState,
    handleTableDrillUp,
    tableData,
    tableLoading,
    tableError,
    tableTotalRows,
    tablePage,
    tablePageSize,
    setTablePage,
    handleTablePageSizeChange,
    handleTableRowClick,
    currentDimensionColumn,
    geojsonData,
    geojsonLoading,
    geojsonError,
    mapDataOverlay,
    mapLoading,
    mapError,
    handleRegionClick,
  } = data;

  return isLoading ? (
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
  );
}
