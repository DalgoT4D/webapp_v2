import { getSortableColumns, getSortOptions } from '@/components/charts/logic/sort-options';

describe('getSortOptions', () => {
  it('dimension, then aliased metrics only', () => {
    expect(
      getSortOptions({
        dimension_column: 'state',
        metrics: [
          { aggregation: 'sum', column: 'students', alias: 'Students' },
          { aggregation: 'count' },
        ],
      })
    ).toEqual([
      { value: 'state', label: 'state', type: 'column' },
      { value: 'Students', label: 'Students', type: 'metric', _uniqueId: 'metric-0-Students' },
    ]);
  });

  it('legacy single metric when there is no metrics array', () => {
    expect(getSortOptions({ aggregate_column: 'students', aggregate_function: 'sum' })).toEqual([
      { value: 'sum(students)', label: 'sum(students)', type: 'metric' },
    ]);
    expect(getSortOptions({})).toEqual([]);
  });
});

describe('getSortableColumns', () => {
  it('an alias-less metric counts as agg(column)', () => {
    expect([
      ...getSortableColumns({
        dimension_column: 'state',
        metrics: [{ aggregation: 'count', column: null }],
      }),
    ]).toEqual(['state', 'count(null)']);
  });
});
