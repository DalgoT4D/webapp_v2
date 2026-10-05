/**
 * Chart Date Formatting Utilities
 *
 * Date-specific formatting for pie chart dimensions and line/bar X-axis labels.
 * Split out of formatting.ts — see that file for the shared number formatting.
 */

import { formatDate, type DateFormat, type NumberFormat } from '@/lib/formatters';
import { createPieDimensionFormatter, type ChartCustomizations } from './formatting';

/**
 * Creates a formatter for pie chart date dimensions that handles:
 * - Pure date strings (formats using dateFormat)
 * - Strings with " - " separator (dimension - extra_dimension)
 * - Non-date strings (returned unchanged, since formatDate returns original for invalid dates)
 *
 * Mirrors createPieDimensionFormatter for number formatting.
 *
 * @param dateFormat - The date format to apply
 * @returns A function that formats dimension values
 */
export function createPieDateFormatter(dateFormat: DateFormat): (val: unknown) => string {
  return (val: unknown): string => {
    const strVal = String(val);
    // Handle " - " separator (dimension - extra_dimension)
    if (strVal.includes(' - ')) {
      const parts = strVal.split(' - ');
      return parts.map((part) => formatDate(part.trim(), { format: dateFormat })).join(' - ');
    }
    return formatDate(strVal, { format: dateFormat });
  };
}

/**
 * Applies pie chart date formatting to the ECharts config in place.
 * Formats dimension names (series.data names, label names, legend) using dateFormat.
 * Call this after applyPieChartFormatting so date formatting takes priority for names.
 * Handles combined dimension names like "2019-01-14 - Electronics" by splitting on " - "
 * and formatting each part individually (non-date parts pass through unchanged).
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
  const formatDate_ = createPieDateFormatter(dateFormat);
  const seriesArray = Array.isArray(config.series) ? config.series : [config.series];

  // Override label formatter and format series.data names in a single pass
  config.series = seriesArray.map((series: Record<string, unknown>) => ({
    ...series,
    label: {
      ...(series.label as Record<string, unknown>),
      formatter: (params: Record<string, unknown>) => {
        const formattedValue = formatIfNumber(params.value);
        const formattedName = formatDate_(params.name);
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
    ...(series.type === 'pie' &&
      Array.isArray(series.data) && {
        data: (series.data as Record<string, unknown>[]).map((item) => ({
          ...item,
          name: formatDate_(item.name),
        })),
      }),
  }));

  // Update legend.data and add legend formatter for date values
  if (config.legend) {
    const legend = config.legend as Record<string, unknown>;
    config.legend = {
      ...legend,
      ...(Array.isArray(legend.data) && {
        data: (legend.data as unknown[]).map((item) => formatDate_(item)),
      }),
      formatter: (name: string) => formatDate_(name),
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
