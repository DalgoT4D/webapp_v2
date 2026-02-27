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
import { formatNumber, formatDate, type NumberFormat, type DateFormat } from '@/lib/formatters';

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
      // Use configWithLegend as the canonical config (preserves legend positioning and pie center/radius)
      const modifiedConfig = {
        ...configWithLegend,
        // Enhanced data labels styling - derive from configWithLegend.series to preserve pie adjustments
        series: Array.isArray(configWithLegend.series)
          ? configWithLegend.series.map((series: any) => ({
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
          ...configWithLegend.tooltip,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          textStyle: {
            color: '#1f2937',
            fontSize: 12,
          },
          extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);',
          formatter: function (params: any) {
            // Helper to format values based on customizations
            const formatValue = (val: any) => {
              // Try to parse string values to numbers (like TableChart does)
              const numVal = typeof val === 'number' ? val : parseFloat(val);
              if (isNaN(numVal)) return val; // Return original if not a valid number

              const numFormat = (customizations.numberFormat || 'default') as NumberFormat;
              if (numFormat === 'default') {
                return numVal.toLocaleString();
              }
              return formatNumber(numVal, {
                format: numFormat,
                decimalPlaces: customizations.decimalPlaces,
              });
            };

            // Helper to format name (dimension) with date formatting for pie charts
            const formatName = (name: any) => {
              const dateFormat = customizations.dateFormat as DateFormat;
              if (isPieChart && dateFormat && dateFormat !== 'default') {
                return formatDate(name, { format: dateFormat });
              }
              return name;
            };

            if (Array.isArray(params)) {
              // For multiple series (line/bar charts with multiple lines/bars)
              let result = '';
              params.forEach((param: any, index: number) => {
                if (index === 0) {
                  result += formatName(param.name) + '<br/>';
                }
                const value = formatValue(param.value);
                result += `${param.marker}${param.seriesName}: <b>${value}</b><br/>`;
              });
              return result;
            } else {
              // For single series (pie charts, single bar/line)
              const value = formatValue(params.value);
              const name = formatName(params.name);
              if (params.percent !== undefined) {
                // Pie chart with percentage
                return `${params.marker}${params.seriesName}<br/><b>${value}</b>: ${name} (${params.percent}%)`;
              } else {
                // Regular chart
                return `${params.marker}${params.seriesName}<br/>${name}: <b>${value}</b>`;
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
                  configWithLegend.xAxis?.axisLabel?.rotate !== undefined &&
                  configWithLegend.xAxis?.axisLabel?.rotate !== 0;
                // Tighten hasLegend check: legend must be a real object and not explicitly hidden
                const hasLegend =
                  Boolean(configWithLegend.legend) && configWithLegend.legend?.show !== false;

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
                  ...configWithLegend.grid,
                  containLabel: true,
                  left: leftMargin,
                  bottom: bottomMargin,
                  right: rightMargin,
                  top: topMargin,
                };
              })(),
              xAxis: Array.isArray(configWithLegend.xAxis)
                ? configWithLegend.xAxis.map((axis: any) => ({
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
                : configWithLegend.xAxis
                  ? {
                      ...configWithLegend.xAxis,
                      nameGap: configWithLegend.xAxis.name ? 80 : 15,
                      nameTextStyle: {
                        fontSize: 14,
                        color: '#374151',
                        fontFamily: 'Inter, system-ui, sans-serif',
                      },
                      axisLabel: {
                        ...configWithLegend.xAxis.axisLabel,
                        interval: 0,
                        margin: 15, // Increased margin from axis line to labels
                        overflow: 'truncate',
                        width: configWithLegend.xAxis.axisLabel?.rotate ? 100 : undefined,
                      },
                    }
                  : undefined,
              yAxis: Array.isArray(configWithLegend.yAxis)
                ? configWithLegend.yAxis.map((axis: any) => ({
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
                : configWithLegend.yAxis
                  ? {
                      ...configWithLegend.yAxis,
                      nameGap: configWithLegend.yAxis.name ? 100 : 15,
                      nameTextStyle: {
                        fontSize: 14,
                        color: '#374151',
                        fontFamily: 'Inter, system-ui, sans-serif',
                      },
                      axisLabel: {
                        ...configWithLegend.yAxis.axisLabel,
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

      // Apply number formatting for number charts (frontend-only formatting)
      if (isNumberChart && modifiedConfig.series) {
        const numberFormat = (customizations.numberFormat || 'default') as NumberFormat;
        const decimalPlaces = customizations.decimalPlaces;

        const seriesArray = Array.isArray(modifiedConfig.series)
          ? modifiedConfig.series
          : [modifiedConfig.series];

        modifiedConfig.series = seriesArray.map((series: any) => ({
          ...series,
          detail: {
            ...series.detail,
            formatter: (value: number) => {
              // Pass both format and decimalPlaces to the formatter
              const formatted = formatNumber(value, {
                format: numberFormat,
                decimalPlaces: decimalPlaces,
              });
              // Apply prefix and suffix from customizations
              const prefix = customizations.numberPrefix || '';
              const suffix = customizations.numberSuffix || '';
              return `${prefix}${formatted}${suffix}`;
            },
          },
        }));
      }

      // Apply number formatting and visibility settings for pie chart data labels
      if (isPieChart && modifiedConfig.series) {
        const numberFormat = (customizations.numberFormat || 'default') as NumberFormat;
        const decimalPlaces = customizations.decimalPlaces;
        const dateFormat = customizations.dateFormat as DateFormat;
        const labelFormat = customizations.labelFormat || 'percentage';
        const showDataLabels = customizations.showDataLabels !== false; // Default to true
        const dataLabelPosition = customizations.dataLabelPosition || 'outside';
        const seriesArray = Array.isArray(modifiedConfig.series)
          ? modifiedConfig.series
          : [modifiedConfig.series];

        modifiedConfig.series = seriesArray.map((series: any) => ({
          ...series,
          label: {
            ...series.label,
            show: showDataLabels,
            position: dataLabelPosition === 'inside' ? 'inside' : 'outside',
            formatter: (params: any) => {
              // Only format if value is already a number type
              const formattedValue =
                typeof params.value === 'number'
                  ? numberFormat !== 'default'
                    ? formatNumber(params.value, { format: numberFormat, decimalPlaces })
                    : params.value.toLocaleString()
                  : params.value;

              // Format name (dimension value) with date formatting if configured
              const formattedName =
                dateFormat && dateFormat !== 'default'
                  ? formatDate(params.name, { format: dateFormat })
                  : params.name;

              switch (labelFormat) {
                case 'value':
                  return formattedValue;
                case 'name_percentage':
                  return `${formattedName}\n${params.percent}%`;
                case 'name_value':
                  return `${formattedName}\n${formattedValue}`;
                case 'percentage':
                default:
                  return `${params.percent}%`;
              }
            },
          },
        }));

        // Add legend formatter for pie charts to format date values in legend
        if (dateFormat && dateFormat !== 'default' && modifiedConfig.legend) {
          modifiedConfig.legend = {
            ...modifiedConfig.legend,
            formatter: (name: string) => formatDate(name, { format: dateFormat }),
          };
        }
      }

      // Apply number formatting for line/bar charts (separate X-axis and Y-axis formatting)
      const isLineChart = detectedChartType === 'line';
      const isBarChart = detectedChartType === 'bar';
      if (isLineChart || isBarChart) {
        const yAxisNumberFormat = customizations.yAxisNumberFormat as NumberFormat;
        const yAxisDecimalPlaces = customizations.yAxisDecimalPlaces;
        const xAxisNumberFormat = customizations.xAxisNumberFormat as NumberFormat;
        const xAxisDecimalPlaces = customizations.xAxisDecimalPlaces;

        // Format Y-axis labels
        if (modifiedConfig.yAxis && yAxisNumberFormat && yAxisNumberFormat !== 'default') {
          const formatYAxisLabel = (value: number) => {
            if (typeof value !== 'number' || isNaN(value)) return value;
            return formatNumber(value, {
              format: yAxisNumberFormat,
              decimalPlaces: yAxisDecimalPlaces,
            });
          };

          if (Array.isArray(modifiedConfig.yAxis)) {
            modifiedConfig.yAxis = modifiedConfig.yAxis.map((axis: any) => ({
              ...axis,
              axisLabel: {
                ...axis.axisLabel,
                formatter: formatYAxisLabel,
              },
            }));
          } else {
            modifiedConfig.yAxis = {
              ...modifiedConfig.yAxis,
              axisLabel: {
                ...modifiedConfig.yAxis.axisLabel,
                formatter: formatYAxisLabel,
              },
            };
          }
        }

        // Format X-axis labels (only if numeric values)
        if (modifiedConfig.xAxis && xAxisNumberFormat && xAxisNumberFormat !== 'default') {
          const formatXAxisLabel = (value: any) => {
            // Try to parse string values to numbers
            const numVal = typeof value === 'number' ? value : parseFloat(value);
            if (isNaN(numVal)) return value; // Return original if not a valid number
            return formatNumber(numVal, {
              format: xAxisNumberFormat,
              decimalPlaces: xAxisDecimalPlaces,
            });
          };

          if (Array.isArray(modifiedConfig.xAxis)) {
            modifiedConfig.xAxis = modifiedConfig.xAxis.map((axis: any) => ({
              ...axis,
              axisLabel: {
                ...axis.axisLabel,
                formatter: formatXAxisLabel,
              },
            }));
          } else {
            modifiedConfig.xAxis = {
              ...modifiedConfig.xAxis,
              axisLabel: {
                ...modifiedConfig.xAxis.axisLabel,
                formatter: formatXAxisLabel,
              },
            };
          }
        }

        // Format data labels on the chart points/bars (uses Y-axis format since data labels show Y values)
        if (
          modifiedConfig.series &&
          customizations.showDataLabels &&
          yAxisNumberFormat &&
          yAxisNumberFormat !== 'default'
        ) {
          const seriesArray = Array.isArray(modifiedConfig.series)
            ? modifiedConfig.series
            : [modifiedConfig.series];

          modifiedConfig.series = seriesArray.map((series: any) => ({
            ...series,
            label: {
              ...series.label,
              formatter: (params: any) => {
                const value = params.value;
                if (typeof value !== 'number' || isNaN(value)) return value;
                return formatNumber(value, {
                  format: yAxisNumberFormat,
                  decimalPlaces: yAxisDecimalPlaces,
                });
              },
            },
          }));
        }
      }

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
    // Merge customizations.columnFormatting and dateColumnFormatting into config.column_formatting for table charts
    const customizations = propCustomizations || config?.extra_config?.customizations || {};
    const hasColumnFormatting =
      customizations?.columnFormatting || customizations?.dateColumnFormatting;

    let tableConfig = config;
    if (hasColumnFormatting) {
      // Merge number formatting from columnFormatting
      const numberFormatting = customizations.columnFormatting || {};

      // Merge date formatting from dateColumnFormatting into column_formatting
      const dateFormatting: Record<string, { dateFormat: string }> = {};
      if (customizations.dateColumnFormatting) {
        Object.entries(customizations.dateColumnFormatting).forEach(([col, format]) => {
          dateFormatting[col] = {
            dateFormat: (format as { dateFormat?: string })?.dateFormat || 'default',
          };
        });
      }

      tableConfig = {
        ...config,
        column_formatting: {
          ...(config?.column_formatting || {}),
          ...numberFormatting,
          ...dateFormatting,
        },
      };
    }

    return (
      <TableChart
        data={tableData}
        config={tableConfig}
        onSort={onTableSort}
        pagination={tablePagination}
      />
    );
  }

  // Render ECharts-based charts
  return <div ref={chartRef} className="w-full h-full" />;
}
