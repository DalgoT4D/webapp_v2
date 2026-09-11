'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import {
  Plus,
  Search,
  Share2,
  Target,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  BellRing,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  User,
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
import { useKPIs, fetchKPI, useKPIData, deleteKPI, useProgramTags } from '@/hooks/api/useKPIs';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { useAuthStore } from '@/stores/authStore';
import {
  markKpiCreated,
  isStageBefore,
} from '@/components/onboarding/insight-walkthrough-constants';
import { CelebrationModal } from '@/components/onboarding/celebration-modal';
import { AlertWizardModal } from '@/components/alerts/AlertWizardModal';
import { ShareModal } from '@/components/ui/share-modal';
import { useOpenShareDeepLink } from '@/hooks/useOpenShareDeepLink';
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
  onShare,
  canCreateAlert,
  canEditKpis,
  canDeleteKpis,
  canShare,
  statusFilter,
}: {
  kpi: KPI;
  onClick: () => void;
  /** ⋮ → View KPI. Same drawer as onClick, tracked with its own source. */
  onViewFromMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCreateAlert?: () => void;
  onShare?: () => void;
  canCreateAlert?: boolean;
  canEditKpis?: boolean;
  canDeleteKpis?: boolean;
  canShare?: boolean;
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
            {canShare && onShare && (
              <DropdownMenuItem onClick={onShare} className="cursor-pointer">
                <Share2 className="w-4 h-4 mr-2" />
                Share
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
  const queryString = searchParams.toString();
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
  // The KPI the walkthrough just created, waiting for its drawer to be opened for the user —
  // see the effect below.
  const [pendingWalkthroughKpiId, setPendingWalkthroughKpiId] = useState<number | null>(null);
  const [editingKpi, setEditingKpi] = useState<KPI | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<KPI | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingKpi, setDeletingKpi] = useState<KPI | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [alertKpiId, setAlertKpiId] = useState<number | null>(null);
  const [shareModalKpi, setShareModalKpi] = useState<KPI | null>(null);
  const { initialOpen: shouldAutoOpenShare, clearParam: clearShareDeepLink } = useOpenShareDeepLink(
    ['kpiId']
  );

  // Subscribed rather than read through getState(): the drawer has to close when the
  // walkthrough moves on, which is a state change nothing on this page triggers itself.
  const walkthroughActive = useInsightWalkthroughStore((state) => state.active);
  const walkthroughStage = useInsightWalkthroughStore((state) => state.stage);

  const { hasPermission } = useRbac();
  // Creation is role-based; editing an existing KPI uses its effective access level.
  const canCreateKpis = hasPermission(PERMISSIONS.CAN_CREATE_KPIS);
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

  const { tags: programTags } = useProgramTags();
  const { mutate: globalMutate } = useSWRConfig();

  // Dashboard/report links fetch the KPI directly by id, rather than searching the
  // current paginated list. After consuming the action, keep `from` in the URL so
  // the page can offer the same source-aware back action as chart detail pages.
  useEffect(() => {
    const params = new URLSearchParams(queryString);
    const hasOpenParam = params.has('open');
    const hasEditParam = params.has('edit');
    if (!hasOpenParam && !hasEditParam) {
      handledDeepLinkRef.current = null;
      return undefined;
    }

    const clearActionParams = () => {
      const next = new URLSearchParams(queryString);
      next.delete('open');
      next.delete('edit');
      const qs = next.toString();
      router.replace(qs ? `/kpis?${qs}` : '/kpis', { scroll: false });
    };

    if (!deepLinkedKpiId) {
      clearActionParams();
      return undefined;
    }

    const mode = editKpiId ? 'edit' : 'open';
    const deepLinkKey = `${selectedOrgSlug}:${mode}:${deepLinkedKpiId}`;
    if (handledDeepLinkRef.current === deepLinkKey) return undefined;

    const controller = new AbortController();
    // Open once from a fresh response. Subsequent cache updates must not reset a
    // dirty form, and an old request must not open after navigation or an org switch.
    fetchKPI(deepLinkedKpiId, controller.signal)
      .then((kpi) => {
        if (controller.signal.aborted) return;
        handledDeepLinkRef.current = deepLinkKey;
        void globalMutate(`/api/kpis/${kpi.id}/`, kpi, { revalidate: false });
        if (mode === 'edit' && kpi.access_level === 'edit') {
          setDrawerOpen(false);
          setEditingKpi(kpi);
          setFormOpen(true);
        } else {
          if (mode === 'edit') {
            toastError.api('You do not have permission to edit this KPI.');
          }
          trackEvent(ANALYTICS_EVENTS.KPI_VIEWED, {
            kpi_id: kpi.id,
            source: KPI_VIEW_SOURCES.DEEP_LINK,
            metric_type_tag: kpi.metric_type_tag || null,
          });
          setSelectedKpi(kpi);
          setDrawerOpen(true);
        }
        clearActionParams();
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        handledDeepLinkRef.current = deepLinkKey;
        toastError.load(error, 'KPI');
        clearActionParams();
      });

    return () => controller.abort();
  }, [deepLinkedKpiId, editKpiId, globalMutate, queryString, router, selectedOrgSlug]);

  // Auto-open share modal when ?openShare=true&kpiId={id} is in the URL —
  // deep link from an access-request notification.
  useEffect(() => {
    if (!shouldAutoOpenShare || kpis.length === 0) return;
    const kpiId = searchParams.get('kpiId');
    if (!kpiId) return;
    const kpi = kpis.find((k) => k.id === parseInt(kpiId));
    if (kpi) {
      setShareModalKpi(kpi);
    }
    clearShareDeepLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoOpenShare, kpis]);

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

  // The dashboard nudge rings a sidebar item the 600px drawer covers. Normally the user closes
  // the drawer themselves (kpi_close_drawer); this is the safety net for every other route in.
  useEffect(() => {
    if (walkthroughActive && walkthroughStage === 'dashboard_nudge') setDrawerOpen(false);
  }, [walkthroughActive, walkthroughStage]);

  /**
   * Open the drawer on the KPI the walkthrough just created, once the celebration dialog is out
   * of the way.
   *
   * Waits on the refetched list rather than opening from the create response: the drawer needs a
   * full KPI object, and `mutate()` is what produces it.
   *
   * Coachmarks stay suppressed until the drawer is up, so nothing flashes on the list behind
   * it. If the refetch never yields the id, suppression lifts and kpi_duration waits.
   */
  useEffect(() => {
    if (pendingWalkthroughKpiId === null || kpiLiveModalOpen) return;
    const created = kpis.find((k) => k.id === pendingWalkthroughKpiId);
    const walkthrough = useInsightWalkthroughStore.getState();
    if (!created) {
      if (!isLoading) {
        setPendingWalkthroughKpiId(null);
        walkthrough.setSuppressCoachmark(false);
      }
      return;
    }
    trackEvent(ANALYTICS_EVENTS.KPI_VIEWED, {
      kpi_id: created.id,
      source: KPI_VIEW_SOURCES.WALKTHROUGH,
      metric_type_tag: created.metric_type_tag || null,
    });
    setSelectedKpi(created);
    setDrawerOpen(true);
    setPendingWalkthroughKpiId(null);
    if (walkthrough.active) walkthrough.advanceIfBefore('kpi_duration');
    walkthrough.setSuppressCoachmark(false);
  }, [pendingWalkthroughKpiId, kpiLiveModalOpen, kpis, isLoading]);

  const handleFormSuccess = useCallback(
    (createdKpiId?: number) => {
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
        isStageBefore(walkthrough.path, walkthrough.stage, 'kpi_duration')
      ) {
        // A full celebration dialog rather than a toast — this is the moment the thing they came
        // to build exists, and it needs a CTA. That CTA opens the drawer directly.
        setKpiLiveModalOpen(true);
        // Nothing else on screen while the congratulations are up. Released when the dialog
        // closes, at which point the drawer this hands them into is what they see.
        walkthrough.setSuppressCoachmark(true);
        // Straight into the KPI — the dialog's CTA already says "View KPI". Opened once that
        // dialog closes; see the effect above, which also advances into the drawer.
        if (createdKpiId !== undefined) setPendingWalkthroughKpiId(createdKpiId);
        // Advanced here too: creating the KPI is the checkpoint whether or not the drawer opens,
        // so a create that returns no id can't strand the walkthrough on a closed dialog.
        walkthrough.advanceIfBefore('kpi_duration');
      }
    },
    [mutate, globalMutate, orgSlug]
  );

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

  /**
   * Closing the drawer is the walkthrough's kpi_close_drawer step. Advancing here rather than
   * from the coachmark catches every way out — the ✕, Escape, a click on the backdrop.
   */
  const handleDrawerOpenChange = (open: boolean) => {
    setDrawerOpen(open);
    if (open) return;
    const walkthrough = useInsightWalkthroughStore.getState();
    if (walkthrough.active && walkthrough.stage === 'kpi_close_drawer') {
      walkthrough.advanceTo('dashboard_nudge');
    }
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
          {/* p-1.5 is a clip allowance, not spacing. `overflow-y: auto` forces overflow-x to
              compute to `auto` as well, so this scroller clips on all four sides — and the grid
              inside sat flush against every one of them. Anything a card paints outside its own
              box was cut off: the cards' hover shadow, and the onboarding walkthrough's ring
              (2px at a 4px offset = 6px), which lost whichever edges were flush and rendered as
              a half-drawn box. 6px of room is enough for both. */}
          <div className="flex-1 overflow-y-auto p-1.5">
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
                    onShare={() => setShareModalKpi(kpi)}
                    canCreateAlert={canCreateAlert}
                    canEditKpis={kpi.access_level === 'edit'}
                    canDeleteKpis={canDeleteKpis}
                    canShare={kpi.access_level === 'edit'}
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
          // Whichever way it closes — the CTA or the ✕ — the KPI itself is the next thing to
          // see, and the effect above opens its drawer and lifts the suppression with it. Only
          // released here when there is no KPI to open, so the walkthrough is never left silent.
          if (!open && pendingWalkthroughKpiId === null) {
            useInsightWalkthroughStore.getState().setSuppressCoachmark(false);
          }
        }}
        title="Congratulations, your KPI is live!"
        description="Take a look at what you just built — its value, its trend, and how it is doing against your target."
        ctaLabel="View KPI"
        dismissEvent={ANALYTICS_EVENTS.KPI_LIVE_MODAL_DISMISSED}
        testId="kpi-live-modal"
      />

      <KPIDetailDrawer
        kpi={selectedKpi}
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
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

      {shareModalKpi && (
        <ShareModal
          rtype="kpi"
          entityId={shareModalKpi.id}
          entityLabel={shareModalKpi.name}
          isOpen={shareModalKpi !== null}
          onClose={() => {
            setShareModalKpi(null);
            clearShareDeepLink();
          }}
          onUpdate={mutate}
        />
      )}
    </div>
  );
}
