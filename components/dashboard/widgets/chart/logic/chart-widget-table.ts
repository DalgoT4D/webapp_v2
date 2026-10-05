import type { Chart, ChartDimension } from '@/types/charts';
import {
  resolveTableDimensions,
  type TableDrillDownState,
} from '@/components/charts/logic/payload';
import {
  getCurrentDrillColumn,
  getDrillDownColumns,
} from '@/components/charts/logic/table-drilldown';
import { mergeTableColumnFormatting, resolveTableColumnOrder } from '@/lib/chart-payload-utils';

type WidgetExtraConfig = Chart['extra_config'] | undefined;

/** Table page size the chart falls back to when it saved no pagination. */
const DEFAULT_TABLE_PAGE_SIZE = 20;

/**
 * Dimension columns a dashboard table widget groups by. With drill-down: the chart builders'
 * rule (resolveTableDimensions). Without: every dimension, else the legacy
 * `dimension_columns`, else none.
 */
export function getWidgetTableDimensions(
  extraConfig: WidgetExtraConfig,
  tableDrillDownState: TableDrillDownState | null
): string[] {
  const dimensions: ChartDimension[] | undefined = extraConfig?.dimensions;
  const isDrillDownEnabled = dimensions?.some((dim) => dim.enable_drill_down === true);

  if (!isDrillDownEnabled) {
    // Show all dimensions if drill-down disabled
    if (dimensions && dimensions.length > 0) {
      return dimensions.map((d) => d.column).filter(Boolean);
    }
    if (extraConfig?.dimension_columns && extraConfig.dimension_columns.length > 0) {
      return extraConfig.dimension_columns;
    }
    return [];
  }

  // When drill-down is enabled: the top dimension, or the current level's one
  return resolveTableDimensions(dimensions ?? [], tableDrillDownState);
}

/** Drill-down selections as `equals` filters for the table request. */
export function toTableDrillFilters(tableDrillDownState: TableDrillDownState | null) {
  return tableDrillDownState?.appliedFilters
    ? Object.entries(tableDrillDownState.appliedFilters).map(([column, value]) => ({
        column,
        operator: 'equals',
        value,
      }))
    : [];
}

/** The `config` both widgets pass to TableChart (column order follows the drill level). */
export function buildWidgetTableConfig(
  extraConfig: WidgetExtraConfig,
  columns: string[] | undefined,
  tableDrillDownState: TableDrillDownState | null
) {
  const drillDownDimensions = getDrillDownColumns(extraConfig?.dimensions);
  const currentDim = getCurrentDrillColumn(extraConfig?.dimensions, tableDrillDownState);
  return {
    table_columns: resolveTableColumnOrder({
      cols: columns || [],
      savedOrder: extraConfig?.customizations?.columnOrder,
      drillDownDimensions,
      currentDimensionColumn: currentDim,
    }),
    column_formatting: mergeTableColumnFormatting(extraConfig?.customizations),
    sort: extraConfig?.sort || [],
    pagination: extraConfig?.pagination || {
      enabled: true,
      page_size: DEFAULT_TABLE_PAGE_SIZE,
    },
    conditionalFormatting: extraConfig?.customizations?.conditionalFormatting || [],
    columnAlignment: extraConfig?.customizations?.columnAlignment || {},
    zebraRows: extraConfig?.customizations?.zebraRows ?? true,
    freezeFirstColumn: extraConfig?.customizations?.freezeFirstColumn || false,
    theme: extraConfig?.customizations?.theme,
  };
}

/** "Chart Error" card text: data-related backend errors get the dataset hint. */
export function getChartWidgetErrorMessage(rawErrorMessage: string): string {
  // Determine if this is a data-related error and provide helpful message
  const isDataError =
    rawErrorMessage.toLowerCase().includes('data') ||
    rawErrorMessage.toLowerCase().includes('column') ||
    rawErrorMessage.toLowerCase().includes('metric') ||
    rawErrorMessage.toLowerCase().includes('dimension') ||
    rawErrorMessage.toLowerCase().includes('aggregate') ||
    rawErrorMessage.toLowerCase().includes('no rows') ||
    rawErrorMessage.toLowerCase().includes('empty result');

  return isDataError
    ? 'Please check the dataset or metrics selected and try again'
    : 'Chart configuration needs adjustment. Please review your settings and try again';
}
