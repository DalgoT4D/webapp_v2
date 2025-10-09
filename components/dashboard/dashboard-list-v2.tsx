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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  LayoutDashboard,
  Edit,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { useDashboards, deleteDashboard, duplicateDashboard } from '@/hooks/api/useDashboards';
import { DashboardThumbnail } from './dashboard-thumbnail';
import { ShareModal } from './ShareModal';
import { toastSuccess, toastError } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { useLandingPage } from '@/hooks/api/useLandingPage';
import useSWR, { mutate as swrMutate } from 'swr';
import { apiGet } from '@/lib/api';

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
  // COMMENTED OUT: Dashboard type filtering (Native/Superset) - not needed anymore
  // const [dashboardType, setDashboardType] = useState<'all' | 'native' | 'superset'>('all');
  // COMMENTED OUT: Draft/publish filtering - not applicable for dashboards
  // const [publishFilter, setPublishFilter] = useState<'all' | 'published' | 'draft'>('all');
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
  const authCurrentUser = getCurrentOrgUser();

  // Fetch fresh user data to get updated landing page settings
  const { data: orgUsersData } = useSWR('/api/currentuserv2', apiGet, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });

  // Use fresh user data if available, fall back to auth store data
  const selectedOrgSlug = useAuthStore((state) => state.selectedOrgSlug);
  const currentUser =
    orgUsersData?.find((ou: any) => ou.org.slug === selectedOrgSlug) || authCurrentUser;

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
    // COMMENTED OUT: Dashboard type filtering - not needed anymore
    // dashboard_type: dashboardType === 'all' ? undefined : dashboardType,
    // COMMENTED OUT: Draft/publish filtering - not applicable for dashboards
    // is_published: publishFilter === 'all' ? undefined : publishFilter === 'published',
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

  // Separate pinned dashboards (org default and personal landing page)
  const pinnedDashboards = dashboards.filter((dashboard) => {
    const isPersonalLanding = currentUser?.landing_dashboard_id === dashboard.id;
    const isOrgDefault = currentUser?.org_default_dashboard_id === dashboard.id;
    return isPersonalLanding || isOrgDefault;
  });

  // Regular dashboards excluding pinned ones
  const regularDashboards = dashboards.filter((dashboard) => {
    const isPersonalLanding = currentUser?.landing_dashboard_id === dashboard.id;
    const isOrgDefault = currentUser?.org_default_dashboard_id === dashboard.id;
    return !(isPersonalLanding || isOrgDefault);
  });

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRegularDashboards =
    apiTotalPages > 1 ? regularDashboards : regularDashboards.slice(startIndex, endIndex);

  // Calculate pagination values (use API values if available, otherwise client-side for regular dashboards only)
  const total = apiTotal || regularDashboards.length;
  const totalPages =
    apiTotalPages > 1 ? apiTotalPages : Math.ceil(regularDashboards.length / pageSize);

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
    [mutate]
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
    [mutate, router]
  );

  // COMMENTED OUT: Handle dashboard download - not needed
  // const handleDownloadDashboard = useCallback((dashboardId: number, dashboardTitle: string) => {
  //   toastSuccess.generic('Dashboard download will be available soon');
  // }, []);

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
      // The landing page hook already mutates '/api/v1/organizations/users/currentuserv2'
      // Also mutate '/api/currentuserv2' to refresh our local data
      await swrMutate('/api/currentuserv2');
      mutate(); // Refresh the dashboard list to update indicators
    },
    [setPersonalLanding, mutate]
  );

  const handleRemovePersonalLanding = useCallback(async () => {
    await removePersonalLanding();
    // The landing page hook already mutates '/api/v1/organizations/users/currentuserv2'
    // Also mutate '/api/currentuserv2' to refresh our local data
    await swrMutate('/api/currentuserv2');
    mutate(); // Refresh the dashboard list to update indicators
  }, [removePersonalLanding, mutate]);

  const handleSetOrgDefault = useCallback(
    async (dashboardId: number) => {
      await setOrgDefault(dashboardId);
      // The landing page hook already mutates '/api/v1/organizations/users/currentuserv2'
      // Also mutate '/api/currentuserv2' to refresh our local data
      await swrMutate('/api/currentuserv2');
      mutate(); // Refresh the dashboard list to update indicators
    },
    [setOrgDefault, mutate]
  );

  // Remove mock data - use real data from API

  const renderDashboardCard = (dashboard: any) => {
    // COMMENTED OUT: Dashboard type checking - not needed anymore
    // const isNative = dashboard.dashboard_type === 'native';
    const isLocked = dashboard.is_locked;
    const isLockedByOther =
      isLocked && dashboard.locked_by && dashboard.locked_by !== currentUser?.email;

    // Landing page status for this dashboard
    const isPersonalLanding = currentUser?.landing_dashboard_id === dashboard.id;
    const isOrgDefault = currentUser?.org_default_dashboard_id === dashboard.id;
    const canManageOrgDefault = hasPermission('can_manage_org_default_dashboard');

    // By default, all dashboards go to view mode first
    const getNavigationUrl = () => {
      return hasPermission('can_view_dashboards') ? `/dashboards/${dashboard.id}` : '#';
    };

    return (
      <Card
        id={`dashboard-card-${dashboard.id}`}
        key={dashboard.id}
        className={cn(
          'transition-all duration-300 hover:shadow-lg hover:shadow-black/10 hover:-translate-y-1 h-full relative group',
          'bg-white border border-gray-200 rounded-lg overflow-hidden'
          // COMMENTED OUT: Draft opacity styling - not applicable for dashboards
          // !dashboard.is_published && 'opacity-75'
        )}
      >
        {/* Modern Card Header with Integrated Actions */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/20 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 [.force-hover_&]:opacity-100">
          <div className="flex justify-end gap-2">
            {/* Profile Icon */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 bg-white/90 backdrop-blur-sm border-white/20 hover:bg-white text-gray-700 hover:text-gray-900 shadow-sm"
                    onClick={(e) => e.preventDefault()}
                  >
                    <User className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-900 text-white border-gray-700">
                  <p className="text-sm">
                    Created by {dashboard.created_by || dashboard.changed_by_name || 'Unknown'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Share Button */}
            {hasPermission('can_share_dashboards') && (
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 bg-white/90 backdrop-blur-sm border-white/20 hover:bg-white text-gray-700 hover:text-gray-900 shadow-sm"
                onClick={(e) => {
                  e.preventDefault();
                  handleShareDashboard(dashboard);
                }}
              >
                <Share2 className="w-3 h-3" />
              </Button>
            )}

            {/* Edit Button */}
            {hasPermission('can_edit_dashboards') && (
              <Link href={`/dashboards/${dashboard.id}/edit`}>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 bg-white/90 backdrop-blur-sm border-white/20 hover:bg-white text-gray-700 hover:text-gray-900 shadow-sm"
                >
                  <Edit className="w-3 h-3" />
                </Button>
              </Link>
            )}

            {/* More Actions Menu */}
            {(hasPermission('can_create_dashboards') ||
              hasPermission('can_delete_dashboards') ||
              hasPermission('can_view_dashboards')) && (
              <DropdownMenu
                onOpenChange={(open) => {
                  // Prevent the card hover state from being lost when dropdown opens
                  if (open) {
                    const cardElement = document.getElementById(`dashboard-card-${dashboard.id}`);
                    if (cardElement) {
                      cardElement.classList.add('force-hover');
                    }
                  } else {
                    const cardElement = document.getElementById(`dashboard-card-${dashboard.id}`);
                    if (cardElement) {
                      cardElement.classList.remove('force-hover');
                    }
                  }
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 bg-white/90 backdrop-blur-sm border-white/20 hover:bg-white shadow-sm"
                  >
                    <MoreVertical className="w-3 h-3 text-gray-700" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
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
            )}
          </div>
        </div>

        {/* Clickable content area */}
        <Link href={getNavigationUrl()}>
          <div className="cursor-pointer">
            {/* Enhanced Thumbnail with Real Dashboard Preview */}
            <div className="relative h-52 bg-gray-50 overflow-hidden rounded-t-lg">
              <DashboardThumbnail
                dashboardId={dashboard.id}
                thumbnailUrl={dashboard.thumbnail_url}
                alt={dashboard.title || dashboard.dashboard_title || 'Dashboard'}
                className="w-full h-full object-cover"
                fallbackClassName="bg-gradient-to-br from-gray-50 to-gray-100"
                fallbackIconSize="lg"
                dashboardType={dashboard.dashboard_type}
                isPublished={dashboard.is_published}
                useClientSideRendering={true}
              />

              {/* Lock indicator */}
              {isLocked && (
                <div
                  className={cn(
                    'absolute bottom-2 right-2 text-white p-1 rounded text-xs flex items-center gap-1',
                    isLockedByOther ? 'bg-red-500' : 'bg-blue-500'
                  )}
                >
                  <Lock className="w-3 h-3" />
                  {isLockedByOther ? 'Locked' : 'By you'}
                </div>
              )}
            </div>

            {/* Enhanced Card Content with Better Hierarchy */}
            <div className="p-4">
              {/* Left-aligned Title and Metadata Stack */}
              <div className="space-y-2">
                {/* Title */}
                <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 leading-tight text-left">
                  {dashboard.title || dashboard.dashboard_title}
                </h3>

                {/* Modified Time - Left aligned below title */}
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>
                    Modified{' '}
                    {dashboard.updated_at
                      ? formatDistanceToNow(new Date(dashboard.updated_at), { addSuffix: true })
                      : 'unknown time ago'}
                  </span>
                </div>
              </div>

              {/* Status Badges with Better Visual Design */}
              {(isPersonalLanding || isOrgDefault || isLocked) && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {isPersonalLanding && (
                    <Badge
                      variant="default"
                      className="text-xs bg-blue-500 text-white border-blue-600 font-medium px-2 py-1"
                    >
                      <Star className="w-3 h-3 mr-1 fill-current" />
                      My Landing Page
                    </Badge>
                  )}

                  {isOrgDefault && (
                    <Badge
                      variant="outline"
                      className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300 font-medium px-2 py-1"
                    >
                      <Settings className="w-3 h-3 mr-1" />
                      Organization Default
                    </Badge>
                  )}

                  {isLocked && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs font-medium px-2 py-1',
                        isLockedByOther
                          ? 'bg-red-50 text-red-700 border-red-300'
                          : 'bg-blue-50 text-blue-700 border-blue-300'
                      )}
                    >
                      <Lock className="w-3 h-3 mr-1" />
                      {isLockedByOther ? 'Locked' : 'By you'}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </Link>
      </Card>
    );
  };

  const renderDashboardList = (dashboard: any) => {
    // COMMENTED OUT: Dashboard type checking - not needed anymore
    // const isNative = dashboard.dashboard_type === 'native';
    const isLocked = dashboard.is_locked;
    const isLockedByOther =
      isLocked && dashboard.locked_by && dashboard.locked_by !== currentUser?.email;

    const isPersonalLanding = currentUser?.landing_dashboard_id === dashboard.id;
    const canManageOrgDefault = hasPermission('can_manage_org_default_dashboard');
    const isOrgDefault = currentUser?.org_default_dashboard_id === dashboard.id;
    // By default, all dashboards go to view mode first
    const getNavigationUrl = () => {
      return hasPermission('can_view_dashboards') ? `/dashboards/${dashboard.id}` : '#';
    };

    return (
      <Card
        key={dashboard.id}
        className="transition-all duration-200 hover:shadow-sm hover:bg-[#0066FF]/3"
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {/* Clickable main content */}
            <Link
              href={getNavigationUrl()}
              className={cn(
                'flex items-center gap-4 flex-1',
                hasPermission('can_view_dashboards') ? 'cursor-pointer' : 'cursor-default'
              )}
            >
              <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                <DashboardThumbnail
                  dashboardId={dashboard.id}
                  thumbnailUrl={dashboard.thumbnail_url}
                  alt={dashboard.title || dashboard.dashboard_title || 'Dashboard'}
                  className="w-full h-full object-cover"
                  fallbackClassName="bg-gradient-to-br from-gray-100 to-gray-200"
                  fallbackIconSize="sm"
                  dashboardType={dashboard.dashboard_type}
                  isPublished={dashboard.is_published}
                  useClientSideRendering={false}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium truncate">
                    {dashboard.title || dashboard.dashboard_title}
                  </h3>
                  {/* COMMENTED OUT: Type badge - not needed anymore */}
                  {/* <Badge variant={isNative ? 'default' : 'secondary'} className="text-xs">
                    {isNative ? 'Native' : 'Superset'}
                  </Badge> */}

                  {/* Landing page badges in list view */}
                  {isPersonalLanding && (
                    <Badge
                      variant="default"
                      className="text-xs bg-blue-500 text-white border-blue-600 font-semibold"
                    >
                      <Star className="w-3 h-3 mr-1 fill-current" />
                      My Landing Page
                    </Badge>
                  )}

                  {isOrgDefault && (
                    <Badge
                      variant="outline"
                      className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold"
                    >
                      <Settings className="w-3 h-3 mr-1" />
                      Organization Default
                    </Badge>
                  )}

                  {isLocked && (
                    <Lock
                      className={cn('w-4 h-4', isLockedByOther ? 'text-red-500' : 'text-blue-500')}
                    />
                  )}
                </div>

                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center">
                          <User className="w-3 h-3 text-gray-600" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-gray-900 text-white border-gray-700">
                        <p className="text-sm">
                          {dashboard.created_by || dashboard.changed_by_name || 'Unknown'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="flex items-center gap-1" title="Last Updated">
                    <Clock className="w-3 h-3" />
                    Modified{' '}
                    {dashboard.updated_at
                      ? formatDistanceToNow(new Date(dashboard.updated_at), { addSuffix: true })
                      : 'unknown time ago'}
                  </span>
                  {/* COMMENTED OUT: Draft/Published status - not applicable for dashboards */}
                  {/* {dashboard.is_published ? (
                    <Badge variant="outline" className="text-xs">
                      Published
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Draft
                    </Badge>
                  )} */}
                </div>
              </div>

              {/* COMMENTED OUT: External link icon for Superset dashboards - not needed anymore */}
              {/* {!isNative && (
                <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
              )} */}
            </Link>

            {/* Action Buttons - Share and Edit as icon-only buttons */}
            <div className="flex items-center gap-2 ml-4">
              {hasPermission('can_share_dashboards') && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                  onClick={() => handleShareDashboard(dashboard)}
                >
                  <Share2 className="w-4 h-4 text-gray-700" />
                </Button>
              )}
              {hasPermission('can_edit_dashboards') && (
                <Link href={`/dashboards/${dashboard.id}/edit`}>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                  >
                    <Edit className="w-4 h-4 text-gray-700" />
                  </Button>
                </Link>
              )}

              {/* More actions menu for remaining actions */}
              {(hasPermission('can_create_dashboards') ||
                hasPermission('can_delete_dashboards') ||
                hasPermission('can_view_dashboards') ||
                canManageOrgDefault) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                    >
                      <MoreHorizontal className="w-3 h-3 text-gray-700" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {/* Landing page controls */}
                    {(hasPermission('can_view_dashboards') || canManageOrgDefault) && (
                      <>
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
                    {/* COMMENTED OUT: Download functionality - not needed */}
                    {/* {hasPermission('can_view_dashboards') && (
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
                    )} */}
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
              )}
            </div>
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
              className="pl-10 focus:border-[#0066FF] focus:ring-[#0066FF]"
            />
          </div>

          {/* COMMENTED OUT: Dashboard type filter dropdown - not needed anymore */}
          {/* <Select
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
          </Select> */}

          {/* COMMENTED OUT: Draft/publish filter dropdown - not applicable for dashboards */}
          {/* <Select
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
          </Select> */}

          <div id="dashboard-view-mode-wrapper" className="flex gap-1">
            <Button
              id="dashboard-grid-view-button"
              variant="outline"
              size="icon"
              onClick={() => setViewMode('grid')}
              className={cn('h-8 w-8 p-0 bg-transparent', viewMode === 'grid' ? 'text-white' : '')}
              style={viewMode === 'grid' ? { backgroundColor: '#06887b' } : {}}
            >
              <Grid id="dashboard-grid-icon" className="w-4 h-4" />
            </Button>
            <Button
              id="dashboard-list-view-button"
              variant="outline"
              size="icon"
              onClick={() => setViewMode('list')}
              className={cn('h-8 w-8 p-0 bg-transparent', viewMode === 'list' ? 'text-white' : '')}
              style={viewMode === 'list' ? { backgroundColor: '#06887b' } : {}}
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
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                  : 'space-y-2'
              )}
            >
              {[...Array(8)].map((_, i) => (
                <Card key={i} className="h-full overflow-hidden">
                  <div className="h-52 bg-gray-100 animate-pulse rounded-t-lg" />
                  <div className="p-4">
                    <div className="mb-3">
                      <Skeleton className="h-6 w-3/4 mb-1" />
                      <Skeleton className="h-6 w-1/2" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-6 w-20" />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : pinnedDashboards.length > 0 || paginatedRegularDashboards.length > 0 ? (
            <div className="py-6 space-y-8">
              {/* Pinned Dashboards Section */}
              {pinnedDashboards.length > 0 && (
                <div>
                  <div
                    className={cn(
                      viewMode === 'grid'
                        ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                        : 'space-y-2'
                    )}
                  >
                    {pinnedDashboards.map((dashboard) =>
                      viewMode === 'grid'
                        ? renderDashboardCard(dashboard)
                        : renderDashboardList(dashboard)
                    )}
                  </div>
                </div>
              )}

              {/* Regular Dashboards Section */}
              {paginatedRegularDashboards.length > 0 && (
                <div>
                  <div
                    className={cn(
                      viewMode === 'grid'
                        ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                        : 'space-y-2'
                    )}
                  >
                    {paginatedRegularDashboards.map((dashboard) =>
                      viewMode === 'grid'
                        ? renderDashboardCard(dashboard)
                        : renderDashboardList(dashboard)
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              id="dashboard-empty-state"
              className="flex flex-col items-center justify-center h-full gap-4"
            >
              <Layout id="dashboard-empty-icon" className="w-12 h-12 text-muted-foreground" />
              <p id="dashboard-empty-text" className="text-muted-foreground">
                {searchQuery
                  ? // COMMENTED OUT: Filter-based checks - not needed anymore
                    // || dashboardType !== 'all' || publishFilter !== 'all'
                    'No dashboards found'
                  : 'No dashboards yet'}
              </p>
              {hasPermission('can_create_dashboards') && (
                <Link id="dashboard-empty-create-link" href="/dashboards/create">
                  <Button
                    id="dashboard-empty-create-button"
                    variant="ghost"
                    className="text-white hover:opacity-90 shadow-xs"
                    style={{ backgroundColor: '#0066FF' }}
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

      {/* Lightweight Modern Pagination */}
      {regularDashboards.length > pageSize && (
        <div
          id="dashboard-pagination-footer"
          className="flex-shrink-0 border-t border-gray-100 bg-gray-50/30 py-3 px-6"
        >
          <div id="dashboard-pagination-wrapper" className="flex items-center justify-between">
            {/* Left: Compact Item Count */}
            <div id="dashboard-pagination-info" className="text-sm text-gray-600">
              {startIndex + 1}–{Math.min(startIndex + pageSize, regularDashboards.length)} of{' '}
              {regularDashboards.length}
            </div>

            {/* Right: Streamlined Controls */}
            <div id="dashboard-pagination-controls" className="flex items-center gap-4">
              {/* Compact Page Size Selector */}
              <div id="dashboard-page-size-wrapper" className="flex items-center gap-2">
                <span id="dashboard-page-size-label" className="text-sm text-gray-500">
                  Show
                </span>
                <Select
                  id="dashboard-page-size-select"
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(parseInt(value));
                    setCurrentPage(1); // Reset to first page when page size changes
                  }}
                >
                  <SelectTrigger
                    id="dashboard-page-size-trigger"
                    className="w-16 h-7 text-sm border-gray-200 bg-white"
                  >
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

              {/* Simplified Navigation */}
              <div className="flex items-center gap-1">
                <Button
                  id="dashboard-prev-page-button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="h-7 px-2 hover:bg-gray-100 disabled:opacity-50"
                >
                  <ChevronLeft id="dashboard-prev-icon" className="h-4 w-4" />
                </Button>

                <span id="dashboard-page-info" className="text-sm text-gray-600 px-3 py-1">
                  {currentPage} of {totalPages}
                </span>

                <Button
                  id="dashboard-next-page-button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="h-7 px-2 hover:bg-gray-100 disabled:opacity-50"
                >
                  <ChevronRight id="dashboard-next-icon" className="h-4 w-4" />
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
