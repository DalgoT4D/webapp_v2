import { ChartTypes, type ChartType } from '@/types/charts';

/**
 * Merges columnFormatting and dateColumnFormatting from customizations into the
 * column_formatting shape expected by TableChart.
 *
 * columnFormatting holds number formatting per column; dateColumnFormatting holds
 * date formatting per column. Both are merged so TableChart receives them via a
 * single column_formatting prop.
 */
export function mergeTableColumnFormatting(
  customizations: Record<string, any> | undefined
): Record<string, Record<string, unknown>> {
  const columnFormatting = customizations?.columnFormatting || {};
  const dateColumnFormatting = customizations?.dateColumnFormatting || {};

  const dateEntries = Object.fromEntries(
    Object.entries(dateColumnFormatting).map(([col, format]) => [
      col,
      { dateFormat: (format as { dateFormat?: string })?.dateFormat || 'default' },
    ])
  );

  return { ...columnFormatting, ...dateEntries };
}

/**
 * Filters frontend-only formatting keys from customizations before sending to API.
 * Number and date formatting is applied on the frontend only and should not be persisted.
 *
 * - pie/number/map charts: exclude global numberFormat, decimalPlaces, dateFormat
 * - line/bar charts: exclude axis-specific number and date formatting keys
 * - table charts: customizations are excluded entirely (handled by caller)
 */
export function getApiCustomizations(
  chartType: ChartType | undefined,
  customizations: Record<string, any> | undefined
): Record<string, any> | undefined {
  if (
    chartType === ChartTypes.NUMBER ||
    chartType === ChartTypes.PIE ||
    chartType === ChartTypes.MAP
  ) {
    return Object.fromEntries(
      Object.entries(customizations || {}).filter(
        ([key]) => key !== 'numberFormat' && key !== 'decimalPlaces' && key !== 'dateFormat'
      )
    );
  }

  if (chartType === ChartTypes.LINE || chartType === ChartTypes.BAR) {
    return Object.fromEntries(
      Object.entries(customizations || {}).filter(
        ([key]) =>
          key !== 'yAxisNumberFormat' &&
          key !== 'yAxisDecimalPlaces' &&
          key !== 'xAxisNumberFormat' &&
          key !== 'xAxisDecimalPlaces' &&
          key !== 'xAxisDateFormat'
      )
    );
  }

  return customizations;
}
