'use client';

import { ChartPreview } from '@/components/charts/right-panel';
import { TableChart } from '@/components/charts/renderers';
import { MapPreview } from '@/components/charts/map';
import type * as echarts from 'echarts';

interface DrillDownLevel {
  level: number;
  name: string;
  geographic_column: string;
  geojson_id: number;
  region_id?: number;
  parent_selections: Array<{
    column: string;
    value: string;
  }>;
}

interface MapChartProps {
  geojsonData: unknown;
  geojsonLoading: boolean;
  geojsonError: Error | null;
  mapData: any[] | undefined;
  mapDataLoading: boolean;
  mapDataError: Error | null;
  valueColumn: string | undefined;
  customizations: Record<string, unknown>;
  drillDownPath: DrillDownLevel[];
  onRegionClick: (regionName: string, regionData: unknown) => void;
  onDrillUp: (targetLevel: number) => void;
  onDrillHome: () => void;
}

interface TableChartProps {
  data: unknown[];
  columns: string[];
  tableColumns: string[];
  sort: Array<{ column: string; direction: 'asc' | 'desc' }>;
  pagination: { enabled: boolean; page_size: number };
  isLoading: boolean;
  error: Error | null;
  paginationConfig?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
}

interface RegularChartProps {
  config: unknown;
  isLoading: boolean;
  error: Error | null;
  onChartReady: (instance: echarts.ECharts) => void;
}

interface ChartRendererProps {
  chartType: string;
  mapProps?: MapChartProps;
  tableProps?: TableChartProps;
  regularChartProps?: RegularChartProps;
}

export function ChartRenderer({
  chartType,
  mapProps,
  tableProps,
  regularChartProps,
}: ChartRendererProps) {
  if (chartType === 'map' && mapProps) {
    return (
      <MapPreview
        geojsonData={mapProps.geojsonData}
        geojsonLoading={mapProps.geojsonLoading}
        geojsonError={mapProps.geojsonError}
        mapData={mapProps.mapData}
        mapDataLoading={mapProps.mapDataLoading}
        mapDataError={mapProps.mapDataError}
        valueColumn={mapProps.valueColumn}
        customizations={mapProps.customizations}
        onRegionClick={mapProps.onRegionClick}
        drillDownPath={mapProps.drillDownPath}
        onDrillUp={mapProps.onDrillUp}
        onDrillHome={mapProps.onDrillHome}
      />
    );
  }

  if (chartType === 'table' && tableProps) {
    return (
      <TableChart
        data={tableProps.data}
        config={{
          table_columns:
            tableProps.columns.length > 0 ? tableProps.columns : tableProps.tableColumns,
          column_formatting: {},
          sort: tableProps.sort,
          pagination: tableProps.pagination,
        }}
        isLoading={tableProps.isLoading}
        error={tableProps.error}
        pagination={tableProps.paginationConfig}
      />
    );
  }

  if (regularChartProps) {
    return (
      <ChartPreview
        config={regularChartProps.config}
        isLoading={regularChartProps.isLoading}
        error={regularChartProps.error}
        onChartReady={regularChartProps.onChartReady}
      />
    );
  }

  return null;
}
