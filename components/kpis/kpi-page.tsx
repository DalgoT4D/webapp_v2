'use client';

import { useState, useRef, useEffect } from 'react';
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
import type { KPI } from '@/types/kpis';
import { RAG_COLORS, METRIC_TYPE_TAG_OPTIONS, TIME_GRAIN_OPTIONS } from '@/types/kpis';
import type { RAGStatus } from '@/types/kpis';
import { toastSuccess, toastError } from '@/lib/toast';
import { formatDistanceToNow } from 'date-fns';

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

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }
    chartInstance.current.setOption(config, true);

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
  onEdit,
  onDelete,
}: {
  kpi: KPI;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { chartData, echartsConfig, isLoading } = useKPIData(kpi.id);

  const metricTypeLabel = METRIC_TYPE_TAG_OPTIONS.find(
    (o) => o.value === kpi.metric_type_tag
  )?.label;

  const ragStatus = chartData?.rag_status as RAGStatus | null;
  const ragInfo = ragStatus ? RAG_COLORS[ragStatus] : null;
  const currentValue = chartData?.current_value;

  const formatValue = (v: number | null | undefined) => {
    if (v === null || v === undefined) return '\u2014';
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  return (
    <div className="bg-white border rounded-lg p-5 hover:shadow-md transition-shadow space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3
            className="font-semibold text-gray-900 truncate cursor-pointer hover:text-teal-700 hover:underline"
            onClick={onEdit}
          >
            {kpi.name}
          </h3>
          <p className="text-xs text-muted-foreground truncate">{kpi.metric.name}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {ragInfo && (
            <Badge variant="outline" className={`${ragInfo.bg} ${ragInfo.text} border-0 text-xs`}>
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
                Edit
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

      {/* Value */}
      <div>
        <div className="text-2xl font-bold text-gray-900">
          {isLoading ? <Skeleton className="h-8 w-20" /> : formatValue(currentValue)}
        </div>
        {kpi.target_value !== null && (
          <p className="text-xs text-muted-foreground">Target: {formatValue(kpi.target_value)}</p>
        )}
      </div>

      {/* Chart */}
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <EChartsRenderer config={echartsConfig || {}} />
      )}

      {/* Tags + updated */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {metricTypeLabel && (
            <Badge variant="secondary" className="text-xs">
              {metricTypeLabel}
            </Badge>
          )}
          {kpi.program_tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatDistanceToNow(new Date(kpi.updated_at), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}

export function KPIPageComponent() {
  const [search, setSearch] = useState('');
  const [metricTypeFilter, setMetricTypeFilter] = useState('');
  const [programTagFilter, setProgramTagFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<KPI | null>(null);
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
    programTag: programTagFilter || undefined,
  });

  const handleCreate = () => {
    setEditingKpi(null);
    setFormOpen(true);
  };

  const handleEdit = (kpi: KPI) => {
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
            <h1 className="text-3xl font-bold">KPIs</h1>
            <p className="text-muted-foreground mt-1">
              Track key performance indicators across your programs
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
        <div className="flex items-center gap-3 px-6 pb-4">
          <div className="relative flex-1 max-w-xs">
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
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Metric Type" />
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
          <Input
            placeholder="Program tag..."
            value={programTagFilter}
            onChange={(e) => {
              setProgramTagFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-36 h-9"
          />
          {(search || metricTypeFilter || programTagFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setMetricTypeFilter('');
                setProgramTagFilter('');
                setCurrentPage(1);
              }}
              className="h-9 px-2 text-xs text-gray-500"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
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
                onEdit={() => handleEdit(kpi)}
                onDelete={() => handleDeleteClick(kpi)}
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
        onSuccess={() => mutate()}
        kpi={editingKpi}
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
