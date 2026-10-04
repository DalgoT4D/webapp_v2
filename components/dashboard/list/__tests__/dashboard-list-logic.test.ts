import { createEmptyDateFilter } from '@/components/list-page/list-logic';
import {
  createEmptyDashboardNameFilters,
  filterDashboards,
  getActiveDashboardFilters,
  getDashboardOwner,
  getDashboardSortValue,
  getUniqueOwners,
  paginateDashboardRows,
  splitPinnedDashboards,
  type DashboardListFilterValues,
  type DashboardListItem,
} from '@/components/dashboard/list/dashboard-list-logic';

const makeDashboard = (patch: Partial<DashboardListItem>): DashboardListItem => ({
  id: 1,
  title: 'Sales',
  dashboard_type: 'native',
  grid_columns: 12,
  tabs: [],
  is_published: true,
  is_locked: false,
  created_by: 'ana@ngo.org',
  org_id: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  filters: [],
  is_public: false,
  public_access_count: 0,
  ...patch,
});

const now = new Date('2026-10-04T12:00:00Z');
const rows = [
  makeDashboard({
    id: 1,
    title: 'Sales Overview',
    is_favorite: true,
    updated_at: '2026-10-04T08:00:00Z',
  }),
  makeDashboard({
    id: 2,
    title: '',
    dashboard_title: 'Legacy Health',
    created_by: '',
    changed_by_name: 'Ravi',
    is_locked: true,
    updated_at: '2026-09-20T08:00:00Z',
  }),
  makeDashboard({
    id: 3,
    title: 'Budget',
    created_by: 'zoe@ngo.org',
    updated_at: '2026-06-01T08:00:00Z',
  }),
  makeDashboard({ id: 4, title: 'Orphan', created_by: '' }),
];
const noFilters = (): DashboardListFilterValues => ({
  nameFilters: createEmptyDashboardNameFilters(),
  ownerFilters: [],
  dateFilters: createEmptyDateFilter(),
});
const ids = (list: { id: number }[]) => list.map((d) => d.id);
const withName = (patch: Partial<DashboardListFilterValues['nameFilters']>) => ({
  ...noFilters(),
  nameFilters: { ...createEmptyDashboardNameFilters(), ...patch },
});

describe('filterDashboards', () => {
  it('name matches title, falling back to the legacy dashboard_title', () => {
    expect(ids(filterDashboards(rows, withName({ text: 'LEGACY' }), now))).toEqual([2]);
  });

  it('favorites / locked flags', () => {
    expect(ids(filterDashboards(rows, withName({ showFavorites: true }), now))).toEqual([1]);
    expect(ids(filterDashboards(rows, withName({ showLocked: true }), now))).toEqual([2]);
  });

  it('"Show only shared" is always empty (pinned D-L3: list API lacks is_public)', () => {
    expect(ids(filterDashboards(rows, withName({ showShared: true }), now))).toEqual([]);
  });

  it('owner uses created_by, then changed_by_name, then "Unknown"', () => {
    expect(getDashboardOwner(rows[1])).toBe('Ravi');
    expect(getDashboardOwner(rows[3])).toBe('Unknown');
    expect(ids(filterDashboards(rows, { ...noFilters(), ownerFilters: ['Ravi'] }, now))).toEqual([
      2,
    ]);
    expect(ids(filterDashboards(rows, { ...noFilters(), ownerFilters: ['Unknown'] }, now))).toEqual(
      [4]
    );
  });

  it('date modified uses the shared rule', () => {
    expect(
      ids(
        filterDashboards(
          rows,
          { ...noFilters(), dateFilters: { ...createEmptyDateFilter(), range: 'week' } },
          now
        )
      )
    ).toEqual([1]);
    expect(
      ids(
        filterDashboards(
          rows,
          { ...noFilters(), dateFilters: { ...createEmptyDateFilter(), range: 'month' } },
          now
        )
      )
    ).toEqual([1, 2]);
  });
});

describe('getDashboardSortValue', () => {
  it('name falls back to dashboard_title; owner sorts on created_by only', () => {
    expect(getDashboardSortValue(rows[1], 'name')).toBe('legacy health');
    expect(getDashboardSortValue(rows[1], 'created_by')).toBe('');
    expect(getDashboardSortValue(rows[2], 'created_by')).toBe('zoe@ngo.org');
    expect(getDashboardSortValue(rows[0], 'updated_at')).toBe(Date.parse('2026-10-04T08:00:00Z'));
  });
});

describe('getUniqueOwners', () => {
  it('unique, sorted, without "Unknown"', () => {
    expect(getUniqueOwners([...rows, makeDashboard({ id: 5, created_by: 'ana@ngo.org' })])).toEqual(
      ['Ravi', 'ana@ngo.org', 'zoe@ngo.org']
    );
  });
});

describe('getActiveDashboardFilters', () => {
  it('any name flag activates the name column', () => {
    expect(getActiveDashboardFilters(noFilters())).toEqual({
      name: false,
      owner: false,
      date: false,
    });
    expect(
      getActiveDashboardFilters({ ...withName({ showShared: true }), ownerFilters: ['Ravi'] })
    ).toEqual({
      name: true,
      owner: true,
      date: false,
    });
  });
});

describe('splitPinnedDashboards', () => {
  it('personal landing and org default are pinned, in list order', () => {
    const { pinned, regular } = splitPinnedDashboards(rows, {
      landing_dashboard_id: 3,
      org_default_dashboard_id: 1,
    });
    expect(ids(pinned)).toEqual([1, 3]);
    expect(ids(regular)).toEqual([2, 4]);
  });

  it('no user → nothing pinned', () => {
    expect(ids(splitPinnedDashboards(rows, null).pinned)).toEqual([]);
  });
});

describe('paginateDashboardRows', () => {
  const regular = Array.from({ length: 25 }, (_, i) => makeDashboard({ id: i + 1 }));

  it('array response: slices the regular rows; total counts every dashboard incl. pinned', () => {
    const page = paginateDashboardRows({
      regular,
      currentPage: 2,
      pageSize: 10,
      apiTotal: 27,
      apiTotalPages: 1,
    });
    expect(ids(page.paginatedRegular)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(page.total).toBe(27);
    expect(page.totalPages).toBe(3);
  });

  it('empty list → total 0 and 0 pages ("1 of 0")', () => {
    expect(
      paginateDashboardRows({
        regular: [],
        currentPage: 1,
        pageSize: 10,
        apiTotal: 0,
        apiTotalPages: 1,
      })
    ).toEqual({
      paginatedRegular: [],
      total: 0,
      totalPages: 0,
    });
  });

  it('apiTotal 0 falls back to the regular count', () => {
    expect(
      paginateDashboardRows({
        regular: regular.slice(0, 5),
        currentPage: 1,
        pageSize: 10,
        apiTotal: 0,
        apiTotalPages: 1,
      }).total
    ).toBe(5);
  });

  it('server-paginated response (never sent today) shows all regular rows and the server page count', () => {
    const page = paginateDashboardRows({
      regular,
      currentPage: 1,
      pageSize: 10,
      apiTotal: 60,
      apiTotalPages: 3,
    });
    expect(page.paginatedRegular).toHaveLength(25);
    expect(page.totalPages).toBe(3);
  });
});
