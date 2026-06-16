'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  ArrowUpDown,
  ChevronUp,
  ChevronDown as ChevronDownSort,
  Filter,
  X,
  Target,
  User,
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
import { ConsumerLinks } from './consumer-links';
import { KPIForm } from '@/components/kpis/kpi-form';
import { formatDistanceToNow } from 'date-fns';
import { toastSuccess, toastError } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { cn } from '@/lib/utils';

export function MetricsLibrary() {
  const searchParams = useSearchParams();
  const [nameFilter, setNameFilter] = useState('');
  const [openFilters, setOpenFilters] = useState({ name: false });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<'name' | 'updated_at' | 'data_source'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [formOpen, setFormOpen] = useState(searchParams.get('create') === 'true');
  const highlightMetricId = searchParams.get('highlight');
  const [editingMetric, setEditingMetric] = useState<Metric | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingMetric, setDeletingMetric] = useState<Metric | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConsumers, setDeleteConsumers] = useState<MetricConsumersResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [kpiFormOpen, setKpiFormOpen] = useState(false);
  const [kpiPreselectedMetricId, setKpiPreselectedMetricId] = useState<number | undefined>();

  // Lazy-loaded consumers for "Used By" column
  const [consumersMap, setConsumersMap] = useState<Record<number, MetricConsumersResponse>>({});
  const fetchedIdsRef = useRef<Set<number>>(new Set());

  // Debounce search to avoid firing on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(nameFilter);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [nameFilter]);

  const {
    data: metrics,
    total,
    totalPages,
    isLoading,
    isError,
    mutate,
  } = useMetrics({
    page: currentPage,
    pageSize,
    search: debouncedSearch || undefined,
  });

  const handleSort = (column: 'name' | 'updated_at' | 'data_source') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const sortedMetrics = useMemo(() => {
    return [...(metrics || [])].sort((a, b) => {
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
  }, [metrics, sortBy, sortOrder]);

  // Lazy-fetch consumers for visible metrics
  useEffect(() => {
    const idsToFetch = sortedMetrics
      .map((m) => m.id)
      .filter((id) => !fetchedIdsRef.current.has(id));

    if (idsToFetch.length === 0) return;

    idsToFetch.forEach((id) => {
      fetchedIdsRef.current.add(id);
      getMetricConsumers(id)
        .then((c) => {
          setConsumersMap((prev) => ({ ...prev, [id]: c }));
        })
        .catch(() => {
          // silently ignore — column will just not show data
        });
    });
  }, [sortedMetrics]);

  const handleCreate = () => {
    setEditingMetric(null);
    setFormOpen(true);
  };

  const handleEdit = (metric: Metric) => {
    setEditingMetric(metric);
    setFormOpen(true);
  };

  const [consumerCheckFailed, setConsumerCheckFailed] = useState(false);

  const handleDeleteClick = async (metric: Metric) => {
    setDeletingMetric(metric);
    setDeleteError(null);
    setDeleteConsumers(null);
    setConsumerCheckFailed(false);
    try {
      const c = await getMetricConsumers(metric.id);
      setDeleteConsumers(c);
    } catch {
      setConsumerCheckFailed(true);
    }
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingMetric) return;
    setIsDeleting(true);
    try {
      await deleteMetric(deletingMetric.id);
      trackEvent(ANALYTICS_EVENTS.METRIC_DELETED, {
        aggregation: deletingMetric.aggregation || null,
      });
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

  const hasDeleteConsumers =
    deleteConsumers && (deleteConsumers.charts.length > 0 || deleteConsumers.kpis.length > 0);

  const formatExpression = (metric: Metric) => {
    if (metric.column_expression) {
      return metric.column_expression.length > 30
        ? metric.column_expression.slice(0, 30) + '…'
        : metric.column_expression;
    }
    if (metric.aggregation === 'count' && !metric.column) {
      return 'COUNT(*)';
    }
    return `${(metric.aggregation || '').toUpperCase()}(${metric.column})`;
  };

  const getMode = (metric: Metric) => (metric.column_expression ? 'Calculated' : 'Simple');

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
    const mode = getMode(metric);
    const consumers = consumersMap[metric.id];

    return (
      <TableRow
        key={metric.id}
        className={`hover:bg-gray-50 ${highlightMetricId === String(metric.id) ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}
      >
        {/* Name */}
        <TableCell className="py-4">
          <div className="flex flex-col">
            <span
              className="font-medium text-lg text-gray-900 hover:text-teal-700 hover:underline cursor-pointer"
              onClick={() => handleEdit(metric)}
            >
              {metric.name}
            </span>
            {metric.description && (
              <span className="text-sm text-gray-500 truncate max-w-[200px]">
                {metric.description}
              </span>
            )}
          </div>
        </TableCell>
        {/* Mode */}
        <TableCell className="py-4">
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
              mode === 'Simple'
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-gray-50 text-gray-600 border-gray-200'
            )}
          >
            {mode}
          </span>
        </TableCell>
        {/* Data Source */}
        <TableCell className="py-4 max-w-[200px]">
          <span className="text-base text-gray-700 block truncate" title={dataSource}>
            {dataSource}
          </span>
        </TableCell>
        {/* Expression */}
        <TableCell className="py-4">
          <span className="text-sm text-gray-600">{formatExpression(metric)}</span>
        </TableCell>
        {/* Used By */}
        <TableCell className="py-4">
          {consumers ? <ConsumerLinks consumers={consumers} /> : <Skeleton className="h-4 w-16" />}
        </TableCell>
        {/* Created by */}
        <TableCell className="py-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-3 h-3 text-gray-600" />
            </div>
            <span className="text-sm text-gray-600" data-testid={`metric-created-by-${metric.id}`}>
              {metric.created_by || 'Unknown'}
            </span>
          </div>
        </TableCell>
        {/* Last Updated */}
        <TableCell className="py-4 text-sm text-gray-500">
          {metric.updated_at
            ? formatDistanceToNow(new Date(metric.updated_at), { addSuffix: false }) + ' ago'
            : '—'}
        </TableCell>
        {/* Actions */}
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
                Edit Metric
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setKpiPreselectedMetricId(metric.id);
                  setKpiFormOpen(true);
                }}
                className="cursor-pointer"
              >
                <Target className="w-4 h-4 mr-2" />
                Create KPI
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

  const columnHeaders = (
    <TableRow className="bg-gray-50">
      <TableHead className="w-[20%]">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            className="h-auto p-0 font-medium text-base hover:bg-transparent"
            onClick={() => handleSort('name')}
          >
            <div className="flex items-center gap-1">
              Name
              {renderSortIcon('name')}
            </div>
          </Button>
          <Popover
            open={openFilters.name}
            onOpenChange={(open) => setOpenFilters((prev) => ({ ...prev, name: open }))}
          >
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5 p-0 hover:bg-gray-100">
                {renderFilterIcon(!!nameFilter)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="start">
              <div className="space-y-3">
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
      <TableHead className="w-[8%] font-medium text-base">Mode</TableHead>
      <TableHead className="w-[14%]">
        <Button
          variant="ghost"
          className="h-auto p-0 font-medium text-base hover:bg-transparent"
          onClick={() => handleSort('data_source')}
        >
          <div className="flex items-center gap-1">
            Data Source
            {renderSortIcon('data_source')}
          </div>
        </Button>
      </TableHead>
      <TableHead className="w-[16%] font-medium text-base">Expression</TableHead>
      <TableHead className="w-[12%] font-medium text-base">Used By</TableHead>
      <TableHead className="w-[14%] font-medium text-base">Created by</TableHead>
      <TableHead className="w-[11%]">
        <Button
          variant="ghost"
          className="h-auto p-0 font-medium text-base hover:bg-transparent"
          onClick={() => handleSort('updated_at')}
        >
          <div className="flex items-center gap-1">
            Last Updated
            {renderSortIcon('updated_at')}
          </div>
        </Button>
      </TableHead>
      <TableHead className="w-[5%] font-medium text-base">Actions</TableHead>
    </TableRow>
  );

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
        <div id="metrics-title-section" className="flex items-center justify-between p-6 pb-4">
          <div>
            <h1 className="text-3xl font-bold">Metrics</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Define reusable metric definitions that power your KPIs &amp; Charts
            </p>
          </div>
          <Button
            variant="ghost"
            className="text-white hover:opacity-90 shadow-xs"
            style={{ backgroundColor: 'var(--primary)' }}
            onClick={handleCreate}
            data-testid="create-metric-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Metric
          </Button>
        </div>

        {/* Active filter indicator */}
        {nameFilter && (
          <div className="flex items-center gap-2 px-6 pb-3">
            <span className="text-xs text-gray-600">1 filter active</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNameFilter('')}
              className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
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
            <div className="py-4">
              <div className="border rounded-lg bg-white">
                <TableComponent>
                  <TableHeader>{columnHeaders}</TableHeader>
                  <TableBody>
                    {[...Array(6)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="py-3">
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-14 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-3 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-3 w-12" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-6" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </TableComponent>
              </div>
            </div>
          ) : sortedMetrics.length > 0 ? (
            <div className="py-4">
              <div className="border rounded-lg bg-white">
                <TableComponent>
                  <TableHeader>{columnHeaders}</TableHeader>
                  <TableBody>{sortedMetrics.map((metric) => renderMetricRow(metric))}</TableBody>
                </TableComponent>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <BarChart3 className="w-12 h-12 text-muted-foreground" />
              <p className="text-lg font-medium text-gray-700">
                {nameFilter ? 'No metrics match your filter' : 'No metrics defined yet'}
              </p>
              {!nameFilter && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Create your first metric to start building KPIs and tracking what matters most.
                  </p>
                  <Button
                    variant="ghost"
                    className="text-white hover:opacity-90 shadow-xs"
                    style={{ backgroundColor: 'var(--primary)' }}
                    onClick={handleCreate}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Metric
                  </Button>
                </>
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

      <KPIForm
        open={kpiFormOpen}
        onOpenChange={setKpiFormOpen}
        onSuccess={() => {
          setKpiFormOpen(false);
          if (kpiPreselectedMetricId) {
            getMetricConsumers(kpiPreselectedMetricId)
              .then((c) => {
                setConsumersMap((prev) => ({ ...prev, [kpiPreselectedMetricId]: c }));
              })
              .catch(() => {});
          }
        }}
        preselectedMetricId={kpiPreselectedMetricId}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">
              {hasDeleteConsumers || consumerCheckFailed ? 'Cannot Delete Metric' : 'Delete Metric'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {consumerCheckFailed ? (
                  <p className="text-sm text-destructive">
                    Could not verify if this metric is in use. Please try again.
                  </p>
                ) : hasDeleteConsumers ? (
                  <>
                    <p className="text-base text-foreground">
                      This metric has been used in multiple places. Remove these dependencies before
                      deleting.
                    </p>
                    <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
                      <p className="text-sm font-medium text-amber-700 mb-1">Used by:</p>
                      <ConsumerLinks consumers={deleteConsumers!} variant="inherit" />
                    </div>
                  </>
                ) : (
                  <p className="text-base text-foreground">
                    Are you sure you want to delete Metric{' '}
                    <span className="font-bold">&quot;{deletingMetric?.name}&quot;</span> ?
                    <br />
                    This change cannot be undone.
                  </p>
                )}
                {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-destructive text-destructive hover:bg-destructive/5">
              CANCEL
            </AlertDialogCancel>
            {!hasDeleteConsumers && !consumerCheckFailed && (
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void handleDeleteConfirm();
                }}
                disabled={isDeleting}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                DELETE
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
