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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
// import {
//   Command,
//   CommandEmpty,
//   CommandGroup,
//   CommandInput,
//   CommandItem,
//   CommandList,
// } from '@/components/ui/command';
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
  ChevronUp,
  ChevronDown as ChevronDownSort,
  ArrowUpDown,
  Filter,
  X,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { useDashboards, deleteDashboard, duplicateDashboard } from '@/hooks/api/useDashboards';
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
  // COMMENTED OUT: Global search - replaced with column-specific filters
  // const [searchQuery, setSearchQuery] = useState('');
  // const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  // COMMENTED OUT: Dashboard type filtering (Native/Superset) - not needed anymore
  // const [dashboardType, setDashboardType] = useState<'all' | 'native' | 'superset'>('all');
  // COMMENTED OUT: Draft/publish filtering - not applicable for dashboards
  // const [publishFilter, setPublishFilter] = useState<'all' | 'published' | 'draft'>('all');
  // View mode is now fixed to 'table' - grid and list views are hidden
  const viewMode = 'table';
  const [sortBy, setSortBy] = useState<'name' | 'updated_at' | 'created_by'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  // Column filter states
  const [nameFilters, setNameFilters] = useState({
    text: '',
    showFavorites: false,
    showLocked: false,
    showShared: false,
  });
  const [ownerFilters, setOwnerFilters] = useState<string[]>([]);
  const [dateFilters, setDateFilters] = useState({
    range: 'all' as 'all' | 'today' | 'week' | 'month' | 'custom',
    customStart: null as Date | null,
    customEnd: null as Date | null,
  });

  // Filter dropdown states
  const [openFilters, setOpenFilters] = useState({
    name: false,
    owner: false,
    date: false,
  });

  // Owner search state
  const [ownerSearch, setOwnerSearch] = useState('');
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

  // COMMENTED OUT: Global search functionality - replaced with column filters
  // const debouncedSearch = useMemo(
  //   () =>
  //     debounce((value: string) => {
  //       setDebouncedSearchQuery(value);
  //     }, 500),
  //   []
  // );

  // const handleSearchChange = useCallback(
  //   (e: React.ChangeEvent<HTMLInputElement>) => {
  //     const value = e.target.value;
  //     setSearchQuery(value);
  //     setCurrentPage(1); // Reset to first page when searching
  //     debouncedSearch(value);
  //   },
  //   [debouncedSearch]
  // );

  // Build params for API call - removed search param
  const params = {
    // COMMENTED OUT: Global search - using column filters instead
    // search: debouncedSearchQuery,
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

  // If API doesn't support pagination, implement client-side pagination and sorting
  const dashboards = allDashboards || [];

  // Handle sorting
  const handleSort = (column: 'name' | 'updated_at' | 'created_by') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Apply filters and sort dashboards with memoization for performance
  const filteredAndSortedDashboards = useMemo(() => {
    // Apply column filters
    const filtered = dashboards.filter((dashboard) => {
      // Name filters
      if (nameFilters.text) {
        const title = (dashboard.title || dashboard.dashboard_title || '').toLowerCase();
        if (!title.includes(nameFilters.text.toLowerCase())) {
          return false;
        }
      }

      if (nameFilters.showFavorites && !favorites.has(dashboard.id)) {
        return false;
      }

      if (nameFilters.showLocked && !dashboard.is_locked) {
        return false;
      }

      if (nameFilters.showShared && !dashboard.is_public) {
        return false;
      }

      // Owner filters
      if (ownerFilters.length > 0) {
        const owner = dashboard.created_by || dashboard.changed_by_name || 'Unknown';
        if (!ownerFilters.includes(owner)) {
          return false;
        }
      }

      // Date filters
      if (dateFilters.range !== 'all' && dashboard.updated_at) {
        const updatedDate = new Date(dashboard.updated_at);
        const now = new Date();

        switch (dateFilters.range) {
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
            if (dateFilters.customStart && updatedDate < dateFilters.customStart) return false;
            if (dateFilters.customEnd && updatedDate > dateFilters.customEnd) return false;
            break;
          }
        }
      }

      return true;
    });

    // Sort the filtered results
    return [...filtered].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case 'name':
          aValue = (a.title || a.dashboard_title || '').toLowerCase();
          bValue = (b.title || b.dashboard_title || '').toLowerCase();
          break;
        case 'updated_at':
          aValue = new Date(a.updated_at || 0).getTime();
          bValue = new Date(b.updated_at || 0).getTime();
          break;
        case 'created_by':
          aValue = (a.created_by || '').toLowerCase();
          bValue = (b.created_by || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [dashboards, nameFilters, ownerFilters, dateFilters, favorites, sortBy, sortOrder]);

  // Handle favorites toggle
  const handleToggleFavorite = (dashboardId: number) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(dashboardId)) {
        newFavorites.delete(dashboardId);
      } else {
        newFavorites.add(dashboardId);
      }
      return newFavorites;
    });
  };

  // Get unique owners for filter options
  const uniqueOwners = useMemo(() => {
    const owners = new Set<string>();
    dashboards.forEach((dashboard) => {
      const owner = dashboard.created_by || dashboard.changed_by_name || 'Unknown';
      if (owner && owner !== 'Unknown') {
        owners.add(owner);
      }
    });
    return Array.from(owners).sort();
  }, [dashboards]);

  // This filtering logic is now integrated into the useMemo above

  // Get active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    if (
      nameFilters.text ||
      nameFilters.showFavorites ||
      nameFilters.showLocked ||
      nameFilters.showShared
    )
      count++;
    if (ownerFilters.length > 0) count++;
    if (dateFilters.range !== 'all') count++;
    return count;
  };

  // Clear all filters
  const clearAllFilters = () => {
    setNameFilters({ text: '', showFavorites: false, showLocked: false, showShared: false });
    setOwnerFilters([]);
    setDateFilters({ range: 'all', customStart: null, customEnd: null });
  };

  // Separate pinned dashboards (org default and personal landing page)
  const pinnedDashboards = filteredAndSortedDashboards.filter((dashboard) => {
    const isPersonalLanding = currentUser?.landing_dashboard_id === dashboard.id;
    const isOrgDefault = currentUser?.org_default_dashboard_id === dashboard.id;
    return isPersonalLanding || isOrgDefault;
  });

  // Regular dashboards excluding pinned ones
  const regularDashboards = filteredAndSortedDashboards.filter((dashboard) => {
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
      // The landing page hook already mutates '/api/currentuserv2'
      // Also mutate '/api/currentuserv2' to refresh our local data
      await swrMutate('/api/currentuserv2');
      mutate(); // Refresh the dashboard list to update indicators
    },
    [setPersonalLanding, mutate]
  );

  const handleRemovePersonalLanding = useCallback(async () => {
    await removePersonalLanding();
    // The landing page hook already mutates '/api/currentuserv2'
    // Also mutate '/api/currentuserv2' to refresh our local data
    await swrMutate('/api/currentuserv2');
    mutate(); // Refresh the dashboard list to update indicators
  }, [removePersonalLanding, mutate]);

  const handleSetOrgDefault = useCallback(
    async (dashboardId: number) => {
      await setOrgDefault(dashboardId);
      // The landing page hook already mutates '/api/currentuserv2'
      // Also mutate '/api/currentuserv2' to refresh our local data
      await swrMutate('/api/currentuserv2');
      mutate(); // Refresh the dashboard list to update indicators
    },
    [setOrgDefault, mutate]
  );

  // Render sort icon for table headers
  const renderSortIcon = (column: 'name' | 'updated_at' | 'created_by') => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-4 h-4 text-slate-400" />;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4 text-white" />
    ) : (
      <ChevronDownSort className="w-4 h-4 text-white" />
    );
  };

  // Check if column has active filters
  const hasActiveFilter = (column: 'name' | 'owner' | 'date') => {
    switch (column) {
      case 'name':
        return (
          nameFilters.text ||
          nameFilters.showFavorites ||
          nameFilters.showLocked ||
          nameFilters.showShared
        );
      case 'owner':
        return ownerFilters.length > 0;
      case 'date':
        return dateFilters.range !== 'all';
      default:
        return false;
    }
  };

  // Render filter icon for table headers
  const renderFilterIcon = (column: 'name' | 'owner' | 'date') => {
    const isActive = hasActiveFilter(column);
    return (
      <div className="relative">
        <Filter
          className={cn(
            'w-4 h-4 transition-colors',
            isActive ? 'text-indigo-300' : 'text-slate-400 hover:text-slate-200'
          )}
        />
        {isActive && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-400 rounded-full" />
        )}
      </div>
    );
  };

  // Render Name column filter
  const renderNameFilter = () => (
    <PopoverContent className="w-80" align="start">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">Filter by Name</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setNameFilters({
                text: '',
                showFavorites: false,
                showLocked: false,
                showShared: false,
              })
            }
            className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </Button>
        </div>

        <div className="space-y-2">
          <Input
            placeholder="Search dashboard names..."
            value={nameFilters.text}
            onChange={(e) => setNameFilters((prev) => ({ ...prev, text: e.target.value }))}
            className="h-8"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="favorites"
              checked={nameFilters.showFavorites}
              onCheckedChange={(checked) =>
                setNameFilters((prev) => ({ ...prev, showFavorites: checked as boolean }))
              }
            />
            <Label htmlFor="favorites" className="text-sm cursor-pointer">
              Show only favorites
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="locked"
              checked={nameFilters.showLocked}
              onCheckedChange={(checked) =>
                setNameFilters((prev) => ({ ...prev, showLocked: checked as boolean }))
              }
            />
            <Label htmlFor="locked" className="text-sm cursor-pointer">
              Show only locked
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="shared"
              checked={nameFilters.showShared}
              onCheckedChange={(checked) =>
                setNameFilters((prev) => ({ ...prev, showShared: checked as boolean }))
              }
            />
            <Label htmlFor="shared" className="text-sm cursor-pointer">
              Show only shared
            </Label>
          </div>
        </div>
      </div>
    </PopoverContent>
  );

  // Filter owners based on search with memoization
  const filteredOwners = useMemo(() => {
    return uniqueOwners.filter((owner) => owner.toLowerCase().includes(ownerSearch.toLowerCase()));
  }, [uniqueOwners, ownerSearch]);

  // Render Owner column filter
  const renderOwnerFilter = () => {
    return (
      <PopoverContent className="w-64" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Filter by Owner</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOwnerFilters([])}
              className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </Button>
          </div>

          <div className="space-y-2">
            <Input
              placeholder="Search owners..."
              value={ownerSearch}
              onChange={(e) => setOwnerSearch(e.target.value)}
              className="h-8"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2">
            {filteredOwners.length > 0 ? (
              filteredOwners.map((owner) => (
                <div
                  key={owner}
                  className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                  onClick={() => {
                    setOwnerFilters((prev) => {
                      if (prev.includes(owner)) {
                        return prev.filter((o) => o !== owner);
                      } else {
                        return [...prev, owner];
                      }
                    });
                  }}
                >
                  <Checkbox
                    checked={ownerFilters.includes(owner)}
                    onChange={() => {}} // Handled by parent onClick
                  />
                  <Label className="text-sm cursor-pointer flex-1 text-gray-900">{owner}</Label>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-2">No owners found</p>
            )}
          </div>
        </div>
      </PopoverContent>
    );
  };

  // Render Date column filter
  const renderDateFilter = () => (
    <PopoverContent className="w-72" align="start">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">Filter by Date Modified</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDateFilters({ range: 'all', customStart: null, customEnd: null })}
            className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </Button>
        </div>

        <div className="space-y-2">
          {[
            { value: 'all', label: 'All time' },
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'Last 7 days' },
            { value: 'month', label: 'Last 30 days' },
            { value: 'custom', label: 'Custom range' },
          ].map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <input
                type="radio"
                id={option.value}
                name="dateRange"
                checked={dateFilters.range === option.value}
                onChange={() => setDateFilters((prev) => ({ ...prev, range: option.value as any }))}
                className="w-4 h-4 text-teal-600"
              />
              <Label htmlFor={option.value} className="text-sm cursor-pointer">
                {option.label}
              </Label>
            </div>
          ))}
        </div>

        {dateFilters.range === 'custom' && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs text-gray-600">Custom Date Range</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={
                    dateFilters.customStart ? format(dateFilters.customStart, 'yyyy-MM-dd') : ''
                  }
                  onChange={(e) =>
                    setDateFilters((prev) => ({
                      ...prev,
                      customStart: e.target.value ? new Date(e.target.value + 'T00:00:00') : null,
                    }))
                  }
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={dateFilters.customEnd ? format(dateFilters.customEnd, 'yyyy-MM-dd') : ''}
                  onChange={(e) =>
                    setDateFilters((prev) => ({
                      ...prev,
                      customEnd: e.target.value ? new Date(e.target.value + 'T00:00:00') : null,
                    }))
                  }
                  className="h-8"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </PopoverContent>
  );

  // Render dashboard table row
  const renderDashboardTableRow = (dashboard: any) => {
    const isPersonalLanding = currentUser?.landing_dashboard_id === dashboard.id;
    const isOrgDefault = currentUser?.org_default_dashboard_id === dashboard.id;
    const canManageOrgDefault = hasPermission('can_manage_org_default_dashboard');
    const isLocked = dashboard.is_locked;
    const isLockedByOther =
      isLocked && dashboard.locked_by && dashboard.locked_by !== currentUser?.email;
    const isFavorited = favorites.has(dashboard.id);

    const getNavigationUrl = () => {
      return hasPermission('can_view_dashboards') ? `/dashboards/${dashboard.id}` : '#';
    };

    return (
      <TableRow
        key={dashboard.id}
        className="hover:bg-indigo-50/60 transition-colors duration-100 border-b border-slate-100"
      >
        {/* Name Column with Star */}
        <TableCell className="py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0 hover:bg-amber-50"
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
                href={getNavigationUrl()}
                className="font-semibold text-base text-slate-800 hover:text-indigo-600 hover:underline transition-colors"
              >
                {dashboard.title || dashboard.dashboard_title}
              </Link>
              {(isPersonalLanding || isOrgDefault || isLocked) && (
                <div className="flex items-center gap-2 mt-1">
                  {isPersonalLanding && (
                    <Badge
                      variant="default"
                      className="text-xs bg-indigo-100 text-indigo-700 border-indigo-200 font-medium"
                    >
                      My Landing
                    </Badge>
                  )}
                  {isOrgDefault && (
                    <Badge
                      variant="outline"
                      className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300 font-medium"
                    >
                      Org Default
                    </Badge>
                  )}
                  {isLocked && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs font-medium',
                        isLockedByOther
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-sky-50 text-sky-700 border-sky-200'
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
        </TableCell>

        {/* Commenting Type Column as all dashboards are Native for now */}
        {/* <TableCell className="py-4">
          <Badge variant="secondary" className="text-xs">
            {dashboard.dashboard_type === 'native' ? 'Native' : 'Superset'}
          </Badge>
        </TableCell> */}

        {/* Owner Column */}
        <TableCell className="py-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center ring-1 ring-indigo-200">
              <User className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <span className="text-sm text-slate-600 font-medium">
              {dashboard.created_by || dashboard.changed_by_name || 'Unknown'}
            </span>
          </div>
        </TableCell>

        {/* Last Modified Column */}
        <TableCell className="py-4 text-sm text-slate-500">
          {dashboard.updated_at
            ? formatDistanceToNow(new Date(dashboard.updated_at), { addSuffix: true })
            : 'Unknown'}
        </TableCell>

        {/* Actions Column */}
        <TableCell className="py-4">
          <div className="flex items-center gap-1">
            {hasPermission('can_edit_dashboards') && (
              <Link href={`/dashboards/${dashboard.id}/edit`}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 p-0 hover:bg-indigo-50 hover:text-indigo-600"
                >
                  <Edit className="w-4 h-4 text-slate-500" />
                </Button>
              </Link>
            )}
            {hasPermission('can_share_dashboards') && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-0 hover:bg-indigo-50 hover:text-indigo-600"
                onClick={() => handleShareDashboard(dashboard)}
              >
                <Share2 className="w-4 h-4 text-slate-500" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 p-0 hover:bg-indigo-50">
                  <MoreHorizontal className="w-4 h-4 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {/* Landing page controls */}
                {(hasPermission('can_view_dashboards') || canManageOrgDefault) && (
                  <>
                    <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                      Landing Page
                    </div>
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
        </TableCell>
      </TableRow>
    );
  };

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
                    Updated by {dashboard.created_by || dashboard.changed_by_name || 'Unknown'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

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
            {/* Dashboard Icon Preview */}
            <div className="relative h-52 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden rounded-t-lg">
              <div className="flex items-center justify-center h-full p-6">
                <div className="rounded-xl flex items-center justify-center w-32 h-32 shadow-sm border border-white/50 bg-gray-200/60">
                  <LayoutDashboard className="w-20 h-20 text-gray-600" />
                </div>
              </div>

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
              <div className="w-16 h-16 bg-gray-200/60 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-200">
                <LayoutDashboard className="w-8 h-8 text-gray-600" />
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

            {/* Action Buttons - Edit and Share as icon-only buttons */}
            <div className="flex items-center gap-2 ml-4">
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
        <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-rose-500" />
        </div>
        <div className="text-center">
          <p className="text-slate-700 font-medium">Failed to load dashboards</p>
          <p className="text-slate-400 text-sm mt-1">Something went wrong. Please try again.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          className="border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-slate-600"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div id="dashboard-list-container" className="h-full flex flex-col">
      {/* Fixed Header */}
      <div
        id="dashboard-header"
        className="flex-shrink-0 bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 shadow-lg"
      >
        {/* Title Section */}
        <div id="dashboard-title-section" className="flex items-center justify-between mb-3">
          <div id="dashboard-title-wrapper">
            <h1 id="dashboard-page-title" className="text-3xl font-bold text-white tracking-tight">
              Dashboards
            </h1>
            <p id="dashboard-page-description" className="text-slate-400 mt-1 text-sm">
              Create and manage your dashboards
            </p>
          </div>

          {hasPermission('can_create_dashboards') && (
            <Link id="dashboard-create-link" href="/dashboards/create">
              <Button
                id="dashboard-create-button"
                className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold shadow-md border-0 transition-colors"
              >
                <Plus id="dashboard-create-icon" className="w-4 h-4 mr-2" />
                Create Dashboard
              </Button>
            </Link>
          )}
        </div>

        {/* Filter Summary - Only shows when filters are active to save space */}
        {getActiveFilterCount() > 0 && (
          <div id="dashboard-filters-section" className="flex items-center gap-2 mt-2">
            <span className="text-sm text-slate-300">
              {getActiveFilterCount()} filter{getActiveFilterCount() > 1 ? 's' : ''} active
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 px-2 text-xs text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <X className="w-3 h-3 mr-1" />
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/* Scrollable Content - Only the dashboard list scrolls */}
      <div className="flex-1 overflow-hidden px-6 bg-slate-50/40">
        <div className="h-full overflow-y-auto">
          {isLoading ? (
            viewMode === 'table' ? (
              <div className="py-6">
                <div className="rounded-xl shadow-sm overflow-hidden border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-700 hover:bg-slate-700 border-0">
                        <TableHead className="w-[40%] border-0">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-20 bg-slate-500" />
                            <Skeleton className="h-4 w-4 bg-slate-500" />
                          </div>
                        </TableHead>
                        {/* Commenting Type column skeleton */}
                        {/* <TableHead className="w-[15%]">
                          <Skeleton className="h-4 w-16" />
                        </TableHead> */}
                        <TableHead className="w-[35%] border-0">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-16 bg-slate-500" />
                            <Skeleton className="h-4 w-4 bg-slate-500" />
                          </div>
                        </TableHead>
                        <TableHead className="w-[15%] border-0">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-20 bg-slate-500" />
                            <Skeleton className="h-4 w-4 bg-slate-500" />
                          </div>
                        </TableHead>
                        <TableHead className="w-[10%] border-0">
                          <Skeleton className="h-4 w-16 bg-slate-500" />
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...Array(8)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-3">
                              <Skeleton className="h-8 w-8 rounded" />
                              <div className="flex flex-col gap-1">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-20" />
                              </div>
                            </div>
                          </TableCell>
                          {/* Commenting Type column skeleton */}
                          {/* <TableCell><Skeleton className="h-6 w-16" /></TableCell> */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Skeleton className="h-6 w-6 rounded-full" />
                              <Skeleton className="h-4 w-20" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Skeleton className="h-8 w-8" />
                              <Skeleton className="h-8 w-8" />
                              <Skeleton className="h-8 w-8" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
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
            )
          ) : pinnedDashboards.length > 0 || paginatedRegularDashboards.length > 0 ? (
            viewMode === 'table' ? (
              <div className="py-6">
                <div className="rounded-xl shadow-sm overflow-hidden border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-700 hover:bg-slate-700 border-0">
                        <TableHead className="w-[40%] border-0">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              className="h-auto p-0 font-semibold text-sm hover:bg-transparent flex-1 text-white hover:text-slate-200"
                              onClick={() => handleSort('name')}
                            >
                              <div className="flex items-center gap-2">
                                Name
                                {renderSortIcon('name')}
                              </div>
                            </Button>
                            <Popover
                              open={openFilters.name}
                              onOpenChange={(open) =>
                                setOpenFilters((prev) => ({ ...prev, name: open }))
                              }
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 p-0 hover:bg-slate-600"
                                >
                                  {renderFilterIcon('name')}
                                </Button>
                              </PopoverTrigger>
                              {renderNameFilter()}
                            </Popover>
                          </div>
                        </TableHead>
                        {/* Commenting Type column as all dashboards are Native for now */}
                        {/* <TableHead className="w-[15%] font-medium">Type</TableHead> */}
                        <TableHead className="w-[35%] border-0">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              className="h-auto p-0 font-semibold text-sm hover:bg-transparent flex-1 text-white hover:text-slate-200"
                              onClick={() => handleSort('created_by')}
                            >
                              <div className="flex items-center gap-2">
                                Owner
                                {renderSortIcon('created_by')}
                              </div>
                            </Button>
                            <Popover
                              open={openFilters.owner}
                              onOpenChange={(open) =>
                                setOpenFilters((prev) => ({ ...prev, owner: open }))
                              }
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 p-0 hover:bg-slate-600"
                                >
                                  {renderFilterIcon('owner')}
                                </Button>
                              </PopoverTrigger>
                              {renderOwnerFilter()}
                            </Popover>
                          </div>
                        </TableHead>
                        <TableHead className="w-[15%] border-0">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              className="h-auto p-0 font-semibold text-sm hover:bg-transparent flex-1 text-white hover:text-slate-200"
                              onClick={() => handleSort('updated_at')}
                            >
                              <div className="flex items-center gap-2">
                                Last Modified
                                {renderSortIcon('updated_at')}
                              </div>
                            </Button>
                            <Popover
                              open={openFilters.date}
                              onOpenChange={(open) =>
                                setOpenFilters((prev) => ({ ...prev, date: open }))
                              }
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 p-0 hover:bg-slate-600"
                                >
                                  {renderFilterIcon('date')}
                                </Button>
                              </PopoverTrigger>
                              {renderDateFilter()}
                            </Popover>
                          </div>
                        </TableHead>
                        <TableHead className="w-[10%] font-semibold text-sm text-white border-0">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pinnedDashboards.map((dashboard) => renderDashboardTableRow(dashboard))}
                      {paginatedRegularDashboards.map((dashboard) =>
                        renderDashboardTableRow(dashboard)
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
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
            )
          ) : (
            <div
              id="dashboard-empty-state"
              className="flex flex-col items-center justify-center h-full gap-5"
            >
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
                <Layout id="dashboard-empty-icon" className="w-8 h-8 text-slate-400" />
              </div>
              <div className="text-center">
                <p id="dashboard-empty-text" className="text-slate-600 font-medium text-lg">
                  {getActiveFilterCount() > 0 ? 'No dashboards found' : 'No dashboards yet'}
                </p>
                <p className="text-slate-400 text-sm mt-1">
                  {getActiveFilterCount() > 0
                    ? 'Try adjusting your filters'
                    : 'Create your first dashboard to get started'}
                </p>
              </div>
              {hasPermission('can_create_dashboards') && (
                <Link id="dashboard-empty-create-link" href="/dashboards/create">
                  <Button
                    id="dashboard-empty-create-button"
                    className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold shadow-md border-0 transition-colors"
                  >
                    <Plus id="dashboard-empty-create-icon" className="w-4 h-4 mr-2" />
                    Create Your First Dashboard
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      <div
        id="dashboard-pagination-footer"
        className="flex-shrink-0 border-t border-slate-200 bg-slate-50 py-3 px-6"
      >
        <div id="dashboard-pagination-wrapper" className="flex items-center justify-between">
          {/* Left: Item Count */}
          <div id="dashboard-pagination-info" className="text-sm text-slate-500 font-medium">
            {total === 0
              ? 'No results'
              : `${startIndex + 1}–${Math.min(startIndex + pageSize, total)} of ${total} dashboards`}
          </div>

          {/* Right: Controls */}
          <div id="dashboard-pagination-controls" className="flex items-center gap-4">
            {/* Page Size Selector */}
            <div id="dashboard-page-size-wrapper" className="flex items-center gap-2">
              <span id="dashboard-page-size-label" className="text-sm text-slate-400">
                Rows per page
              </span>
              <Select
                id="dashboard-page-size-select"
                value={pageSize.toString()}
                onValueChange={(value) => {
                  setPageSize(parseInt(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger
                  id="dashboard-page-size-trigger"
                  className="h-7 text-sm border-slate-200 bg-white text-slate-600"
                  style={{ width: '70px' }}
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

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <Button
                id="dashboard-prev-page-button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-7 w-7 p-0 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 disabled:opacity-40"
              >
                <ChevronLeft id="dashboard-prev-icon" className="h-4 w-4 text-slate-600" />
              </Button>

              <span
                id="dashboard-page-info"
                className="text-sm text-slate-600 px-3 py-1 font-medium"
              >
                {currentPage} / {totalPages}
              </span>

              <Button
                id="dashboard-next-page-button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="h-7 w-7 p-0 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 disabled:opacity-40"
              >
                <ChevronRight id="dashboard-next-icon" className="h-4 w-4 text-slate-600" />
              </Button>
            </div>
          </div>
        </div>
      </div>

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
