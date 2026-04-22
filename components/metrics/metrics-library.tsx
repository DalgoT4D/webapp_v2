'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  ArrowUpDown,
  ChevronUp,
  ChevronDown as ChevronDownSort,
  Filter,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table as TableComponent,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMetrics, deleteMetric, getMetricConsumers } from '@/hooks/api/useMetrics';
import type { Metric, MetricConsumersResponse } from '@/types/metrics';
import { MetricFormDialog } from './metric-form-dialog';
import { formatDistanceToNow } from 'date-fns';
import { toastSuccess, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';

export function MetricsLibrary() {
  const [nameFilter, setNameFilter] = useState('');
  const [openFilters, setOpenFilters] = useState({ name: false });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<'name' | 'updated_at' | 'data_source'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [formOpen, setFormOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<Metric | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingMetric, setDeletingMetric] = useState<Metric | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [consumers, setConsumers] = useState<MetricConsumersResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    data: allMetrics,
    total: apiTotal,
    isLoading,
    isError,
    mutate,
  } = useMetrics({
    page: currentPage,
    pageSize,
  });

  const metrics = allMetrics || [];

  const handleSort = (column: 'name' | 'updated_at' | 'data_source') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const filteredAndSortedMetrics = useMemo(() => {
    const filtered = metrics.filter((metric) => {
      if (nameFilter) {
        const name = (metric.name || '').toLowerCase();
        const desc = (metric.description || '').toLowerCase();
        if (!name.includes(nameFilter.toLowerCase()) && !desc.includes(nameFilter.toLowerCase())) {
          return false;
        }
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case 'name':
          aValue = (a.name || '').toLowerCase();
          bValue = (b.name || '').toLowerCase();
          break;
        case 'updated_at':
          aValue = new Date(a.updated_at || 0).getTime();
          bValue = new Date(b.updated_at || 0).getTime();
          break;
        case 'data_source':
          aValue = `${a.schema_name}.${a.table_name}`.toLowerCase();
          bValue = `${b.schema_name}.${b.table_name}`.toLowerCase();
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
  }, [metrics, nameFilter, sortBy, sortOrder]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedMetrics = filteredAndSortedMetrics.slice(startIndex, endIndex);
  const total = filteredAndSortedMetrics.length;
  const totalPages = Math.ceil(total / pageSize);

  const handleCreate = () => {
    setEditingMetric(null);
    setFormOpen(true);
  };

  const handleEdit = (metric: Metric) => {
    setEditingMetric(metric);
    setFormOpen(true);
  };

  const handleDeleteClick = async (metric: Metric) => {
    setDeletingMetric(metric);
    setDeleteError(null);
    setConsumers(null);
    try {
      const c = await getMetricConsumers(metric.id);
      setConsumers(c);
    } catch {
      // ignore
    }
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingMetric) return;
    setIsDeleting(true);
    try {
      await deleteMetric(deletingMetric.id);
      mutate();
      setDeleteDialogOpen(false);
      toastSuccess.deleted(deletingMetric.name);
    } catch (err: any) {
      setDeleteError(err.message);
      toastError.delete(err, deletingMetric.name);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasConsumers = consumers && (consumers.charts.length > 0 || consumers.kpis.length > 0);

  const formatDefinition = (metric: Metric) => {
    if (metric.column_expression) {
      return metric.column_expression.length > 40
        ? metric.column_expression.slice(0, 40) + '...'
        : metric.column_expression;
    }
    if (metric.aggregation === 'count' && !metric.column) {
      return 'COUNT(*)';
    }
    return `${(metric.aggregation || '').toUpperCase()}(${metric.column})`;
  };

  const renderSortIcon = (column: 'name' | 'updated_at' | 'data_source') => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4 text-gray-600" />
    ) : (
      <ChevronDownSort className="w-4 h-4 text-gray-600" />
    );
  };

  const renderFilterIcon = (isActive: boolean) => (
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

  const renderMetricRow = (metric: Metric) => {
    const dataSource = `${metric.schema_name}.${metric.table_name}`;

    return (
      <TableRow key={metric.id} className="hover:bg-gray-50">
        <TableCell className="py-4">
          <div className="flex flex-col">
            <span
              className="font-medium text-lg text-gray-900 hover:text-teal-700 hover:underline cursor-pointer"
              onClick={() => handleEdit(metric)}
            >
              {metric.name}
            </span>
            {metric.description && (
              <span className="text-sm text-gray-500 truncate max-w-[300px]">
                {metric.description}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="py-4">
          <div className="text-base text-gray-700">{dataSource}</div>
        </TableCell>
        <TableCell className="py-4">
          <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-700">
            {formatDefinition(metric)}
          </code>
        </TableCell>
        <TableCell className="py-4 text-base text-gray-600">
          {metric.updated_at
            ? formatDistanceToNow(new Date(metric.updated_at), { addSuffix: true })
            : 'Unknown'}
        </TableCell>
        <TableCell className="py-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 p-0 hover:bg-gray-100">
                <MoreVertical className="w-4 h-4 text-gray-600" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleEdit(metric)} className="cursor-pointer">
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeleteClick(metric)}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    );
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <BarChart3 className="w-12 h-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load metrics</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div id="metrics-list-container" className="h-full flex flex-col">
      {/* Fixed Header */}
      <div id="metrics-header" className="flex-shrink-0 border-b bg-background">
        <div id="metrics-title-section" className="flex items-center justify-between mb-6 p-6 pb-0">
          <div>
            <h1 className="text-3xl font-bold">Metrics</h1>
            <p className="text-muted-foreground mt-1">Reusable calculations for charts and KPIs</p>
          </div>
          <Button
            variant="ghost"
            className="text-white hover:opacity-90 shadow-xs"
            style={{ backgroundColor: 'var(--primary)' }}
            onClick={handleCreate}
          >
            <Plus className="w-4 h-4 mr-2" />
            CREATE METRIC
          </Button>
        </div>

        {/* Filter summary */}
        {nameFilter && (
          <div className="flex items-center gap-2 px-6 pb-0">
            <span className="text-sm text-gray-600">1 filter active</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNameFilter('')}
              className="h-8 px-2 text-xs text-gray-500 hover:text-gray-700"
            >
              <X className="w-3 h-3 mr-1" />
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div id="metrics-content-wrapper" className="flex-1 overflow-hidden px-6">
        <div id="metrics-scrollable-content" className="h-full overflow-y-auto">
          {isLoading ? (
            <div className="py-6">
              <div className="border rounded-lg bg-white">
                <TableComponent>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-[30%]">
                        <Skeleton className="h-4 w-16" />
                      </TableHead>
                      <TableHead className="w-[25%]">
                        <Skeleton className="h-4 w-20" />
                      </TableHead>
                      <TableHead className="w-[25%]">
                        <Skeleton className="h-4 w-16" />
                      </TableHead>
                      <TableHead className="w-[15%]">
                        <Skeleton className="h-4 w-20" />
                      </TableHead>
                      <TableHead className="w-[5%]">
                        <Skeleton className="h-4 w-12" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(6)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="py-4">
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-8" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </TableComponent>
              </div>
            </div>
          ) : paginatedMetrics.length > 0 ? (
            <div className="py-6">
              <div className="border rounded-lg bg-white">
                <TableComponent>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-[30%]">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            className="h-auto p-0 font-medium text-base hover:bg-transparent"
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
                                className="h-6 w-6 p-0 hover:bg-gray-100"
                              >
                                {renderFilterIcon(!!nameFilter)}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80" align="start">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium text-sm">Filter by Name</h4>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setNameFilter('')}
                                    className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
                                  >
                                    Clear
                                  </Button>
                                </div>
                                <Input
                                  placeholder="Search metric names..."
                                  value={nameFilter}
                                  onChange={(e) => setNameFilter(e.target.value)}
                                  className="h-8"
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </TableHead>
                      <TableHead className="w-[25%]">
                        <Button
                          variant="ghost"
                          className="h-auto p-0 font-medium text-base hover:bg-transparent"
                          onClick={() => handleSort('data_source')}
                        >
                          <div className="flex items-center gap-2">
                            Data Source
                            {renderSortIcon('data_source')}
                          </div>
                        </Button>
                      </TableHead>
                      <TableHead className="w-[25%] font-medium text-base">Definition</TableHead>
                      <TableHead className="w-[15%]">
                        <Button
                          variant="ghost"
                          className="h-auto p-0 font-medium text-base hover:bg-transparent"
                          onClick={() => handleSort('updated_at')}
                        >
                          <div className="flex items-center gap-2">
                            Last Modified
                            {renderSortIcon('updated_at')}
                          </div>
                        </Button>
                      </TableHead>
                      <TableHead className="w-[5%] font-medium text-base">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{paginatedMetrics.map((metric) => renderMetricRow(metric))}</TableBody>
                </TableComponent>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <BarChart3 className="w-12 h-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                {nameFilter ? 'No metrics match your filter' : 'No metrics yet'}
              </p>
              {!nameFilter && (
                <Button
                  variant="ghost"
                  className="text-white hover:opacity-90 shadow-xs"
                  style={{ backgroundColor: 'var(--primary)' }}
                  onClick={handleCreate}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  CREATE YOUR FIRST METRIC
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="flex-shrink-0 border-t border-gray-100 bg-gray-50/30 py-3 px-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {total === 0
              ? '0\u20130 of 0'
              : `${(currentPage - 1) * pageSize + 1}\u2013${Math.min(currentPage * pageSize, total)} of ${total}`}
          </div>
          <div className="flex items-center gap-4">
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
                </SelectContent>
              </Select>
            </div>
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
                {currentPage} of {totalPages || 1}
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

      {/* Form Dialog */}
      <MetricFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={() => mutate()}
        metric={editingMetric}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Metric</AlertDialogTitle>
            <AlertDialogDescription>
              {hasConsumers ? (
                <>
                  <span className="font-medium text-destructive">
                    Cannot delete &quot;{deletingMetric?.name}&quot;
                  </span>{' '}
                  &mdash; it is referenced by:
                  {consumers!.kpis.length > 0 && (
                    <span>
                      {' '}
                      {consumers!.kpis.length} KPI{consumers!.kpis.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {consumers!.charts.length > 0 && (
                    <span>
                      {' '}
                      {consumers!.charts.length} chart{consumers!.charts.length > 1 ? 's' : ''}
                    </span>
                  )}
                </>
              ) : (
                <>
                  Are you sure you want to delete &quot;{deletingMetric?.name}&quot;? This action
                  cannot be undone.
                </>
              )}
              {deleteError && <p className="text-sm text-destructive mt-2">{deleteError}</p>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {!hasConsumers && (
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
