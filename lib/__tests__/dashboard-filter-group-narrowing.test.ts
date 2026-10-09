import { getGroupNarrowingInfo } from '../dashboard-filter-utils';
import type { DashboardFilterConfig } from '../dashboard-filter-utils';

const filters = [
  { id: '1', name: 'State', filter_type: 'value', column_name: 'state' },
  { id: '2', name: 'District', filter_type: 'value', column_name: 'district' },
  { id: '3', name: 'City', filter_type: 'value', column_name: 'city' },
] as unknown as DashboardFilterConfig[];

describe('getGroupNarrowingInfo', () => {
  it('returns every other group member with a value set, excluding self and unset members', () => {
    const result = getGroupNarrowingInfo(
      '3',
      [1, 2, 3],
      filters,
      { '1': null, '2': ['Kochi'], '3': null } // State unset, District set, City is self
    );

    expect(result).toEqual([{ column: 'district', operator: 'in', value: ['Kochi'] }]);
  });
});
