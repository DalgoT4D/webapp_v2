'use client';

import { useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, AlertCircle } from 'lucide-react';
import { useChart } from '@/hooks/api/useCharts';
import useSWR from 'swr';
import { apiGet } from '@/lib/api';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, GaugeChart, ScatterChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Register necessary ECharts components
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GaugeChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  CanvasRenderer,
]);

interface ChartElementV2Props {
  chartId: number;
  config: any;
  onRemove: () => void;
  onUpdate: (config: any) => void;
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

  const { data: chart, isLoading: chartLoading, isError: chartError } = useChart(chartId);

  // Create a unique identifier for when filters change to trigger data refetch
  const filterHash = useMemo(() => JSON.stringify(appliedFilters), [appliedFilters]);

  // Build query params with filters
  const queryParams = new URLSearchParams();
  if (Object.keys(appliedFilters).length > 0) {
    queryParams.append('dashboard_filters', JSON.stringify(appliedFilters));
  }

  const apiUrl = `/api/charts/${chartId}/data/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  // Debug logging for API URL generation
  console.log(`🔍 ChartElementV2 ${chartId} - API URL:`, apiUrl);
  console.log(`🔍 ChartElementV2 ${chartId} - appliedFilters:`, appliedFilters);

  // Fetch chart data with filters
  const {
    data: chartData,
    isLoading: dataLoading,
    error: dataError,
    mutate: mutateChartData,
  } = useSWR(apiUrl, apiGet, {
    revalidateOnFocus: false,
    refreshInterval: 0, // Disable auto-refresh
    onSuccess: (data) => {
      console.log(
        '✅ Chart data fetched successfully for chart',
        chartId,
        'with filters:',
        appliedFilters,
        'API URL:',
        apiUrl
      );
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

  // Compute derived state
  const isLoading = chartLoading || dataLoading;
  const isError = chartError || dataError;

  // Force refetch when filters change
  useEffect(() => {
    if (Object.keys(appliedFilters).length > 0) {
      console.log(
        `🔄 ChartElementV2 ${chartId} - Filters changed, forcing refetch:`,
        appliedFilters
      );
      mutateChartData();
    }
  }, [appliedFilters, mutateChartData, chartId]);

  // Debug logging
  useEffect(() => {
    console.log(`📊 ChartElementV2 ${chartId} - Chart metadata:`, chart);
    console.log(`📊 ChartElementV2 ${chartId} - Chart data:`, chartData);
    console.log(`📊 ChartElementV2 ${chartId} - Applied filters:`, appliedFilters);
    console.log(
      `📊 ChartElementV2 ${chartId} - echarts_config available:`,
      chartData?.echarts_config ? 'yes' : 'no'
    );
  }, [chart, chartData, chartId, appliedFilters]);

  // Initialize chart instance once
  useEffect(() => {
    // Use a small delay to ensure DOM is ready and container has dimensions
    const initTimer = setTimeout(() => {
      if (chartRef.current && !chartInstance.current) {
        const { width, height } = chartRef.current.getBoundingClientRect();

        // Only initialize if container has dimensions
        if (width > 0 && height > 0) {
          console.log(`Initializing ECharts instance for chart ${chartId} (${width}x${height})`);
          chartInstance.current = echarts.init(chartRef.current);
        } else {
          console.warn(`Chart container for ${chartId} has no dimensions, delaying initialization`);
        }
      }
    }, 50);

    // Cleanup only on unmount
    return () => {
      clearTimeout(initTimer);
      if (chartInstance.current) {
        console.log(`Disposing ECharts instance for chart ${chartId}`);
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []); // Empty dependency array - only run on mount/unmount

  // Update chart data separately
  useEffect(() => {
    // Use fresh echarts_config from data endpoint (no more render_config fallback)
    const chartConfig = chartData?.echarts_config;

    // If we have data but no chart instance yet, try to initialize
    if (!chartInstance.current && chartRef.current && chartConfig) {
      const { width, height } = chartRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) {
        console.log(`Late initialization of ECharts for chart ${chartId}`);
        chartInstance.current = echarts.init(chartRef.current);
      }
    }

    if (chartInstance.current && chartConfig) {
      console.log(`Updating chart ${chartId} with config:`, chartConfig);

      // Set chart option with animation disabled for better performance
      chartInstance.current.setOption(chartConfig, {
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
    } else if (!chartConfig && !isLoading) {
      console.warn(`No chart config available for chart ${chartId}`);
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
          console.log('Final resize after drag stop:', width, 'x', height);
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
        <CardContent className="p-0 flex-1">
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
    </div>
  );
}
