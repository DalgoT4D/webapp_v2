/**
 * Chart Formatting Utilities
 *
 * Reusable formatting functions for tooltips, axis labels, and dimensions
 * for all chart types (bar, line, pie, etc.).
 *
 * Used by ChartPreview, chart-element-view, and chart-element-v2 components.
 */

import { formatNumber, NumberFormats, type NumberFormat } from './formatters';

interface ChartCustomizations {
  numberFormat?: NumberFormat;
  decimalPlaces?: number;
  numberPrefix?: string;
  numberSuffix?: string;
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
        : customizations.numberFormat) as NumberFormat) || NumberFormats.DEFAULT;

    const decimalPlaces = isBarOrLineChart
      ? (customizations.yAxisDecimalPlaces ?? customizations.decimalPlaces)
      : customizations.decimalPlaces;

    if (numFormat === NumberFormats.DEFAULT) {
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
    if (!numFormat || numFormat === NumberFormats.DEFAULT) return val;

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
    const formatPieDimension = createPieDimensionFormatter(
      customizations.numberFormat as NumberFormat,
      customizations.decimalPlaces
    );

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
      if (p.percent !== undefined) {
        // Pie chart with percentage - format dimension name if numeric
        const dimensionName = formatPieDimension(p.name);
        return `${p.marker}${p.seriesName}<br/><b>${value}</b>: ${dimensionName} (${p.percent}%)`;
      } else {
        // Regular chart
        const xValue = formatXValue(p.name);
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

  if (!yAxisNumberFormat || yAxisNumberFormat === NumberFormats.DEFAULT) {
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

  if (!xAxisNumberFormat || xAxisNumberFormat === NumberFormats.DEFAULT) {
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
 * Creates a formatter for pie chart dimensions that handles:
 * - Pure number types (number or bigint)
 * - Strings with " - " separator (dimension - extra_dimension)
 * - Numeric strings
 *
 * @param numberFormat - The number format to apply
 * @param decimalPlaces - The decimal places for formatting
 * @returns A function that formats dimension values
 */
export function createPieDimensionFormatter(
  numberFormat: NumberFormat | undefined,
  decimalPlaces: number | undefined
): (val: any) => string {
  const numFormat = numberFormat || NumberFormats.DEFAULT;

  // Helper to format a single numeric string
  const formatNumericString = (val: string): string => {
    const trimmed = val.trim();
    // Only format if a specific number format is set (not 'default')
    if (numFormat !== NumberFormats.DEFAULT && /^-?\d+(\.\d+)?$/.test(trimmed)) {
      const numVal = Number(trimmed);
      if (!isNaN(numVal)) {
        return formatNumber(numVal, { format: numFormat, decimalPlaces });
      }
    }
    // Return raw value for 'default' format or non-numeric strings
    return trimmed;
  };

  return (val: any): string => {
    // Handle pure number type
    if (typeof val === 'number' || typeof val === 'bigint') {
      const numVal = Number(val);
      // Return raw value for 'default' format, otherwise apply number formatting
      return numFormat !== NumberFormats.DEFAULT
        ? formatNumber(numVal, { format: numFormat, decimalPlaces })
        : String(numVal);
    }

    const strVal = String(val);
    // Check if it contains " - " separator (dimension - extra_dimension)
    if (strVal.includes(' - ')) {
      const parts = strVal.split(' - ');
      const formattedParts = parts.map((part) => formatNumericString(part));
      return formattedParts.join(' - ');
    }
    // Single value - format if numeric string
    return formatNumericString(strVal);
  };
}

/**
 * Applies number chart (gauge) formatting to the ECharts config in place.
 * Injects a detail.formatter into each series using number format, decimal
 * places, prefix, and suffix from customizations.
 *
 * @param config - The ECharts config object to mutate
 * @param customizations - Chart customization settings
 */
export function applyNumberChartFormatting(
  config: Record<string, unknown>,
  customizations: ChartCustomizations
): void {
  if (!config.series) return;
  const numFormat = customizations.numberFormat || NumberFormats.DEFAULT;
  const prefix = customizations.numberPrefix || '';
  const suffix = customizations.numberSuffix || '';
  const formatter = (value: number) => {
    const formatted = formatNumber(value, {
      format: numFormat,
      decimalPlaces: customizations.decimalPlaces,
    });
    return `${prefix}${formatted}${suffix}`;
  };
  const seriesArray = Array.isArray(config.series) ? config.series : [config.series];
  config.series = seriesArray.map((series: Record<string, unknown>) => ({
    ...series,
    detail: { ...(series.detail as Record<string, unknown>), formatter },
  }));
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
        : customizations.numberFormat) as NumberFormat) || NumberFormats.DEFAULT;

    const decimalPlaces = isBarOrLineChart
      ? (customizations.yAxisDecimalPlaces ?? customizations.decimalPlaces)
      : customizations.decimalPlaces;

    if (numFormat === NumberFormats.DEFAULT) {
      return value.toLocaleString();
    }
    return formatNumber(value, {
      format: numFormat,
      decimalPlaces: decimalPlaces,
    });
  };
}
