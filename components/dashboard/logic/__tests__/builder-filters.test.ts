import { normalizeBuilderFilters } from '@/components/dashboard/logic/builder-filters';

const row = {
  id: 5,
  name: 'State',
  schema_name: 'public',
  table_name: 'sales',
  column_name: 'state',
  filter_type: 'value' as const,
  settings: { can_select_multiple: true },
};

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('normalizeBuilderFilters (BUILDER-DRIFT copy)', () => {
  it('keeps the numeric id and the seven fields, nothing else (no position)', () => {
    expect(normalizeBuilderFilters([{ ...row, order: 2 }])).toEqual([
      {
        id: 5,
        name: 'State',
        schema_name: 'public',
        table_name: 'sales',
        column_name: 'state',
        filter_type: 'value',
        settings: { can_select_multiple: true },
      },
    ]);
  });

  it('fills defaults: name from column (then "Unnamed Filter"), type "value", settings {}', () => {
    const [a, b] = normalizeBuilderFilters([
      { ...row, name: '', filter_type: undefined, settings: undefined },
      { ...row, id: 6, name: '', column_name: 'district', filter_type: 'numerical' },
    ]);
    expect(a).toMatchObject({ name: 'state', filter_type: 'value', settings: {} });
    expect(b).toMatchObject({ name: 'district', filter_type: 'numerical' });
  });

  it('skips rows missing id / schema / table / column, with a warning each', () => {
    const out = normalizeBuilderFilters([
      null,
      { ...row, id: 0 },
      { ...row, schema_name: '' },
      { ...row, table_name: undefined },
      { ...row, column_name: '' },
      row,
    ]);
    expect(out).toHaveLength(1);
    expect(console.warn).toHaveBeenCalledTimes(5);
    expect(console.warn).toHaveBeenCalledWith('Skipping invalid filter:', null);
  });

  it('not an array → []', () => {
    expect(normalizeBuilderFilters(undefined)).toEqual([]);
  });

  it('returns a new array on every call (UnifiedFiltersPanel re-syncs on identity — do not memoize)', () => {
    const rows = [row];
    expect(normalizeBuilderFilters(rows)).not.toBe(normalizeBuilderFilters(rows));
  });
});
