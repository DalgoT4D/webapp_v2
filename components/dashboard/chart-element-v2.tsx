'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, AlertCircle } from 'lucide-react';
import { useChart, useChartData } from '@/hooks/api/useCharts';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Register necessary ECharts components
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

interface ChartElementV2Props {
  chartId: number;
  config: any;
  onRemove: () => void;
  onUpdate: (config: any) => void;
}

export function ChartElementV2({ chartId, config, onRemove, onUpdate }: ChartElementV2Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const { data: chart, isLoading: chartLoading, isError: chartError } = useChart(chartId);
  const { data: chartData, isLoading: dataLoading, isError: dataError } = useChartData(chartId);

  useEffect(() => {
    // Initialize or update chart
    if (chartRef.current && chartData?.echarts_config) {
      if (!chartInstance.current) {
        chartInstance.current = echarts.init(chartRef.current);
      }

      // Set chart option with animation disabled for better performance
      chartInstance.current.setOption(chartData.echarts_config, {
        notMerge: true,
        lazyUpdate: false,
        silent: false,
      });

      // Force resize after setting options to ensure proper rendering
      setTimeout(() => {
        if (chartInstance.current) {
          chartInstance.current.resize();
        }
      }, 100);
    }

    // Cleanup on unmount
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [chartData]);

  // Handle window resize and container resize - separate from chart data changes
  useEffect(() => {
    let resizeTimeoutId: NodeJS.Timeout | null = null;

    const handleResize = () => {
      if (chartInstance.current) {
        // Clear any pending resize
        if (resizeTimeoutId) {
          clearTimeout(resizeTimeoutId);
        }

        // Debounce resize calls
        resizeTimeoutId = setTimeout(() => {
          if (chartInstance.current) {
            console.log('Window resize - resizing chart instance');
            chartInstance.current.resize();
          }
        }, 100);
      }
    };

    // Handle window resize
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
    };
  }, []); // No dependencies to avoid infinite loops

  // Handle container resize using ResizeObserver - separate effect
  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimeoutId: NodeJS.Timeout | null = null;

    if (chartRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver((entries) => {
        // Clear any pending resize
        if (resizeTimeoutId) {
          clearTimeout(resizeTimeoutId);
        }

        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            // Debounce rapid resize events
            resizeTimeoutId = setTimeout(() => {
              if (chartInstance.current) {
                console.log('ResizeObserver triggered, resizing chart to:', width, 'x', height);

                // Force explicit resize with dimensions for all chart types
                chartInstance.current.resize({
                  width: Math.floor(width),
                  height: Math.floor(height),
                });
              }
            }, 150);
          }
        }
      });

      resizeObserver.observe(chartRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
    };
  }, []); // No dependencies to avoid re-creating observer

  const isLoading = chartLoading || dataLoading;
  const isError = chartError || dataError;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div>
          <CardTitle className="text-base">{chart?.title || `Chart #${chartId}`}</CardTitle>
          <CardDescription className="text-xs">
            {chart?.chart_type && chart?.computation_type
              ? `${chart.chart_type} • ${chart.computation_type}`
              : 'Data Visualization'}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-0 flex-1">
        <div className="h-full min-h-[200px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-xs text-muted-foreground">Loading chart...</p>
              </div>
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-sm text-destructive">Failed to load chart</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Please check your data connection
                </p>
              </div>
            </div>
          ) : (
            <div ref={chartRef} className="w-full h-full" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
