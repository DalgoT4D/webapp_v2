import type { Dashboard } from '@/hooks/api/useDashboards';
import type { OrgUser } from '@/stores/authStore';
import {
  matchesDateFilter,
  paginateRows,
  type DateFilter,
  type SortValue,
} from '@/components/list-page/list-logic';

/** Rules of the /dashboards list. The list endpoint returns every dashboard as one array. */

/** A list row: the API row plus legacy fields the `Dashboard` type doesn't declare. */
export type DashboardListItem = Dashboard & {
  dashboard_title?: string;
  changed_by_name?: string;
  access_level?: 'view' | 'edit';
};

export type DashboardSortColumn = 'name' | 'updated_at' | 'created_by';

export interface DashboardNameFilters {
  text: string;
  showFavorites: boolean;
  showLocked: boolean;
  showShared: boolean;
}

export interface DashboardListFilterValues {
  nameFilters: DashboardNameFilters;
  ownerFilters: string[];
  dateFilters: DateFilter;
}

export interface ActiveDashboardFilters {
  name: boolean;
  owner: boolean;
  date: boolean;
}

export type LandingIds = Pick<OrgUser, 'landing_dashboard_id' | 'org_default_dashboard_id'> | null;

export function createEmptyDashboardNameFilters(): DashboardNameFilters {
  return { text: '', showFavorites: false, showLocked: false, showShared: false };
}

/** Owner column text (also the owner filter's value). */
export function getDashboardOwner(dashboard: DashboardListItem): string {
  return dashboard.created_by || dashboard.changed_by_name || 'Unknown';
}

export function filterDashboards(
  dashboards: DashboardListItem[],
  { nameFilters, ownerFilters, dateFilters }: DashboardListFilterValues,
  now: Date = new Date()
): DashboardListItem[] {
  return dashboards.filter((dashboard) => {
    if (nameFilters.text) {
      const title = (dashboard.title || dashboard.dashboard_title || '').toLowerCase();
      if (!title.includes(nameFilters.text.toLowerCase())) return false;
    }
    if (nameFilters.showFavorites && !dashboard.is_favorite) return false;
    if (nameFilters.showLocked && !dashboard.is_locked) return false;
    // PINNED-BUGS: ""Show only shared" list filter always empty — list API lacks `is_public`"
    if (nameFilters.showShared && !dashboard.is_public) return false;
    if (ownerFilters.length > 0 && !ownerFilters.includes(getDashboardOwner(dashboard)))
      return false;
    return matchesDateFilter(dashboard.updated_at, dateFilters, now);
  });
}

export function getDashboardSortValue(
  dashboard: DashboardListItem,
  column: DashboardSortColumn
): SortValue {
  switch (column) {
    case 'name':
      return (dashboard.title || dashboard.dashboard_title || '').toLowerCase();
    case 'updated_at':
      return new Date(dashboard.updated_at || 0).getTime();
    case 'created_by':
      return (dashboard.created_by || '').toLowerCase();
  }
}

/** Options of the Owner filter ("Unknown" is never offered). */
export function getUniqueOwners(dashboards: DashboardListItem[]): string[] {
  const owners = new Set<string>();
  dashboards.forEach((dashboard) => {
    const owner = getDashboardOwner(dashboard);
    if (owner && owner !== 'Unknown') owners.add(owner);
  });
  return Array.from(owners).sort();
}

export function getActiveDashboardFilters({
  nameFilters,
  ownerFilters,
  dateFilters,
}: DashboardListFilterValues): ActiveDashboardFilters {
  return {
    name: !!(
      nameFilters.text ||
      nameFilters.showFavorites ||
      nameFilters.showLocked ||
      nameFilters.showShared
    ),
    owner: ownerFilters.length > 0,
    date: dateFilters.range !== 'all',
  };
}

function isPinnedDashboard(dashboard: DashboardListItem, landingIds: LandingIds): boolean {
  const isPersonalLanding = landingIds?.landing_dashboard_id === dashboard.id;
  const isOrgDefault = landingIds?.org_default_dashboard_id === dashboard.id;
  return isPersonalLanding || isOrgDefault;
}

/** Personal landing + org default go on top of every page; the rest are paginated. */
export function splitPinnedDashboards(dashboards: DashboardListItem[], landingIds: LandingIds) {
  return {
    pinned: dashboards.filter((dashboard) => isPinnedDashboard(dashboard, landingIds)),
    regular: dashboards.filter((dashboard) => !isPinnedDashboard(dashboard, landingIds)),
  };
}

interface DashboardPageInput {
  regular: DashboardListItem[];
  currentPage: number;
  pageSize: number;
  apiTotal: number;
  apiTotalPages: number;
}

/**
 * The list endpoint returns a plain array, so useDashboards reports apiTotalPages = 1 and the
 * regular rows are sliced here. The `apiTotalPages > 1` branch (server pages) is kept as today.
 * PINNED-BUGS: "Empty filtered dashboard list hides header; counter shows unfiltered total" —
 * `total` is the API's unfiltered count.
 */
export function paginateDashboardRows({
  regular,
  currentPage,
  pageSize,
  apiTotal,
  apiTotalPages,
}: DashboardPageInput) {
  return {
    paginatedRegular: apiTotalPages > 1 ? regular : paginateRows(regular, currentPage, pageSize),
    total: apiTotal || regular.length,
    totalPages: apiTotalPages > 1 ? apiTotalPages : Math.ceil(regular.length / pageSize),
  };
}
