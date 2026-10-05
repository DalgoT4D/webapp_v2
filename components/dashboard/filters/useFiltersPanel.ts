'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSWRConfig } from 'swr';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { AppliedFilters, DashboardFilterConfig } from '@/types/dashboard-filters';
import { getDefaultFilterValues, summarizeAppliedFilters } from '@/lib/dashboard-filter-utils';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS, DASHBOARD_FILTER_CONTEXTS } from '@/constants/analytics';
import { deleteDashboardFilter, updateDashboardFilter } from '@/hooks/api/useDashboards';
import { toastError } from '@/lib/toast';

/** Apply shows a spinner this long before notifying the parent (no request is made). */
export const APPLY_FILTERS_DELAY_MS = 500;
/**
 * 5px activation distance lets clicks on the drag handle pass through to child buttons
 * without starting a phantom drag, and removes the small "stickiness" at the start of a
 * real drag.
 */
const DRAG_ACTIVATION_DISTANCE_PX = 5;

export interface UseFiltersPanelOptions {
  initialFilters: DashboardFilterConfig[];
  dashboardId: number;
  isEditMode: boolean;
  isPublicMode: boolean;
  isReportMode: boolean;
  initiallyCollapsed: boolean;
  onFiltersApplied?: (appliedFilters: AppliedFilters) => void;
  onFiltersCleared?: () => void;
  onCollapseChange?: (isCollapsed: boolean) => void;
}

/** State and handlers shared by the vertical and horizontal filter panels. */
export function useFiltersPanel({
  initialFilters,
  dashboardId,
  isEditMode,
  isPublicMode,
  isReportMode,
  initiallyCollapsed,
  onFiltersApplied,
  onFiltersCleared,
  onCollapseChange,
}: UseFiltersPanelOptions) {
  // Internal state - changes here don't affect parent component
  const [filters, setFilters] = useState<DashboardFilterConfig[]>(initialFilters);
  const [currentFilterValues, setCurrentFilterValues] = useState<AppliedFilters>(() =>
    getDefaultFilterValues(initialFilters)
  );
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  // Which surface this panel is mounted on, for DASHBOARD_FILTER_APPLIED. Ordered most
  // specific first: a report snapshot can also be flagged public, and the builder is the
  // only place isEditMode is set.
  const filterContext = isReportMode
    ? DASHBOARD_FILTER_CONTEXTS.REPORT
    : isPublicMode
      ? DASHBOARD_FILTER_CONTEXTS.PUBLIC
      : isEditMode
        ? DASHBOARD_FILTER_CONTEXTS.EDIT
        : DASHBOARD_FILTER_CONTEXTS.VIEW;
  const { mutate: globalMutate } = useSWRConfig();
  const [isCollapsed, setIsCollapsed] = useState(initiallyCollapsed); // For collapsing entire panel
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(true); // For showing/hiding filter list
  const [locallyDeletedFilterIds, setLocallyDeletedFilterIds] = useState<Set<string>>(new Set()); // Track deleted filters

  // Sync filters when initialFilters change (when filters are added/deleted externally)
  useEffect(() => {
    try {
      // Validate initialFilters before setting
      const validFilters = (initialFilters || []).filter(
        (filter) =>
          filter && filter.id && filter.schema_name && filter.table_name && filter.column_name
      );

      if (validFilters.length !== initialFilters.length) {
        console.warn('Some filters were invalid and skipped', {
          total: initialFilters.length,
          valid: validFilters.length,
        });
      }

      // Filter out locally deleted filters to prevent them from reappearing
      const filtersToShow = validFilters.filter(
        (filter) => !locallyDeletedFilterIds.has(String(filter.id))
      );

      setFilters(filtersToShow);

      // Update filter values: keep existing values, add defaults for new filters, remove old ones
      setCurrentFilterValues((prev) => {
        const newValues = { ...prev };
        const existingFilterIds = filtersToShow.map((f) => String(f.id)); // Convert to strings to match object keys

        // Remove values for filters that no longer exist
        Object.keys(newValues).forEach((filterId) => {
          if (!existingFilterIds.includes(filterId)) {
            delete newValues[filterId];
          }
        });

        // Add default values for new filters that don't have values yet
        try {
          const defaultValues = getDefaultFilterValues(filtersToShow);

          Object.keys(defaultValues).forEach((filterId) => {
            const stringFilterId = String(filterId); // Ensure consistent string comparison
            if (!(stringFilterId in newValues)) {
              newValues[stringFilterId] = defaultValues[filterId];
            }
          });
        } catch (error) {
          console.error('Error getting default filter values:', error);
        }

        return newValues;
      });
    } catch (error) {
      console.error('Error syncing filters:', error);
      setFilters([]); // Fallback to empty filters on error
      setCurrentFilterValues({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same dependency list as before
  }, [initialFilters, getDefaultFilterValues, locallyDeletedFilterIds]);

  // Handle filter value changes (internal only - no parent re-render)
  // Stable ref so memoized SortableFilterItem doesn't re-render unnecessarily.
  const handleFilterChange = useCallback((filterId: string, value: unknown) => {
    setCurrentFilterValues((prev) => ({
      ...prev,
      [filterId]: value as AppliedFilters[string],
    }));
  }, []);

  // Handle filter removal (internal state management)
  const handleRemoveFilter = useCallback(
    async (filterId: string) => {
      try {
        await deleteDashboardFilter(dashboardId, parseInt(filterId));

        // Track this filter as locally deleted to prevent it from reappearing
        setLocallyDeletedFilterIds((prev) => new Set(prev).add(String(filterId)));

        setFilters((prev) => prev.filter((filter) => filter.id !== filterId));
        setCurrentFilterValues((prev) => {
          const updated = { ...prev };
          delete updated[filterId];
          return updated;
        });
      } catch (error: unknown) {
        console.error('Failed to delete filter:', (error as Error).message || 'Please try again');
      }
    },
    [dashboardId]
  );

  // Persist new order to backend — without this, the next refetch
  // (DB ordered by `order`) snaps filters back to their old positions.
  const handleReorderFilters = useCallback(
    async (newOrder: DashboardFilterConfig[]) => {
      const previousOrder = filters;
      setFilters(newOrder);

      try {
        const updates = newOrder
          .map((filter, index) => ({ filter, index }))
          .filter(({ filter, index }) => {
            const prevIndex = previousOrder.findIndex((f) => f.id === filter.id);
            return prevIndex !== index;
          });

        await Promise.all(
          updates.map(({ filter, index }) =>
            updateDashboardFilter(dashboardId, Number(filter.id), { order: index })
          )
        );

        await globalMutate(`/api/dashboards/${dashboardId}/`);
      } catch (error) {
        // Partial writes may have committed — reload source of truth.
        await globalMutate(`/api/dashboards/${dashboardId}/`);
        toastError.update(error, 'filter order');
      }
    },
    [filters, dashboardId, globalMutate]
  );

  // Apply filters - notify parent (this will cause chart re-renders)
  const handleApplyFilters = async () => {
    // Make sure all filters have values (use null if not set)
    const appliedFilters: AppliedFilters = {};
    filters.forEach((filter) => {
      if (filter.id in currentFilterValues) {
        const filterValue = currentFilterValues[filter.id];
        appliedFilters[filter.id] = filterValue;
      } else {
        // Filter has no value set, include it as null
        appliedFilters[filter.id] = null;
      }
    });

    setIsApplyingFilters(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, APPLY_FILTERS_DELAY_MS)); // Simulate API call
      onFiltersApplied?.(appliedFilters);
      // Both Apply buttons (vertical and horizontal layouts) run this handler, so one
      // call site covers the panel wherever it is mounted. Counts and types only —
      // never the chosen values or the columns behind them.
      trackEvent(ANALYTICS_EVENTS.DASHBOARD_FILTER_APPLIED, {
        // `|| undefined`: the public report view mounts this through DashboardNativeView
        // with dashboardId={0} (it renders frozen snapshot data, not a live dashboard), and
        // a literal 0 would look like a real id in PostHog. `context` still says where it was.
        dashboard_id: dashboardId || undefined,
        context: filterContext,
        ...summarizeAppliedFilters(appliedFilters, filters),
      });
    } catch (error) {
      console.error('Error applying filters:', error);
    } finally {
      setIsApplyingFilters(false);
    }
  };

  // Clear all filters (in report mode, reset to defaults to preserve frozen date)
  const handleClearAllFilters = () => {
    if (isReportMode) {
      const defaults = getDefaultFilterValues(filters);
      setCurrentFilterValues(defaults);
      onFiltersApplied?.(defaults);
    } else {
      setCurrentFilterValues({});
      onFiltersCleared?.();
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE_PX } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = filters.findIndex((filter) => filter.id === active.id);
        const newIndex = filters.findIndex((filter) => filter.id === over.id);
        const newOrder = arrayMove(filters, oldIndex, newIndex);
        handleReorderFilters(newOrder);
      }
    },
    [filters]
  );

  // Check if any filters have values
  // In report mode, locked filters are auto-set from the frozen report config and cannot
  // be changed by the user — exclude them so they don't trigger the blue dot indicator
  const hasActiveFilters = Object.entries(currentFilterValues).some(([filterId, value]) => {
    if (isReportMode) {
      const filter = filters.find((f) => String(f.id) === String(filterId));
      const isLocked = !!(filter?.settings as { locked?: boolean } | undefined)?.locked;
      if (isLocked) return false;
    }
    return (
      value !== null && value !== undefined && (Array.isArray(value) ? value.length > 0 : true)
    );
  });

  // Toggle panel collapse state (hides entire panel)
  const togglePanelCollapse = () => {
    const newCollapseState = !isCollapsed;
    setIsCollapsed(newCollapseState);
    onCollapseChange?.(newCollapseState);
  };

  // Toggle filter list expansion (shows/hides filter list)
  const toggleFiltersExpansion = () => {
    setIsFiltersExpanded(!isFiltersExpanded);
  };

  return {
    filters,
    currentFilterValues,
    isApplyingFilters,
    isCollapsed,
    isFiltersExpanded,
    hasActiveFilters,
    sensors,
    handleFilterChange,
    handleRemoveFilter,
    handleDragEnd,
    handleApplyFilters,
    handleClearAllFilters,
    togglePanelCollapse,
    toggleFiltersExpansion,
  };
}

export type FiltersPanelState = ReturnType<typeof useFiltersPanel>;
