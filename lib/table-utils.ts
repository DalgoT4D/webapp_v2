/**
 * Table utility functions for filtering, sorting, and data extraction
 * Used by DataTable-based list components (Charts, Dashboards, Users, etc.)
 */

import type {
  DateFilterValue,
  TextFilterValue,
  FilterState,
  FilterConfig,
  SortState,
} from '@/components/ui/data-table';

/**
 * Check if a date passes the date range filter
 * @param date - The date to check (Date object, ISO string, or null)
 * @param filter - The date filter configuration
 * @returns true if the date passes the filter
 */
export function matchesDateFilter(
  date: Date | string | null | undefined,
  filter: DateFilterValue
): boolean {
  if (filter.range === 'all') return true;
  if (!date) return false;

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();

  switch (filter.range) {
    case 'today': {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return dateObj >= today;
    }
    case 'week': {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return dateObj >= weekAgo;
    }
    case 'month': {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return dateObj >= monthAgo;
    }
    case 'custom': {
      if (filter.customStart && dateObj < filter.customStart) return false;
      if (filter.customEnd && dateObj > filter.customEnd) return false;
      return true;
    }
    default:
      return true;
  }
}

/**
 * Check if text matches a text filter (case-insensitive)
 * @param text - The text to check
 * @param filterText - The filter text to match against
 * @returns true if the text matches
 */
export function matchesTextFilter(text: string | null | undefined, filterText: string): boolean {
  if (!filterText) return true;
  if (!text) return false;
  return text.toLowerCase().includes(filterText.toLowerCase());
}

/**
 * Check if a value is in a checkbox filter array
 * @param value - The value to check
 * @param filterValues - Array of selected filter values
 * @returns true if no filter is set or value is in the filter array
 */
export function matchesCheckboxFilter(
  value: string | null | undefined,
  filterValues: string[]
): boolean {
  if (filterValues.length === 0) return true;
  if (!value) return false;
  return filterValues.includes(value);
}

/**
 * Calculate active filter count from filter state
 * @param filterState - Current filter state
 * @param filterConfigs - Filter configuration for each column
 * @returns Number of active filters
 */
export function getActiveFilterCount(
  filterState: FilterState,
  filterConfigs: Record<string, FilterConfig>
): number {
  let count = 0;

  for (const [columnId, config] of Object.entries(filterConfigs)) {
    const value = filterState[columnId];

    switch (config.type) {
      case 'text': {
        const textValue = value as TextFilterValue | undefined;
        if (textValue?.text) {
          count++;
        } else if (config.checkboxOptions) {
          // Check if any checkbox options are active
          const hasActiveCheckbox = config.checkboxOptions.some(
            (opt) => textValue?.[opt.key as keyof TextFilterValue]
          );
          if (hasActiveCheckbox) count++;
        }
        break;
      }
      case 'checkbox': {
        const checkboxValue = value as string[] | undefined;
        if (checkboxValue && checkboxValue.length > 0) {
          count++;
        }
        break;
      }
      case 'date': {
        const dateValue = value as DateFilterValue | undefined;
        if (dateValue && dateValue.range !== 'all') {
          count++;
        }
        break;
      }
    }
  }

  return count;
}

/**
 * Extract unique values from an array for filter options
 * @param items - Array of items to extract values from
 * @param accessor - Function to get the value from each item
 * @param labelFormatter - Optional function to format the label
 * @returns Array of { value, label } objects sorted alphabetically
 */
export function extractUniqueValues<T>(
  items: T[],
  accessor: (item: T) => string | null | undefined,
  labelFormatter?: (value: string) => string
): Array<{ value: string; label: string }> {
  const values = new Set<string>();

  items.forEach((item) => {
    const value = accessor(item);
    if (value && value.trim()) {
      values.add(value);
    }
  });

  return Array.from(values)
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({
      value,
      label: labelFormatter ? labelFormatter(value) : value,
    }));
}

/**
 * Generic compare function for sorting
 * @param a - First value
 * @param b - Second value
 * @param direction - Sort direction
 * @returns Comparison result (-1, 0, or 1)
 */
export function compareValues(
  a: string | number | Date | null | undefined,
  b: string | number | Date | null | undefined,
  direction: 'asc' | 'desc'
): number {
  // Handle null/undefined
  if (a == null && b == null) return 0;
  if (a == null) return direction === 'asc' ? -1 : 1;
  if (b == null) return direction === 'asc' ? 1 : -1;

  // Convert to comparable values
  let aVal: string | number;
  let bVal: string | number;

  if (a instanceof Date && b instanceof Date) {
    aVal = a.getTime();
    bVal = b.getTime();
  } else if (typeof a === 'string' && typeof b === 'string') {
    aVal = a.toLowerCase();
    bVal = b.toLowerCase();
  } else {
    aVal = a as number;
    bVal = b as number;
  }

  let result: number;
  if (typeof aVal === 'string' && typeof bVal === 'string') {
    result = aVal.localeCompare(bVal);
  } else {
    result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  }

  return direction === 'desc' ? -result : result;
}

/**
 * Generic sort function for arrays
 * @param items - Array of items to sort
 * @param sortState - Current sort state
 * @param accessors - Map of column IDs to accessor functions
 * @returns New sorted array (does not mutate original)
 */
export function sortItems<T>(
  items: T[],
  sortState: SortState,
  accessors: Record<string, (item: T) => string | number | Date | null | undefined>
): T[] {
  if (!sortState.column || !accessors[sortState.column]) {
    return [...items];
  }

  const accessor = accessors[sortState.column];

  return [...items].sort((a, b) => {
    const aValue = accessor(a);
    const bValue = accessor(b);
    return compareValues(aValue, bValue, sortState.direction);
  });
}

/**
 * Format a role slug to a readable name
 * @param roleSlug - The role slug (e.g., "account-manager")
 * @returns Formatted name (e.g., "Account Manager")
 */
export function formatRoleName(roleSlug: string): string {
  return roleSlug.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Capitalize first letter of a string
 * @param str - String to capitalize
 * @returns String with first letter capitalized
 */
export function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
