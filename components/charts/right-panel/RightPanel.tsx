'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, BarChart3 } from 'lucide-react';
import { ChartPreviewRenderer } from './ChartPreviewRenderer';
import { DataTabRenderer } from './DataTabRenderer';
import type { ChartBuilderFormData } from '@/types/charts';
import type { DrillDownLevel } from '@/hooks/useMapDrillDown';

// Grouped prop types for cleaner interface
export interface ChartDataProps {
  data: any;
  isLoading: boolean;
  error: any;
}

export interface MapDataProps {
  geojsonData: any;
  geojsonLoading: boolean;
  geojsonError: any;
  mapDataOverlay: any;
  mapDataLoading: boolean;
  mapDataError: any;
}

export interface DrillDownProps {
  path: DrillDownLevel[];
  onRegionClick: (regionName: string, regionData?: any) => void;
  onDrillUp: (targetLevel: number) => void;
  onDrillHome: () => void;
}

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export interface RightPanelProps {
  formData: ChartBuilderFormData;
  activeTab: string;
  onTabChange: (tab: string) => void;

  // Grouped data props
  chartData: ChartDataProps;
  mapData: MapDataProps;
  tableChartData: ChartDataProps & { pagination: PaginationProps };
  dataPreview: ChartDataProps & { pagination: PaginationProps };
  rawData: ChartDataProps & {
    tableCount: any;
    pagination: Omit<PaginationProps, 'total'>;
  };

  // Drill-down
  drillDown: DrillDownProps;
}

/**
 * Right panel component for chart builder.
 * Displays chart preview and data tabs.
 */
export function RightPanel({
  formData,
  activeTab,
  onTabChange,
  chartData,
  mapData,
  tableChartData,
  dataPreview,
  rawData,
  drillDown,
}: RightPanelProps) {
  const chartType = formData.chart_type || 'bar';

  return (
    <div className="w-[70%]">
      <Tabs value={activeTab} onValueChange={onTabChange} className="h-full">
        <div className="px-4">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="chart" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              CHART
            </TabsTrigger>
            <TabsTrigger value="data" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              DATA
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chart" className="h-[calc(100%-73px)] overflow-y-auto">
          <div className="p-4 h-full">
            <ChartPreviewContent
              chartType={chartType}
              formData={formData}
              chartData={chartData}
              mapData={mapData}
              tableChartData={tableChartData}
              drillDown={drillDown}
            />
          </div>
        </TabsContent>

        <TabsContent value="data" className="h-[calc(100%-73px)] overflow-y-auto">
          <div className="p-4">
            <DataTabRenderer
              chartType={chartType}
              chartDataPreview={{
                data: dataPreview.data,
                columns: [],
                columnTypes: {},
                isLoading: dataPreview.isLoading,
                error: dataPreview.error,
                pagination: dataPreview.pagination,
              }}
              rawDataPreview={{
                data: rawData.data,
                isLoading: rawData.isLoading,
                error: rawData.error,
                tableCount: rawData.tableCount,
                pagination: rawData.pagination,
              }}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Internal component to handle chart preview routing
interface ChartPreviewContentProps {
  chartType: string;
  formData: ChartBuilderFormData;
  chartData: ChartDataProps;
  mapData: MapDataProps;
  tableChartData: ChartDataProps & { pagination: PaginationProps };
  drillDown: DrillDownProps;
}

function ChartPreviewContent({
  chartType,
  formData,
  chartData,
  mapData,
  tableChartData,
  drillDown,
}: ChartPreviewContentProps) {
  if (chartType === 'map') {
    return (
      <ChartPreviewRenderer
        chartType="map"
        formData={formData}
        mapProps={{
          data: mapData.mapDataOverlay,
          isLoading: mapData.mapDataLoading,
          error: mapData.mapDataError,
          geojsonData: mapData.geojsonData,
          geojsonLoading: mapData.geojsonLoading,
          geojsonError: mapData.geojsonError,
          mapData: mapData.mapDataOverlay,
          mapDataLoading: mapData.mapDataLoading,
          mapDataError: mapData.mapDataError,
          valueColumn: formData.metrics?.[0]?.alias || formData.aggregate_column,
          customizations: formData.customizations,
          drillDown: {
            path: drillDown.path,
            onRegionClick: drillDown.onRegionClick,
            onDrillUp: drillDown.onDrillUp,
            onDrillHome: drillDown.onDrillHome,
          },
        }}
      />
    );
  }

  if (chartType === 'table') {
    return (
      <ChartPreviewRenderer
        chartType="table"
        formData={formData}
        tableProps={{
          data: tableChartData.data,
          isLoading: tableChartData.isLoading,
          error: tableChartData.error,
          columns: formData.table_columns || [],
          config: {
            table_columns: formData.table_columns || [],
            column_formatting: {},
            sort: formData.sort || [],
            pagination: formData.pagination || { enabled: true, page_size: 20 },
          },
          pagination: tableChartData.pagination,
        }}
      />
    );
  }

  // Standard charts (bar, line, pie, number)
  return (
    <ChartPreviewRenderer
      chartType={chartType as 'bar' | 'line' | 'pie' | 'number'}
      formData={formData}
      chartProps={{
        data: chartData.data,
        isLoading: chartData.isLoading,
        error: chartData.error,
        schemaName: formData.schema_name,
        tableName: formData.table_name,
      }}
    />
  );
}
