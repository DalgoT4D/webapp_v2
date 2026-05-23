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

/**
 * Resolves the rendered column order for a table at a given drill-down level.
 *
 * In drill-down mode the table only shows one dimension at a time. The saved
 * columnOrder is authored against the first drill-down dimension; at deeper
 * levels we substitute that dim slot for the dim being displayed.
 *
 * Returns the rendered column list, or `cols` if no order is set or doesn't match
 * the visible columns.
 */
export function resolveTableColumnOrder({
  cols,
  savedOrder,
  drillDownDimensions,
  currentDimensionColumn,
}: {
  cols: string[];
  savedOrder?: string[];
  drillDownDimensions?: string[];
  currentDimensionColumn?: string;
}): string[] {
  if (!savedOrder?.length) return cols;

  let order = savedOrder;
  if (
    drillDownDimensions?.length &&
    currentDimensionColumn &&
    drillDownDimensions[0] !== currentDimensionColumn
  ) {
    const firstDim = drillDownDimensions[0];
    order = savedOrder.map((c) => (c === firstDim ? currentDimensionColumn : c));
  }

  if (order.length === cols.length && order.every((c) => cols.includes(c))) {
    return order;
  }
  return cols;
}
