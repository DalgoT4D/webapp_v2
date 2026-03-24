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

    // Determine operator based on filter type and value
    let operator = 'eq'; // Default operator

    if (filterConfig.filter_type === 'value') {
      // Always use 'in' operator and array format for consistency
      // This ensures both single and multi-select work with the backend
      operator = 'in';
      if (!Array.isArray(value)) {
        value = [value]; // Convert single value to array for consistent format
      }
    } else if (filterConfig.filter_type === 'numerical') {
      if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
        // Range filter - we'll need to handle this differently
        // For now, create two separate filters for min and max
        resolvedFilters.push({
          schema_name: filterConfig.schema_name,
          table_name: filterConfig.table_name,
          column_name: filterConfig.column_name,
          operator: 'greater_than_equal',
          value: value.min,
          filter_type: filterConfig.filter_type,
        });

        resolvedFilters.push({
          schema_name: filterConfig.schema_name,
          table_name: filterConfig.table_name,
          column_name: filterConfig.column_name,
          operator: 'less_than_equal',
          value: value.max,
          filter_type: filterConfig.filter_type,
        });
        return;
      } else {
        operator = 'eq'; // Single numerical value
      }
    } else if (filterConfig.filter_type === 'datetime') {
      // Date range filter — create separate filters matching backend operators
      if (
        typeof value === 'object' &&
        value !== null &&
        ('start_date' in value || 'end_date' in value)
      ) {
        if (value.start_date) {
          resolvedFilters.push({
            schema_name: filterConfig.schema_name,
            table_name: filterConfig.table_name,
            column_name: filterConfig.column_name,
            operator: 'greater_than_equal',
            value: value.start_date,
            filter_type: filterConfig.filter_type,
          });
        }
        if (value.end_date) {
          resolvedFilters.push({
            schema_name: filterConfig.schema_name,
            table_name: filterConfig.table_name,
            column_name: filterConfig.column_name,
            operator: 'less_than_equal',
            value: value.end_date + END_OF_DAY_TIME,
            filter_type: filterConfig.filter_type,
          });
        }
        return; // Already pushed, skip the generic push below
      }
      operator = 'eq'; // Single date value fallback
    }

    // Add the resolved filter
    resolvedFilters.push({
      schema_name: filterConfig.schema_name,
      table_name: filterConfig.table_name,
      column_name: filterConfig.column_name,
      operator,
      value,
      filter_type: filterConfig.filter_type,
    });
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
