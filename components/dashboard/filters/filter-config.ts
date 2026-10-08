import type { DashboardFilter } from '@/hooks/api/useDashboards';
import {
  DashboardFilterType,
  type DashboardFilterConfig,
  type DateTimeFilterSettings,
  type NumericalFilterSettings,
  type ValueFilterSettings,
} from '@/types/dashboard-filters';

export type FilterPosition = DashboardFilterConfig['position'];

/** Filters render in the filter panel, not the grid, so every caller uses this placeholder position. */
export const DEFAULT_FILTER_POSITION: FilterPosition = { x: 0, y: 0, w: 4, h: 3 };

/**
 * API filter → the shape filter widgets render.
 * Settings pass through untouched; an unknown type renders as a VALUE filter.
 * A filter without an id throws (calls .toString() on it) — unchanged from the original.
 */
export function toFilterConfig(
  filter: DashboardFilter,
  position: FilterPosition = DEFAULT_FILTER_POSITION
): DashboardFilterConfig {
  const baseConfig = {
    id: filter.id.toString(),
    name: filter.name,
    schema_name: filter.schema_name,
    table_name: filter.table_name,
    column_name: filter.column_name,
    position,
  };

  switch (filter.filter_type) {
    case 'numerical':
      return {
        ...baseConfig,
        filter_type: DashboardFilterType.NUMERICAL,
        settings: filter.settings as NumericalFilterSettings,
      };
    case 'datetime':
      return {
        ...baseConfig,
        filter_type: DashboardFilterType.DATETIME,
        settings: filter.settings as DateTimeFilterSettings,
      };
    default:
      return {
        ...baseConfig,
        filter_type: DashboardFilterType.VALUE,
        settings: filter.settings as ValueFilterSettings,
      };
  }
}
