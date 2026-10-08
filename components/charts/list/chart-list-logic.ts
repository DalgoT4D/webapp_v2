import type { Chart } from '@/hooks/api/useCharts';
import type { ChartCreate } from '@/types/charts';
import { generateDuplicateTitle } from '@/lib/form-utils';
import {
  matchesDateFilter,
  type DateFilter,
  type SortValue,
} from '@/components/list-page/list-logic';

/** Rules of the /charts list. The server pages; everything here acts on one page of rows. */

export type ChartSortColumn = 'title' | 'updated_at' | 'chart_type' | 'data_source';

export interface ChartNameFilters {
  text: string;
  showFavorites: boolean;
}

export interface ChartListFilterValues {
  nameFilters: ChartNameFilters;
  dataSourceFilters: string[];
  chartTypeFilters: string[];
  dateFilters: DateFilter;
}

export interface ActiveChartFilters {
  name: boolean;
  dataSource: boolean;
  chartType: boolean;
  date: boolean;
}

export function createEmptyChartNameFilters(): ChartNameFilters {
  return { text: '', showFavorites: false };
}

/** "schema.table" as shown in the Data Source column. */
export function getChartDataSource(chart: Chart): string {
  return `${chart.schema_name}.${chart.table_name}`;
}

export function filterCharts(
  charts: Chart[],
  { nameFilters, dataSourceFilters, chartTypeFilters, dateFilters }: ChartListFilterValues,
  now: Date = new Date()
): Chart[] {
  return charts.filter((chart) => {
    if (nameFilters.text) {
      const title = (chart.title || '').toLowerCase();
      if (!title.includes(nameFilters.text.toLowerCase())) return false;
    }
    if (nameFilters.showFavorites && !chart.is_favorite) return false;
    if (dataSourceFilters.length > 0 && !dataSourceFilters.includes(getChartDataSource(chart))) {
      return false;
    }
    if (chartTypeFilters.length > 0 && !chartTypeFilters.includes(chart.chart_type)) return false;
    return matchesDateFilter(chart.updated_at, dateFilters, now);
  });
}

export function getChartSortValue(chart: Chart, column: ChartSortColumn): SortValue {
  switch (column) {
    case 'title':
      return (chart.title || '').toLowerCase();
    case 'updated_at':
      return new Date(chart.updated_at || 0).getTime();
    case 'chart_type':
      return (chart.chart_type || '').toLowerCase();
    case 'data_source':
      return getChartDataSource(chart).toLowerCase();
  }
}

/** Options of the Data Source filter: the sources on the current page. */
export function getUniqueDataSources(charts: Chart[]): string[] {
  const dataSources = new Set<string>();
  charts.forEach((chart) => {
    const dataSource = getChartDataSource(chart);
    if (dataSource && dataSource !== '.') dataSources.add(dataSource);
  });
  return Array.from(dataSources).sort();
}

/** Options of the Type filter: the types on the current page. */
export function getUniqueChartTypes(charts: Chart[]): string[] {
  const chartTypes = new Set<string>();
  charts.forEach((chart) => {
    if (chart.chart_type) chartTypes.add(chart.chart_type);
  });
  return Array.from(chartTypes).sort();
}

export function getActiveChartFilters({
  nameFilters,
  dataSourceFilters,
  chartTypeFilters,
  dateFilters,
}: ChartListFilterValues): ActiveChartFilters {
  return {
    name: !!(nameFilters.text || nameFilters.showFavorites),
    dataSource: dataSourceFilters.length > 0,
    chartType: chartTypeFilters.length > 0,
    date: dateFilters.range !== 'all',
  };
}

/** POST body for the row menu's Duplicate. */
export function buildDuplicateChartPayload(original: Chart, existingTitles: string[]): ChartCreate {
  return {
    title: generateDuplicateTitle(original.title, existingTitles),
    chart_type: original.chart_type as ChartCreate['chart_type'],
    computation_type: original.computation_type as ChartCreate['computation_type'],
    schema_name: original.schema_name,
    table_name: original.table_name,
    extra_config: original.extra_config || {},
  };
}
