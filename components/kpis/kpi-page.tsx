'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import {
  Plus,
  Search,
  Target,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
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
import { useKPIs, useKPIData, deleteKPI, useProgramTags } from '@/hooks/api/useKPIs';
import { KPIForm } from './kpi-form';
import { KPIDetailDrawer } from './kpi-detail-drawer';
import { KPIDeleteDialog } from './kpi-delete-dialog';
import { KPICard } from './kpi-card';
import type { KPICardData } from './kpi-card';
import type { KPI } from '@/types/kpis';
import { RAG_COLORS, METRIC_TYPE_TAG_OPTIONS, TIME_GRAIN_OPTIONS } from '@/types/kpis';
import type { RAGStatus } from '@/types/kpis';
import { toastSuccess, toastError } from '@/lib/toast';
import { formatDistanceToNow } from 'date-fns';
import { computePopChanges } from '@/lib/formatters';

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
  const periods = chartData?.periods || [];

  // Hide card if status filter is active and doesn't match
  if (statusFilter && !isLoading && ragStatus !== statusFilter) return null;

  const lastTwo = periods.slice(-2).map((p) => p.value);
  const popChange = computePopChanges(lastTwo)[1] ?? null;

  const cardData: KPICardData = {
    currentValue: chartData?.current_value,
    targetValue: kpi.target_value,
    ragStatus,
    popChange,
    direction: kpi.direction,
    timeGrain: kpi.time_grain,
    echartsConfig: echartsConfig || null,
    dataLastDate: chartData?.data_last_date,
    updatedAt: kpi.updated_at,
    isLoading,
    periods,
  };

  return (
    <div className="h-72" data-testid={`kpi-card-${kpi.id}`}>
      <KPICard
        name={kpi.name}
        subtitle={kpi.program_tags.length > 0 ? kpi.program_tags.join(', ') : undefined}
        createdBy={kpi.created_by}
        data={cardData}
        onClick={onClick}
        className="h-full"
        showDownload={false}
        downloadInMenu
        menuItems={
          <>
            <DropdownMenuItem onClick={onClick} className="cursor-pointer">
              <Eye className="w-4 h-4 mr-2" />
              View KPI
            </DropdownMenuItem>
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
          </>
        }
      />
    </div>
  );
}

export function KPIPageComponent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [metricTypeFilter, setMetricTypeFilter] = useState('');
  const [programTagFilter, setProgramTagFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<KPI | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<KPI | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingKpi, setDeletingKpi] = useState<KPI | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const PAGE_SIZE = 10;

  const {
    data: kpis,
    total,
    totalPages,
    isLoading,
    isError,
    mutate,
  } = useKPIs({
    page: currentPage,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    metricType: metricTypeFilter || undefined,
    programTag: programTagFilter || undefined,
  });

  const { tags: programTags } = useProgramTags();
  const { mutate: globalMutate } = useSWRConfig();

  // Auto-open drawer when ?open={kpiId} is in the URL, then strip the param
  // so a refresh doesn't reopen the drawer after the user has closed it.
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId && kpis.length > 0) {
      const kpi = kpis.find((k) => k.id === parseInt(openId));
      if (kpi) {
        setSelectedKpi(kpi);
        setDrawerOpen(true);
      }
      const next = new URLSearchParams(searchParams.toString());
      next.delete('open');
      const qs = next.toString();
      router.replace(qs ? `/kpis?${qs}` : '/kpis', { scroll: false });
    }
  }, [searchParams, kpis, router]);

  const handleFormSuccess = useCallback(() => {
    setCurrentPage(1);
    mutate();
    globalMutate('/api/kpis/program-tags/');
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
      if (kpis.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
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
            <h1 className="text-3xl font-bold">KPI</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track business objectives with measurable KPIs linked to your metrics
            </p>
          </div>
          <Button
            variant="ghost"
            className="text-white hover:opacity-90 shadow-xs"
            style={{ backgroundColor: 'var(--primary)' }}
            onClick={handleCreate}
            data-testid="create-kpi-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            CREATE KPI
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="border rounded-lg bg-white p-5 h-full flex flex-col overflow-hidden">
          {/* Filters + Pagination */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search KPIs..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 h-9"
                data-testid="kpi-search"
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
            {programTags.length > 0 && (
              <Select
                value={programTagFilter || 'all'}
                onValueChange={(v) => {
                  setProgramTagFilter(v === 'all' ? '' : v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="Program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select
              value={statusFilter || 'all'}
              onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="green">On Track</SelectItem>
                <SelectItem value="amber">Needs Attention</SelectItem>
                <SelectItem value="red">Off Track</SelectItem>
              </SelectContent>
            </Select>
            {total > 0 && (
              <div className="ml-auto flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  {(currentPage - 1) * PAGE_SIZE + 1}&ndash;
                  {Math.min(currentPage * PAGE_SIZE, total)} of {total}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="h-7 px-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-600 px-2">
                    {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="h-7 px-2"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
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

      <KPIDeleteDialog
        kpiId={deletingKpi?.id ?? null}
        kpiName={deletingKpi?.name ?? ''}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </div>
  );
}
