'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';
import { Loader2, AlertCircle, BarChart2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TableChart } from './chart-types/table/TableChart';
import PivotTableChart from '@/components/charts/chart-types/pivot-table/PivotTableChart';
import { getPivotRenderProps } from '@/components/charts/chart-types/pivot-table/utils';
import { PivotTableResponse } from '@/types/pivot-table';
import { buildChartPreviewOption } from '@/components/charts/chart-types/echarts/preview-option';
import { ChartTypes } from '@/types/charts';
import { mergeTableColumnFormatting } from '@/lib/chart-payload-utils';

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
  customizations?: Record<string, any>;
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
  customizations: propCustomizations,
}: ChartPreviewProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Initialize or update chart
  const initializeChart = useCallback(() => {
    if (!chartRef.current) return;

    // If no config, dispose existing chart to clear it
    if (!config) {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
      return;
    }

    try {
      // Dispose existing instance if it exists
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }

      // Create new instance
      chartInstance.current = echarts.init(chartRef.current);

      const modifiedConfig = buildChartPreviewOption(config, {
        chartType,
        customizations: propCustomizations,
      });

      // Set chart option (notMerge: true ensures clean updates when customizations change)
      chartInstance.current.setOption(modifiedConfig, { notMerge: true });

      // Notify parent component that chart is ready
      if (onChartReady) {
        onChartReady(chartInstance.current);
      }
    } catch (err) {
      console.error('Error initializing chart:', err);
    }
  }, [config, onChartReady, chartType, propCustomizations]);

  useEffect(() => {
    initializeChart();

    // Handle resize
    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [initializeChart]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="relative w-full h-full min-h-[300px]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-sm text-muted-foreground">Loading chart...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    // When error is passed in, just show empty space since error is handled at page level
    return <div className="w-full h-full" />;
  }

  // Only show configure message for truly empty state (no previous chart)
  if (
    !config &&
    chartType !== ChartTypes.TABLE &&
    chartType !== ChartTypes.PIVOT_TABLE &&
    !isLoading &&
    !chartInstance.current
  ) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <BarChart2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>Configure your chart to see a preview</p>
          <p className="text-sm mt-2">Select data source and columns to get started</p>
        </div>
      </div>
    );
  }

  // Render table chart
  if (chartType === ChartTypes.TABLE) {
    // Merge customizations into config for table charts
    const customizations = propCustomizations || config?.extra_config?.customizations || {};
    // Apply column order if it matches current columns
    const currentCols: string[] = config?.table_columns || [];
    const colOrder: string[] | undefined = customizations?.columnOrder;
    const orderedColumns =
      colOrder?.length &&
      colOrder.length === currentCols.length &&
      colOrder.every((c: string) => currentCols.includes(c))
        ? colOrder
        : currentCols;

    const tableConfig = {
      ...config,
      ...(orderedColumns.length ? { table_columns: orderedColumns } : {}),
      column_formatting: {
        ...(config?.column_formatting || {}),
        ...mergeTableColumnFormatting(customizations),
      },
      conditionalFormatting: customizations?.conditionalFormatting || [],
      columnAlignment: customizations?.columnAlignment || {},
      zebraRows: customizations?.zebraRows ?? true,
      freezeFirstColumn: customizations?.freezeFirstColumn || false,
      theme: customizations?.theme as string | undefined,
    };

    return (
      <TableChart
        data={tableData}
        config={tableConfig}
        onSort={onTableSort}
        pagination={tablePagination}
      />
    );
  }

  // Render pivot table chart
  if (chartType === ChartTypes.PIVOT_TABLE) {
    const pivotData = tableData as unknown as PivotTableResponse | undefined;
    if (!pivotData || !pivotData.cells || !pivotData.metric_headers) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Configure your pivot table
        </div>
      );
    }

    return (
      <PivotTableChart
        data={pivotData}
        {...getPivotRenderProps(config?.extra_config, propCustomizations)}
      />
    );
  }

  // Render ECharts-based charts
  return <div ref={chartRef} className="w-full h-full" />;
}
