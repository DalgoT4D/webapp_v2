'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
  BellRing,
  ArrowLeft,
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
import { DocsLink } from '@/components/ui/docs-link';
import { useKPIs, useKPI, useKPIData, deleteKPI, useProgramTags } from '@/hooks/api/useKPIs';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { useAuthStore } from '@/stores/authStore';
import {
  markKpiCreated,
  isStageBefore,
} from '@/components/onboarding/insight-walkthrough-constants';
import { CelebrationModal } from '@/components/onboarding/celebration-modal';
import { AlertWizardModal } from '@/components/alerts/AlertWizardModal';
import { KPIForm } from './kpi-form';
import { KPIDetailDrawer } from './kpi-detail-drawer';
import { KPIDeleteDialog } from './kpi-delete-dialog';
import { KPICard } from './kpi-card';
import type { KPICardData } from './kpi-card';
import type { KPI } from '@/types/kpis';
import { RAG_COLORS, METRIC_TYPE_TAG_OPTIONS, TIME_GRAIN_OPTIONS } from '@/types/kpis';
import type { RAGStatus } from '@/types/kpis';
import { toastSuccess, toastError } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import {
  ALERT_CREATE_SOURCES,
  ANALYTICS_EVENTS,
  KPI_EXPORT_SOURCES,
  KPI_VIEW_SOURCES,
  type KpiViewSource,
} from '@/constants/analytics';
import { formatDistanceToNow } from 'date-fns';
import { computePopChanges } from '@/lib/formatters';
import { getWidgetBackLabel, parseWidgetNavigationSource } from '@/lib/widget-navigation';

function parseKpiId(value: string | null): number | null {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// A single KPI card that fetches its own data
function KPICardWithData({
  kpi,
  onClick,
  onViewFromMenu,
  onEdit,
  onDelete,
  onCreateAlert,
  canCreateAlert,
  canEditKpis,
  canDeleteKpis,
  statusFilter,
}: {
  kpi: KPI;
  onClick: () => void;
  /** ⋮ → View KPI. Same drawer as onClick, tracked with its own source. */
  onViewFromMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCreateAlert?: () => void;
  canCreateAlert?: boolean;
  canEditKpis?: boolean;
  canDeleteKpis?: boolean;
  statusFilter?: string;
}) {
  const { chartData, echartsConfig, isLoading } = useKPIData(kpi.id);

  const ragStatus = chartData?.rag_status as RAGStatus | null;
  const periods = chartData?.periods || [];

  // Hide card if status filter is active and doesn't match
  if (statusFilter && !isLoading && ragStatus !== statusFilter) return null;

  const lastTwo = periods.slice(-2).map((p: { value: number | null }) => p.value);
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
    customizations: kpi.extra_config?.customizations,
  };

  return (
    <div className="h-72" data-testid={`kpi-card-${kpi.id}`}>
      <KPICard
        name={kpi.name}
        subtitle={kpi.program_tags.length > 0 ? kpi.program_tags.join(', ') : undefined}
        data={cardData}
        onClick={onClick}
        className="h-full"
        kpiId={kpi.id}
        exportSource={KPI_EXPORT_SOURCES.KPI_PAGE}
        showDownload={false}
        downloadInMenu
        menuItems={
          <>
            <DropdownMenuItem onClick={onViewFromMenu} className="cursor-pointer">
              <Eye className="w-4 h-4 mr-2" />
              View KPI
            </DropdownMenuItem>
            {canEditKpis && (
              <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
                <Pencil className="w-4 h-4 mr-2" />
                Edit KPI
              </DropdownMenuItem>
            )}
            {canCreateAlert && onCreateAlert && (
              <DropdownMenuItem onClick={onCreateAlert} className="cursor-pointer">
                <BellRing className="w-4 h-4 mr-2" />
                Create alert
              </DropdownMenuItem>
            )}
            {canDeleteKpis && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </>
        }
      />
    </div>
  );
}

export function KPIPageComponent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const openKpiId = parseKpiId(searchParams.get('open'));
  const editKpiId = parseKpiId(searchParams.get('edit'));
  const deepLinkedKpiId = editKpiId ?? openKpiId;
  const navigationSource = parseWidgetNavigationSource(searchParams.get('from'));
  const handledDeepLinkRef = useRef<string | null>(null);
  const orgUsers = useAuthStore((s) => s.orgUsers);
  const selectedOrgSlug = useAuthStore((s) => s.selectedOrgSlug);
  const orgSlug = orgUsers.find((ou) => ou.org.slug === selectedOrgSlug)?.org.slug ?? null;
  const [search, setSearch] = useState('');
  const [metricTypeFilter, setMetricTypeFilter] = useState('');
  const [programTagFilter, setProgramTagFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(searchParams.get('create') === 'true');
  // Walkthrough only — see handleFormSuccess.
  const [kpiLiveModalOpen, setKpiLiveModalOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<KPI | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<KPI | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingKpi, setDeletingKpi] = useState<KPI | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [alertKpiId, setAlertKpiId] = useState<number | null>(null);

  const { hasPermission } = useRbac();
  // Create/edit/delete affordances are hidden for view-only roles (members) and
  // shown to roles that hold the matching permission (admins + analysts).
  const canCreateKpis = hasPermission(PERMISSIONS.CAN_CREATE_KPIS);
  const canEditKpis = hasPermission(PERMISSIONS.CAN_EDIT_KPIS);
  const canDeleteKpis = hasPermission(PERMISSIONS.CAN_DELETE_KPIS);
  const canCreateAlert = hasPermission(PERMISSIONS.CAN_CREATE_ALERTS);

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
  const { kpi: deepLinkedKpi, isError: deepLinkedKpiError } = useKPI(deepLinkedKpiId);

  const { tags: programTags } = useProgramTags();
  const { mutate: globalMutate } = useSWRConfig();

  // Dashboard/report links fetch the KPI directly by id, rather than searching the
  // current paginated list. After consuming the action, keep `from` in the URL so
  // the page can offer the same source-aware back action as chart detail pages.
  useEffect(() => {
    const hasOpenParam = searchParams.has('open');
    const hasEditParam = searchParams.has('edit');
    if (!hasOpenParam && !hasEditParam) {
      handledDeepLinkRef.current = null;
      return;
    }

    const clearActionParams = () => {
      const next = new URLSearchParams(searchParams.toString());
      next.delete('open');
      next.delete('edit');
      const qs = next.toString();
      router.replace(qs ? `/kpis?${qs}` : '/kpis', { scroll: false });
    };

    if (!deepLinkedKpiId) {
      clearActionParams();
      return;
    }

    const mode = editKpiId ? 'edit' : 'open';
    const deepLinkKey = `${mode}:${deepLinkedKpiId}`;
    if (handledDeepLinkRef.current === deepLinkKey) return;

    if (deepLinkedKpiError) {
      handledDeepLinkRef.current = deepLinkKey;
      toastError.load(deepLinkedKpiError, 'KPI');
      clearActionParams();
      return;
    }

    if (!deepLinkedKpi || deepLinkedKpi.id !== deepLinkedKpiId) return;

    handledDeepLinkRef.current = deepLinkKey;
    if (mode === 'edit' && canEditKpis) {
      setDrawerOpen(false);
      setEditingKpi(deepLinkedKpi);
      setFormOpen(true);
    } else {
      if (mode === 'edit') {
        toastError.api('You do not have permission to edit this KPI.');
      }
      trackEvent(ANALYTICS_EVENTS.KPI_VIEWED, {
        kpi_id: deepLinkedKpi.id,
        source: KPI_VIEW_SOURCES.DEEP_LINK,
        metric_type_tag: deepLinkedKpi.metric_type_tag || null,
      });
      setSelectedKpi(deepLinkedKpi);
      setDrawerOpen(true);
    }

    clearActionParams();
  }, [
    canEditKpis,
    deepLinkedKpi,
    deepLinkedKpiError,
    deepLinkedKpiId,
    editKpiId,
    router,
    searchParams,
  ]);

  // Strip `?create=true` after consuming it on mount so a refresh doesn't
  // re-open the create form.
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      const next = new URLSearchParams(searchParams.toString());
      next.delete('create');
      const qs = next.toString();
      router.replace(qs ? `/kpis?${qs}` : '/kpis', { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFormSuccess = useCallback(() => {
    setCurrentPage(1);
    mutate();
    globalMutate('/api/kpis/program-tags/');
    // Resume-nudge milestone — set regardless of whether a coachmark session is active,
    // so a returning user's progress is accurate (see flow-resume.ts).
    markKpiCreated();
    const walkthrough = useInsightWalkthroughStore.getState();
    // Whatever they skipped on the way here — an optional KPI Type, a hint they clicked past
    // — creating the KPI is the checkpoint, so catch the walkthrough up to it.
    if (
      walkthrough.active &&
      walkthrough.stage &&
      isStageBefore(walkthrough.path, walkthrough.stage, 'dashboard_nudge')
    ) {
      // A full celebration dialog rather than a toast — this is where the flow hands over
      // from KPIs to dashboards, and the handover needs a CTA, not a corner notification.
      setKpiLiveModalOpen(true);
      // The next stage's coachmark points at the Dashboards nav item, which is visible
      // behind this dialog — without suppressing it, congratulations and the nudge land on
      // screen together. Released when the dialog closes, so the nudge is what the user
      // sees next.
      walkthrough.setSuppressCoachmark(true);
      walkthrough.advanceIfBefore('dashboard_nudge');
    }
  }, [mutate, globalMutate, orgSlug]);

  const handleCreate = () => {
    setEditingKpi(null);
    setFormOpen(true);
    const walkthrough = useInsightWalkthroughStore.getState();
    if (walkthrough.active && walkthrough.stage === 'kpi_intro') {
      walkthrough.advanceTo('kpi_metric');
    }
  };

  // `source` distinguishes the card body from the ⋮ → View KPI item: both land here, so
  // without it there is no way to tell which affordance people actually use.
  const handleCardClick = (kpi: KPI, source: KpiViewSource = KPI_VIEW_SOURCES.CARD) => {
    trackEvent(ANALYTICS_EVENTS.KPI_VIEWED, {
      kpi_id: kpi.id,
      source,
      metric_type_tag: kpi.metric_type_tag || null,
    });
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
      // Id read before the mutate() below drops the row from local state.
      trackEvent(ANALYTICS_EVENTS.KPI_DELETED, {
        kpi_id: deletingKpi.id,
        metric_type_tag: deletingKpi.metric_type_tag || null,
      });
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
        <div className="flex items-center justify-between mb-6 p-6 pb-0">
          <div className="flex items-start gap-3">
            {navigationSource && (
              <Button
                data-testid="kpi-back-to-source"
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="mt-0.5"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {getWidgetBackLabel(navigationSource)}
              </Button>
            )}
            <div>
              <DocsLink path="/kpis">
                <h1 className="text-3xl font-bold">Key Performance Indicators</h1>
              </DocsLink>
              <p className="text-muted-foreground mt-1">
                Track business objectives with measurable KPIs linked to your metrics
              </p>
            </div>
          </div>
          {canCreateKpis && (
            <Button variant="primary" onClick={handleCreate} data-testid="create-kpi-btn">
              <Plus className="w-4 h-4 mr-2" />
              CREATE KPI
            </Button>
          )}
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
                    onViewFromMenu={() => handleCardClick(kpi, KPI_VIEW_SOURCES.MENU)}
                    onEdit={() => handleEdit(kpi)}
                    onDelete={() => handleDeleteClick(kpi)}
                    onCreateAlert={() => setAlertKpiId(kpi.id)}
                    canCreateAlert={canCreateAlert}
                    canEditKpis={canEditKpis}
                    canDeleteKpis={canDeleteKpis}
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
                {!search && canCreateKpis && (
                  <Button variant="primary" onClick={handleCreate}>
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

      <CelebrationModal
        open={kpiLiveModalOpen}
        onOpenChange={(open) => {
          setKpiLiveModalOpen(open);
          // Whichever way it closes, the dashboard nudge is the next thing to see.
          if (!open) useInsightWalkthroughStore.getState().setSuppressCoachmark(false);
        }}
        title="Congratulations, your KPI is live!"
        description="Your insight is built, and you can now add it to a dashboard!"
        ctaLabel="Add to Dashboard"
        dismissEvent={ANALYTICS_EVENTS.KPI_LIVE_MODAL_DISMISSED}
        testId="kpi-live-modal"
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

      <AlertWizardModal
        open={alertKpiId !== null}
        onOpenChange={(o) => !o && setAlertKpiId(null)}
        initial={{ alertType: 'kpi_rag', kpiId: alertKpiId }}
        createSource={ALERT_CREATE_SOURCES.KPI_LIST}
      />
    </div>
  );
}
