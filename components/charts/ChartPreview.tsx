'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';
import { Loader2, AlertCircle, BarChart2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TableChart } from './TableChart';
import {
  applyLegendPosition,
  extractLegendPosition,
  isLegendPaginated,
  type LegendPosition,
} from '@/lib/chart-legend-utils';

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

    try {
      // Dispose existing instance if it exists
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }

      // Create new instance
      chartInstance.current = echarts.init(chartRef.current);

      // Extract legend position from props or config's customizations
      const customizations =
        propCustomizations || config.extra_config?.customizations || config.customizations || {};
      const legendPosition = extractLegendPosition(customizations, config) as LegendPosition;
      const isPaginated = isLegendPaginated(customizations);

      // Apply legend positioning (handles both legend config and pie chart center adjustment)
      const configWithLegend = config.legend
        ? applyLegendPosition(config, legendPosition, isPaginated, detectedChartType)
        : config;

      // Modify config to ensure proper margins for axis titles and axis title styling
      const modifiedConfig = {
        ...config,
        // Enhanced legend positioning - respect backend config if provided, otherwise use defaults
        legend: config.legend
          ? {
              ...config.legend,
              // Preserve backend positioning if provided, otherwise use sensible defaults
              top: config.legend.top ?? '5%',
              left: config.legend.left ?? 'center',
              right: config.legend.right,
              bottom: config.legend.bottom,
              orient: config.legend.orient || 'horizontal',
            }
          : undefined,
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
          : configWithLegend.series
            ? {
                ...configWithLegend.series,
                label: {
                  ...configWithLegend.series.label,
                  fontSize: configWithLegend.series.label?.fontSize
                    ? configWithLegend.series.label.fontSize + 0.5
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
              // Dynamically adjust margins based on legend position and label rotation
              grid: (() => {
                const hasRotatedXLabels =
                  config.xAxis?.axisLabel?.rotate !== undefined &&
                  config.xAxis?.axisLabel?.rotate !== 0;
                const hasLegend = config.legend?.show !== false;

                // Adjust margins based on legend position
                let topMargin = hasLegend && legendPosition === 'top' ? '18%' : '10%';
                let bottomMargin = hasRotatedXLabels ? '18%' : '16%';
                if (hasLegend && legendPosition === 'bottom') {
                  bottomMargin = hasRotatedXLabels ? '22%' : '20%';
                }
                let leftMargin = '10%';
                let rightMargin = '6%';
                if (hasLegend && legendPosition === 'left') {
                  leftMargin = '18%';
                }
                if (hasLegend && legendPosition === 'right') {
                  rightMargin = '15%';
                }

                return {
                  ...config.grid,
                  containLabel: true,
                  left: leftMargin,
                  bottom: bottomMargin,
                  right: rightMargin,
                  top: topMargin,
                };
              })(),
              xAxis: Array.isArray(config.xAxis)
                ? config.xAxis.map((axis) => ({
                    ...axis,
                    nameGap: axis.name ? 80 : 15,
                    nameTextStyle: {
                      fontSize: 14,
                      color: '#374151',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    },
                    axisLabel: {
                      ...axis.axisLabel,
                      interval: 0,
                      margin: 15, // Increased margin from axis line to labels
                      overflow: 'truncate',
                      width: axis.axisLabel?.rotate ? 100 : undefined,
                    },
                  }))
                : config.xAxis
                  ? {
                      ...config.xAxis,
                      nameGap: config.xAxis.name ? 80 : 15,
                      nameTextStyle: {
                        fontSize: 14,
                        color: '#374151',
                        fontFamily: 'Inter, system-ui, sans-serif',
                      },
                      axisLabel: {
                        ...config.xAxis.axisLabel,
                        interval: 0,
                        margin: 15, // Increased margin from axis line to labels
                        overflow: 'truncate',
                        width: config.xAxis.axisLabel?.rotate ? 100 : undefined,
                      },
                    }
                  : undefined,
              yAxis: Array.isArray(config.yAxis)
                ? config.yAxis.map((axis) => ({
                    ...axis,
                    nameGap: axis.name ? 100 : 15,
                    nameTextStyle: {
                      fontSize: 14,
                      color: '#374151',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    },
                    axisLabel: {
                      ...axis.axisLabel,
                      margin: 15, // Increased margin from axis line to labels
                    },
                  }))
                : config.yAxis
                  ? {
                      ...config.yAxis,
                      nameGap: config.yAxis.name ? 100 : 15,
                      nameTextStyle: {
                        fontSize: 14,
                        color: '#374151',
                        fontFamily: 'Inter, system-ui, sans-serif',
                      },
                      axisLabel: {
                        ...config.yAxis.axisLabel,
                        margin: 15, // Increased margin from axis line to labels
                      },
                    }
                  : undefined,
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
    return (
      <TableChart
        data={tableData}
        config={config}
        onSort={onTableSort}
        pagination={tablePagination}
      />
    );
  }

  // Render ECharts-based charts
  return <div ref={chartRef} className="w-full h-full" />;
}
