import { useMemo, useState } from 'react';
import {
  countActiveFilters,
  createEmptyDateFilter,
  type DateFilter,
} from '@/components/list-page/list-logic';
import { useFilterPopovers } from '@/components/list-page/useFilterPopovers';
import {
  createEmptyChartNameFilters,
  getActiveChartFilters,
  type ChartListFilterValues,
  type ChartNameFilters,
} from './chart-list-logic';

/** Column-filter state of the chart list (kept at page level — see useFilterPopovers). */
export function useChartListFilters() {
  const [nameFilters, setNameFilters] = useState<ChartNameFilters>(createEmptyChartNameFilters());
  const [dataSourceFilters, setDataSourceFilters] = useState<string[]>([]);
  const [chartTypeFilters, setChartTypeFilters] = useState<string[]>([]);
  const [dateFilters, setDateFilters] = useState<DateFilter>(createEmptyDateFilter());
  const [dataSourceSearch, setDataSourceSearch] = useState('');
  const { openFilters, setFilterOpen } = useFilterPopovers({
    name: false,
    dataSource: false,
    chartType: false,
    date: false,
  });

  const values: ChartListFilterValues = useMemo(
    () => ({ nameFilters, dataSourceFilters, chartTypeFilters, dateFilters }),
    [nameFilters, dataSourceFilters, chartTypeFilters, dateFilters]
  );
  const activeFilters = getActiveChartFilters(values);
  const activeFilterCount = countActiveFilters(Object.values(activeFilters));

  const clearAllFilters = () => {
    setNameFilters(createEmptyChartNameFilters());
    setDataSourceFilters([]);
    setChartTypeFilters([]);
    setDateFilters(createEmptyDateFilter());
  };

  return {
    nameFilters,
    setNameFilters,
    dataSourceFilters,
    setDataSourceFilters,
    chartTypeFilters,
    setChartTypeFilters,
    dateFilters,
    setDateFilters,
    dataSourceSearch,
    setDataSourceSearch,
    values,
    activeFilters,
    activeFilterCount,
    clearAllFilters,
    openFilters,
    setFilterOpen,
  };
}

export type ChartListFilters = ReturnType<typeof useChartListFilters>;
