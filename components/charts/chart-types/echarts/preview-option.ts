import {
  applyLegendPosition,
  extractLegendPosition,
  isLegendPaginated,
  type LegendPosition,
} from '@/components/charts/chart-types/echarts/legend';
import { applyStackedBarLabels } from '@/components/charts/chart-types/echarts/stacked-bar';
import {
  createTooltipFormatter,
  applyNumberChartFormatting,
  applyPieChartFormatting,
  applyLineBarChartFormatting,
} from '@/components/charts/chart-types/echarts/formatting';
import {
  applyPieDateFormatting,
  applyLineBarDateFormatting,
} from '@/components/charts/chart-types/echarts/date-formatting';
import { ChartTypes } from '@/types/charts';

export interface ChartPreviewOptionParams {
  chartType?: string;
  customizations?: Record<string, any>;
}

/**
 * Builds the final ECharts option ChartPreview passes to setOption: resolves the chart type
 * (chartType param, else series[0].type), applies legend positioning, label/tooltip/grid/axis
 * styling, and number/date/stacked-bar formatting. Pure apart from the pie/number debug log.
 */
export function buildChartPreviewOption(
  config: Record<string, any>,
  { chartType, customizations: propCustomizations }: ChartPreviewOptionParams
): Record<string, any> {
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

  const isPieChart = detectedChartType === ChartTypes.PIE;
  const isNumberChart = detectedChartType === ChartTypes.NUMBER || detectedChartType === 'gauge';

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
      formatter: createTooltipFormatter(customizations, detectedChartType || ''),
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
  if (isNumberChart) {
    applyNumberChartFormatting(modifiedConfig, customizations);
  }

  // Apply number formatting and visibility settings for pie chart data labels
  if (isPieChart) {
    applyPieChartFormatting(modifiedConfig, customizations);
    applyPieDateFormatting(modifiedConfig, customizations);
  }

  // Apply number formatting for line/bar charts (separate X-axis and Y-axis formatting)
  const isLineChart = detectedChartType === ChartTypes.LINE;
  const isBarChart = detectedChartType === ChartTypes.BAR;
  if (isLineChart || isBarChart) {
    applyLineBarChartFormatting(modifiedConfig, customizations);
    applyLineBarDateFormatting(modifiedConfig, customizations);
  }

  // Apply stacked bar data labels (shows total at top of each stacked bar)
  if (isBarChart) {
    const stackedConfig = applyStackedBarLabels(modifiedConfig, customizations);
    Object.assign(modifiedConfig, stackedConfig);
  }

  return modifiedConfig;
}
