'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { KPICard } from './KPICard';
import { KPIConfigDialog } from './KPIConfigDialog';
import { KPIDetailDrawer } from './KPIDetailDrawer';
import { KPIAlertsDialog } from './KPIAlertsDialog';
import {
  useKPIs,
  useKPIsData,
  useCreateKPI,
  useUpdateKPI,
  useDeleteKPI,
} from '@/hooks/api/useKPIs';
import { useAlerts } from '@/hooks/api/useAlerts';
import { toastSuccess, toastError } from '@/lib/toast';
import type { KPI, KPICreate } from '@/types/kpis';
import { METRIC_TYPES } from '@/types/kpis';

const GROUP_BY_OPTIONS = [
  { value: 'program', label: 'Program' },
  { value: 'type', label: 'KPI Type' },
  { value: 'none', label: 'None' },
];

interface KPIsListProps {
  canEdit: boolean;
}

export function KPIsList({ canEdit }: KPIsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm, DialogComponent: DeleteDialog } = useConfirmationDialog();
  const { hasPermission } = useUserPermissions();
  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: kpis, isLoading: kpisLoading, mutate: refreshKPIs } = useKPIs();
  const canCreateAlerts = hasPermission('can_create_alerts');
  const canViewAlerts = hasPermission('can_view_alerts');

  const kpiIds = useMemo(() => (kpis || []).map((k) => k.id), [kpis]);

  const { data: kpisData, isLoading: dataLoading } = useKPIsData(kpiIds.length > 0 ? kpiIds : null);

  // Build a map of kpi_id → data point
  const dataMap = useMemo(() => {
    const map = new Map<number, NonNullable<typeof kpisData>[number]>();
    (kpisData || []).forEach((d) => map.set(d.kpi_id, d));
    return map;
  }, [kpisData]);

  // Bulk-fetch every alert in the org, then count per KPI for the linked-alerts
  // dot. One extra request for the whole page — cheap, and keeps the dot in
  // sync when alerts are created/deleted from this page via the alerts dialog.
  const { alerts: allAlerts } = useAlerts(1, 500);
  const linkedAlertCountByKPI = useMemo(() => {
    const counts = new Map<number, number>();
    for (const a of allAlerts) {
      if (a.kpi_id != null) {
        counts.set(a.kpi_id, (counts.get(a.kpi_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [allAlerts]);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<string>('program');

  const programTags = useMemo(() => {
    const tags = [...new Set((kpis || []).map((k) => k.program_tag).filter(Boolean))];
    return tags.sort();
  }, [kpis]);

  const metricTypes = [...METRIC_TYPES];

  const showProgramFilter = programTags.length > 1;
  const showTypeFilter = metricTypes.length > 1;

  const effectiveGroupBy = useMemo(() => {
    if (groupBy === 'program' && programTags.length <= 1) {
      return metricTypes.length > 1 ? 'type' : 'none';
    }
    if (groupBy === 'type' && metricTypes.length <= 1) {
      return 'none';
    }
    return groupBy;
  }, [groupBy, programTags.length, metricTypes.length]);

  // Apply filters
  const filteredKPIs = useMemo(() => {
    let result = kpis || [];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((k) => k.metric.name.toLowerCase().includes(q));
    }

    if (programFilter !== 'all') {
      result = result.filter((k) => k.program_tag === programFilter);
    }

    if (typeFilter !== 'all') {
      result = result.filter((k) => k.metric_type_tag === typeFilter);
    }

    return result;
  }, [kpis, search, programFilter, typeFilter]);

  const groups = useMemo(() => {
    if (effectiveGroupBy === 'none') {
      return [{ key: '', label: '', kpis: filteredKPIs }];
    }

    const tagField = effectiveGroupBy === 'program' ? 'program_tag' : 'metric_type_tag';

    const groupMap = new Map<string, KPI[]>();
    filteredKPIs.forEach((k) => {
      const key = (k as unknown as Record<string, string>)[tagField] || 'Untagged';
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(k);
    });

    return Array.from(groupMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, kpis]) => ({
        key,
        label: key,
        kpis,
      }));
  }, [filteredKPIs, effectiveGroupBy]);

  // ── Config Dialog ─────────────────────────────────────────────────────────
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [editingKPI, setEditingKPI] = useState<KPI | null>(null);

  const { trigger: createKPI, isMutating: isCreating } = useCreateKPI();
  const { trigger: updateKPI, isMutating: isUpdating } = useUpdateKPI();
  const { trigger: deleteKPI } = useDeleteKPI();
  const [viewAlertsKPI, setViewAlertsKPI] = useState<KPI | null>(null);
  const createParam = searchParams.get('create');
  const returnToParam = searchParams.get('returnTo');

  // ── Detail Drawer ─────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedKPI, setSelectedKPI] = useState<KPI | null>(null);

  useEffect(() => {
    if (createParam === '1') {
      setEditingKPI(null);
      setConfigDialogOpen(true);
    }
  }, [createParam]);

  const handleCardClick = (kpi: KPI) => {
    setSelectedKPI(kpi);
    setDrawerOpen(true);
  };

  const handleAddKPI = () => {
    setEditingKPI(null);
    setConfigDialogOpen(true);
  };

  const handleEditKPI = (kpi: KPI) => {
    setDrawerOpen(false);
    setEditingKPI(kpi);
    setConfigDialogOpen(true);
  };

  const handleCreateAlert = (kpi: KPI) => {
    setDrawerOpen(false);
    router.push(`/alerts/new?kpi_id=${kpi.id}`);
  };

  const handleViewAlerts = (kpi: KPI) => {
    setDrawerOpen(false);
    setViewAlertsKPI(kpi);
  };

  const handleDeleteKPI = async (kpi: KPI) => {
    const confirmed = await confirm({
      title: 'Delete KPI?',
      description: `This will permanently delete "${kpi.metric.name}". This action cannot be undone.`,
      confirmText: 'Delete',
      type: 'warning',
    });
    if (!confirmed) return;

    try {
      await deleteKPI(kpi.id);
      toastSuccess.deleted(kpi.metric.name);
      await refreshKPIs();
    } catch (error: unknown) {
      toastError.delete(error, kpi.metric.name);
    }
  };

  const handleSaveKPI = async (data: KPICreate) => {
    try {
      if (editingKPI) {
        // KPI edit sends only KPI-level fields (no inline_metric). The config
        // dialog is responsible for stripping inline_metric from the payload.
        const updatePayload: Partial<KPICreate> = { ...data };
        delete updatePayload.metric_id;
        delete updatePayload.inline_metric;
        await updateKPI({ id: editingKPI.id, data: updatePayload });
        toastSuccess.updated('KPI');
        await refreshKPIs();
        setConfigDialogOpen(false);
        if (createParam === '1') {
          router.replace('/kpis');
        }
        return;
      }

      const createdKPI = (await createKPI(data)) as KPI;
      toastSuccess.created('KPI');
      await refreshKPIs();
      setConfigDialogOpen(false);

      if (returnToParam) {
        const s = new URLSearchParams();
        s.set('kpi_id', String(createdKPI.id));
        router.push(`${returnToParam}?${s.toString()}`);
        return;
      }
      if (createParam === '1') {
        router.replace('/kpis');
      }
    } catch (error: unknown) {
      toastError.save(error, 'KPI');
    }
  };

  // ── Empty / Loading states ────────────────────────────────────────────────
  if (kpisLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl border bg-muted" />
        ))}
      </div>
    );
  }

  const isEmpty = !kpis || kpis.length === 0;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6 p-6">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">KPIs</h1>
          {canEdit && (
            <Button onClick={handleAddKPI} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Add KPI
            </Button>
          )}
        </div>

        {/* Filter bar */}
        {!isEmpty && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search KPIs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {showProgramFilter && (
              <Select value={programFilter} onValueChange={setProgramFilter}>
                <SelectTrigger className="w-44 h-9">
                  <SelectValue placeholder="All programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All programs</SelectItem>
                  {programTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {showTypeFilter && (
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {metricTypes.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {(showProgramFilter || showTypeFilter) && (
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="Group by" />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_BY_OPTIONS.filter((opt) => {
                    if (opt.value === 'program' && programTags.length <= 1) return false;
                    if (opt.value === 'type' && metricTypes.length <= 1) return false;
                    return true;
                  }).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      Group: {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
            <p className="text-lg font-medium text-muted-foreground mb-2">No KPIs configured yet</p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Track your goals with targets and RAG status.
            </p>
            {canEdit && (
              <Button onClick={handleAddKPI}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add Your First KPI
              </Button>
            )}
          </div>
        )}

        {/* KPI groups / cards */}
        {groups.map((group) => (
          <div key={group.key || '__flat'}>
            {group.label && (
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </h2>
                <span className="text-xs text-muted-foreground">({group.kpis.length})</span>
                <div className="flex-1 border-t" />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.kpis.map((kpi) => (
                <KPICard
                  key={kpi.id}
                  kpi={kpi}
                  data={dataMap.get(kpi.id)}
                  linkedAlertCount={linkedAlertCountByKPI.get(kpi.id) ?? 0}
                  isLoading={dataLoading}
                  canEdit={canEdit}
                  canCreateAlert={canCreateAlerts}
                  canViewAlerts={canViewAlerts}
                  onClick={() => handleCardClick(kpi)}
                  onEdit={() => handleEditKPI(kpi)}
                  onCreateAlert={() => handleCreateAlert(kpi)}
                  onViewAlerts={() => handleViewAlerts(kpi)}
                  onDelete={() => handleDeleteKPI(kpi)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Config Dialog */}
        <KPIConfigDialog
          open={configDialogOpen}
          onOpenChange={(open) => {
            setConfigDialogOpen(open);
            if (!open && createParam === '1') {
              router.replace('/kpis');
            }
          }}
          kpi={editingKPI}
          existingProgramTags={programTags}
          onSave={handleSaveKPI}
          isSaving={isCreating || isUpdating}
        />

        {/* Detail Drawer */}
        <KPIDetailDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          kpi={selectedKPI}
          data={selectedKPI ? dataMap.get(selectedKPI.id) : undefined}
          canEdit={canEdit}
          canCreateAlerts={canCreateAlerts}
          canViewAlerts={canViewAlerts}
          onEditKPI={handleEditKPI}
          onCreateAlert={handleCreateAlert}
          onViewAlerts={handleViewAlerts}
        />
        <DeleteDialog />
        <KPIAlertsDialog
          open={Boolean(viewAlertsKPI)}
          onOpenChange={(open) => {
            if (!open) {
              setViewAlertsKPI(null);
            }
          }}
          kpiId={viewAlertsKPI?.id ?? null}
          kpiName={viewAlertsKPI?.metric.name ?? null}
          onAlertSelected={() => {
            setSelectedKPI(null);
            setDrawerOpen(false);
          }}
        />
      </div>
    </TooltipProvider>
  );
}
