'use client';

import type * as echarts from 'echarts';
import { BarChart2 } from 'lucide-react';
import { useEChartsInstance } from '@/hooks/useEChartsInstance';
import { transformStandardChartConfig } from '@/lib/chart-config-transform';
import {
  ChartLoadingState,
  ChartSilentErrorState,
  ChartEmptyState,
} from './common/ChartStateRenderers';
import { TableChart } from './TableChart';

interface ChartPreviewProps {
  config?: Record<string, any>;
  isLoading?: boolean;
  error?: any;
  onChartReady?: (chart: echarts.ECharts) => void;
  chartType?: string;
  tableData?: Record<string, any>[];
  onTableSort?: (column: string, direction: 'asc' | 'desc') => void;
  tablePagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
  };
}

export function ChartPreview({
  config,
  isLoading,
  error,
  onChartReady,
  chartType,
  tableData,
  onTableSort,
  tablePagination,
}: ChartPreviewProps) {
  const { chartRef, chartInstance } = useEChartsInstance({
    config,
    chartType,
    onChartReady,
    transformConfig: transformStandardChartConfig,
  });

  // Loading state
  if (isLoading) {
    return <ChartLoadingState message="Loading chart..." />;
  }

  // Error state - silent since error is handled at page level
  if (error) {
    return <ChartSilentErrorState />;
  }

  // Empty state - only show for truly empty state (no previous chart)
  if (!config && chartType !== 'table' && !isLoading && !chartInstance.current) {
    return (
      <ChartEmptyState
        icon={BarChart2}
        title="Configure your chart to see a preview"
        subtitle="Select data source and columns to get started"
      />
    );
  }

  // Table chart delegation
  if (chartType === 'table') {
    return (
      <TableChart
        data={tableData}
        config={config}
        onSort={onTableSort}
        pagination={tablePagination}
      />
    );
  }

  // ECharts-based charts
  return <div ref={chartRef} className="w-full h-full" />;
}
