import { summarizeAppliedFilters } from '../dashboard-filter-utils';
import type { DashboardFilterConfig } from '../dashboard-filter-utils';

const filters = [
  { id: '1', name: 'Region', filter_type: 'value' },
  { id: '2', name: 'Age', filter_type: 'numerical' },
  { id: '3', name: 'Visit date', filter_type: 'datetime' },
] as unknown as DashboardFilterConfig[];

describe('summarizeAppliedFilters', () => {
  // Apply sends every filter, unset ones as null, so a naive Object.keys count would
  // always equal the filter count and the event would say "3 applied" for zero clicks.
  it('counts only filters the user actually set', () => {
    const result = summarizeAppliedFilters({ '1': ['North'], '2': null, '3': null }, filters);

    expect(result).toEqual({
      applied_filter_count: 1,
      total_filter_count: 3,
      filter_types: ['value'],
    });
  });

  it('treats empty strings, empty arrays and all-empty ranges as unset', () => {
    const result = summarizeAppliedFilters(
      { '1': '', '2': { min: undefined, max: undefined }, '3': [] },
      filters
    );

    expect(result.applied_filter_count).toBe(0);
    expect(result.filter_types).toEqual([]);
  });

  it('counts a partially filled range as set', () => {
    const result = summarizeAppliedFilters({ '2': { min: 18, max: undefined } }, filters);

    expect(result.applied_filter_count).toBe(1);
    expect(result.filter_types).toEqual(['numerical']);
  });

  it('reports each type once, sorted, so click order does not fragment the property', () => {
    const a = summarizeAppliedFilters(
      { '1': ['North'], '2': { min: 1 }, '3': { start_date: '2026-01-01' } },
      filters
    );
    const b = summarizeAppliedFilters(
      { '3': { start_date: '2026-01-01' }, '1': ['North'], '2': { min: 1 } },
      filters
    );

    expect(a.filter_types).toEqual(['datetime', 'numerical', 'value']);
    expect(a.filter_types).toEqual(b.filter_types);
  });

  it('never leaks filter values or column identifiers', () => {
    const result = summarizeAppliedFilters({ '1': ['Bihar'] }, filters);

    expect(JSON.stringify(result)).not.toContain('Bihar');
    expect(Object.keys(result).sort()).toEqual([
      'applied_filter_count',
      'filter_types',
      'total_filter_count',
    ]);
  });
});
