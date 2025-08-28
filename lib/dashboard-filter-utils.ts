/**
 * Utility functions for resolving dashboard filters to column information
 * for maps and tables that need complete filter specifications
 */

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

    // Find the filter configuration for this ID
    const filterConfig = filterConfigs.find((config) => config.id === filterId);

    if (!filterConfig) {
      console.warn(`Dashboard filter config not found for ID: ${filterId}`);
      return;
    }

    // Determine operator based on filter type and value
    let operator = 'eq'; // Default operator

    if (filterConfig.filter_type === 'value') {
      if (Array.isArray(value)) {
        operator = 'in'; // Multi-select values
      } else {
        operator = 'eq'; // Single value
      }
    } else if (filterConfig.filter_type === 'numerical') {
      if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
        // Range filter - we'll need to handle this differently
        // For now, create two separate filters for min and max
        resolvedFilters.push({
          schema_name: filterConfig.schema_name,
          table_name: filterConfig.table_name,
          column_name: filterConfig.column_name,
          operator: 'gte',
          value: value.min,
          filter_type: filterConfig.filter_type,
        });

        resolvedFilters.push({
          schema_name: filterConfig.schema_name,
          table_name: filterConfig.table_name,
          column_name: filterConfig.column_name,
          operator: 'lte',
          value: value.max,
          filter_type: filterConfig.filter_type,
        });
        return;
      } else {
        operator = 'eq'; // Single numerical value
      }
    } else if (filterConfig.filter_type === 'datetime') {
      // Handle datetime filters similarly to numerical
      operator = 'eq';
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
