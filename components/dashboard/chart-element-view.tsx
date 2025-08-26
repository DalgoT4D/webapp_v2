'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw, Maximize2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import { apiGet, apiPost } from '@/lib/api';
import { useChart } from '@/hooks/api/useCharts';
import { useChartDataPreview } from '@/hooks/api/useChart';
import { ChartTitleEditor } from './chart-title-editor';
import { DataPreview } from '@/components/charts/DataPreview';
import { resolveChartTitle, type ChartTitleConfig } from '@/lib/chart-title-utils';
import type { ChartDataPayload } from '@/types/charts';
import * as echarts from 'echarts/core';
import {
  BarChart,
  LineChart,
  PieChart,
  GaugeChart,
  ScatterChart,
  HeatmapChart,
  MapChart,
} from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  ToolboxComponent,
  DataZoomComponent,
  VisualMapComponent,
  GeoComponent,
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
  MapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  ToolboxComponent,
  DataZoomComponent,
  VisualMapComponent,
  GeoComponent,
  CanvasRenderer,
]);

interface ChartElementViewProps {
  chartId: number;
  dashboardFilters?: Record<string, any>;
  viewMode?: boolean;
  className?: string;
  isPublicMode?: boolean;
  publicToken?: string; // Required when isPublicMode=true
  config?: ChartTitleConfig; // For dashboard title configuration
}

export function ChartElementView({
  chartId,
  dashboardFilters = {},
  viewMode = true,
  className,
  isPublicMode = false,
  publicToken,
  config = {},
}: ChartElementViewProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fetch chart metadata to determine chart type
  const {
    data: chart,
    isLoading: chartLoading,
    isError: chartError,
    error: chartFetchError,
  } = useChart(chartId);

  // Create a unique identifier for when filters change to trigger instance recreation
  const filterHash = useMemo(() => JSON.stringify(dashboardFilters), [dashboardFilters]);
  const previousFilterHash = useRef<string>(filterHash);

  // Build query params with filters
  const queryParams = new URLSearchParams();
  if (Object.keys(dashboardFilters).length > 0) {
    queryParams.append('dashboard_filters', JSON.stringify(dashboardFilters));
  }

  // Use public API endpoint if in public mode, otherwise use regular API
  const apiUrl =
    isPublicMode && publicToken
      ? `/api/v1/public/dashboards/${publicToken}/charts/${chartId}/data/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      : `/api/charts/${chartId}/data/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  // Custom fetcher for public mode
  const fetcher = isPublicMode
    ? async (url: string) => {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002'}${url}`
        );
        if (!response.ok) throw new Error('Failed to fetch chart data');
        return response.json();
      }
    : apiGet;

  // Fetch chart data with filters
  const {
    data: chartData,
    isLoading,
    error: isError,
    mutate,
  } = useSWR(apiUrl, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: 0, // Disable auto-refresh
    // Don't retry on 404 errors
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      // Never retry on 404
      if (error?.message?.includes('404') || error?.message?.includes('not found')) {
        return;
      }
      // Only retry up to 3 times for other errors
      if (retryCount >= 3) return;

      // Retry after 1 second
      setTimeout(() => revalidate({ retryCount }), 1000);
    },
    onSuccess: (data) => {
      // Chart data fetched successfully
    },
    onError: (error) => {
      console.error('Error fetching chart data:', error);
    },
  });

  // Fetch chart metadata for title resolution (not needed in public mode)
  const { data: chartMetadata, error: metadataError } = useSWR(
    !isPublicMode ? `/api/charts/${chartId}` : null,
    apiGet,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0,
      // Don't retry on 404 errors
      onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
        // Never retry on 404
        if (error?.message?.includes('404') || error?.message?.includes('not found')) {
          return;
        }
        // Only retry up to 3 times for other errors
        if (retryCount >= 3) return;

        // Retry after 1 second
        setTimeout(() => revalidate({ retryCount }), 1000);
      },
    }
  );

  // For table charts, also fetch raw data using data preview API
  const chartDataPayload: ChartDataPayload | null =
    chart?.chart_type === 'table' && chart
      ? {
          chart_type: chart.chart_type,
          computation_type: chart.computation_type as 'raw' | 'aggregated',
          schema_name: chart.schema_name,
          table_name: chart.table_name,
          x_axis: chart.extra_config?.x_axis_column,
          y_axis: chart.extra_config?.y_axis_column,
          dimension_col: chart.extra_config?.dimension_column,
          aggregate_col: chart.extra_config?.aggregate_column,
          aggregate_func: chart.extra_config?.aggregate_function || 'sum',
          extra_dimension: chart.extra_config?.extra_dimension_column,
          metrics: chart.extra_config?.metrics,
          extra_config: {
            filters: chart.extra_config?.filters,
            pagination: chart.extra_config?.pagination,
            sort: chart.extra_config?.sort,
          },
          // Include dashboard filters in the payload
          dashboard_filters:
            Object.keys(dashboardFilters).length > 0
              ? Object.entries(dashboardFilters).map(([filterId, value]) => ({
                  filter_id: filterId,
                  value: value,
                }))
              : undefined,
        }
      : null;

  const {
    data: tableData,
    error: tableError,
    isLoading: tableLoading,
  } = useChartDataPreview(chartDataPayload, 1, 50);

  // Get the actual error message
  const errorMessage =
    metadataError?.message ||
    (chart?.chart_type === 'table' ? tableError?.message : isError?.message) ||
    'Failed to load chart';

  // Initialize and update chart
  useEffect(() => {
    if (!chartRef.current) {
      return undefined;
    }

    // Check if filters changed and we need to recreate the chart instance
    const filtersChanged = previousFilterHash.current !== filterHash;
    if (filtersChanged && chartInstance.current && chartData?.echarts_config) {
      chartInstance.current.dispose();
      chartInstance.current = null;
      previousFilterHash.current = filterHash;
    }

    // Initialize chart instance if it doesn't exist
    if (!chartInstance.current) {
      try {
        chartInstance.current = echarts.init(chartRef.current, null, {
          renderer: 'canvas',
        });
      } catch (error) {
        console.error('Failed to create chart instance:', error);
        return undefined;
      }
    }

    // Only proceed with config if we have valid echarts_config
    if (!chartData?.echarts_config) {
      // Clear chart but don't dispose instance
      if (chartInstance.current) {
        chartInstance.current.clear();
      }
      return undefined;
    }

    // Handle map charts - register GeoJSON data if available
    let baseConfig = chartData.echarts_config;
    if (chartMetadata?.chart_type === 'map' && chartData?.data?.geojson) {
      const mapName = `map_${chartId}_${Date.now()}`;
      echarts.registerMap(mapName, chartData.data.geojson);

      // Update map series to use registered map name
      baseConfig = {
        ...baseConfig,
        series: baseConfig.series?.map((series: any) => ({
          ...series,
          map: mapName,
        })),
      };
    }

    // Apply beautiful theme and styling
    const styledConfig = {
      ...baseConfig,
      // Disable ECharts internal title since we use HTML titles
      title: {
        ...chartData.echarts_config.title,
        show: false,
      },
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
        top: '10%', // Reduced from 15% since we have HTML title
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

    // Check DOM element dimensions before setting options
    const rect = chartRef.current.getBoundingClientRect();

    try {
      // Use notMerge: true on first render after filter change, false otherwise
      const notMerge = filtersChanged || !chartInstance.current.getOption();
      chartInstance.current.setOption(styledConfig, notMerge);

      // Ensure the chart is properly sized after setting options
      chartInstance.current.resize();
    } catch (error) {
      console.error('Error setting chart option for chart', chartId, error);
    }

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
  }, [dashboardFilters, mutate, chartId]);

  // Cleanup on unmount and when chartId changes
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [chartId]);

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

  if (isLoading || chartLoading || (chart?.chart_type === 'table' && tableLoading)) {
    return (
      <div className={cn('h-full flex items-center justify-center', className)}>
        <div className="w-full h-full min-h-[200px] p-4">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    );
  }

  if (
    isError ||
    chartError ||
    (chart?.chart_type === 'table' && tableError) ||
    (chart?.chart_type !== 'table' && !chartData)
  ) {
    return (
      <div className={cn('h-full flex items-center justify-center p-4', className)}>
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-900">Chart Error</p>
          <p className="text-xs text-muted-foreground mt-1">{errorMessage}</p>
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
        'h-full relative group flex flex-col',
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

      {/* Chart Title - HTML title for better styling and interaction */}
      <div className="px-2 pt-2">
        <ChartTitleEditor
          chartData={chartMetadata}
          config={config}
          onTitleChange={() => {}} // Read-only in view mode
          isEditMode={false}
        />
      </div>

      {/* Chart container */}
      {chart?.chart_type === 'table' ? (
        <div className="w-full flex-1 min-h-[200px] p-2">
          <DataPreview
            data={Array.isArray(tableData?.data) ? tableData.data : []}
            columns={tableData?.columns || []}
            columnTypes={tableData?.column_types || {}}
            isLoading={tableLoading}
            error={tableError}
          />
        </div>
      ) : (
        <div
          ref={chartRef}
          className="w-full flex-1 min-h-[200px]"
          style={{ padding: viewMode ? '8px' : '0' }}
        />
      )}
    </div>
  );
}
