'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Grid,
  List,
  BarChart3,
  Plus,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ExternalLink,
  Layout,
  Clock,
  User,
  Lock,
  Trash2,
  MoreHorizontal,
  MoreVertical,
  Copy,
  Download,
  Share2,
  Star,
  StarOff,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useDashboards, deleteDashboard, duplicateDashboard } from '@/hooks/api/useDashboards';
import { DashboardThumbnail } from './dashboard-thumbnail';
import { ShareModal } from './ShareModal';
import { toastSuccess, toastError } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { useLandingPage } from '@/hooks/api/useLandingPage';

// Simple debounce implementation
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function DashboardListV2() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [dashboardType, setDashboardType] = useState<'all' | 'native' | 'superset'>('all');
  const [publishFilter, setPublishFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isDuplicating, setIsDuplicating] = useState<number | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState<any>(null);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const router = useRouter();

  // Get current user info for permission checks
  const getCurrentOrgUser = useAuthStore((state) => state.getCurrentOrgUser);
  const currentUser = getCurrentOrgUser();

  // Get user permissions
  const { hasPermission } = useUserPermissions();

  // Landing page functionality
  const {
    setPersonalLanding,
    removePersonalLanding,
    setOrgDefault,
    isLoading: landingPageLoading,
  } = useLandingPage();

  // Debounce search input
  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setDebouncedSearchQuery(value);
      }, 500),
    []
  );

  // Update search with debounce
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);
      setCurrentPage(1); // Reset to first page when searching
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  // Build params for API call
  const params = {
    search: debouncedSearchQuery,
    dashboard_type: dashboardType === 'all' ? undefined : dashboardType,
    is_published: publishFilter === 'all' ? undefined : publishFilter === 'published',
    page: currentPage,
    pageSize,
  };

  // Fetch dashboards
  const {
    data: allDashboards,
    total: apiTotal,
    page: apiPage,
    pageSize: apiPageSize,
    totalPages: apiTotalPages,
    isLoading,
    isError,
    mutate,
  } = useDashboards(params);

  // If API doesn't support pagination, implement client-side pagination
  const dashboards = allDashboards || [];
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedDashboards =
    apiTotalPages > 1 ? dashboards : dashboards.slice(startIndex, endIndex);

  // Calculate pagination values (use API values if available, otherwise client-side)
  const total = apiTotal || dashboards.length;
  const totalPages = apiTotalPages > 1 ? apiTotalPages : Math.ceil(dashboards.length / pageSize);

  // Handle dashboard deletion
  const handleDeleteDashboard = useCallback(
    async (dashboardId: number, dashboardTitle: string) => {
      setIsDeleting(dashboardId);

      try {
        await deleteDashboard(dashboardId);

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
    [mutate, toast]
  );

  // Handle dashboard duplication
  const handleDuplicateDashboard = useCallback(
    async (dashboardId: number, dashboardTitle: string) => {
      setIsDuplicating(dashboardId);

      try {
        const newDashboard = await duplicateDashboard(dashboardId);

        // Refresh the dashboard list
        await mutate();

        toastSuccess.duplicated(dashboardTitle, newDashboard.title);
      } catch (error: any) {
        console.error('Error duplicating dashboard:', error);
        toastError.duplicate(error, dashboardTitle);
      } finally {
        setIsDuplicating(null);
      }
    },
    [mutate, toast, router]
  );

  // Handle dashboard download (placeholder)
  const handleDownloadDashboard = useCallback((dashboardId: number, dashboardTitle: string) => {
    toastSuccess.generic('Dashboard download will be available soon');
  }, []);

  // Handle share dashboard
  const handleShareDashboard = useCallback((dashboard: any) => {
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

  // Landing page handlers
  const handleSetPersonalLanding = useCallback(
    async (dashboardId: number) => {
      await setPersonalLanding(dashboardId);
      mutate(); // Refresh the dashboard list to update indicators
    },
    [setPersonalLanding, mutate]
  );

  const handleRemovePersonalLanding = useCallback(async () => {
    await removePersonalLanding();
    mutate(); // Refresh the dashboard list to update indicators
  }, [removePersonalLanding, mutate]);

  const handleSetOrgDefault = useCallback(
    async (dashboardId: number) => {
      await setOrgDefault(dashboardId);
      mutate(); // Refresh the dashboard list to update indicators
    },
    [setOrgDefault, mutate]
  );

  // Remove mock data - use real data from API

  const renderDashboardCard = (dashboard: any) => {
    const isNative = dashboard.dashboard_type === 'native';
    const isLocked = dashboard.is_locked;
    const isLockedByOther =
      isLocked && dashboard.locked_by && dashboard.locked_by !== currentUser?.email;

    // Landing page status for this dashboard
    const isPersonalLanding = currentUser?.landing_dashboard_id === dashboard.id;
    const isOrgDefault = currentUser?.org_default_dashboard_id === dashboard.id;
    const canManageOrgDefault = hasPermission('can_manage_org_default_dashboard');

    // By default, all dashboards go to view mode first
    const getNavigationUrl = () => {
      return `/dashboards/${dashboard.id}`;
    };

    return (
      <Card
        id={`dashboard-card-${dashboard.id}`}
        key={dashboard.id}
        className={cn(
          'transition-all duration-200 hover:shadow-md h-full relative group',
          !dashboard.is_published && 'opacity-75'
        )}
      >
        {/* Action Menu - only render if user has any dashboard permissions */}
        {(hasPermission('can_share_dashboards') ||
          hasPermission('can_create_dashboards') ||
          hasPermission('can_edit_dashboards') ||
          hasPermission('can_delete_dashboards') ||
          hasPermission('can_view_dashboards')) && (
          <div className="absolute top-2 right-2 z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 bg-white shadow-md hover:bg-gray-50 border-gray-200"
                >
                  <MoreVertical className="w-4 h-4 text-gray-700" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {hasPermission('can_share_dashboards') && (
                  <>
                    <DropdownMenuItem
                      onClick={() => handleShareDashboard(dashboard)}
                      className="cursor-pointer"
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {hasPermission('can_create_dashboards') && (
                  <DropdownMenuItem
                    onClick={() =>
                      handleDuplicateDashboard(
                        dashboard.id,
                        dashboard.title || dashboard.dashboard_title
                      )
                    }
                    className="cursor-pointer"
                    disabled={isDuplicating === dashboard.id}
                  >
                    {isDuplicating === dashboard.id ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                        Duplicating...
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                {hasPermission('can_view_dashboards') && (
                  <DropdownMenuItem
                    onClick={() =>
                      handleDownloadDashboard(
                        dashboard.id,
                        dashboard.title || dashboard.dashboard_title
                      )
                    }
                    className="cursor-pointer"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                )}
                {hasPermission('can_delete_dashboards') && (
                  <>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          className="cursor-pointer text-destructive focus:text-destructive"
                          onSelect={(e) => e.preventDefault()}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Dashboard</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "
                            {dashboard.title || dashboard.dashboard_title}"? This action cannot be
                            undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              handleDeleteDashboard(
                                dashboard.id,
                                dashboard.title || dashboard.dashboard_title
                              )
                            }
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {isDeleting === dashboard.id ? 'Deleting...' : 'Delete'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Clickable content area */}
        <Link href={getNavigationUrl()}>
          <div className="cursor-pointer">
            {/* Thumbnail */}
            <div className="relative h-48 bg-muted overflow-hidden">
              {isNative ? (
                <div className="flex items-center justify-center h-full">
                  <Layout className="w-16 h-16 text-muted-foreground" />
                </div>
              ) : (
                <DashboardThumbnail
                  dashboardId={dashboard.id}
                  thumbnailUrl={dashboard.thumbnail_url}
                  alt={dashboard.title}
                />
              )}

              {/* Type badge */}
              <Badge variant={isNative ? 'default' : 'secondary'} className="absolute top-2 left-2">
                {isNative ? 'Native' : 'Superset'}
              </Badge>

              {/* Lock indicator */}
              {isLocked && (
                <div
                  className={cn(
                    'absolute bottom-2 left-2 text-white p-1 rounded text-xs flex items-center gap-1',
                    isLockedByOther ? 'bg-red-500' : 'bg-blue-500'
                  )}
                >
                  <Lock className="w-3 h-3" />
                  {isLockedByOther ? 'Locked' : 'By you'}
                </div>
              )}
            </div>

            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-base line-clamp-1">
                    {dashboard.title || dashboard.dashboard_title}
                  </CardTitle>
                  <CardDescription className="text-xs line-clamp-2">
                    {dashboard.description || 'No description'}
                  </CardDescription>
                </div>

                {!isNative && (
                  <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>{dashboard.created_by || dashboard.changed_by_name || 'Unknown'}</span>
                </div>

                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>
                    {dashboard.updated_at
                      ? format(new Date(dashboard.updated_at), 'MMM d')
                      : 'Unknown'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-2">
                {dashboard.is_published ? (
                  <Badge variant="outline" className="text-xs">
                    Published
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    Draft
                  </Badge>
                )}

                {/* Landing page badges */}
                {isPersonalLanding && (
                  <Badge
                    variant="default"
                    className="text-xs bg-blue-100 text-blue-800 border-blue-200"
                  >
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    My Landing Page
                  </Badge>
                )}

                {isOrgDefault && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-green-50 text-green-700 border-green-200"
                  >
                    <Settings className="w-3 h-3 mr-1" />
                    Org Default
                  </Badge>
                )}
              </div>

              {isLocked && dashboard.locked_by && (
                <p
                  className={cn('text-xs mt-2', isLockedByOther ? 'text-red-600' : 'text-blue-600')}
                >
                  {isLockedByOther ? `Locked by ${dashboard.locked_by}` : 'Locked by you'}
                </p>
              )}
            </CardContent>
          </div>
        </Link>
      </Card>
    );
  };

  const renderDashboardList = (dashboard: any) => {
    const isNative = dashboard.dashboard_type === 'native';
    const isLocked = dashboard.is_locked;
    const isLockedByOther =
      isLocked && dashboard.locked_by && dashboard.locked_by !== currentUser?.email;

    const isPersonalLanding = currentUser?.landing_dashboard_id === dashboard.id;
    const canManageOrgDefault = hasPermission('can_manage_org_default_dashboard');
    const isOrgDefault = currentUser?.org_default_dashboard_id === dashboard.id;
    // By default, all dashboards go to view mode first
    const getNavigationUrl = () => {
      return `/dashboards/${dashboard.id}`;
    };

    return (
      <Card key={dashboard.id} className="transition-all duration-200 hover:shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {/* Clickable main content */}
            <Link
              href={getNavigationUrl()}
              className="flex items-center gap-4 flex-1 cursor-pointer"
            >
              <div className="w-16 h-16 bg-muted rounded flex items-center justify-center flex-shrink-0">
                {isNative ? (
                  <Layout className="w-8 h-8 text-muted-foreground" />
                ) : (
                  <BarChart3 className="w-8 h-8 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium truncate">
                    {dashboard.title || dashboard.dashboard_title}
                  </h3>
                  <Badge variant={isNative ? 'default' : 'secondary'} className="text-xs">
                    {isNative ? 'Native' : 'Superset'}
                  </Badge>
                  {isLocked && (
                    <Lock
                      className={cn('w-4 h-4', isLockedByOther ? 'text-red-500' : 'text-blue-500')}
                    />
                  )}
                </div>

                <p className="text-sm text-muted-foreground truncate">
                  {dashboard.description || 'No description'}
                </p>

                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {dashboard.created_by || dashboard.changed_by_name || 'Unknown'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {dashboard.updated_at
                      ? format(new Date(dashboard.updated_at), 'MMM d, yyyy')
                      : 'Unknown'}
                  </span>
                  {dashboard.is_published ? (
                    <Badge variant="outline" className="text-xs">
                      Published
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Draft
                    </Badge>
                  )}
                </div>
              </div>

              {!isNative && (
                <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
              )}
            </Link>

            {/* Action Menu - only render if user has any dashboard permissions */}
            {(hasPermission('can_share_dashboards') ||
              hasPermission('can_create_dashboards') ||
              hasPermission('can_edit_dashboards') ||
              hasPermission('can_delete_dashboards') ||
              hasPermission('can_view_dashboards')) && (
              <div className="flex items-center gap-2 ml-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                    >
                      <MoreHorizontal className="w-4 h-4 text-gray-700" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {hasPermission('can_share_dashboards') && (
                      <>
                        <DropdownMenuItem
                          onClick={() => handleShareDashboard(dashboard)}
                          className="cursor-pointer"
                        >
                          <Share2 className="w-4 h-4 mr-2" />
                          Share
                        </DropdownMenuItem>
                      </>
                    )}

                    {/* Landing page controls */}
                    {(hasPermission('can_view_dashboards') || canManageOrgDefault) && (
                      <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                          Landing Page
                        </div>

                        {/* Personal landing page controls */}
                        {hasPermission('can_view_dashboards') && (
                          <>
                            {isPersonalLanding ? (
                              <DropdownMenuItem
                                onClick={() => handleRemovePersonalLanding()}
                                disabled={landingPageLoading}
                                className="cursor-pointer"
                              >
                                <StarOff className="w-4 h-4 mr-2" />
                                Remove as my landing page
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleSetPersonalLanding(dashboard.id)}
                                disabled={landingPageLoading}
                                className="cursor-pointer"
                              >
                                <Star className="w-4 h-4 mr-2" />
                                Set as my landing page
                              </DropdownMenuItem>
                            )}
                          </>
                        )}

                        {/* Org default controls for admins */}
                        {canManageOrgDefault && (
                          <DropdownMenuItem
                            onClick={() => handleSetOrgDefault(dashboard.id)}
                            disabled={landingPageLoading || isOrgDefault}
                            className="cursor-pointer"
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            {isOrgDefault ? 'Current org default' : 'Set as org default'}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                      </>
                    )}

                    {hasPermission('can_create_dashboards') && (
                      <DropdownMenuItem
                        onClick={() =>
                          handleDuplicateDashboard(
                            dashboard.id,
                            dashboard.title || dashboard.dashboard_title
                          )
                        }
                        className="cursor-pointer"
                        disabled={isDuplicating === dashboard.id}
                      >
                        {isDuplicating === dashboard.id ? (
                          <>
                            <div className="w-4 h-4 mr-2 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                            Duplicating...
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
                          </>
                        )}
                      </DropdownMenuItem>
                    )}
                    {hasPermission('can_view_dashboards') && (
                      <DropdownMenuItem
                        onClick={() =>
                          handleDownloadDashboard(
                            dashboard.id,
                            dashboard.title || dashboard.dashboard_title
                          )
                        }
                        className="cursor-pointer"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                    )}
                    {hasPermission('can_delete_dashboards') && (
                      <>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              className="cursor-pointer text-destructive focus:text-destructive"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Dashboard</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "
                                {dashboard.title || dashboard.dashboard_title}"? This action cannot
                                be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  handleDeleteDashboard(
                                    dashboard.id,
                                    dashboard.title || dashboard.dashboard_title
                                  )
                                }
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {isDeleting === dashboard.id ? 'Deleting...' : 'Delete'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

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
      <div id="dashboard-header" className="flex-shrink-0 border-b bg-background p-6">
        {/* Title Section */}
        <div id="dashboard-title-section" className="flex items-center justify-between mb-6">
          <div id="dashboard-title-wrapper">
            <h1 id="dashboard-page-title" className="text-3xl font-bold">
              Dashboards
            </h1>
            <p id="dashboard-page-description" className="text-muted-foreground mt-1">
              Create and manage your data dashboards
            </p>
          </div>

          {hasPermission('can_create_dashboards') && (
            <Link id="dashboard-create-link" href="/dashboards/create">
              <Button id="dashboard-create-button">
                <Plus id="dashboard-create-icon" className="w-4 h-4 mr-2" />
                Create Dashboard
              </Button>
            </Link>
          )}
        </div>

        {/* Filters */}
        <div id="dashboard-filters-section" className="flex flex-col sm:flex-row gap-4">
          <div id="dashboard-search-wrapper" className="relative flex-1">
            <Search
              id="dashboard-search-icon"
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4"
            />
            <Input
              id="dashboard-search-input"
              placeholder="Search dashboards..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>

          <Select
            id="dashboard-type-select"
            value={dashboardType}
            onValueChange={(value: any) => {
              setDashboardType(value);
              setCurrentPage(1); // Reset to first page when filter changes
            }}
          >
            <SelectTrigger id="dashboard-type-trigger" className="w-[180px]">
              <SelectValue id="dashboard-type-value" />
            </SelectTrigger>
            <SelectContent id="dashboard-type-content">
              <SelectItem id="dashboard-type-all" value="all">
                All Types
              </SelectItem>
              <SelectItem id="dashboard-type-native" value="native">
                Native Only
              </SelectItem>
              <SelectItem id="dashboard-type-superset" value="superset">
                Superset Only
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            id="dashboard-publish-select"
            value={publishFilter}
            onValueChange={(value: any) => {
              setPublishFilter(value);
              setCurrentPage(1); // Reset to first page when filter changes
            }}
          >
            <SelectTrigger id="dashboard-publish-trigger" className="w-[180px]">
              <SelectValue id="dashboard-publish-value" />
            </SelectTrigger>
            <SelectContent id="dashboard-publish-content">
              <SelectItem id="dashboard-publish-all" value="all">
                All Status
              </SelectItem>
              <SelectItem id="dashboard-publish-published" value="published">
                Published
              </SelectItem>
              <SelectItem id="dashboard-publish-draft" value="draft">
                Draft
              </SelectItem>
            </SelectContent>
          </Select>

          <div id="dashboard-view-mode-wrapper" className="flex gap-1">
            <Button
              id="dashboard-grid-view-button"
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <Grid id="dashboard-grid-icon" className="w-4 h-4" />
            </Button>
            <Button
              id="dashboard-list-view-button"
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List id="dashboard-list-icon" className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content - Only the dashboard list scrolls */}
      <div className="flex-1 overflow-hidden px-6">
        <div className="h-full overflow-y-auto">
          {isLoading ? (
            <div
              className={cn(
                'py-6',
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                  : 'space-y-2'
              )}
            >
              {[...Array(8)].map((_, i) => (
                <Card key={i}>
                  <div className="h-48 bg-muted animate-pulse" />
                  <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-full mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-3 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : paginatedDashboards && paginatedDashboards.length > 0 ? (
            <div
              className={cn(
                'py-6',
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                  : 'space-y-2'
              )}
            >
              {paginatedDashboards.map((dashboard) =>
                viewMode === 'grid'
                  ? renderDashboardCard(dashboard)
                  : renderDashboardList(dashboard)
              )}
            </div>
          ) : (
            <div
              id="dashboard-empty-state"
              className="flex flex-col items-center justify-center h-full gap-4"
            >
              <Layout id="dashboard-empty-icon" className="w-12 h-12 text-muted-foreground" />
              <p id="dashboard-empty-text" className="text-muted-foreground">
                {searchQuery || dashboardType !== 'all' || publishFilter !== 'all'
                  ? 'No dashboards found'
                  : 'No dashboards yet'}
              </p>
              {hasPermission('can_create_dashboards') && (
                <Link id="dashboard-empty-create-link" href="/dashboards/create">
                  <Button id="dashboard-empty-create-button">
                    <Plus id="dashboard-empty-create-icon" className="w-4 h-4 mr-2" />
                    Create your first dashboard
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fixed Pagination Footer */}
      {dashboards.length > pageSize && (
        <div id="dashboard-pagination-footer" className="flex-shrink-0 border-t bg-background p-6">
          <div id="dashboard-pagination-wrapper" className="flex items-center justify-between">
            <div id="dashboard-pagination-info" className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(startIndex + pageSize, dashboards.length)} of{' '}
              {dashboards.length} dashboards
            </div>

            <div id="dashboard-pagination-controls" className="flex items-center gap-2">
              <div id="dashboard-page-size-wrapper" className="flex items-center gap-2">
                <span id="dashboard-page-size-label" className="text-sm text-muted-foreground">
                  Rows per page:
                </span>
                <Select
                  id="dashboard-page-size-select"
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(parseInt(value));
                    setCurrentPage(1); // Reset to first page when page size changes
                  }}
                >
                  <SelectTrigger id="dashboard-page-size-trigger" className="w-20 h-8">
                    <SelectValue id="dashboard-page-size-value" />
                  </SelectTrigger>
                  <SelectContent id="dashboard-page-size-content">
                    <SelectItem id="dashboard-page-size-10" value="10">
                      10
                    </SelectItem>
                    <SelectItem id="dashboard-page-size-20" value="20">
                      20
                    </SelectItem>
                    <SelectItem id="dashboard-page-size-50" value="50">
                      50
                    </SelectItem>
                    <SelectItem id="dashboard-page-size-100" value="100">
                      100
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div id="dashboard-pagination-nav-left" className="flex items-center gap-1">
                <Button
                  id="dashboard-first-page-button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  First
                </Button>
                <Button
                  id="dashboard-prev-page-button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft id="dashboard-prev-icon" className="h-4 w-4" />
                  Previous
                </Button>
              </div>

              <div id="dashboard-pagination-info-center" className="flex items-center gap-1">
                <span id="dashboard-page-info" className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
              </div>

              <div id="dashboard-pagination-nav-right" className="flex items-center gap-1">
                <Button
                  id="dashboard-next-page-button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                >
                  Next
                  <ChevronRight id="dashboard-next-icon" className="h-4 w-4" />
                </Button>
                <Button
                  id="dashboard-last-page-button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                >
                  Last
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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
