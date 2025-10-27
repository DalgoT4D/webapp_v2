'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';
import { Loader2, AlertCircle, BarChart2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TableChart } from './TableChart';

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

    // Determine if this is a pie or number chart (these don't need axes)
    // First try the chartType prop, then detect from config
    let detectedChartType = chartType;
    if (!detectedChartType && config?.series) {
      // Try to detect from the series configuration
      const firstSeries = Array.isArray(config.series) ? config.series[0] : config.series;
      if (firstSeries?.type) {
        detectedChartType = firstSeries.type;
      }
    }

    const isPieChart = detectedChartType === 'pie';
    const isNumberChart = detectedChartType === 'number' || detectedChartType === 'gauge';

    // Debug logging
    console.log('ChartPreview - Chart type detection:', {
      chartTypeProp: chartType,
      detectedChartType,
      isPieChart,
      isNumberChart,
      configHasXAxis: !!config?.xAxis,
      configHasYAxis: !!config?.yAxis,
      firstSeriesType: config?.series?.[0]?.type || 'none',
    });

    try {
      // Dispose existing instance if it exists
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }

      // Create new instance
      chartInstance.current = echarts.init(chartRef.current);

      // Modify config to ensure proper margins for axis titles and axis title styling
      const modifiedConfig = {
        ...config,
        // Enhanced data labels styling
        series: Array.isArray(config.series)
          ? config.series.map((series) => ({
              ...series,
              label: {
                ...series.label,
                fontSize: series.label?.fontSize ? series.label.fontSize + 0.5 : 12.5,
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: 'normal',
              },
            }))
          : config.series
            ? {
                ...config.series,
                label: {
                  ...config.series.label,
                  fontSize: config.series.label?.fontSize
                    ? config.series.label.fontSize + 0.5
                    : 12.5,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: 'normal',
                },
              }
            : undefined,
        // Enhanced tooltip with bold values
        tooltip: {
          ...config.tooltip,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          textStyle: {
            color: '#1f2937',
            fontSize: 12,
          },
          extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);',
          formatter: function (params: any) {
            if (Array.isArray(params)) {
              // For multiple series (line/bar charts with multiple lines/bars)
              let result = '';
              params.forEach((param: any, index: number) => {
                if (index === 0) {
                  result += param.name + '<br/>';
                }
                const value =
                  typeof param.value === 'number' ? param.value.toLocaleString() : param.value;
                result += `${param.marker}${param.seriesName}: <b>${value}</b><br/>`;
              });
              return result;
            } else {
              // For single series (pie charts, single bar/line)
              const value =
                typeof params.value === 'number' ? params.value.toLocaleString() : params.value;
              if (params.percent !== undefined) {
                // Pie chart with percentage
                return `${params.marker}${params.seriesName}<br/><b>${value}</b>: ${params.name} (${params.percent}%)`;
              } else {
                // Regular chart
                return `${params.marker}${params.seriesName}<br/>${params.name}: <b>${value}</b>`;
              }
            }
          },
        },
        // For pie and number charts, completely remove grid and axis configurations
        ...(isPieChart || isNumberChart
          ? {
              // Remove grid entirely
              grid: undefined,
              // Remove axes entirely
              xAxis: undefined,
              yAxis: undefined,
            }
          : {
              // For other chart types, apply normal grid and axis styling
              grid: {
                ...config.grid,
                containLabel: true,
                left: '5%',
                bottom: '5%',
              },
              xAxis: Array.isArray(config.xAxis)
                ? config.xAxis.map((axis) => ({
                    ...axis,
                    nameTextStyle: {
                      fontSize: 14,
                      color: '#374151',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    },
                  }))
                : {
                    ...config.xAxis,
                    nameTextStyle: {
                      fontSize: 14,
                      color: '#374151',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    },
                  },
              yAxis: Array.isArray(config.yAxis)
                ? config.yAxis.map((axis) => ({
                    ...axis,
                    nameTextStyle: {
                      fontSize: 14,
                      color: '#374151',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    },
                  }))
                : {
                    ...config.yAxis,
                    nameTextStyle: {
                      fontSize: 14,
                      color: '#374151',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    },
                  },
            }),
      };

      // Debug the final config for pie/number charts
      if (isPieChart || isNumberChart) {
        console.log('ChartPreview - Final config for pie/number chart:', {
          hasXAxis: 'xAxis' in modifiedConfig,
          hasYAxis: 'yAxis' in modifiedConfig,
          hasGrid: 'grid' in modifiedConfig,
          xAxisValue: modifiedConfig.xAxis,
          yAxisValue: modifiedConfig.yAxis,
          gridValue: modifiedConfig.grid,
        });
      }

      // Set chart option
      chartInstance.current.setOption(modifiedConfig);

      // Notify parent component that chart is ready
      if (onChartReady) {
        onChartReady(chartInstance.current);
      }
    } catch (err) {
      console.error('Error initializing chart:', err);
    }
  }, [config, onChartReady, chartType]);

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
  if (!config && chartType !== 'table' && !isLoading && !chartInstance.current) {
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
