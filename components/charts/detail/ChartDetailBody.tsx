'use client';

import type { ComponentProps, RefObject } from 'react';
import type * as echarts from 'echarts';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ChartPreview } from '@/components/charts/ChartPreview';
import { TableChart } from '@/components/charts/chart-types/table/TableChart';
import PivotTableChart from '@/components/charts/chart-types/pivot-table/PivotTableChart';
import { getPivotRenderProps } from '@/components/charts/chart-types/pivot-table/utils';
import { MapPreview } from '@/components/charts/chart-types/map/MapPreview';
import { TableDrillBreadcrumb } from '@/components/charts/builder/TableDrillBreadcrumb';
import type { useSavedMapDrillDown } from '@/components/charts/hooks/useSavedMapDrillDown';
import type { useTableDrillDown } from '@/components/charts/hooks/useTableDrillDown';
import type { useChartData, useChartDataPreview } from '@/hooks/api/useChart';
import { mergeTableColumnFormatting } from '@/lib/chart-payload-utils';
import type { Chart } from '@/types/charts';
import type { PivotTableResponse } from '@/types/pivot-table';

type ChartDataResult = ReturnType<typeof useChartData>;
type TablePreviewResult = ReturnType<typeof useChartDataPreview>;

interface ChartDetailTableProps {
  data: TablePreviewResult['data'];
  isLoading: boolean;
  error: TablePreviewResult['error'];
  totalRows: number | undefined;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** Pagination is shown only once there is a payload (and data). */
  hasPayload: boolean;
}

interface ChartDetailBodyProps {
  chart: Chart;
  chartContentRef: RefObject<HTMLDivElement>;
  map: ReturnType<typeof useSavedMapDrillDown>;
  mapCustomizations: ComponentProps<typeof MapPreview>['customizations'];
  tableDrill: ReturnType<typeof useTableDrillDown>;
  table: ChartDetailTableProps;
  chartData: ChartDataResult['data'];
  dataLoading: boolean;
  dataError: ChartDataResult['error'];
  onChartReady: (instance: echarts.ECharts) => void;
}

/** Table branch of the detail card: drill breadcrumb + paginated TableChart. */
function ChartDetailTable({
  chart,
  tableDrill,
  table,
}: Pick<ChartDetailBodyProps, 'chart' | 'tableDrill' | 'table'>) {
  const tableData = table.data;
  return (
    <div className="w-full h-full flex flex-col">
      {/* Breadcrumb navigation for drill-down */}
      <TableDrillBreadcrumb
        state={tableDrill.tableDrillDownState}
        onBack={tableDrill.handleTableDrillUp}
      />
      <div className="flex-1 overflow-hidden">
        <TableChart
          data={Array.isArray(tableData?.data) ? tableData.data : []}
          config={{
            // BUILDER-DRIFT: detail keeps its own column order rule (order must cover every
            // column exactly), unlike the builders' resolveTableColumnOrder.
            table_columns: (() => {
              const cols = tableData?.columns || chart.extra_config?.table_columns || [];
              const order = chart.extra_config?.customizations?.columnOrder;
              if (
                order?.length &&
                order.length === cols.length &&
                order.every((c: string) => cols.includes(c))
              ) {
                return order;
              }
              return cols;
            })(),
            column_formatting: mergeTableColumnFormatting(chart.extra_config?.customizations),
            sort: chart.extra_config?.sort || [],
            pagination: chart.extra_config?.pagination || {
              enabled: true,
              page_size: 20,
            },
            conditionalFormatting: chart.extra_config?.customizations?.conditionalFormatting || [],
            columnAlignment: chart.extra_config?.customizations?.columnAlignment || {},
            zebraRows: chart.extra_config?.customizations?.zebraRows ?? true,
            freezeFirstColumn: chart.extra_config?.customizations?.freezeFirstColumn || false,
            theme: chart.extra_config?.customizations?.theme,
          }}
          isLoading={table.isLoading}
          error={table.error}
          pagination={
            table.hasPayload && tableData
              ? {
                  page: table.page,
                  pageSize: table.pageSize,
                  total: table.totalRows || 0,
                  onPageChange: table.onPageChange,
                  onPageSizeChange: table.onPageSizeChange,
                }
              : undefined
          }
          onRowClick={tableDrill.handleTableRowClick}
          drillDownEnabled={tableDrill.isDrillDownEnabled}
          currentDimensionColumn={tableDrill.currentDimensionColumn}
          currentDrillLevel={
            // 0-based index of the currently-displayed dimension
            tableDrill.currentDrillLevel
          }
        />
      </div>
    </div>
  );
}

/** The chart card on the detail page: map, pivot, table or ECharts preview. */
export function ChartDetailBody({
  chart,
  chartContentRef,
  map,
  mapCustomizations,
  tableDrill,
  table,
  chartData,
  dataLoading,
  dataError,
  onChartReady,
}: ChartDetailBodyProps) {
  return (
    <div>
      {/* Chart Preview - Full width */}
      <div>
        <Card className="h-[75vh]">
          <CardContent className="h-full p-6" ref={chartContentRef}>
            {chart?.chart_type === 'map' ? (
              <MapPreview
                geojsonData={map.geojsonData?.geojson_data}
                geojsonLoading={map.geojsonLoading}
                geojsonError={map.geojsonError}
                mapData={map.mapDataOverlay?.data}
                mapDataLoading={map.mapDataLoading}
                mapDataError={map.mapDataError}
                valueColumn={
                  chart.extra_config?.metrics?.[0]?.alias || chart.extra_config?.aggregate_column
                }
                customizations={mapCustomizations}
                onRegionClick={map.handleRegionClick}
                drillDownPath={map.drillDownPath}
                onDrillUp={map.handleDrillUp}
                onDrillHome={map.handleDrillHome}
                onChartReady={onChartReady}
              />
            ) : chart?.chart_type === 'pivot_table' ? (
              <div className="w-full h-full">
                {dataLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : dataError ? (
                  <div className="flex items-center justify-center h-full text-destructive">
                    Failed to load pivot table data
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
            ) : chart?.chart_type === 'table' ? (
              <ChartDetailTable chart={chart} tableDrill={tableDrill} table={table} />
            ) : (
              <ChartPreview
                config={chartData?.echarts_config}
                isLoading={dataLoading}
                error={dataError}
                onChartReady={onChartReady}
                customizations={chart?.extra_config?.customizations}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
