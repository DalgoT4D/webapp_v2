'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';
import { Loader2, AlertCircle, BarChart2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TableChart } from './TableChart';
import { processChartConfig } from '@/lib/chart-config-processor';

interface ChartPreviewProps {
  config?: Record<string, any>;
  isLoading?: boolean;
  error?: any;
  onChartReady?: (chart: echarts.ECharts) => void;
  chartType?: string;
  tableData?: Record<string, any>[];
  onTableSort?: (column: string, direction: 'asc' | 'desc') => void;
}

export function ChartPreview({
  config,
  isLoading,
  error,
  onChartReady,
  chartType,
  tableData,
  onTableSort,
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

      // Modify config to ensure proper margins for axis titles
      const modifiedConfig = {
        ...config,
        grid: {
          ...config.grid,
          containLabel: true,
          left: '5%',
          bottom: '5%',
        },
      };

      // Process the config to handle special features like label thresholds
      const processedConfig = processChartConfig(modifiedConfig);

      // Set chart option
      chartInstance.current.setOption(processedConfig);

      // Notify parent component that chart is ready
      if (onChartReady) {
        onChartReady(chartInstance.current);
      }
    } catch (err) {
      console.error('Error initializing chart:', err);
    }
  }, [config, onChartReady]);

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
    return (
      <div className="relative h-full">
        <div className="absolute top-0 left-0 right-0 z-10 p-4">
          <Alert variant="warning">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Chart configuration needs a small adjustment. Please review your settings and try
              again.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!config && chartType !== 'table') {
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
  if (chartType === 'table') {
    return <TableChart data={tableData} config={config} onSort={onTableSort} />;
  }

  // Render ECharts-based charts
  return <div ref={chartRef} className="w-full h-full" />;
}
