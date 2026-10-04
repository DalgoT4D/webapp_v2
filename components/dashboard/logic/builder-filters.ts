import type { DashboardFilter } from '@/hooks/api/useDashboards';
import type { DashboardFilterConfig } from '@/types/dashboard-filters';

type ApiFilterRow = Partial<DashboardFilter> | null | undefined;

/**
 * The builder's copy of "API filter → filter-panel filter".
 * BUILDER-DRIFT: the view converts with toFilterConfig (string id, a position, unknown type →
 * VALUE). This copy keeps the numeric id, has no position, skips rows missing
 * id/schema/table/column (warning for each), names an unnamed filter after its column (or
 * "Unnamed Filter"), and defaults a missing filter_type to 'value' and settings to {}.
 * Returns a new array on every call: the builder calls it in render and UnifiedFiltersPanel
 * re-syncs whenever the array identity changes — do not memoize.
 */
export function normalizeBuilderFilters(
  dashboardFilters: ApiFilterRow[] | undefined
): DashboardFilterConfig[] {
  // Load filters from backend with proper error handling
  // BUILDER-DRIFT: numeric id and no position — the panel only reads the seven fields below.
  return (Array.isArray(dashboardFilters)
    ? dashboardFilters
        .map((filter) => {
          // Validate filter data before processing
          if (
            !filter ||
            !filter.id ||
            !filter.schema_name ||
            !filter.table_name ||
            !filter.column_name
          ) {
            console.warn('Skipping invalid filter:', filter);
            return null;
          }

          return {
            id: filter.id,
            name: filter.name || filter.column_name || 'Unnamed Filter',
            schema_name: filter.schema_name,
            table_name: filter.table_name,
            column_name: filter.column_name,
            filter_type: filter.filter_type || 'value', // Default to 'value' if missing
            settings: filter.settings || {},
          };
        })
        .filter(Boolean) // Remove null entries
    : []) as unknown as DashboardFilterConfig[];
}
