import { createEmptyDateFilter, sortRows } from '@/components/list-page/list-logic';
import {
  buildDuplicateChartPayload,
  createEmptyChartNameFilters,
  filterCharts,
  getActiveChartFilters,
  getChartSortValue,
  getUniqueChartTypes,
  getUniqueDataSources,
  type ChartListFilterValues,
} from '@/components/charts/list/chart-list-logic';
import { makeChart } from './chart-fixtures';

const now = new Date('2026-10-04T12:00:00Z');
const charts = [
  makeChart({
    id: 1,
    title: 'Enrolment by District',
    chart_type: 'bar',
    table_name: 'students',
    is_favorite: true,
    updated_at: '2026-10-04T08:00:00Z',
  }),
  makeChart({
    id: 2,
    title: 'attendance trend',
    chart_type: 'line',
    schema_name: 'staging',
    table_name: 'attendance',
    updated_at: '2026-09-20T08:00:00Z',
  }),
  makeChart({
    id: 3,
    title: 'Budget split',
    chart_type: 'pie',
    table_name: 'budget',
    is_favorite: false,
    updated_at: '2026-06-01T08:00:00Z',
  }),
];
const noFilters = (): ChartListFilterValues => ({
  nameFilters: createEmptyChartNameFilters(),
  dataSourceFilters: [],
  chartTypeFilters: [],
  dateFilters: createEmptyDateFilter(),
});
const ids = (rows: { id: number }[]) => rows.map((r) => r.id);

describe('filterCharts', () => {
  it('keeps everything with no filter', () => {
    expect(ids(filterCharts(charts, noFilters(), now))).toEqual([1, 2, 3]);
  });

  it('name: case-insensitive substring; favorites only', () => {
    expect(
      ids(
        filterCharts(
          charts,
          { ...noFilters(), nameFilters: { text: 'ATTEND', showFavorites: false } },
          now
        )
      )
    ).toEqual([2]);
    expect(
      ids(
        filterCharts(
          charts,
          { ...noFilters(), nameFilters: { text: '', showFavorites: true } },
          now
        )
      )
    ).toEqual([1]);
  });

  it('data source and chart type are multi-select', () => {
    expect(
      ids(
        filterCharts(
          charts,
          { ...noFilters(), dataSourceFilters: ['public.students', 'public.budget'] },
          now
        )
      )
    ).toEqual([1, 3]);
    expect(ids(filterCharts(charts, { ...noFilters(), chartTypeFilters: ['line'] }, now))).toEqual([
      2,
    ]);
  });

  it('date modified uses the shared rule', () => {
    expect(
      ids(
        filterCharts(
          charts,
          { ...noFilters(), dateFilters: { ...createEmptyDateFilter(), range: 'week' } },
          now
        )
      )
    ).toEqual([1]);
    expect(
      ids(
        filterCharts(
          charts,
          { ...noFilters(), dateFilters: { ...createEmptyDateFilter(), range: 'month' } },
          now
        )
      )
    ).toEqual([1, 2]);
  });

  it('filters combine with AND', () => {
    expect(
      ids(
        filterCharts(
          charts,
          {
            ...noFilters(),
            dataSourceFilters: ['public.students', 'public.budget'],
            nameFilters: { text: '', showFavorites: true },
          },
          now
        )
      )
    ).toEqual([1]);
  });
});

describe('getChartSortValue', () => {
  it('returns the compared value per column', () => {
    const chart = makeChart({
      title: 'Enrolment',
      chart_type: 'Bar',
      schema_name: 'Public',
      table_name: 'Students',
      updated_at: '2026-10-04T08:00:00Z',
    });
    expect(getChartSortValue(chart, 'title')).toBe('enrolment');
    expect(getChartSortValue(chart, 'chart_type')).toBe('bar');
    expect(getChartSortValue(chart, 'data_source')).toBe('public.students');
    expect(getChartSortValue(chart, 'updated_at')).toBe(Date.parse('2026-10-04T08:00:00Z'));
  });

  it('composes with sortRows like the page does', () => {
    expect(ids(sortRows(charts, (c) => getChartSortValue(c, 'title'), 'asc'))).toEqual([2, 3, 1]);
    expect(ids(sortRows(charts, (c) => getChartSortValue(c, 'updated_at'), 'desc'))).toEqual([
      1, 2, 3,
    ]);
  });
});

describe('filter options', () => {
  it('unique sorted data sources, skipping "."', () => {
    expect(
      getUniqueDataSources([...charts, makeChart({ id: 9, schema_name: '', table_name: '' })])
    ).toEqual(['public.budget', 'public.students', 'staging.attendance']);
  });

  it('unique sorted chart types, skipping empty', () => {
    expect(
      getUniqueChartTypes([
        ...charts,
        makeChart({ id: 8, chart_type: 'bar' }),
        makeChart({ id: 9, chart_type: '' }),
      ])
    ).toEqual(['bar', 'line', 'pie']);
  });
});

describe('getActiveChartFilters', () => {
  it('flags each column', () => {
    expect(getActiveChartFilters(noFilters())).toEqual({
      name: false,
      dataSource: false,
      chartType: false,
      date: false,
    });
    expect(
      getActiveChartFilters({
        nameFilters: { text: 'x', showFavorites: false },
        dataSourceFilters: ['public.students'],
        chartTypeFilters: [],
        dateFilters: { ...createEmptyDateFilter(), range: 'today' },
      })
    ).toEqual({ name: true, dataSource: true, chartType: false, date: true });
  });
});

describe('buildDuplicateChartPayload', () => {
  it('copies the chart under the next free "Copy of" title, defaulting extra_config to {}', () => {
    const original = makeChart({
      title: 'Students',
      chart_type: 'table',
      computation_type: 'raw',
      extra_config: null,
    });
    expect(buildDuplicateChartPayload(original, ['Students', 'Copy of Students'])).toEqual({
      title: 'Copy of Students (2)',
      chart_type: 'table',
      computation_type: 'raw',
      schema_name: 'public',
      table_name: 'students',
      extra_config: {},
    });
  });
});
