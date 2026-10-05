import { useCallback, useMemo, useState } from 'react';
import { countActiveFilters } from '@/components/list-page/list-logic';
import { useDebouncedValue } from '@/components/list-page/useDebouncedValue';
import { useFilterPopovers } from '@/components/list-page/useFilterPopovers';
import {
  REPORT_FILTER_DEBOUNCE_MS,
  buildSnapshotFilterParams,
  type ReportFilterInputs,
} from '@/components/reports/logic/report-list';

/**
 * The reports list's three text filters: typed values (drive the "N filters active" count and
 * the teal dots) and their debounced server params.
 * PINNED-BUGS: "Reports list: the 400 ms filter debounce also fires on mount and resets to page 1"
 * — `onFiltersSettled` (the page's "go to page 1") runs every time the timer fires, mount included.
 */
export function useReportListFilters(onFiltersSettled: () => void) {
  const [titleFilter, setTitleFilter] = useState('');
  const [dashboardFilter, setDashboardFilter] = useState('');
  const [createdByFilter, setCreatedByFilter] = useState('');

  const filterInputs: ReportFilterInputs = useMemo(
    () => ({ title: titleFilter, dashboard: dashboardFilter, createdBy: createdByFilter }),
    [titleFilter, dashboardFilter, createdByFilter]
  );
  // PINNED-BUGS: "Reports list: the 400 ms filter debounce also fires on mount and resets to page 1 → an early "Next" bounces back"
  // (the debounce timer also fires once on mount, which runs onFiltersSettled → page 1)
  const debouncedInputs = useDebouncedValue(
    filterInputs,
    REPORT_FILTER_DEBOUNCE_MS,
    onFiltersSettled
  );
  const filterParams = buildSnapshotFilterParams(debouncedInputs);

  const { openFilters, setFilterOpen } = useFilterPopovers({
    title: false,
    dashboard: false,
    createdBy: false,
  });

  const activeFilters = {
    title: titleFilter !== '',
    dashboard: dashboardFilter !== '',
    createdBy: createdByFilter !== '',
  };
  const activeFilterCount = countActiveFilters(Object.values(activeFilters));
  const hasAnyFilter = activeFilterCount > 0;

  const clearAllFilters = useCallback(() => {
    setTitleFilter('');
    setDashboardFilter('');
    setCreatedByFilter('');
  }, []);

  return {
    titleFilter,
    setTitleFilter,
    dashboardFilter,
    setDashboardFilter,
    createdByFilter,
    setCreatedByFilter,
    filterParams,
    activeFilters,
    activeFilterCount,
    hasAnyFilter,
    clearAllFilters,
    openFilters,
    setFilterOpen,
  };
}

export type ReportListFilters = ReturnType<typeof useReportListFilters>;
