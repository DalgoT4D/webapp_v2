import {
  DEFAULT_FILTER_POSITION,
  toFilterConfig,
} from '@/components/dashboard/filters/filter-config';
import { DashboardFilterType } from '@/types/dashboard-filters';
import type { DashboardFilter } from '@/hooks/api/useDashboards';

const apiFilter = (overrides: Partial<DashboardFilter>): DashboardFilter =>
  ({
    id: 12,
    name: 'State',
    schema_name: 's',
    table_name: 't',
    column_name: 'state',
    filter_type: 'value',
    settings: { can_select_multiple: true },
    ...overrides,
  }) as DashboardFilter;

describe('toFilterConfig', () => {
  it('maps a value filter, stringifying the id and passing settings through unchanged', () => {
    expect(toFilterConfig(apiFilter({}))).toEqual({
      id: '12',
      name: 'State',
      schema_name: 's',
      table_name: 't',
      column_name: 'state',
      filter_type: DashboardFilterType.VALUE,
      position: DEFAULT_FILTER_POSITION,
      settings: { can_select_multiple: true },
    });
  });

  it('keeps numerical and datetime types', () => {
    expect(toFilterConfig(apiFilter({ filter_type: 'numerical' })).filter_type).toBe(
      DashboardFilterType.NUMERICAL
    );
    expect(toFilterConfig(apiFilter({ filter_type: 'datetime' })).filter_type).toBe(
      DashboardFilterType.DATETIME
    );
  });

  it('falls back to VALUE for an unknown type and leaves missing settings undefined', () => {
    const config = toFilterConfig(
      apiFilter({ filter_type: 'mystery' as never, settings: undefined })
    );
    expect(config.filter_type).toBe(DashboardFilterType.VALUE);
    expect(config.settings).toBeUndefined();
  });

  it('throws on a filter without an id (as the view does today)', () => {
    expect(() => toFilterConfig(apiFilter({ id: undefined as never }))).toThrow(TypeError);
  });

  it('uses the given position', () => {
    const position = { x: 1, y: 2, w: 3, h: 4 };
    expect(toFilterConfig(apiFilter({}), position).position).toBe(position);
  });
});
