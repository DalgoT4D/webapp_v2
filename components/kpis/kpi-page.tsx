'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSWRConfig } from 'swr';
import * as echarts from 'echarts';
import { Plus, Search, Target, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useKPIs, useKPIData, deleteKPI } from '@/hooks/api/useKPIs';
import { KPIForm } from './kpi-form';
import { KPIDetailDrawer } from './kpi-detail-drawer';
import type { KPI } from '@/types/kpis';
import { RAG_COLORS, METRIC_TYPE_TAG_OPTIONS, TIME_GRAIN_OPTIONS } from '@/types/kpis';
import type { RAGStatus } from '@/types/kpis';
import { toastSuccess, toastError } from '@/lib/toast';
import { formatDistanceToNow, format as formatDate, parseISO, isValid } from 'date-fns';

// Renders an ECharts config into a div
function EChartsRenderer({
  config,
  height = 'h-40',
}: {
  config: Record<string, any>;
  height?: string;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || !config || Object.keys(config).length === 0) return;

    // Always dispose and reinit to handle chart type changes (e.g. line → gauge)
    if (chartInstance.current) {
      chartInstance.current.dispose();
    }
    chartInstance.current = echarts.init(chartRef.current);
    chartInstance.current.setOption(config);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [config]);

  if (!config || Object.keys(config).length === 0) {
    return (
      <div className={`${height} flex items-center justify-center text-xs text-muted-foreground`}>
        No trend data
      </div>
    );
  }

  return <div ref={chartRef} className={`${height} w-full`} />;
}

// A single KPI card that fetches its own data
function KPICardWithData({
  kpi,
  onClick,
  onEdit,
  onDelete,
  statusFilter,
}: {
  kpi: KPI;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  statusFilter?: string;
}) {
  const { chartData, echartsConfig, isLoading } = useKPIData(kpi.id);

  const ragStatus = chartData?.rag_status as RAGStatus | null;
  const ragInfo = ragStatus ? RAG_COLORS[ragStatus] : null;
  const currentValue = chartData?.current_value;
  const hasTrend = chartData?.periods && chartData.periods.length > 0;
  const periods = chartData?.periods || [];

  // Hide card if status filter is active and doesn't match
  if (statusFilter && !isLoading && ragStatus !== statusFilter) return null;

  // Period-over-period change
  const popChange = (() => {
    if (periods.length < 2) return null;
    const current = periods[periods.length - 1]?.value;
    const previous = periods[periods.length - 2]?.value;
    if (current == null || previous == null || previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
  })();

  // Direction-aware: is the change "good"?
  const isPositiveChange =
    popChange !== null &&
    ((kpi.direction === 'increase' && popChange > 0) ||
      (kpi.direction === 'decrease' && popChange < 0));
  const isNegativeChange =
    popChange !== null &&
    ((kpi.direction === 'increase' && popChange < 0) ||
      (kpi.direction === 'decrease' && popChange > 0));

  const timeGrainLabel: Record<string, string> = {
    daily: 'day',
    weekly: 'week',
    monthly: 'month',
    quarterly: 'quarter',
    yearly: 'year',
  };

  const formatValue = (v: number | null | undefined) => {
    if (v === null || v === undefined) return '\u2014';
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  return (
    <div className="bg-white border rounded-lg hover:shadow-md transition-shadow flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2 border-b">
        <div className="min-w-0">
          <h3
            className="font-semibold text-gray-900 truncate cursor-pointer hover:text-teal-700 hover:underline"
            onClick={onClick}
          >
            {kpi.name}
          </h3>
          {kpi.program_tags.length > 0 && (
            <p className="text-xs text-muted-foreground truncate">{kpi.program_tags.join(', ')}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {ragInfo && (
            <Badge variant="outline" className={`${ragInfo.bg} ${ragInfo.text} border-0 text-xs`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${ragInfo.dot}`} />
              {ragInfo.label}
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 p-0">
                <MoreVertical className="w-4 h-4 text-gray-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
                <Pencil className="w-4 h-4 mr-2" />
                Edit KPI
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Value section */}
      <div className="px-4 pt-3 pb-2">
        {isLoading ? (
          <Skeleton className="h-10 w-28" />
        ) : (
          <>
            <div className="text-4xl font-bold text-gray-900">{formatValue(currentValue)}</div>
            {kpi.target_value !== null && (
              <p className="text-sm text-muted-foreground mt-0.5">
                Target: {formatValue(kpi.target_value)}
              </p>
            )}
            {popChange !== null && (
              <p
                className={`text-sm font-medium mt-1 ${
                  isPositiveChange
                    ? 'text-green-600'
                    : isNegativeChange
                      ? 'text-red-600'
                      : 'text-muted-foreground'
                }`}
              >
                {popChange > 0 ? '↑' : popChange < 0 ? '↓' : '—'} {popChange > 0 ? '+' : ''}
                {popChange.toFixed(1)}% from last {timeGrainLabel[kpi.time_grain] || 'period'}
              </p>
            )}
          </>
        )}
      </div>

      {/* Chart */}
      <div className="px-4 pb-3 flex-1">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <EChartsRenderer config={echartsConfig || {}} height="h-32" />
        )}
      </div>

      {/* Footer */}
      <div className="mx-4 border-t" />
      <div className="px-4 py-1.5">
        <span className="text-xs text-muted-foreground">
          {(() => {
            const raw = chartData?.data_last_date;
            if (raw) {
              const d = parseISO(raw);
              if (isValid(d)) return `Data as of ${formatDate(d, 'd MMMM yyyy')}`;
            }
            return `Updated ${formatDistanceToNow(new Date(kpi.updated_at))} ago`;
          })()}
        </span>
      </div>
    </div>
  );
}

export function KPIPageComponent() {
  const [search, setSearch] = useState('');
  const [metricTypeFilter, setMetricTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<KPI | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<KPI | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingKpi, setDeletingKpi] = useState<KPI | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    data: kpis,
    total,
    totalPages,
    isLoading,
    isError,
    mutate,
  } = useKPIs({
    page: currentPage,
    pageSize: 20,
    search: search || undefined,
    metricType: metricTypeFilter || undefined,
  });

  const { mutate: globalMutate } = useSWRConfig();

  const handleFormSuccess = useCallback(() => {
    mutate(); // refresh KPI list
    // Also invalidate all KPI data endpoints so charts re-render
    globalMutate(
      (key: string) =>
        typeof key === 'string' && key.includes('/api/kpis/') && key.includes('/data/'),
      undefined,
      { revalidate: true }
    );
  }, [mutate, globalMutate]);

  const handleCreate = () => {
    setEditingKpi(null);
    setFormOpen(true);
  };

  const handleCardClick = (kpi: KPI) => {
    setSelectedKpi(kpi);
    setDrawerOpen(true);
  };

  const handleEdit = (kpi: KPI) => {
    setDrawerOpen(false);
    setEditingKpi(kpi);
    setFormOpen(true);
  };

  const handleDeleteClick = (kpi: KPI) => {
    setDeletingKpi(kpi);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingKpi) return;
    setIsDeleting(true);
    try {
      await deleteKPI(deletingKpi.id);
      mutate();
      toastSuccess.deleted(deletingKpi.name);
      setDeleteDialogOpen(false);
    } catch (err: any) {
      toastError.delete(err, deletingKpi.name);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Target className="w-12 h-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load KPIs</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h1 className="text-2xl font-bold">KPI</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track business objectives with measurable KPIs linked to your metrics
            </p>
          </div>
          <Button
            variant="ghost"
            className="text-white hover:opacity-90 shadow-xs"
            style={{ backgroundColor: 'var(--primary)' }}
            onClick={handleCreate}
          >
            <Plus className="w-4 h-4 mr-2" />
            CREATE KPI
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="border rounded-lg bg-white p-5 h-full flex flex-col overflow-hidden">
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search KPIs..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 h-9"
              />
            </div>
            <Select
              value={metricTypeFilter || 'all'}
              onValueChange={(v) => {
                setMetricTypeFilter(v === 'all' ? '' : v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-28 h-9">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {METRIC_TYPE_TAG_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter || 'all'}
              onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-32 h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="green">On Track</SelectItem>
                <SelectItem value="amber">Needs Attention</SelectItem>
                <SelectItem value="red">Off Track</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="border rounded-lg p-5 space-y-3">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : kpis.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {kpis.map((kpi) => (
                  <KPICardWithData
                    key={kpi.id}
                    kpi={kpi}
                    onClick={() => handleCardClick(kpi)}
                    onEdit={() => handleEdit(kpi)}
                    onDelete={() => handleDeleteClick(kpi)}
                    statusFilter={statusFilter || undefined}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <Target className="w-12 h-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {search ? 'No KPIs match your search' : 'No KPIs yet'}
                </p>
                {!search && (
                  <Button
                    variant="ghost"
                    className="text-white hover:opacity-90 shadow-xs"
                    style={{ backgroundColor: 'var(--primary)' }}
                    onClick={handleCreate}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    CREATE YOUR FIRST KPI
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 border-t border-gray-100 bg-gray-50/30 py-3 px-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {`${(currentPage - 1) * 20 + 1}\u2013${Math.min(currentPage * 20, total)} of ${total}`}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-7 px-2"
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600 px-3">
                {currentPage} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="h-7 px-2"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      <KPIForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={handleFormSuccess}
        kpi={editingKpi}
      />

      <KPIDetailDrawer
        kpi={selectedKpi}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onEdit={() => selectedKpi && handleEdit(selectedKpi)}
        onDelete={() => {
          if (selectedKpi) {
            setDrawerOpen(false);
            handleDeleteClick(selectedKpi);
          }
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete KPI</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingKpi?.name}&quot;? This will also remove
              it from any dashboards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
