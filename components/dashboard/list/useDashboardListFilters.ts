import { useMemo, useState } from 'react';
import {
  countActiveFilters,
  createEmptyDateFilter,
  type DateFilter,
} from '@/components/list-page/list-logic';
import { useFilterPopovers } from '@/components/list-page/useFilterPopovers';
import {
  createEmptyDashboardNameFilters,
  getActiveDashboardFilters,
  type DashboardListFilterValues,
  type DashboardNameFilters,
} from './dashboard-list-logic';

/** Column-filter state of the dashboard list (page level — survives the header unmounting). */
export function useDashboardListFilters() {
  const [nameFilters, setNameFilters] = useState<DashboardNameFilters>(
    createEmptyDashboardNameFilters()
  );
  const [ownerFilters, setOwnerFilters] = useState<string[]>([]);
  const [dateFilters, setDateFilters] = useState<DateFilter>(createEmptyDateFilter());
  const [ownerSearch, setOwnerSearch] = useState('');
  const { openFilters, setFilterOpen } = useFilterPopovers({
    name: false,
    owner: false,
    date: false,
  });

  const values: DashboardListFilterValues = useMemo(
    () => ({ nameFilters, ownerFilters, dateFilters }),
    [nameFilters, ownerFilters, dateFilters]
  );
  const activeFilters = getActiveDashboardFilters(values);
  const activeFilterCount = countActiveFilters(Object.values(activeFilters));

  const clearAllFilters = () => {
    setNameFilters(createEmptyDashboardNameFilters());
    setOwnerFilters([]);
    setDateFilters(createEmptyDateFilter());
  };

  return {
    nameFilters,
    setNameFilters,
    ownerFilters,
    setOwnerFilters,
    dateFilters,
    setDateFilters,
    ownerSearch,
    setOwnerSearch,
    values,
    activeFilters,
    activeFilterCount,
    clearAllFilters,
    openFilters,
    setFilterOpen,
  };
}

export type DashboardListFilters = ReturnType<typeof useDashboardListFilters>;
