import { act, renderHook } from '@testing-library/react';
import {
  buildSnapshotFilterParams,
  getReportSortValue,
  getReportTotalPages,
} from '@/components/reports/logic/report-list';
import { useReportListFilters } from '@/components/reports/list/useReportListFilters';
import { createMockSnapshot } from './report-mock-data';

describe('buildSnapshotFilterParams', () => {
  it('no filter → undefined (useSnapshots gets no query string)', () => {
    expect(buildSnapshotFilterParams({ title: '', dashboard: '', createdBy: '' })).toBeUndefined();
  });

  it('any filter → all three keys, empty ones undefined', () => {
    expect(buildSnapshotFilterParams({ title: 'Q1', dashboard: '', createdBy: '' })).toStrictEqual({
      search: 'Q1',
      dashboard_title: undefined,
      created_by: undefined,
    });
    expect(
      buildSnapshotFilterParams({ title: '', dashboard: 'Sales', createdBy: 'ana@ngo.org' })
    ).toStrictEqual({
      search: undefined,
      dashboard_title: 'Sales',
      created_by: 'ana@ngo.org',
    });
  });
});

describe('getReportSortValue', () => {
  it('lower-cases text columns and uses ms for created_at', () => {
    const snapshot = createMockSnapshot({
      title: 'Q1 Sales',
      dashboard_title: undefined,
      created_by: 'Ana@NGO.org',
    });
    expect(getReportSortValue(snapshot, 'title')).toBe('q1 sales');
    expect(getReportSortValue(snapshot, 'dashboard_title')).toBe('');
    expect(getReportSortValue(snapshot, 'created_by')).toBe('ana@ngo.org');
    expect(getReportSortValue(snapshot, 'created_at')).toBe(Date.parse('2025-01-31T10:00:00Z'));
  });
});

describe('getReportTotalPages', () => {
  it('at least one page; never clamps the current page (pinned "2 of 1")', () => {
    expect(getReportTotalPages(0, 10)).toBe(1);
    expect(getReportTotalPages(10, 10)).toBe(1);
    expect(getReportTotalPages(25, 10)).toBe(3);
  });
});

describe('useReportListFilters', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('counts typed filters at once but sends them after 400 ms, then calls onFiltersSettled', () => {
    const onFiltersSettled = jest.fn();
    const { result } = renderHook(() => useReportListFilters(onFiltersSettled));
    act(() => jest.advanceTimersByTime(400));
    expect(onFiltersSettled).toHaveBeenCalledTimes(1); // mount timer (pinned)

    act(() => result.current.setTitleFilter('Q1'));
    act(() => result.current.setCreatedByFilter('ana'));
    expect(result.current.activeFilterCount).toBe(2);
    expect(result.current.hasAnyFilter).toBe(true);
    expect(result.current.filterParams).toBeUndefined();

    act(() => jest.advanceTimersByTime(400));
    expect(result.current.filterParams).toStrictEqual({
      search: 'Q1',
      dashboard_title: undefined,
      created_by: 'ana',
    });
    expect(onFiltersSettled).toHaveBeenCalledTimes(2);

    act(() => result.current.clearAllFilters());
    expect(result.current.activeFilters).toEqual({
      title: false,
      dashboard: false,
      createdBy: false,
    });
  });
});
