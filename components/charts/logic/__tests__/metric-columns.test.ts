import { AGGREGATE_FUNCTIONS, getAvailableColumns } from '@/components/charts/logic/metric-columns';

const columns = [
  { column_name: 'name', data_type: 'text' },
  { column_name: 'score', data_type: 'NUMERIC' },
];

describe('getAvailableColumns', () => {
  it('count adds `*` and enables everything', () => {
    expect(getAvailableColumns(columns, 'count')).toEqual([
      { column_name: 'name', data_type: 'text', disabled: false },
      { column_name: 'score', data_type: 'NUMERIC', disabled: false },
      { column_name: '*', data_type: 'any', disabled: false },
    ]);
  });
  it('count_distinct enables every column, no `*`', () => {
    expect(getAvailableColumns(columns, 'count_distinct').map((c) => c.disabled)).toEqual([
      false,
      false,
    ]);
  });
  it('sum/avg/min/max allow numeric types only (case-insensitive)', () => {
    expect(getAvailableColumns(columns, 'sum').map((c) => c.disabled)).toEqual([true, false]);
  });
  it('lists the six aggregations in menu order', () => {
    expect(AGGREGATE_FUNCTIONS.map((f) => f.value)).toEqual([
      'count',
      'sum',
      'avg',
      'min',
      'max',
      'count_distinct',
    ]);
  });
});
