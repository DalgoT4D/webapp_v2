/**
 * Custom hook for managing table state (sorting, filtering)
 * Provides a unified interface for DataTable-based list components
 */

import { useState, useMemo, useCallback } from 'react';
import type { SortState, FilterState, FilterConfig } from '@/components/ui/data-table';
import { getActiveFilterCount, sortItems } from '@/lib/table-utils';

export interface UseTableStateOptions<T> {
  /** Initial sort state */
  initialSort?: SortState;
  /** Initial filter state */
  initialFilters: FilterState;
  /** Filter configuration for each column */
  filterConfigs: Record<string, FilterConfig>;
  /** Data to filter and sort */
  data: T[];
  /** Map of column IDs to accessor functions for sorting */
  sortAccessors: Record<string, (item: T) => string | number | Date | null | undefined>;
  /** Custom filter function that takes an item and filter state */
  filterFn: (item: T, filterState: FilterState) => boolean;
}

export interface UseTableStateReturn<T> {
  // State
  sortState: SortState;
  filterState: FilterState;
  /** Data after applying filters and sorting */
  filteredAndSortedData: T[];

  // Handlers
  setSortState: React.Dispatch<React.SetStateAction<SortState>>;
  setFilterState: React.Dispatch<React.SetStateAction<FilterState>>;
  /** Reset filters to initial state */
  clearAllFilters: () => void;

  // Computed values
  /** Number of active filters */
  activeFilterCount: number;
  /** Whether any filters are active */
  hasActiveFilters: boolean;
}

/**
 * Hook for managing table sorting and filtering state
 *
 * @example
 * ```tsx
 * const {
 *   sortState,
 *   setSortState,
 *   filterState,
 *   setFilterState,
 *   filteredAndSortedData,
 *   activeFilterCount,
 *   clearAllFilters,
 * } = useTableState({
 *   data: charts,
 *   initialFilters: { title: { text: '' }, chart_type: [] },
 *   filterConfigs: { title: { type: 'text' }, chart_type: { type: 'checkbox' } },
 *   sortAccessors: {
 *     title: (item) => item.title,
 *     updated_at: (item) => new Date(item.updated_at),
 *   },
 *   filterFn: (item, filters) => {
 *     // Custom filter logic
 *     return true;
 *   },
 * });
 * ```
 */
export function useTableState<T>(options: UseTableStateOptions<T>): UseTableStateReturn<T> {
  const {
    initialSort = { column: null, direction: 'desc' },
    initialFilters,
    filterConfigs,
    data,
    sortAccessors,
    filterFn,
  } = options;

  // Sorting state
  const [sortState, setSortState] = useState<SortState>(initialSort);

  // Filter state
  const [filterState, setFilterState] = useState<FilterState>(initialFilters);

  // Apply filters and sort
  const filteredAndSortedData = useMemo(() => {
    // First, apply filters
    const filtered = data.filter((item) => filterFn(item, filterState));

    // Then, apply sorting
    return sortItems(filtered, sortState, sortAccessors);
  }, [data, filterState, filterFn, sortState, sortAccessors]);

  // Calculate active filter count
  const activeFilterCount = useMemo(
    () => getActiveFilterCount(filterState, filterConfigs),
    [filterState, filterConfigs]
  );

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilterState(initialFilters);
  }, [initialFilters]);

  return {
    sortState,
    filterState,
    filteredAndSortedData,
    setSortState,
    setFilterState,
    clearAllFilters,
    activeFilterCount,
    hasActiveFilters: activeFilterCount > 0,
  };
}

export default useTableState;
