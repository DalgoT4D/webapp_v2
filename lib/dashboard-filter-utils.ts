/**
 * Utility functions for resolving dashboard filters to column information
 * for maps and tables that need complete filter specifications
 */

import type {
  ValueFilterSettings,
  NumericalFilterSettings,
  DateTimeFilterSettings,
} from '@/types/dashboard-filters';

// Appended to date-only strings so a "less_than_equal" comparison includes the full end day
// e.g. "2025-03-19" + END_OF_DAY_TIME → "2025-03-19T23:59:59"
const END_OF_DAY_TIME = 'T23:59:59';

// Define the resolved filter format that maps and tables expect
export interface ResolvedDashboardFilter {
  schema_name: string;
  table_name: string;
  column_name: string;
  operator: string;
  value: any;
  filter_type: 'value' | 'numerical' | 'datetime';
}

// Dashboard filter configuration structure (from API)
export interface DashboardFilterConfig {
  id: string;
  name: string;
  schema_name: string;
  table_name: string;
  column_name: string;
  filter_type: 'value' | 'numerical' | 'datetime';
  settings?: any;
}

// The value side of a {column/operator, value} constraint: a list of selected options
// for a categorical filter, or a single number/date-string for a numerical/datetime one.
export type FilterConstraintValue = string[] | number | string;

// A filter's raw current value, before it's turned into {operator, value} entries.
export type FilterRawValue =
  | string
  | string[]
  | number
  | { min: number; max: number }
  | { start_date?: string; end_date?: string };

export interface OperatorValueEntry {
  operator: string;
  value: FilterConstraintValue;
}

/**
 * Turns one filter's current value into one or more {operator, value} entries. A value
 * filter -> one 'in' entry; a numerical/datetime range -> two entries (>=, <=); a single
 * number/date -> one 'eq' entry. Shared by resolveDashboardFilters (chart querying) and
 * the dependent-filters narrowing so both use the same range-to-operator rule.
 */
export function filterValueToOperatorEntries(
  filterType: 'value' | 'numerical' | 'datetime',
  value: FilterRawValue
): OperatorValueEntry[] {
  if (filterType === 'value') {
    const v = value as string | string[];
    return [{ operator: 'in', value: Array.isArray(v) ? v : [v] }];
  }

  if (filterType === 'numerical') {
    if (typeof value === 'object' && value !== null && 'min' in value && 'max' in value) {
      return [
        { operator: 'greater_than_equal', value: value.min },
        { operator: 'less_than_equal', value: value.max },
      ];
    }
    return [{ operator: 'eq', value: value as number }];
  }

  if (filterType === 'datetime') {
    if (
      typeof value === 'object' &&
      value !== null &&
      ('start_date' in value || 'end_date' in value)
    ) {
      const entries: OperatorValueEntry[] = [];
      if (value.start_date) {
        entries.push({ operator: 'greater_than_equal', value: value.start_date });
      }
      if (value.end_date) {
        entries.push({ operator: 'less_than_equal', value: value.end_date + END_OF_DAY_TIME });
      }
      return entries;
    }
    return [{ operator: 'eq', value: value as string }];
  }

  return [{ operator: 'eq', value: value as FilterConstraintValue }];
}

/**
 * Resolves dashboard filter IDs to complete column information
 * @param appliedFilters - The applied filters from dashboard state (filter_id -> value)
 * @param filterConfigs - The dashboard filter configurations from API
 * @returns Array of resolved filters with complete column info
 */
export function resolveDashboardFilters(
  appliedFilters: Record<string, any>,
  filterConfigs: DashboardFilterConfig[]
): ResolvedDashboardFilter[] {
  const resolvedFilters: ResolvedDashboardFilter[] = [];

  // Iterate through applied filters
  Object.entries(appliedFilters).forEach(([filterId, value]) => {
    // Skip null/undefined values
    if (value === null || value === undefined) {
      return;
    }

    // Find the filter configuration for this ID (handle string/number mismatch)
    const filterConfig = filterConfigs.find((config) => {
      return config.id === filterId || config.id.toString() === filterId;
    });

    if (!filterConfig) {
      console.warn(`Dashboard filter config not found for ID: ${filterId}`);
      return;
    }

    for (const entry of filterValueToOperatorEntries(filterConfig.filter_type, value)) {
      resolvedFilters.push({
        schema_name: filterConfig.schema_name,
        table_name: filterConfig.table_name,
        column_name: filterConfig.column_name,
        operator: entry.operator,
        value: entry.value,
        filter_type: filterConfig.filter_type,
      });
    }
  });

  return resolvedFilters;
}

/**
 * Creates a lookup map of filter configurations by ID for quick access
 */
export function createFilterConfigLookup(
  filterConfigs: DashboardFilterConfig[]
): Record<string, DashboardFilterConfig> {
  const lookup: Record<string, DashboardFilterConfig> = {};

  filterConfigs.forEach((config) => {
    lookup[config.id] = config;
  });

  return lookup;
}

/**
 * Formats resolved filters for chart filter format (used by individual charts)
 * This is used to maintain compatibility with chart-level filtering
 */
export function formatAsChartFilters(resolvedFilters: ResolvedDashboardFilter[]) {
  return resolvedFilters.map((filter) => ({
    column: filter.column_name,
    operator: filter.operator,
    value: filter.value,
    schema_name: filter.schema_name,
    table_name: filter.table_name,
  }));
}

/**
 * Extract default filter values from filter configurations.
 * Used by both DashboardNativeView (for auto-apply in report mode)
 * and UnifiedFiltersPanel (for initial state).
 */
export function getDefaultFilterValues(filters: DashboardFilterConfig[]): Record<string, any> {
  const defaultValues: Record<string, any> = {};

  filters.forEach((filter) => {
    if (filter.filter_type === 'value') {
      const settings = filter.settings as ValueFilterSettings | undefined;
      if (settings?.has_default_value && settings?.default_value) {
        defaultValues[String(filter.id)] = settings.default_value;
      }
    } else if (filter.filter_type === 'numerical') {
      const settings = filter.settings as NumericalFilterSettings | undefined;
      if (settings?.default_min !== undefined || settings?.default_max !== undefined) {
        defaultValues[String(filter.id)] = {
          min: settings.default_min,
          max: settings.default_max,
        };
      }
    } else if (filter.filter_type === 'datetime') {
      const settings = filter.settings as DateTimeFilterSettings | undefined;
      if (settings?.default_start_date || settings?.default_end_date) {
        const dateValue: { start_date?: string; end_date?: string } = {};
        if (settings.default_start_date) dateValue.start_date = settings.default_start_date;
        if (settings.default_end_date) dateValue.end_date = settings.default_end_date;
        defaultValues[String(filter.id)] = dateValue;
      }
    }
  });

  return defaultValues;
}

/**
 * Is this filter value actually set by the user?
 *
 * Apply sends every filter, unset ones as null (so charts can clear a previous value),
 * which means the payload size is the filter COUNT, not the number of filters used. This
 * separates the two. Empty strings, empty arrays and all-empty range objects are "unset":
 * a numerical filter the user never touched arrives as `{min: undefined, max: undefined}`.
 */
export function isFilterValueSet(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(
      (entry) => entry !== null && entry !== undefined && entry !== ''
    );
  }
  return true;
}

/**
 * Summarise an applied filter payload for analytics.
 *
 * Returns counts and filter TYPES only — never the selected values or the column/table/
 * schema they point at, which are warehouse data and must not reach PostHog.
 */
export function summarizeAppliedFilters(
  appliedValues: Record<string, any>,
  filters: DashboardFilterConfig[]
): { applied_filter_count: number; total_filter_count: number; filter_types: string[] } {
  const setFilterIds = Object.keys(appliedValues).filter((id) =>
    isFilterValueSet(appliedValues[id])
  );
  const types = new Set<string>();
  setFilterIds.forEach((id) => {
    const filter = filters.find((candidate) => String(candidate.id) === String(id));
    if (filter?.filter_type) types.add(filter.filter_type);
  });

  return {
    applied_filter_count: setFilterIds.length,
    total_filter_count: filters.length,
    // Sorted so the same combination is one value in PostHog regardless of click order.
    filter_types: Array.from(types).sort(),
  };
}

export interface GroupNarrowingConstraint {
  column: string;
  operator: string;
  value: FilterConstraintValue;
}

/**
 * For one member of a dependent filter group, returns every *other* member's current
 * value as narrowing constraints -- {column, operator, value} entries ready for the
 * `constraints` query param. Self is excluded by construction; members without a value
 * currently set are skipped.
 */
export function getGroupNarrowingInfo(
  memberFilterId: string,
  groupFilterIds: number[],
  filters: DashboardFilterConfig[],
  appliedValues: Record<string, FilterRawValue>
): GroupNarrowingConstraint[] {
  if (!groupFilterIds.includes(Number(memberFilterId))) return [];

  const constraints: GroupNarrowingConstraint[] = [];

  for (const filter of filters) {
    if (String(filter.id) === String(memberFilterId)) continue;
    if (!groupFilterIds.includes(Number(filter.id))) continue;

    const value = appliedValues[filter.id];
    if (!isFilterValueSet(value)) continue;

    for (const entry of filterValueToOperatorEntries(filter.filter_type, value)) {
      constraints.push({
        column: filter.column_name,
        operator: entry.operator,
        value: entry.value,
      });
    }
  }

  return constraints;
}
