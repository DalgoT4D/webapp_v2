'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, BarChart3 } from 'lucide-react';
import { DataPreview } from './DataPreview';

export interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export interface ChartDataPreviewProps {
  data: any;
  columns: string[];
  columnTypes: Record<string, string>;
  isLoading: boolean;
  error: any;
  pagination: PaginationConfig;
}

export interface RawDataPreviewProps {
  data: any;
  isLoading: boolean;
  error: any;
  tableCount: any;
  pagination: {
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
}

export interface DataTabRendererProps {
  chartType: string;
  chartDataPreview: ChartDataPreviewProps;
  rawDataPreview: RawDataPreviewProps;
}

/**
 * Renders the DATA tab content with Chart Data and Raw Data sub-tabs.
 * Adapts based on chart type (table charts only show Raw Data).
 */
export function DataTabRenderer({
  chartType,
  chartDataPreview,
  rawDataPreview,
}: DataTabRendererProps) {
  const isTableChart = chartType === 'table';
  const defaultTab = isTableChart ? 'raw-data' : 'chart-data';

  return (
    <Tabs defaultValue={defaultTab} className="h-full flex flex-col">
      <TabsList className={`grid w-full ${isTableChart ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {!isTableChart && (
          <TabsTrigger value="chart-data" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Chart Data
          </TabsTrigger>
        )}
        <TabsTrigger value="raw-data" className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          Raw Data
        </TabsTrigger>
      </TabsList>

      {!isTableChart && (
        <TabsContent value="chart-data" className="flex-1">
          <ChartDataPreview {...chartDataPreview} />
        </TabsContent>
      )}

      <TabsContent value="raw-data" className="flex-1">
        <RawDataPreview {...rawDataPreview} />
      </TabsContent>
    </Tabs>
  );
}

function ChartDataPreview({
  data,
  columns,
  columnTypes,
  isLoading,
  error,
  pagination,
}: ChartDataPreviewProps) {
  return (
    <DataPreview
      data={Array.isArray(data?.data) ? data.data : []}
      columns={data?.columns || columns}
      columnTypes={data?.column_types || columnTypes}
      isLoading={isLoading}
      error={error}
      pagination={pagination}
    />
  );
}

function RawDataPreview({ data, isLoading, error, tableCount, pagination }: RawDataPreviewProps) {
  const rawData = Array.isArray(data) ? data : [];
  const columns = rawData.length > 0 ? Object.keys(rawData[0]) : [];

  return (
    <DataPreview
      data={rawData}
      columns={columns}
      columnTypes={{}}
      isLoading={isLoading}
      error={error}
      pagination={
        tableCount
          ? {
              page: pagination.page,
              pageSize: pagination.pageSize,
              total: tableCount.total_rows || 0,
              onPageChange: pagination.onPageChange,
              onPageSizeChange: pagination.onPageSizeChange,
            }
          : undefined
      }
    />
  );
}
