'use client';

import { ChartPreview } from './ChartPreview';
import { TableChart } from './TableChart';
import { MapPreview } from './map/MapPreview';
import type { ChartBuilderFormData } from '@/types/charts';

// Grouped props for each chart type
export interface BaseChartPreviewProps {
  data: any;
  isLoading: boolean;
  error: any;
}

export interface MapPreviewProps extends BaseChartPreviewProps {
  geojsonData: any;
  geojsonLoading: boolean;
  geojsonError: any;
  mapData: any;
  mapDataLoading: boolean;
  mapDataError: any;
  valueColumn?: string;
  customizations?: Record<string, any>;
  drillDown: {
    path: Array<{
      level: number;
      name: string;
      geographic_column: string;
      parent_selections: Array<{ column: string; value: string }>;
      region_id: number;
    }>;
    onRegionClick: (regionName: string, regionData?: any) => void;
    onDrillUp: (targetLevel: number) => void;
    onDrillHome: () => void;
  };
}

export interface TablePreviewProps extends BaseChartPreviewProps {
  columns: string[];
  config: {
    table_columns: string[];
    column_formatting: Record<string, any>;
    sort: any[];
    pagination: { enabled: boolean; page_size: number };
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
}

export interface StandardChartPreviewProps extends BaseChartPreviewProps {
  schemaName?: string;
  tableName?: string;
}

// Discriminated union for type-safe props
export type ChartPreviewRendererProps =
  | {
      chartType: 'map';
      formData: ChartBuilderFormData;
      mapProps: MapPreviewProps;
    }
  | {
      chartType: 'table';
      formData: ChartBuilderFormData;
      tableProps: TablePreviewProps;
    }
  | {
      chartType: 'bar' | 'line' | 'pie' | 'number';
      formData: ChartBuilderFormData;
      chartProps: StandardChartPreviewProps;
    };

/**
 * Strategy pattern renderer for different chart types.
 * Handles the rendering logic for map, table, and standard charts.
 */
export function ChartPreviewRenderer(props: ChartPreviewRendererProps) {
  switch (props.chartType) {
    case 'map':
      return <MapChartPreview {...props.mapProps} />;
    case 'table':
      return <TableChartPreview {...props.tableProps} />;
    default:
      return <StandardChartPreview {...props.chartProps} />;
  }
}

// Individual preview components
function MapChartPreview({
  geojsonData,
  geojsonLoading,
  geojsonError,
  mapData,
  mapDataLoading,
  mapDataError,
  valueColumn,
  customizations,
  drillDown,
}: MapPreviewProps) {
  return (
    <div className="w-full h-full">
      <MapPreview
        geojsonData={geojsonData?.geojson_data}
        geojsonLoading={geojsonLoading}
        geojsonError={geojsonError}
        mapData={mapData?.data}
        mapDataLoading={mapDataLoading}
        mapDataError={mapDataError}
        valueColumn={valueColumn}
        customizations={customizations}
        onRegionClick={drillDown.onRegionClick}
        drillDownPath={drillDown.path}
        onDrillUp={drillDown.onDrillUp}
        onDrillHome={drillDown.onDrillHome}
        showBreadcrumbs={true}
      />
    </div>
  );
}

function TableChartPreview({
  data,
  isLoading,
  error,
  columns,
  config,
  pagination,
}: TablePreviewProps) {
  return (
    <div className="w-full h-full">
      <TableChart
        data={Array.isArray(data?.data) ? data.data : []}
        config={{
          table_columns: data?.columns || columns || config.table_columns,
          column_formatting: config.column_formatting,
          sort: config.sort,
          pagination: config.pagination,
        }}
        isLoading={isLoading}
        error={error}
        pagination={pagination}
      />
    </div>
  );
}

function StandardChartPreview({
  data,
  isLoading,
  error,
  schemaName,
  tableName,
}: StandardChartPreviewProps) {
  return (
    <div className="w-full h-full">
      <ChartPreview
        key={`${schemaName}-${tableName}`}
        config={data?.echarts_config}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}
