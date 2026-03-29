/**
 * Chart Formatting Utilities
 *
 * Reusable formatting functions for tooltips, axis labels, and dimensions
 * for all chart types (bar, line, pie, etc.).
 *
 * Used by ChartPreview, chart-element-view, and chart-element-v2 components.
 */

import {
  formatNumber,
  formatDate,
  NumberFormats,
  type NumberFormat,
  type DateFormat,
} from './formatters';

interface ChartCustomizations {
  numberFormat?: NumberFormat;
  decimalPlaces?: number;
  numberPrefix?: string;
  numberSuffix?: string;
  yAxisNumberFormat?: NumberFormat;
  yAxisDecimalPlaces?: number;
  xAxisNumberFormat?: NumberFormat;
  xAxisDecimalPlaces?: number;
  dateFormat?: DateFormat;
  xAxisDateFormat?: DateFormat;
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
    // Use Number() instead of parseFloat() - Number("2019-01-14") returns NaN, parseFloat returns 2019
    const numVal = typeof val === 'number' ? val : Number(val);
    if (isNaN(numVal)) return val;

    const numFormat =
      ((isBarOrLineChart
        ? customizations.yAxisNumberFormat || customizations.numberFormat
        : customizations.numberFormat) as NumberFormat) || NumberFormats.DEFAULT;

    const decimalPlaces = isBarOrLineChart
      ? (customizations.yAxisDecimalPlaces ?? customizations.decimalPlaces)
      : customizations.decimalPlaces;

    if (numFormat === NumberFormats.DEFAULT) {
      return decimalPlaces !== undefined ? numVal.toFixed(decimalPlaces) : numVal.toLocaleString();
    }
    return formatNumber(numVal, {
      format: numFormat,
      decimalPlaces: decimalPlaces,
    });
  } else {
    // X-axis formatting: only format for bar/line charts when explicitly configured
    if (!isBarOrLineChart) return val;

    const numFormat = customizations.xAxisNumberFormat as NumberFormat;
    const decimalPlaces = customizations.xAxisDecimalPlaces;

    // Only format if xAxisNumberFormat is explicitly set OR decimal places are specified
    if ((!numFormat || numFormat === NumberFormats.DEFAULT) && decimalPlaces === undefined)
      return val;

    // Use Number() instead of parseFloat() - Number("2019-01-14") returns NaN, parseFloat returns 2019
    const numVal = typeof val === 'number' ? val : Number(val);
    if (isNaN(numVal)) return val;

    if (!numFormat || numFormat === NumberFormats.DEFAULT) {
      return numVal.toFixed(decimalPlaces);
    }
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
 * Applies pie chart formatting to the ECharts config in place.
 * Injects label formatter (with labelFormat switch), formats series.data names,
 * and updates legend.data to match formatted names.
 *
 * @param config - The ECharts config object to mutate
 * @param customizations - Chart customization settings
 */
export function applyPieChartFormatting(
  config: Record<string, unknown>,
  customizations: ChartCustomizations
): void {
  if (!config.series) return;
  const numberFormat = customizations.numberFormat || NumberFormats.DEFAULT;
  const decimalPlaces = customizations.decimalPlaces;
  const labelFormat = customizations.labelFormat || 'percentage';
  const showDataLabels = customizations.showDataLabels !== false;
  const dataLabelPosition = customizations.dataLabelPosition || 'outside';
  const formatIfNumber = createPieDimensionFormatter(numberFormat, decimalPlaces);
  const seriesArray = Array.isArray(config.series) ? config.series : [config.series];

  // Inject label formatter
  config.series = seriesArray.map((series: Record<string, unknown>) => ({
    ...series,
    label: {
      ...(series.label as Record<string, unknown>),
      show: showDataLabels,
      position: dataLabelPosition === 'inside' ? 'inside' : 'outside',
      formatter: (params: Record<string, unknown>) => {
        const formattedValue = formatIfNumber(params.value);
        const formattedName = formatIfNumber(params.name);
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

  // Format numeric dimension values in series.data
  config.series = (Array.isArray(config.series) ? config.series : [config.series]).map(
    (series: Record<string, unknown>) => {
      if (series.type === 'pie' && Array.isArray(series.data)) {
        return {
          ...series,
          data: (series.data as Record<string, unknown>[]).map((item) => ({
            ...item,
            name: formatIfNumber(item.name),
          })),
        };
      }
      return series;
    }
  );

  // Update legend.data to match the formatted names
  if (config.legend && Array.isArray((config.legend as Record<string, unknown>).data)) {
    config.legend = {
      ...(config.legend as Record<string, unknown>),
      data: ((config.legend as Record<string, unknown>).data as unknown[]).map((item) =>
        formatIfNumber(item)
      ),
    };
  }
}

/**
 * Applies line/bar chart axis and data label formatting to the ECharts config in place.
 * Injects formatters for Y-axis labels, X-axis labels, and series data labels
 * based on customizations.
 *
 * @param config - The ECharts config object to mutate
 * @param customizations - Chart customization settings
 */
export function applyLineBarChartFormatting(
  config: Record<string, unknown>,
  customizations: ChartCustomizations
): void {
  const yAxisNumberFormat = customizations.yAxisNumberFormat;
  const yAxisDecimalPlaces = customizations.yAxisDecimalPlaces;
  const xAxisNumberFormat = customizations.xAxisNumberFormat;
  const xAxisDecimalPlaces = customizations.xAxisDecimalPlaces;

  const hasYAxisFormatting =
    (yAxisNumberFormat && yAxisNumberFormat !== NumberFormats.DEFAULT) ||
    yAxisDecimalPlaces !== undefined;
  const hasXAxisFormatting =
    (xAxisNumberFormat && xAxisNumberFormat !== NumberFormats.DEFAULT) ||
    xAxisDecimalPlaces !== undefined;

  // Format Y-axis labels
  if (config.yAxis && hasYAxisFormatting) {
    const formatYAxisLabel = (value: number) => {
      if (typeof value !== 'number' || isNaN(value)) return value;
      if (yAxisNumberFormat && yAxisNumberFormat !== NumberFormats.DEFAULT) {
        return formatNumber(value, {
          format: yAxisNumberFormat,
          decimalPlaces: yAxisDecimalPlaces,
        });
      }
      return value.toFixed(yAxisDecimalPlaces);
    };

    if (Array.isArray(config.yAxis)) {
      config.yAxis = (config.yAxis as Record<string, unknown>[]).map((axis) => ({
        ...axis,
        axisLabel: { ...(axis.axisLabel as Record<string, unknown>), formatter: formatYAxisLabel },
      }));
    } else {
      config.yAxis = {
        ...(config.yAxis as Record<string, unknown>),
        axisLabel: {
          ...((config.yAxis as Record<string, unknown>).axisLabel as Record<string, unknown>),
          formatter: formatYAxisLabel,
        },
      };
    }
  }

  // Format X-axis labels
  if (config.xAxis && hasXAxisFormatting) {
    const formatXAxisLabel = (value: unknown) => {
      const numVal = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(numVal)) return value;
      if (xAxisNumberFormat && xAxisNumberFormat !== NumberFormats.DEFAULT) {
        return formatNumber(numVal, {
          format: xAxisNumberFormat,
          decimalPlaces: xAxisDecimalPlaces,
        });
      }
      return numVal.toFixed(xAxisDecimalPlaces);
    };

    if (Array.isArray(config.xAxis)) {
      config.xAxis = (config.xAxis as Record<string, unknown>[]).map((axis) => ({
        ...axis,
        axisLabel: { ...(axis.axisLabel as Record<string, unknown>), formatter: formatXAxisLabel },
      }));
    } else {
      config.xAxis = {
        ...(config.xAxis as Record<string, unknown>),
        axisLabel: {
          ...((config.xAxis as Record<string, unknown>).axisLabel as Record<string, unknown>),
          formatter: formatXAxisLabel,
        },
      };
    }
  }

  // Format data labels on chart points/bars (uses Y-axis format since data labels show Y values)
  if (config.series && customizations.showDataLabels && hasYAxisFormatting) {
    const seriesArray = Array.isArray(config.series) ? config.series : [config.series];
    config.series = (seriesArray as Record<string, unknown>[]).map((series) => ({
      ...series,
      label: {
        ...(series.label as Record<string, unknown>),
        formatter: (params: Record<string, unknown>) => {
          const value = params.value;
          if (typeof value !== 'number' || isNaN(value)) return value;
          if (yAxisNumberFormat && yAxisNumberFormat !== NumberFormats.DEFAULT) {
            return formatNumber(value, {
              format: yAxisNumberFormat,
              decimalPlaces: yAxisDecimalPlaces,
            });
          }
          return value.toFixed(yAxisDecimalPlaces);
        },
      },
    }));
  }
}

/**
 * Applies pie chart date formatting to the ECharts config in place.
 * Formats dimension names (series.data names, label names, legend) using dateFormat.
 * Call this after applyPieChartFormatting so date formatting takes priority for names.
 *
 * @param config - The ECharts config object to mutate
 * @param customizations - Chart customization settings
 */
export function applyPieDateFormatting(
  config: Record<string, unknown>,
  customizations: ChartCustomizations
): void {
  if (!config.series) return;
  const dateFormat = customizations.dateFormat as DateFormat;
  if (!dateFormat || dateFormat === 'default') return;

  const labelFormat = customizations.labelFormat || 'percentage';
  const numberFormat = customizations.numberFormat as NumberFormat;
  const decimalPlaces = customizations.decimalPlaces;
  const formatIfNumber = createPieDimensionFormatter(numberFormat, decimalPlaces);
  const seriesArray = Array.isArray(config.series) ? config.series : [config.series];

  // Override label formatter so dimension names use date formatting
  config.series = seriesArray.map((series: Record<string, unknown>) => ({
    ...series,
    label: {
      ...(series.label as Record<string, unknown>),
      formatter: (params: Record<string, unknown>) => {
        const formattedValue = formatIfNumber(params.value);
        const formattedName = formatDate(String(params.name), { format: dateFormat });
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

  // Format series.data names with date format
  config.series = (Array.isArray(config.series) ? config.series : [config.series]).map(
    (series: Record<string, unknown>) => {
      if (series.type === 'pie' && Array.isArray(series.data)) {
        return {
          ...series,
          data: (series.data as Record<string, unknown>[]).map((item) => ({
            ...item,
            name: formatDate(String(item.name), { format: dateFormat }),
          })),
        };
      }
      return series;
    }
  );

  // Update legend.data and add legend formatter for date values
  if (config.legend) {
    const legend = config.legend as Record<string, unknown>;
    config.legend = {
      ...legend,
      ...(Array.isArray(legend.data) && {
        data: (legend.data as unknown[]).map((item) =>
          formatDate(String(item), { format: dateFormat })
        ),
      }),
      formatter: (name: string) => formatDate(name, { format: dateFormat }),
    };
  }
}

/**
 * Applies date formatting to the X-axis labels for line/bar charts.
 * Call this after applyLineBarChartFormatting so date formatting overrides number formatting on X-axis.
 *
 * @param config - The ECharts config object to mutate
 * @param customizations - Chart customization settings
 */
export function applyLineBarDateFormatting(
  config: Record<string, unknown>,
  customizations: ChartCustomizations
): void {
  const xAxisDateFormat = customizations.xAxisDateFormat as DateFormat;
  if (!xAxisDateFormat || xAxisDateFormat === 'default') return;
  if (!config.xAxis) return;

  const formatter = (value: unknown) => formatDate(String(value), { format: xAxisDateFormat });

  if (Array.isArray(config.xAxis)) {
    config.xAxis = (config.xAxis as Record<string, unknown>[]).map((axis) => ({
      ...axis,
      axisLabel: { ...(axis.axisLabel as Record<string, unknown>), formatter },
    }));
  } else {
    config.xAxis = {
      ...(config.xAxis as Record<string, unknown>),
      axisLabel: {
        ...((config.xAxis as Record<string, unknown>).axisLabel as Record<string, unknown>),
        formatter,
      },
    };
  }
}
