'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  FileText,
  Filter,
  MoreHorizontal,
  Plus,
  Trash2,
  User,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ChevronUp,
  ChevronDown as ChevronDownSort,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toastSuccess, toastError } from '@/lib/toast';
import { useSnapshots, deleteSnapshot } from '@/hooks/api/useReports';
import type { ReportSnapshot } from '@/types/reports';
import { CreateSnapshotDialog } from '@/components/reports/create-snapshot-dialog';
import { formatCreatedOn } from '@/components/reports/utils';
import { ReportShareMenu } from '@/components/reports/report-share-menu';
import { useUserPermissions } from '@/hooks/api/usePermissions';

// Debounce delay in ms before sending filter to API
const FILTER_DEBOUNCE_MS = 400;
// Default number of items per page
const DEFAULT_PAGE_SIZE = 10;

type FilterColumn = 'title' | 'dashboard' | 'createdBy';
type SortColumn = 'title' | 'dashboard_title' | 'created_by' | 'created_at';

export default function ReportsPage() {
  const router = useRouter();
  const { confirm, DialogComponent: DeleteDialog } = useConfirmationDialog();
  const { hasPermission } = useUserPermissions();
  const canCreate = hasPermission('can_create_dashboards');
  const canDelete = hasPermission('can_delete_dashboards');

  // Filter input states (what the user types)
  const [titleFilter, setTitleFilter] = useState('');
  const [dashboardFilter, setDashboardFilter] = useState('');
  const [createdByFilter, setCreatedByFilter] = useState('');

  // Debounced filter values (what gets sent to the API)
  const [debouncedTitle, setDebouncedTitle] = useState('');
  const [debouncedDashboard, setDebouncedDashboard] = useState('');
  const [debouncedCreatedBy, setDebouncedCreatedBy] = useState('');

  // Sorting state
  const [sortBy, setSortBy] = useState<SortColumn>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Debounce filter inputs
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedTitle(titleFilter);
      setDebouncedDashboard(dashboardFilter);
      setDebouncedCreatedBy(createdByFilter);
      setCurrentPage(1);
    }, FILTER_DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [titleFilter, dashboardFilter, createdByFilter]);

  // Build filter params — only include non-empty values
  const filterParams =
    debouncedTitle || debouncedDashboard || debouncedCreatedBy
      ? {
          search: debouncedTitle || undefined,
          dashboard_title: debouncedDashboard || undefined,
          created_by: debouncedCreatedBy || undefined,
        }
      : undefined;

  const { snapshots, isLoading, mutate } = useSnapshots(filterParams);

  // Filter popover open states
  const [openFilters, setOpenFilters] = useState({
    title: false,
    dashboard: false,
    createdBy: false,
  });

  const hasAnyFilter = titleFilter !== '' || dashboardFilter !== '' || createdByFilter !== '';

  const getActiveFilterCount = useCallback(() => {
    let count = 0;
    if (titleFilter) count++;
    if (dashboardFilter) count++;
    if (createdByFilter) count++;
    return count;
  }, [titleFilter, dashboardFilter, createdByFilter]);

  const clearAllFilters = useCallback(() => {
    setTitleFilter('');
    setDashboardFilter('');
    setCreatedByFilter('');
  }, []);

  const hasActiveFilter = (column: FilterColumn) => {
    switch (column) {
      case 'title':
        return titleFilter !== '';
      case 'dashboard':
        return dashboardFilter !== '';
      case 'createdBy':
        return createdByFilter !== '';
      default:
        return false;
    }
  };

  // Sorting
  const handleSort = useCallback(
    (column: SortColumn) => {
      if (sortBy === column) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortBy(column);
        setSortOrder('desc');
      }
    },
    [sortBy, sortOrder]
  );

  const renderSortIcon = (column: SortColumn) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4 text-gray-600" />
    ) : (
      <ChevronDownSort className="w-4 h-4 text-gray-600" />
    );
  };

  const renderFilterIcon = (column: FilterColumn) => {
    const isActive = hasActiveFilter(column);
    return (
      <div className="relative">
        <Filter
          className={cn(
            'w-4 h-4 transition-colors',
            isActive ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'
          )}
        />
        {isActive && <div className="absolute -top-1 -right-1 w-2 h-2 bg-teal-600 rounded-full" />}
      </div>
    );
  };

  // Sort and paginate snapshots client-side
  const sortedSnapshots = useMemo(() => {
    return [...snapshots].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case 'title':
          aValue = (a.title || '').toLowerCase();
          bValue = (b.title || '').toLowerCase();
          break;
        case 'dashboard_title':
          aValue = (a.dashboard_title || '').toLowerCase();
          bValue = (b.dashboard_title || '').toLowerCase();
          break;
        case 'created_at':
          aValue = new Date(a.created_at || 0).getTime();
          bValue = new Date(b.created_at || 0).getTime();
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
  }, [snapshots, sortBy, sortOrder]);

  // Pagination calculations
  const total = sortedSnapshots.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedSnapshots = sortedSnapshots.slice(startIndex, startIndex + pageSize);

  const handleDelete = useCallback(
    async (snapshot: ReportSnapshot) => {
      const confirmed = await confirm({
        title: 'Delete report?',
        description: `This will permanently delete "${snapshot.title}". This action cannot be undone.`,
        confirmText: 'Delete',
        type: 'warning',
      });
      if (!confirmed) return;
      try {
        await deleteSnapshot(snapshot.id);
        mutate();
        toastSuccess.deleted('Report');
      } catch (error) {
        toastError.delete(error, 'report');
      }
    },
    [mutate, confirm]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        {/* Title Section */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-3xl font-bold">Reports</h1>
            <p className="text-muted-foreground mt-1">Create And Manage Your Reports</p>
          </div>
          {canCreate && (
            <CreateSnapshotDialog
              onCreated={() => mutate()}
              trigger={
                <Button
                  data-testid="create-report-btn"
                  variant="ghost"
                  className="text-white hover:opacity-90 shadow-xs"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  <Plus className="h-4 w-4 mr-2" /> CREATE REPORT
                </Button>
              }
            />
          )}
        </div>

        {/* Filter Summary */}
        {getActiveFilterCount() > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-gray-600">
              {getActiveFilterCount()} filter{getActiveFilterCount() > 1 ? 's' : ''} active
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 px-2 text-xs text-gray-500 hover:text-gray-700"
            >
              <X className="w-3 h-3 mr-1" />
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-hidden px-6">
        <div className="h-full overflow-y-auto">
          {isLoading && !hasAnyFilter ? (
            <div className="py-6">
              <div className="border rounded-lg bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-[25%]">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead className="w-[30%]">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead className="w-[20%]">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead className="w-[15%]">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead className="w-[10%]">
                        <Skeleton className="h-4 w-16" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(8)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="py-4">
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell className="py-4">
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-6 w-6 rounded-full" />
                            <Skeleton className="h-4 w-20" />
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell className="py-4">
                          <Skeleton className="h-8 w-8" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : snapshots.length === 0 && !hasAnyFilter ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No reports yet</p>
              {canCreate && (
                <CreateSnapshotDialog
                  onCreated={() => mutate()}
                  trigger={
                    <Button
                      data-testid="create-first-report-btn"
                      variant="ghost"
                      className="text-white hover:opacity-90 shadow-xs"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      <Plus className="h-4 w-4 mr-2" /> CREATE YOUR FIRST REPORT
                    </Button>
                  }
                />
              )}
            </div>
          ) : (
            <div className="py-6">
              <div className="border rounded-lg bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      {/* Title column with sort + filter */}
                      <TableHead className="w-[25%]">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            className="h-auto p-0 font-medium text-base hover:bg-transparent flex-1"
                            onClick={() => handleSort('title')}
                          >
                            <div className="flex items-center gap-2">
                              Title
                              {renderSortIcon('title')}
                            </div>
                          </Button>
                          <Popover
                            open={openFilters.title}
                            onOpenChange={(open) =>
                              setOpenFilters((prev) => ({ ...prev, title: open }))
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 p-0 hover:bg-gray-100"
                              >
                                {renderFilterIcon('title')}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72" align="start">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium text-sm">Filter by Title</h4>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setTitleFilter('')}
                                    className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
                                  >
                                    Clear
                                  </Button>
                                </div>
                                <Input
                                  data-testid="report-filter-title"
                                  placeholder="Search report titles..."
                                  value={titleFilter}
                                  onChange={(e) => setTitleFilter(e.target.value)}
                                  className="h-8"
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </TableHead>

                      {/* Dashboard Used column with sort + filter */}
                      <TableHead className="w-[30%]">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            className="h-auto p-0 font-medium text-base hover:bg-transparent flex-1"
                            onClick={() => handleSort('dashboard_title')}
                          >
                            <div className="flex items-center gap-2">
                              Dashboard Used
                              {renderSortIcon('dashboard_title')}
                            </div>
                          </Button>
                          <Popover
                            open={openFilters.dashboard}
                            onOpenChange={(open) =>
                              setOpenFilters((prev) => ({ ...prev, dashboard: open }))
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 p-0 hover:bg-gray-100"
                              >
                                {renderFilterIcon('dashboard')}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72" align="start">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium text-sm">Filter by Dashboard</h4>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDashboardFilter('')}
                                    className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
                                  >
                                    Clear
                                  </Button>
                                </div>
                                <Input
                                  data-testid="report-filter-dashboard"
                                  placeholder="Search dashboard names..."
                                  value={dashboardFilter}
                                  onChange={(e) => setDashboardFilter(e.target.value)}
                                  className="h-8"
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </TableHead>

                      {/* Created by column with sort + filter */}
                      <TableHead className="w-[20%]">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            className="h-auto p-0 font-medium text-base hover:bg-transparent flex-1"
                            onClick={() => handleSort('created_by')}
                          >
                            <div className="flex items-center gap-2">
                              Created by
                              {renderSortIcon('created_by')}
                            </div>
                          </Button>
                          <Popover
                            open={openFilters.createdBy}
                            onOpenChange={(open) =>
                              setOpenFilters((prev) => ({ ...prev, createdBy: open }))
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 p-0 hover:bg-gray-100"
                              >
                                {renderFilterIcon('createdBy')}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72" align="start">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium text-sm">Filter by Creator</h4>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCreatedByFilter('')}
                                    className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
                                  >
                                    Clear
                                  </Button>
                                </div>
                                <Input
                                  data-testid="report-filter-creator"
                                  placeholder="Search by email..."
                                  value={createdByFilter}
                                  onChange={(e) => setCreatedByFilter(e.target.value)}
                                  className="h-8"
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </TableHead>

                      {/* Created on column with sort */}
                      <TableHead className="w-[15%]">
                        <Button
                          variant="ghost"
                          className="h-auto p-0 font-medium text-base hover:bg-transparent"
                          onClick={() => handleSort('created_at')}
                        >
                          <div className="flex items-center gap-2">
                            Created on
                            {renderSortIcon('created_at')}
                          </div>
                        </Button>
                      </TableHead>

                      <TableHead className="w-[10%] font-medium text-base">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSnapshots.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="px-6 py-8 text-center text-sm text-muted-foreground"
                        >
                          No reports match the current filters
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedSnapshots.map((snapshot: ReportSnapshot) => (
                        <TableRow
                          key={snapshot.id}
                          data-testid={`report-row-${snapshot.id}`}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => router.push(`/reports/${snapshot.id}`)}
                        >
                          <TableCell className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 shrink-0" />
                              <span className="font-medium text-lg text-gray-900">
                                {snapshot.title}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 text-base text-gray-700">
                            {snapshot.dashboard_title || '—'}
                          </TableCell>
                          <TableCell className="py-4">
                            {snapshot.created_by && (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                                  <User className="w-3 h-3 text-gray-600" />
                                </div>
                                <span className="text-base text-gray-700">
                                  {snapshot.created_by}
                                </span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-4 text-base text-gray-600">
                            {formatCreatedOn(snapshot.created_at)}
                          </TableCell>
                          <TableCell className="py-4">
                            <div
                              className="flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {hasPermission('can_share_dashboards') && (
                                <ReportShareMenu snapshotId={snapshot.id} />
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    data-testid={`report-actions-${snapshot.id}`}
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 p-0 hover:bg-gray-100"
                                    aria-label="Report actions"
                                  >
                                    <MoreHorizontal className="w-4 h-4 text-gray-600" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    data-testid={`report-view-${snapshot.id}`}
                                    onClick={() => router.push(`/reports/${snapshot.id}`)}
                                  >
                                    <FileText className="h-4 w-4 mr-2" />
                                    View Report
                                  </DropdownMenuItem>
                                  {canDelete && (
                                    <DropdownMenuItem
                                      data-testid={`report-delete-${snapshot.id}`}
                                      onClick={() => handleDelete(snapshot)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="flex-shrink-0 border-t border-gray-100 bg-gray-50/30 py-3 px-6">
        <div className="flex items-center justify-between">
          {/* Left: Item Count */}
          <div className="text-sm text-gray-600">
            {total === 0
              ? '0–0 of 0'
              : `${startIndex + 1}–${Math.min(startIndex + pageSize, total)} of ${total}`}
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-4">
            {/* Page Size Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Show</span>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => {
                  setPageSize(parseInt(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger
                  className="h-7 text-sm border-gray-200 bg-white"
                  style={{ width: '70px' }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-7 px-2 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span className="text-sm text-gray-600 px-3 py-1">
                {currentPage} of {totalPages}
              </span>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="h-7 px-2 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <DeleteDialog />
    </div>
  );
}
