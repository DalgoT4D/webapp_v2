'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import {
  Plus,
  AlertCircle,
  Layout,
  User,
  Lock,
  Trash2,
  Copy,
  Share2,
  Star,
  StarOff,
  Settings,
  Edit,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  useDashboards,
  deleteDashboard,
  duplicateDashboard,
  type Dashboard,
} from '@/hooks/api/useDashboards';
import { ShareModal } from './ShareModal';
import { toastSuccess, toastError } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { useLandingPage } from '@/hooks/api/useLandingPage';
import useSWR, { mutate as swrMutate } from 'swr';
import { apiGet } from '@/lib/api';
import type { ColumnDef } from '@tanstack/react-table';
import {
  DataTable,
  ColumnHeader,
  ActionsCell,
  type ActionMenuItem,
  type SortState,
  type FilterState,
  type TextFilterValue,
  type DateFilterValue,
  type FilterConfig,
  type SkeletonConfig,
} from '@/components/ui/data-table';

// Extended Dashboard type for list display (includes legacy field aliases from API)
type DashboardListItem = Dashboard & {
  dashboard_title?: string;
  changed_by_name?: string;
};

// Filter configurations
const filterConfigs: Record<string, FilterConfig> = {
  name: {
    type: 'text',
    placeholder: 'Search dashboard names...',
    checkboxOptions: [
      { key: 'showFavorites', label: 'Show only favorites' },
      { key: 'showLocked', label: 'Show only locked' },
      { key: 'showShared', label: 'Show only shared' },
    ],
  },
  owner: {
    type: 'checkbox',
  },
  updated_at: {
    type: 'date',
  },
};

// Skeleton configuration
const skeletonConfig: SkeletonConfig = {
  rowCount: 8,
  columns: [
    { width: 'w-[40%]', cellType: 'text' },
    { width: 'w-[35%]', cellType: 'avatar' },
    { width: 'w-[15%]', cellType: 'text' },
    { width: 'w-[10%]', cellType: 'actions' },
  ],
};

// Initial filter state
const initialFilterState: FilterState = {
  name: { text: '', showFavorites: false, showLocked: false, showShared: false } as TextFilterValue,
  owner: [] as string[],
  updated_at: { range: 'all', customStart: null, customEnd: null } as DateFilterValue,
};

export function DashboardListV2() {
  // Sorting state
  const [sortState, setSortState] = useState<SortState>({
    column: 'updated_at',
    direction: 'desc',
  });

  // Filter state
  const [filterState, setFilterState] = useState<FilterState>(initialFilterState);

  // Favorites (local state)
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  // Action loading states
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isDuplicating, setIsDuplicating] = useState<number | null>(null);

  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState<DashboardListItem | null>(null);

  // Get current user info
  const getCurrentOrgUser = useAuthStore((state) => state.getCurrentOrgUser);
  const authCurrentUser = getCurrentOrgUser();

  // Fetch fresh user data
  const { data: orgUsersData } = useSWR('/api/currentuserv2', apiGet, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });

  const selectedOrgSlug = useAuthStore((state) => state.selectedOrgSlug);
  const currentUser =
    orgUsersData?.find((ou: { org: { slug: string } }) => ou.org.slug === selectedOrgSlug) ||
    authCurrentUser;

  // Permissions
  const { hasPermission } = useUserPermissions();

  // Landing page functionality
  const {
    setPersonalLanding,
    removePersonalLanding,
    setOrgDefault,
    isLoading: landingPageLoading,
  } = useLandingPage();

  // Fetch dashboards
  const { data: allDashboards, isLoading, isError, mutate } = useDashboards({});

  const dashboards: DashboardListItem[] = useMemo(() => allDashboards || [], [allDashboards]);

  // Get unique owners for filter options
  const uniqueOwners = useMemo(() => {
    const owners = new Set<string>();
    dashboards.forEach((dashboard) => {
      const owner = dashboard.created_by || dashboard.changed_by_name || 'Unknown';
      if (owner && owner !== 'Unknown') {
        owners.add(owner);
      }
    });
    return Array.from(owners)
      .sort()
      .map((o) => ({ value: o, label: o }));
  }, [dashboards]);

  // Apply filters and sort dashboards
  const filteredAndSortedDashboards = useMemo(() => {
    const nameFilter = filterState.name as TextFilterValue;
    const ownerFilter = filterState.owner as string[];
    const dateFilter = filterState.updated_at as DateFilterValue;

    // Apply filters
    const filtered = dashboards.filter((dashboard) => {
      // Name filter
      if (nameFilter?.text) {
        const title = (dashboard.title || dashboard.dashboard_title || '').toLowerCase();
        if (!title.includes(nameFilter.text.toLowerCase())) {
          return false;
        }
      }

      // Favorites filter
      if (nameFilter?.showFavorites && !favorites.has(dashboard.id)) {
        return false;
      }

      // Locked filter
      if (nameFilter?.showLocked && !dashboard.is_locked) {
        return false;
      }

      // Shared filter
      if (nameFilter?.showShared && !dashboard.is_public) {
        return false;
      }

      // Owner filter
      if (ownerFilter.length > 0) {
        const owner = dashboard.created_by || dashboard.changed_by_name || 'Unknown';
        if (!ownerFilter.includes(owner)) {
          return false;
        }
      }

      // Date filter
      if (dateFilter.range !== 'all' && dashboard.updated_at) {
        const updatedDate = new Date(dashboard.updated_at);
        const now = new Date();

        switch (dateFilter.range) {
          case 'today': {
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (updatedDate < today) return false;
            break;
          }
          case 'week': {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (updatedDate < weekAgo) return false;
            break;
          }
          case 'month': {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            if (updatedDate < monthAgo) return false;
            break;
          }
          case 'custom': {
            if (dateFilter.customStart && updatedDate < dateFilter.customStart) return false;
            if (dateFilter.customEnd && updatedDate > dateFilter.customEnd) return false;
            break;
          }
        }
      }

      return true;
    });

    // Sort
    return [...filtered].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortState.column) {
        case 'name':
          aValue = (a.title || a.dashboard_title || '').toLowerCase();
          bValue = (b.title || b.dashboard_title || '').toLowerCase();
          break;
        case 'owner':
          aValue = (a.created_by || '').toLowerCase();
          bValue = (b.created_by || '').toLowerCase();
          break;
        case 'updated_at':
          aValue = new Date(a.updated_at || 0).getTime();
          bValue = new Date(b.updated_at || 0).getTime();
          break;
        default:
          return 0;
      }

      if (sortState.direction === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [dashboards, filterState, favorites, sortState]);

  // Separate pinned dashboards
  const pinnedDashboards = useMemo(() => {
    return filteredAndSortedDashboards.filter((dashboard) => {
      const isPersonalLanding = currentUser?.landing_dashboard_id === dashboard.id;
      const isOrgDefault = currentUser?.org_default_dashboard_id === dashboard.id;
      return isPersonalLanding || isOrgDefault;
    });
  }, [filteredAndSortedDashboards, currentUser]);

  // Regular dashboards excluding pinned
  const regularDashboards = useMemo(() => {
    return filteredAndSortedDashboards.filter((dashboard) => {
      const isPersonalLanding = currentUser?.landing_dashboard_id === dashboard.id;
      const isOrgDefault = currentUser?.org_default_dashboard_id === dashboard.id;
      return !(isPersonalLanding || isOrgDefault);
    });
  }, [filteredAndSortedDashboards, currentUser]);

  // Get active filter count
  const getActiveFilterCount = useCallback(() => {
    let count = 0;
    const nameFilter = filterState.name as TextFilterValue;
    if (
      nameFilter?.text ||
      nameFilter?.showFavorites ||
      nameFilter?.showLocked ||
      nameFilter?.showShared
    )
      count++;
    if ((filterState.owner as string[]).length > 0) count++;
    const dateFilter = filterState.updated_at as DateFilterValue;
    if (dateFilter?.range !== 'all') count++;
    return count;
  }, [filterState]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilterState(initialFilterState);
  }, []);

  // Toggle favorites
  const handleToggleFavorite = useCallback((dashboardId: number) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(dashboardId)) {
        newFavorites.delete(dashboardId);
      } else {
        newFavorites.add(dashboardId);
      }
      return newFavorites;
    });
  }, []);

  // Delete handler
  const handleDeleteDashboard = useCallback(
    async (dashboardId: number, dashboardTitle: string) => {
      setIsDeleting(dashboardId);
      try {
        await deleteDashboard(dashboardId);
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

  // Duplicate handler
  const handleDuplicateDashboard = useCallback(
    async (dashboardId: number, dashboardTitle: string) => {
      setIsDuplicating(dashboardId);
      try {
        const newDashboard = await duplicateDashboard(dashboardId);
        await mutate();
        toastSuccess.duplicated(dashboardTitle, newDashboard.title);
      } catch (error) {
        console.error('Error duplicating dashboard:', error);
        toastError.duplicate(error, dashboardTitle);
      } finally {
        setIsDuplicating(null);
      }
    },
    [mutate]
  );

  // Share handler
  const handleShareDashboard = useCallback((dashboard: DashboardListItem) => {
    setSelectedDashboard(dashboard);
    setShareModalOpen(true);
  }, []);

  // Share modal close
  const handleShareModalClose = useCallback(() => {
    setShareModalOpen(false);
    setSelectedDashboard(null);
  }, []);

  // Dashboard update after sharing
  const handleDashboardUpdate = useCallback(() => {
    mutate();
  }, [mutate]);

  // Landing page handlers
  const handleSetPersonalLanding = useCallback(
    async (dashboardId: number) => {
      await setPersonalLanding(dashboardId);
      await swrMutate('/api/currentuserv2');
      mutate();
    },
    [setPersonalLanding, mutate]
  );

  const handleRemovePersonalLanding = useCallback(async () => {
    await removePersonalLanding();
    await swrMutate('/api/currentuserv2');
    mutate();
  }, [removePersonalLanding, mutate]);

  const handleSetOrgDefault = useCallback(
    async (dashboardId: number) => {
      await setOrgDefault(dashboardId);
      await swrMutate('/api/currentuserv2');
      mutate();
    },
    [setOrgDefault, mutate]
  );

  // Define columns
  const columns: ColumnDef<DashboardListItem>[] = useMemo(
    () => [
      {
        id: 'name',
        accessorFn: (row) => row.title || row.dashboard_title || '',
        header: () => (
          <ColumnHeader
            columnId="name"
            title="Name"
            sortable
            sortState={sortState}
            onSortChange={setSortState}
            filterConfig={filterConfigs.name}
            filterState={filterState}
            onFilterChange={setFilterState}
          />
        ),
        cell: ({ row }) => {
          const dashboard = row.original;
          const isFavorited = favorites.has(dashboard.id);
          const isPersonalLanding = currentUser?.landing_dashboard_id === dashboard.id;
          const isOrgDefault = currentUser?.org_default_dashboard_id === dashboard.id;
          const isLocked = dashboard.is_locked;
          const isLockedByOther =
            isLocked && dashboard.locked_by && dashboard.locked_by !== currentUser?.email;

          return (
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-0 hover:bg-yellow-50"
                onClick={(e) => {
                  e.preventDefault();
                  handleToggleFavorite(dashboard.id);
                }}
              >
                {isFavorited ? (
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                ) : (
                  <Star className="w-4 h-4 text-gray-300 hover:text-yellow-400" />
                )}
              </Button>
              <div className="flex flex-col">
                <Link
                  href={hasPermission('can_view_dashboards') ? `/dashboards/${dashboard.id}` : '#'}
                  className="font-medium text-lg text-gray-900 hover:text-teal-700 hover:underline"
                >
                  {dashboard.title || dashboard.dashboard_title}
                </Link>
                {(isPersonalLanding || isOrgDefault || isLocked) && (
                  <div className="flex items-center gap-2 mt-1">
                    {isPersonalLanding && (
                      <Badge
                        variant="default"
                        className="text-sm bg-blue-100 text-blue-700 border-blue-200"
                      >
                        My Landing
                      </Badge>
                    )}
                    {isOrgDefault && (
                      <Badge
                        variant="outline"
                        className="text-sm bg-emerald-50 text-emerald-700 border-emerald-200"
                      >
                        Org Default
                      </Badge>
                    )}
                    {isLocked && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-sm',
                          isLockedByOther
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        )}
                      >
                        <Lock className="w-3 h-3 mr-1" />
                        {isLockedByOther ? 'Locked' : 'By You'}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        },
        meta: {
          headerClassName: 'w-[40%]',
        },
      },
      {
        id: 'owner',
        accessorFn: (row) => row.created_by || row.changed_by_name || 'Unknown',
        header: () => (
          <ColumnHeader
            columnId="owner"
            title="Owner"
            sortable
            sortState={sortState}
            onSortChange={setSortState}
            filterConfig={filterConfigs.owner}
            filterState={filterState}
            onFilterChange={setFilterState}
            filterOptions={uniqueOwners}
          />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-3 h-3 text-gray-600" />
            </div>
            <span className="text-base text-gray-700">
              {row.original.created_by || row.original.changed_by_name || 'Unknown'}
            </span>
          </div>
        ),
        meta: {
          headerClassName: 'w-[35%]',
        },
      },
      {
        id: 'updated_at',
        accessorKey: 'updated_at',
        header: () => (
          <ColumnHeader
            columnId="updated_at"
            title="Last Modified"
            sortable
            sortState={sortState}
            onSortChange={setSortState}
            filterConfig={filterConfigs.updated_at}
            filterState={filterState}
            onFilterChange={setFilterState}
          />
        ),
        cell: ({ row }) => (
          <span className="text-base text-gray-600">
            {row.original.updated_at
              ? formatDistanceToNow(new Date(row.original.updated_at), { addSuffix: true })
              : 'Unknown'}
          </span>
        ),
        meta: {
          headerClassName: 'w-[15%]',
        },
      },
      {
        id: 'actions',
        header: () => <span className="font-medium text-base">Actions</span>,
        cell: ({ row }) => {
          const dashboard = row.original;
          const isPersonalLanding = currentUser?.landing_dashboard_id === dashboard.id;
          const isOrgDefault = currentUser?.org_default_dashboard_id === dashboard.id;
          const canManageOrgDefault = hasPermission('can_manage_org_default_dashboard');
          const dashboardTitle = dashboard.title || dashboard.dashboard_title || '';

          const actions: ActionMenuItem<DashboardListItem>[] = [
            // Landing page section header
            {
              id: 'landing-header',
              label: 'Landing Page',
              isHeader: true,
              hidden: !hasPermission('can_view_dashboards') && !canManageOrgDefault,
            },
            // Set/Remove as personal landing page
            {
              id: 'personal-landing',
              label: isPersonalLanding ? 'Remove as my landing page' : 'Set as my landing page',
              icon: isPersonalLanding ? (
                <StarOff className="w-4 h-4" />
              ) : (
                <Star className="w-4 h-4" />
              ),
              onClick: () =>
                isPersonalLanding
                  ? handleRemovePersonalLanding()
                  : handleSetPersonalLanding(dashboard.id),
              disabled: landingPageLoading,
              hidden: !hasPermission('can_view_dashboards'),
            },
            // Set as org default
            {
              id: 'org-default',
              label: isOrgDefault ? 'Current org default' : 'Set as org default',
              icon: <Settings className="w-4 h-4" />,
              onClick: () => handleSetOrgDefault(dashboard.id),
              disabled: landingPageLoading || isOrgDefault,
              hidden: !canManageOrgDefault,
              separator: 'after',
            },
            // Duplicate
            {
              id: 'duplicate',
              label: isDuplicating === dashboard.id ? 'Duplicating...' : 'Duplicate',
              icon:
                isDuplicating === dashboard.id ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Copy className="w-4 h-4" />
                ),
              onClick: () => handleDuplicateDashboard(dashboard.id, dashboardTitle),
              disabled: isDuplicating === dashboard.id,
              hidden: !hasPermission('can_create_dashboards'),
            },
            // Delete
            {
              id: 'delete',
              label: 'Delete',
              icon: <Trash2 className="w-4 h-4" />,
              variant: 'destructive',
              hidden: !hasPermission('can_delete_dashboards'),
              separator: 'before',
              render: (_, menuItem) => (
                <AlertDialog>
                  <AlertDialogTrigger asChild>{menuItem}</AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Dashboard</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{dashboardTitle}"? This action cannot be
                        undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteDashboard(dashboard.id, dashboardTitle)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting === dashboard.id ? 'Deleting...' : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ),
            },
          ];

          return (
            <ActionsCell
              row={dashboard}
              actions={actions}
              moreIconVariant="horizontal"
              renderPrimaryActions={() => (
                <>
                  {hasPermission('can_edit_dashboards') && (
                    <Link href={`/dashboards/${dashboard.id}/edit`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 p-0 hover:bg-gray-100">
                        <Edit className="w-4 h-4 text-gray-600" />
                      </Button>
                    </Link>
                  )}
                  {hasPermission('can_share_dashboards') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 p-0 hover:bg-gray-100"
                      onClick={() => handleShareDashboard(dashboard)}
                    >
                      <Share2 className="w-4 h-4 text-gray-600" />
                    </Button>
                  )}
                </>
              )}
            />
          );
        },
        meta: {
          headerClassName: 'w-[10%]',
        },
      },
    ],
    [
      sortState,
      filterState,
      favorites,
      uniqueOwners,
      currentUser,
      isDeleting,
      isDuplicating,
      landingPageLoading,
      hasPermission,
      handleToggleFavorite,
      handleDuplicateDashboard,
      handleDeleteDashboard,
      handleShareDashboard,
      handleSetPersonalLanding,
      handleRemovePersonalLanding,
      handleSetOrgDefault,
    ]
  );

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load dashboards</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
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
            <h1 id="dashboard-page-title" className="text-3xl font-bold">
              Dashboards
            </h1>
            <p id="dashboard-page-description" className="text-muted-foreground mt-1">
              Create And Manage Your Dashboards
            </p>
          </div>

          {hasPermission('can_create_dashboards') && (
            <Link id="dashboard-create-link" href="/dashboards/create">
              <Button
                id="dashboard-create-button"
                variant="ghost"
                className="text-white hover:opacity-90 shadow-xs"
                style={{ backgroundColor: '#06887b' }}
              >
                <Plus id="dashboard-create-icon" className="w-4 h-4 mr-2" />
                CREATE DASHBOARD
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* DataTable with pinned rows support */}
      <DataTable
        data={regularDashboards}
        columns={columns}
        isLoading={isLoading}
        getRowId={(row) => row.id}
        pinnedRows={pinnedDashboards}
        sortState={sortState}
        onSortChange={setSortState}
        filterState={filterState}
        onFilterChange={setFilterState}
        filterConfigs={filterConfigs}
        activeFilterCount={getActiveFilterCount()}
        onClearAllFilters={clearAllFilters}
        pagination={{
          totalRows: regularDashboards.length,
          initialPageSize: 10,
          pageSizeOptions: [10, 20, 50, 100],
        }}
        emptyState={{
          icon: <Layout className="w-12 h-12" />,
          title: 'No dashboards yet',
          filteredTitle: 'No dashboards found',
          action: {
            label: 'CREATE YOUR FIRST DASHBOARD',
            href: '/dashboards/create',
            icon: <Plus className="w-4 h-4" />,
            visible: hasPermission('can_create_dashboards'),
          },
        }}
        skeleton={skeletonConfig}
        idPrefix="dashboard"
      />

      {/* Share Modal */}
      {selectedDashboard && (
        <ShareModal
          dashboard={selectedDashboard}
          isOpen={shareModalOpen}
          onClose={handleShareModalClose}
          onUpdate={handleDashboardUpdate}
        />
      )}
    </div>
  );
}
