'use client';

import { useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, AlertCircle } from 'lucide-react';
import { useChart } from '@/hooks/api/useCharts';
import { useChartDataPreview } from '@/hooks/api/useChart';
import useSWR from 'swr';
import { apiGet, apiPost } from '@/lib/api';
import { ChartTitleEditor } from './chart-title-editor';
import { DataPreview } from '@/components/charts/DataPreview';
import type { ChartTitleConfig } from '@/lib/chart-title-utils';
import type { ChartDataPayload } from '@/types/charts';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, GaugeChart, ScatterChart, MapChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
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
  MapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  VisualMapComponent,
  GeoComponent,
  CanvasRenderer,
]);

interface ChartElementV2Props {
  chartId: number;
  config: any & ChartTitleConfig;
  onRemove: () => void;
  onUpdate: (config: any & ChartTitleConfig) => void;
  isResizing?: boolean;
  isEditMode?: boolean;
  appliedFilters?: Record<string, any>;
}

export function ChartElementV2({
  chartId,
  config,
  onRemove,
  onUpdate,
  isResizing,
  isEditMode = true,
  appliedFilters = {},
}: ChartElementV2Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    data: chart,
    isLoading: chartLoading,
    isError: chartError,
    error: chartFetchError,
  } = useChart(chartId);

  // Handle title configuration updates
  const handleTitleChange = (titleConfig: ChartTitleConfig) => {
    onUpdate({
      ...config,
      ...titleConfig,
    });
  };

  // Create a unique identifier for when filters change to trigger data refetch
  const filterHash = useMemo(() => JSON.stringify(appliedFilters), [appliedFilters]);

  // Build query params with filters
  const queryParams = new URLSearchParams();
  if (Object.keys(appliedFilters).length > 0) {
    queryParams.append('dashboard_filters', JSON.stringify(appliedFilters));
  }

  const apiUrl = `/api/charts/${chartId}/data/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  // Debug logging for API URL generation

  // Fetch chart data with filters
  const {
    data: chartData,
    isLoading: dataLoading,
    error: dataError,
    mutate: mutateChartData,
  } = useSWR(apiUrl, apiGet, {
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
      console.error(
        '❌ Error fetching chart data for chart',
        chartId,
        'with filters:',
        appliedFilters,
        'API URL:',
        apiUrl,
        'Error:',
        error
      );
    },
  });

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
            Object.keys(appliedFilters).length > 0
              ? Object.entries(appliedFilters).map(([filterId, value]) => ({
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

  // Compute derived state
  const isLoading = chartLoading || (chart?.chart_type === 'table' ? tableLoading : dataLoading);
  const isError = chartError || (chart?.chart_type === 'table' ? tableError : dataError);

  // Get the actual error message
  const errorMessage =
    chartFetchError?.message ||
    (chart?.chart_type === 'table' ? tableError?.message : dataError?.message) ||
    'Failed to load chart';

  // Force refetch when filters change
  useEffect(() => {
    if (Object.keys(appliedFilters).length > 0) {
      mutateChartData();
    }
  }, [appliedFilters, mutateChartData, chartId]);

  // Debug logging
  useEffect(() => {
    // Chart config availability check
  }, [chart, chartData, chartId, appliedFilters]);

  // Initialize chart instance once
  useEffect(() => {
    // Use a small delay to ensure DOM is ready and container has dimensions
    const initTimer = setTimeout(() => {
      if (chartRef.current && !chartInstance.current) {
        const { width, height } = chartRef.current.getBoundingClientRect();

        // Only initialize if container has dimensions
        if (width > 0 && height > 0) {
          chartInstance.current = echarts.init(chartRef.current);
        }
      }
    }, 50);

    // Cleanup only on unmount
    return () => {
      clearTimeout(initTimer);
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []); // Empty dependency array - only run on mount/unmount

  // Update chart data separately
  useEffect(() => {
    // Use fresh echarts_config from data endpoint (no more render_config fallback)
    let chartConfig = chartData?.echarts_config;

    // If we have data but no chart instance yet, try to initialize
    if (!chartInstance.current && chartRef.current && chartConfig) {
      const { width, height } = chartRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) {
        chartInstance.current = echarts.init(chartRef.current);
      }
    }

    if (chartInstance.current && chartConfig) {
      // Handle map charts - register GeoJSON data if available
      if (chart?.chart_type === 'map' && chartData?.data?.geojson) {
        const mapName = `map_${chartId}_${Date.now()}`;
        echarts.registerMap(mapName, chartData.data.geojson);

        // Update map series to use registered map name - create a copy to avoid mutation
        chartConfig = {
          ...chartConfig,
          series: chartConfig.series?.map((series: any) => ({
            ...series,
            map: mapName,
          })),
        };
      }

      // Disable ECharts internal title since we use HTML titles
      const modifiedConfig = {
        ...chartConfig,
        title: {
          ...chartConfig.title,
          show: false, // Disable ECharts built-in title
        },
      };

      // Set chart option with animation disabled for better performance
      chartInstance.current.setOption(modifiedConfig, {
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
  }, [chartData, chart, chartId, isLoading, filterHash]); // Update when data or filters change

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

  // Handle resize when isResizing prop changes
  useEffect(() => {
    if (!isResizing && chartInstance.current && chartRef.current) {
      // Clear any pending resize
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      // Perform final resize after drag/resize stops
      resizeTimeoutRef.current = setTimeout(() => {
        if (chartInstance.current && chartRef.current) {
          const { width, height } = chartRef.current.getBoundingClientRect();
          chartInstance.current.resize({
            width: Math.floor(width),
            height: Math.floor(height),
          });
        }
      }, 300); // Slightly longer delay for final resize
    }

    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [isResizing]);

  return (
    <div className="h-full w-full relative">
      {isEditMode && (
        <div className="absolute -top-2 -right-2 z-10">
          <button
            onClick={onRemove}
            className="p-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all"
            title="Remove chart"
          >
            <X className="w-3 h-3 text-gray-600 hover:text-red-600" />
          </button>
        </div>
      )}
      <Card className="h-full flex flex-col">
        <CardContent className="p-4 flex-1 flex flex-col">
          {/* Chart Title Editor */}
          <ChartTitleEditor
            chartData={chart}
            config={config}
            onTitleChange={handleTitleChange}
            isEditMode={isEditMode}
            className="flex-shrink-0"
          />

          {/* Chart Content */}
          <div className="flex-1 min-h-[200px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-xs text-muted-foreground">Loading chart...</p>
                </div>
              </div>
            ) : isError ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-4">
                  <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                  <p className="text-sm text-destructive">Chart Error</p>
                  <p className="text-xs text-muted-foreground mt-1">{errorMessage}</p>
                </div>
              </div>
            ) : chart?.chart_type === 'table' ? (
              <DataPreview
                data={Array.isArray(tableData?.data) ? tableData.data : []}
                columns={tableData?.columns || []}
                columnTypes={tableData?.column_types || {}}
                isLoading={tableLoading}
                error={tableError}
              />
            ) : (
              <div ref={chartRef} className="w-full h-full" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
