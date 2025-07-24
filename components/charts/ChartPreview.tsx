'use client';

import { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { Loader2, AlertCircle, BarChart2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ChartPreviewProps {
  config?: Record<string, any>;
  isLoading?: boolean;
  error?: any;
}

export function ChartPreview({ config, isLoading, error }: ChartPreviewProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (chartRef.current && config) {
      // Initialize chart if not already done
      if (!chartInstance.current) {
        chartInstance.current = echarts.init(chartRef.current);
      }

      // Set chart option
      chartInstance.current.setOption(config);

      // Handle resize
      const handleResize = () => {
        chartInstance.current?.resize();
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
    // Return undefined for the else case
    return undefined;
  }, [config]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      chartInstance.current?.dispose();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading chart...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load chart data. Please check your configuration and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!config) {
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

  return <div ref={chartRef} className="w-full h-full" />;
}
