'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw, Maximize2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import { apiGet } from '@/lib/api';
import * as echarts from 'echarts/core';
import {
  BarChart,
  LineChart,
  PieChart,
  GaugeChart,
  ScatterChart,
  HeatmapChart,
} from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  ToolboxComponent,
  DataZoomComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Register necessary ECharts components
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GaugeChart,
  ScatterChart,
  HeatmapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  ToolboxComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

interface ChartElementViewProps {
  chartId: number;
  dashboardFilters?: Record<string, any>;
  viewMode?: boolean;
  className?: string;
}

export function ChartElementView({
  chartId,
  dashboardFilters = {},
  viewMode = true,
  className,
}: ChartElementViewProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Build query params with filters
  const queryParams = new URLSearchParams();
  if (Object.keys(dashboardFilters).length > 0) {
    queryParams.append('dashboard_filters', JSON.stringify(dashboardFilters));
  }

  // Fetch chart data with filters
  const {
    data: chartData,
    isLoading,
    error: isError,
    mutate,
  } = useSWR(
    `/api/charts/${chartId}/data/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
    apiGet,
    {
      revalidateOnFocus: false,
      refreshInterval: 0, // Disable auto-refresh
    }
  );

  // Initialize and update chart
  useEffect(() => {
    if (!chartRef.current || !chartData?.echarts_config) return undefined;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, null, {
        renderer: 'canvas',
      });
    }

    // Apply beautiful theme and styling
    const styledConfig = {
      ...chartData.echarts_config,
      animation: true,
      animationDuration: 500,
      animationEasing: 'cubicOut',
      textStyle: {
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      color: [
        '#3b82f6', // blue-500
        '#10b981', // emerald-500
        '#f59e0b', // amber-500
        '#ef4444', // red-500
        '#8b5cf6', // violet-500
        '#ec4899', // pink-500
        '#14b8a6', // teal-500
        '#f97316', // orange-500
      ],
      grid: {
        top: '15%',
        left: '3%',
        right: '4%',
        bottom: '10%',
        containLabel: true,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        textStyle: {
          color: '#1f2937',
          fontSize: 12,
        },
        extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);',
      },
      legend: {
        type: 'scroll',
        bottom: 0,
        textStyle: {
          fontSize: 12,
          color: '#6b7280',
        },
      },
    };

    chartInstance.current.setOption(styledConfig, true);

    // Handle resize
    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    // Resize observer for container changes
    const resizeObserver = new ResizeObserver(() => {
      chartInstance.current?.resize();
    });

    resizeObserver.observe(chartRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [chartData]);

  // Re-fetch data when filters change
  useEffect(() => {
    mutate();
  }, [dashboardFilters, mutate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  const handleRefresh = () => {
    mutate();
  };

  const handleDownload = () => {
    if (chartInstance.current) {
      const url = chartInstance.current.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#fff',
      });
      const link = document.createElement('a');
      link.download = `chart-${chartId}.png`;
      link.href = url;
      link.click();
    }
  };

  const toggleFullscreen = () => {
    if (!chartRef.current) return;

    if (!document.fullscreenElement) {
      chartRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (isLoading) {
    return (
      <div className={cn('h-full flex items-center justify-center', className)}>
        <div className="w-full h-full min-h-[200px] p-4">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    );
  }

  if (isError || !chartData) {
    return (
      <div className={cn('h-full flex items-center justify-center p-4', className)}>
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load chart</p>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-2">
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'h-full relative group',
        className,
        isFullscreen && 'fixed inset-0 z-50 bg-white'
      )}
    >
      {/* Chart toolbar - only visible on hover in view mode */}
      {viewMode && (
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex gap-1 bg-white/90 backdrop-blur rounded-md shadow-sm p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="h-7 w-7 p-0"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-7 w-7 p-0"
              title="Download"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="h-7 w-7 p-0"
              title="Fullscreen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Chart title is now handled by ECharts config */}

      {/* Chart container */}
      <div
        ref={chartRef}
        className="w-full h-full min-h-[200px]"
        style={{ padding: viewMode ? '8px' : '0' }}
      />
    </div>
  );
}
