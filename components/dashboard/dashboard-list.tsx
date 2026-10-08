'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { DocsLink } from '@/components/ui/docs-link';
import { Table, TableBody } from '@/components/ui/table';
import { AlertCircle, Layout, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useDashboards,
  deleteDashboard,
  duplicateDashboard,
  favoriteDashboard,
  unfavoriteDashboard,
} from '@/hooks/api/useDashboards';
import { ShareModal } from '@/components/share/ShareModal';
import { toastSuccess, toastError } from '@/lib/toast';
import { toggleFavorite } from '@/lib/favorite-utils';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { markDashboardShared } from '@/components/onboarding/insight-walkthrough-constants';
import { useRbac } from '@/lib/rbac';
import { getRolePermissions } from '@/components/access/logic/resource-permissions';
import { DEFAULT_LIST_PAGE_SIZE, sortRows } from '@/components/list-page/list-logic';
import { useListSort } from '@/components/list-page/useListSort';
import { ListPagination } from '@/components/list-page/ListPagination';
import { ActiveFiltersSummary } from '@/components/list-page/ActiveFiltersSummary';
import { useCurrentOrgUser } from '@/components/dashboard/hooks/useCurrentOrgUser';
import { useLandingPageActions } from '@/components/dashboard/hooks/useLandingPageActions';
import {
  filterDashboards,
  getDashboardSortValue,
  getUniqueOwners,
  paginateDashboardRows,
  splitPinnedDashboards,
  type DashboardListItem,
  type DashboardSortColumn,
} from '@/components/dashboard/list/dashboard-list-logic';
import { useDashboardListFilters } from '@/components/dashboard/list/useDashboardListFilters';
import { DashboardListTableHeader } from '@/components/dashboard/list/DashboardListTableHeader';
import { DashboardListRow } from '@/components/dashboard/list/DashboardListRow';
import { DashboardListSkeleton } from '@/components/dashboard/list/DashboardListSkeleton';

export function DashboardList() {
  const { sortBy, sortOrder, handleSort } = useListSort<DashboardSortColumn>('updated_at');
  const filters = useDashboardListFilters();
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isDuplicating, setIsDuplicating] = useState<number | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState<DashboardListItem | null>(null);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE);

  const router = useRouter();

  // Current user, with fresh landing-page settings
  const currentUser = useCurrentOrgUser();

  // Get user permissions
  const { hasPermission } = useRbac();
  const dashboardRole = getRolePermissions('dashboard', hasPermission);

  // Fetch dashboards
  const {
    data: allDashboards,
    total: apiTotal,
    totalPages: apiTotalPages,
    isLoading,
    isError,
    mutate,
  } = useDashboards({ page: currentPage, pageSize });

  // Landing page actions refresh the list too, so the badges and pinned rows update
  const refreshList = useCallback(() => {
    mutate(); // Refresh the dashboard list to update indicators
  }, [mutate]);
  const { setMyLanding, removeMyLanding, makeOrgDefault, isLandingPageLoading } =
    useLandingPageActions(refreshList);

  const dashboards = (allDashboards || []) as DashboardListItem[];

  const filteredAndSortedDashboards = useMemo(
    () =>
      sortRows(
        filterDashboards(dashboards, filters.values),
        (dashboard) => getDashboardSortValue(dashboard, sortBy),
        sortOrder
      ),
    [dashboards, filters.values, sortBy, sortOrder]
  );
  const uniqueOwners = useMemo(() => getUniqueOwners(dashboards), [dashboards]);

  // Org default + personal landing are pinned on top of every page
  const { pinned: pinnedDashboards, regular: regularDashboards } = splitPinnedDashboards(
    filteredAndSortedDashboards,
    currentUser
  );
  const {
    paginatedRegular: paginatedRegularDashboards,
    total,
    totalPages,
  } = paginateDashboardRows({
    regular: regularDashboards,
    currentPage,
    pageSize,
    apiTotal,
    apiTotalPages,
  });

  const handleToggleFavorite = (dashboard: DashboardListItem) =>
    toggleFavorite(
      dashboard.is_favorite ?? false,
      dashboard.id,
      favoriteDashboard,
      unfavoriteDashboard,
      mutate
    );

  // Handle dashboard deletion
  const handleDeleteDashboard = useCallback(
    async (dashboardId: number, dashboardTitle: string) => {
      setIsDeleting(dashboardId);

      try {
        await deleteDashboard(dashboardId);
        // Id read from the handler arg, not from list state — mutate() below drops the row.
        trackEvent(ANALYTICS_EVENTS.DASHBOARD_DELETED, { dashboard_id: dashboardId });

        // Refresh the dashboard list
        await mutate();

        toastSuccess.deleted(dashboardTitle);
      } catch (error) {
        console.error('Error deleting dashboard:', error);
        toastError.delete(error, dashboardTitle);
      } finally {
        setIsDeleting(null);
      }
    },
    [mutate]
  );

  // Handle dashboard duplication
  const handleDuplicateDashboard = useCallback(
    async (dashboardId: number, dashboardTitle: string) => {
      setIsDuplicating(dashboardId);

      try {
        const newDashboard = await duplicateDashboard(dashboardId);
        // Both ids: dashboard_id is the one that was copied (which dashboards people
        // reuse as templates), new_dashboard_id joins forward to the copy's own events.
        trackEvent(ANALYTICS_EVENTS.DASHBOARD_DUPLICATED, {
          dashboard_id: dashboardId,
          new_dashboard_id: newDashboard.id,
        });

        // Refresh the dashboard list
        await mutate();

        // PINNED-BUGS: "Duplicate dashboard toast says `Chart "X" duplicated`"
        toastSuccess.duplicated(dashboardTitle, newDashboard.title);
      } catch (error) {
        console.error('Error duplicating dashboard:', error);
        toastError.duplicate(error, dashboardTitle);
      } finally {
        setIsDuplicating(null);
      }
    },
    [mutate, router]
  );

  // Handle share dashboard
  const handleShareDashboard = useCallback((dashboard: DashboardListItem) => {
    setSelectedDashboard(dashboard);
    setShareModalOpen(true);
  }, []);

  // Handle share modal close
  const handleShareModalClose = useCallback(() => {
    setShareModalOpen(false);
    setSelectedDashboard(null);
  }, []);

  // Handle dashboard update after sharing changes
  const handleDashboardUpdate = useCallback(() => {
    mutate(); // Refresh the dashboard list
  }, [mutate]);

  // Copying the public link is the share act itself, so it fires here too — the list row
  // menu is a second entry point into the same dialog, and without this the event would
  // only exist on the dashboard view page.
  const handleCopyLink = useCallback(() => {
    trackEvent(ANALYTICS_EVENTS.DASHBOARD_SHARED, { dashboard_id: selectedDashboard?.id });
  }, [selectedDashboard?.id]);

  // ShareModal (components/share/, kept free of onboarding logic) reports when
  // General access flips to Public, so the resume-nudge "shared" milestone is set on that
  // action rather than inside the shared modal.
  const handleMadePublic = useCallback(() => {
    markDashboardShared();
  }, []);

  const renderRow = (dashboard: DashboardListItem) => (
    <DashboardListRow
      key={dashboard.id}
      dashboard={dashboard}
      currentUser={currentUser}
      hasPermission={hasPermission}
      isLandingPageLoading={isLandingPageLoading}
      isDuplicating={isDuplicating === dashboard.id}
      isDeleting={isDeleting === dashboard.id}
      onToggleFavorite={handleToggleFavorite}
      onShare={handleShareDashboard}
      onSetMyLanding={setMyLanding}
      onRemoveMyLanding={removeMyLanding}
      onMakeOrgDefault={makeOrgDefault}
      onDuplicate={handleDuplicateDashboard}
      onDelete={handleDeleteDashboard}
    />
  );

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load dashboards</p>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          data-testid="dashboard-list-retry-btn"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div id="dashboard-list-container" className="h-full flex flex-col">
      {/* Fixed Header */}
      <div id="dashboard-header" className="flex-shrink-0 border-b bg-background">
        {/* Title Section */}
        <div
          id="dashboard-title-section"
          className="flex items-center justify-between mb-6 p-6 pb-0"
        >
          <div id="dashboard-title-wrapper">
            <DocsLink path="/dashboards">
              <h1 id="dashboard-page-title" className="text-3xl font-bold">
                Dashboards
              </h1>
            </DocsLink>
            <p id="dashboard-page-description" className="text-muted-foreground mt-1">
              Create and manage your dashboards
            </p>
          </div>

          <div className="flex items-center gap-2">
            {dashboardRole.canCreate && (
              <Link id="dashboard-create-link" href="/dashboards/create">
                <Button
                  id="dashboard-create-button"
                  variant="primary"
                  data-testid="dashboard-create-button"
                >
                  <Plus id="dashboard-create-icon" className="w-4 h-4 mr-2" />
                  CREATE DASHBOARD
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Filter Summary - Only shows when filters are active to save space */}
        <ActiveFiltersSummary
          id="dashboard-filters-section"
          count={filters.activeFilterCount}
          onClearAll={filters.clearAllFilters}
          clearTestId="dashboard-list-clear-all-filters"
        />
      </div>

      {/* Scrollable Content - Only the dashboard list scrolls */}
      <div className="flex-1 overflow-hidden px-6">
        <div className="h-full overflow-y-auto">
          {isLoading ? (
            <DashboardListSkeleton />
          ) : pinnedDashboards.length > 0 || paginatedRegularDashboards.length > 0 ? (
            // PINNED-BUGS: "Empty filtered dashboard list hides header" — header lives in this branch only.
            <div className="py-6">
              <div className="border rounded-lg bg-white">
                <Table>
                  <DashboardListTableHeader
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    filters={filters}
                    uniqueOwners={uniqueOwners}
                  />
                  <TableBody>
                    {pinnedDashboards.map(renderRow)}
                    {paginatedRegularDashboards.map(renderRow)}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div
              id="dashboard-empty-state"
              className="flex flex-col items-center justify-center h-full gap-4"
            >
              <Layout id="dashboard-empty-icon" className="w-12 h-12 text-muted-foreground" />
              <p id="dashboard-empty-text" className="text-muted-foreground">
                {filters.activeFilterCount > 0 ? 'No dashboards found' : 'No dashboards yet'}
              </p>
              {dashboardRole.canCreate && (
                <Link id="dashboard-empty-create-link" href="/dashboards/create">
                  <Button
                    id="dashboard-empty-create-button"
                    variant="primary"
                    data-testid="dashboard-empty-create-button"
                  >
                    <Plus id="dashboard-empty-create-icon" className="w-4 h-4 mr-2" />
                    CREATE YOUR FIRST DASHBOARD
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <ListPagination
        idPrefix="dashboard"
        currentPage={currentPage}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        testIds={{
          pageSizeTrigger: 'dashboard-page-size-trigger',
          pageSizeOptionPrefix: 'dashboard-page-size-option',
          prev: 'dashboard-prev-page-button',
          next: 'dashboard-next-page-button',
        }}
      />

      {/* Share Modal */}
      {selectedDashboard && (
        <ShareModal
          rtype="dashboard"
          entityId={selectedDashboard.id}
          entityLabel={selectedDashboard.title || 'Dashboard'}
          isOpen={shareModalOpen}
          onClose={handleShareModalClose}
          onUpdate={handleDashboardUpdate}
          onCopyLink={handleCopyLink}
          onMadePublic={handleMadePublic}
        />
      )}
    </div>
  );
}
