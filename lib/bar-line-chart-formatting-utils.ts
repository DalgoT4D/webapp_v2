/**
 * Bar & Line Chart Formatting Utilities
 *
 * Reusable formatting functions for tooltips and axis labels
 * specifically for bar and line charts that have X/Y axes.
 *
 * Used by ChartPreview, chart-element-view, and chart-element-v2 components.
 */

import { formatNumber, type NumberFormat } from './formatters';

interface ChartCustomizations {
  numberFormat?: NumberFormat;
  decimalPlaces?: number;
  yAxisNumberFormat?: NumberFormat;
  yAxisDecimalPlaces?: number;
  xAxisNumberFormat?: NumberFormat;
  xAxisDecimalPlaces?: number;
  [key: string]: unknown;
}

/**
 * Formats an axis value (X or Y) based on customizations.
 * For bar/line charts: uses axis-specific settings (yAxisNumberFormat, xAxisNumberFormat)
 * For other charts: uses global numberFormat
 *
 * @param val - The value to format
 * @param customizations - Chart customization settings
 * @param axis - Which axis ('x' or 'y')
 * @param chartType - The type of chart ('bar', 'line', or other)
 * @returns Formatted value as string or original value
 */
export function formatAxisValue(
  val: unknown,
  customizations: ChartCustomizations,
  axis: 'x' | 'y',
  chartType: string
): string | number | unknown {
  const isBarOrLineChart = chartType === 'bar' || chartType === 'line';

  if (axis === 'y') {
    // Y-axis formatting: always attempt to format
    const numVal = typeof val === 'number' ? val : parseFloat(String(val));
    if (isNaN(numVal)) return val;

    const numFormat =
      ((isBarOrLineChart
        ? customizations.yAxisNumberFormat || customizations.numberFormat
        : customizations.numberFormat) as NumberFormat) || 'default';

    const decimalPlaces = isBarOrLineChart
      ? (customizations.yAxisDecimalPlaces ?? customizations.decimalPlaces)
      : customizations.decimalPlaces;

    if (numFormat === 'default') {
      return numVal.toLocaleString();
    }
    return formatNumber(numVal, {
      format: numFormat,
      decimalPlaces: decimalPlaces,
    });
  } else {
    // X-axis formatting: only format for bar/line charts when explicitly configured
    if (!isBarOrLineChart) return val;

    const numFormat = customizations.xAxisNumberFormat as NumberFormat;
    // Only format if xAxisNumberFormat is explicitly set (means X-axis is numeric)
    if (!numFormat || numFormat === 'default') return val;

    // xAxisNumberFormat is set, so X-axis is numeric - safe to parseFloat
    const numVal = typeof val === 'number' ? val : parseFloat(String(val));
    if (isNaN(numVal)) return val;

    const decimalPlaces = customizations.xAxisDecimalPlaces;
    return formatNumber(numVal, {
      format: numFormat,
      decimalPlaces: decimalPlaces,
    });
  }
}

/**
 * Creates a tooltip formatter function for ECharts bar/line charts.
 *
 * @param customizations - Chart customization settings
 * @param chartType - The type of chart ('bar', 'line', or other)
 * @returns ECharts tooltip formatter function
 */
export function createTooltipFormatter(
  customizations: ChartCustomizations,
  chartType: string
): (params: unknown) => string {
  return function (params: unknown): string {
    const formatYValue = (val: unknown) => formatAxisValue(val, customizations, 'y', chartType);
    const formatXValue = (val: unknown) => formatAxisValue(val, customizations, 'x', chartType);

    if (Array.isArray(params)) {
      // For multiple series (line/bar charts with multiple lines/bars)
      let result = '';
      params.forEach((param: any, index: number) => {
        if (index === 0) {
          result += formatXValue(param.name) + '<br/>';
        }
        const value = formatYValue(param.value);
        result += `${param.marker}${param.seriesName}: <b>${value}</b><br/>`;
      });
      return result;
    } else {
      // For single series (pie charts, single bar/line)
      const p = params as any;
      const value = formatYValue(p.value);
      const xValue = formatXValue(p.name);
      if (p.percent !== undefined) {
        // Pie chart with percentage
        return `${p.marker}${p.seriesName}<br/><b>${value}</b>: ${xValue} (${p.percent}%)`;
      } else {
        // Regular chart
        return `${p.marker}${p.seriesName}<br/>${xValue}: <b>${value}</b>`;
      }
    }
  };
}

/**
 * Creates a Y-axis label formatter function for ECharts.
 *
 * @param customizations - Chart customization settings
 * @returns ECharts axis label formatter function or undefined if no formatting needed
 */
export function createYAxisLabelFormatter(
  customizations: ChartCustomizations
): ((value: number) => string | number) | undefined {
  const yAxisNumberFormat = customizations.yAxisNumberFormat as NumberFormat;
  const yAxisDecimalPlaces = customizations.yAxisDecimalPlaces;

  if (!yAxisNumberFormat || yAxisNumberFormat === 'default') {
    return undefined;
  }

  return (value: number) => {
    if (typeof value !== 'number' || isNaN(value)) return value;
    return formatNumber(value, {
      format: yAxisNumberFormat,
      decimalPlaces: yAxisDecimalPlaces,
    });
  };
}

/**
 * Creates an X-axis label formatter function for ECharts.
 *
 * @param customizations - Chart customization settings
 * @returns ECharts axis label formatter function or undefined if no formatting needed
 */
export function createXAxisLabelFormatter(
  customizations: ChartCustomizations
): ((value: unknown) => string | number | unknown) | undefined {
  const xAxisNumberFormat = customizations.xAxisNumberFormat as NumberFormat;
  const xAxisDecimalPlaces = customizations.xAxisDecimalPlaces;

  if (!xAxisNumberFormat || xAxisNumberFormat === 'default') {
    return undefined;
  }

  return (value: unknown) => {
    const numVal = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(numVal)) return value;
    return formatNumber(numVal, {
      format: xAxisNumberFormat,
      decimalPlaces: xAxisDecimalPlaces,
    });
  };
}

/**
 * Creates a data label formatter function for ECharts series.
 *
 * @param customizations - Chart customization settings
 * @param chartType - The type of chart ('bar', 'line', or other)
 * @returns ECharts label formatter function
 */
export function createDataLabelFormatter(
  customizations: ChartCustomizations,
  chartType: string
): (params: any) => string | number {
  const isBarOrLineChart = chartType === 'bar' || chartType === 'line';

  return (params: any) => {
    const value = params.value;
    if (typeof value !== 'number' || isNaN(value)) return value;

    const numFormat =
      ((isBarOrLineChart
        ? customizations.yAxisNumberFormat || customizations.numberFormat
        : customizations.numberFormat) as NumberFormat) || 'default';

    const decimalPlaces = isBarOrLineChart
      ? (customizations.yAxisDecimalPlaces ?? customizations.decimalPlaces)
      : customizations.decimalPlaces;

    if (numFormat === 'default') {
      return value.toLocaleString();
    }
    return formatNumber(value, {
      format: numFormat,
      decimalPlaces: decimalPlaces,
    });
  };
}
