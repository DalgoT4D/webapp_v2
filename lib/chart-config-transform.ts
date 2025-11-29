/**
 * Chart configuration transformation utilities
 *
 * Extracts and organizes ECharts config transformation logic
 * for standard charts (bar, line, pie, number, gauge)
 */

/**
 * Detects the chart type from config if not explicitly provided
 */
export function detectChartType(
  config: Record<string, any>,
  explicitChartType?: string
): string | undefined {
  if (explicitChartType) return explicitChartType;

  if (config?.series) {
    const firstSeries = Array.isArray(config.series) ? config.series[0] : config.series;
    if (firstSeries?.type) {
      return firstSeries.type;
    }
  }
  return undefined;
}

/**
 * Checks if the chart type is a pie chart
 */
export function isPieChartType(chartType?: string): boolean {
  return chartType === 'pie';
}

/**
 * Checks if the chart type is a number/gauge chart (no axes needed)
 */
export function isNumberChartType(chartType?: string): boolean {
  return chartType === 'number' || chartType === 'gauge';
}

/**
 * Checks if chart type requires axes (not pie, number, or gauge)
 */
export function requiresAxes(chartType?: string): boolean {
  return !isPieChartType(chartType) && !isNumberChartType(chartType);
}

/**
 * Transform legend configuration
 * Positions legend outside chart area at top center
 */
export function transformLegend(legend?: Record<string, any>): Record<string, any> | undefined {
  if (!legend) return undefined;

  return {
    ...legend,
    top: '5%',
    left: 'center',
    orient: legend.orient || 'horizontal',
  };
}

/**
 * Transform series configuration
 * Enhances label styling for better readability
 */
export function transformSeries(series?: any): any {
  if (!series) return undefined;

  const enhanceSeriesLabel = (s: Record<string, any>) => ({
    ...s,
    label: {
      ...s.label,
      fontSize: s.label?.fontSize ? s.label.fontSize + 0.5 : 12.5,
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: 'normal',
    },
  });

  if (Array.isArray(series)) {
    return series.map(enhanceSeriesLabel);
  }

  return enhanceSeriesLabel(series);
}

/**
 * Transform tooltip configuration
 * Adds styling and enhanced formatter with bold values
 */
export function transformTooltip(tooltip?: Record<string, any>): Record<string, any> {
  return {
    ...tooltip,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    textStyle: {
      color: '#1f2937',
      fontSize: 12,
    },
    extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);',
    formatter: createTooltipFormatter(),
  };
}

/**
 * Creates the tooltip formatter function
 * Handles both single and multiple series formats
 */
function createTooltipFormatter() {
  return function (params: any) {
    if (Array.isArray(params)) {
      // For multiple series (line/bar charts with multiple lines/bars)
      let result = '';
      params.forEach((param: any, index: number) => {
        if (index === 0) {
          result += param.name + '<br/>';
        }
        const value = typeof param.value === 'number' ? param.value.toLocaleString() : param.value;
        result += `${param.marker}${param.seriesName}: <b>${value}</b><br/>`;
      });
      return result;
    } else {
      // For single series (pie charts, single bar/line)
      const value = typeof params.value === 'number' ? params.value.toLocaleString() : params.value;
      if (params.percent !== undefined) {
        // Pie chart with percentage
        return `${params.marker}${params.seriesName}<br/><b>${value}</b>: ${params.name} (${params.percent}%)`;
      } else {
        // Regular chart
        return `${params.marker}${params.seriesName}<br/>${params.name}: <b>${value}</b>`;
      }
    }
  };
}

/**
 * Calculate grid margins based on config
 * Adjusts margins for rotated labels and legend presence
 */
export function transformGrid(config: Record<string, any>): Record<string, any> {
  const hasRotatedXLabels =
    config.xAxis?.axisLabel?.rotate !== undefined && config.xAxis?.axisLabel?.rotate !== 0;

  // Horizontal labels (0 degrees) need adequate space to be visible
  // Rotated labels need more space due to angle
  const bottomMargin = hasRotatedXLabels ? '18%' : '16%';
  const hasLegend = config.legend?.show !== false;
  const topMargin = hasLegend ? '18%' : '10%';

  return {
    ...config.grid,
    containLabel: true,
    left: '10%',
    bottom: bottomMargin,
    right: '6%',
    top: topMargin,
  };
}

/**
 * Transform X-axis configuration
 * Adds consistent styling and spacing for axis titles and labels
 */
export function transformXAxis(xAxis?: any): any {
  if (!xAxis) return undefined;

  const transformSingleAxis = (axis: Record<string, any>) => ({
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
      margin: 15,
      overflow: 'truncate',
      width: axis.axisLabel?.rotate ? 100 : undefined,
    },
  });

  if (Array.isArray(xAxis)) {
    return xAxis.map(transformSingleAxis);
  }

  return transformSingleAxis(xAxis);
}

/**
 * Transform Y-axis configuration
 * Adds consistent styling and spacing for axis titles and labels
 */
export function transformYAxis(yAxis?: any): any {
  if (!yAxis) return undefined;

  const transformSingleAxis = (axis: Record<string, any>) => ({
    ...axis,
    nameGap: axis.name ? 100 : 15,
    nameTextStyle: {
      fontSize: 14,
      color: '#374151',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    axisLabel: {
      ...axis.axisLabel,
      margin: 15,
    },
  });

  if (Array.isArray(yAxis)) {
    return yAxis.map(transformSingleAxis);
  }

  return transformSingleAxis(yAxis);
}

/**
 * Main transformation function for standard chart configs
 *
 * Handles:
 * - Legend positioning
 * - Series label styling
 * - Tooltip formatting
 * - Grid margins based on axis configuration
 * - Axis styling and spacing
 * - Removing axes for pie/number charts
 *
 * @param config - Raw ECharts configuration
 * @param chartType - Optional explicit chart type
 * @returns Transformed ECharts configuration
 */
export function transformStandardChartConfig(
  config: Record<string, any>,
  chartType?: string
): Record<string, any> {
  const detectedType = detectChartType(config, chartType);
  const isPie = isPieChartType(detectedType);
  const isNumber = isNumberChartType(detectedType);
  const noAxesNeeded = isPie || isNumber;

  const modifiedConfig: Record<string, any> = {
    ...config,
    legend: transformLegend(config.legend),
    series: transformSeries(config.series),
    tooltip: transformTooltip(config.tooltip),
  };

  if (noAxesNeeded) {
    // For pie and number charts, completely remove grid and axis configurations
    modifiedConfig.grid = undefined;
    modifiedConfig.xAxis = undefined;
    modifiedConfig.yAxis = undefined;
  } else {
    // For axis-based charts, apply grid and axis transformations
    modifiedConfig.grid = transformGrid(config);
    modifiedConfig.xAxis = transformXAxis(config.xAxis);
    modifiedConfig.yAxis = transformYAxis(config.yAxis);
  }

  return modifiedConfig;
}
