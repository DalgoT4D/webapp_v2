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
import { MetricCard } from './MetricCard';
import { MetricConfigDialog } from './MetricConfigDialog';
import { MetricDetailDrawer } from './MetricDetailDrawer';
import { MetricAlertsDialog } from './MetricAlertsDialog';
import {
  useMetrics,
  useMetricsData,
  useCreateMetric,
  useUpdateMetric,
  useDeleteMetric,
} from '@/hooks/api/useMetrics';
import { toastSuccess, toastError } from '@/lib/toast';
import type { MetricDefinition, MetricCreate } from '@/types/metrics';
import { METRIC_TYPES } from '@/types/metrics';

const GROUP_BY_OPTIONS = [
  { value: 'program', label: 'Program' },
  { value: 'type', label: 'Metric Type' },
  { value: 'none', label: 'None' },
];

interface MetricsListProps {
  canEdit: boolean;
}

export function MetricsList({ canEdit }: MetricsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm, DialogComponent: DeleteDialog } = useConfirmationDialog();
  const { hasPermission } = useUserPermissions();
  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: metrics, isLoading: metricsLoading, mutate: refreshMetrics } = useMetrics();
  const canCreateAlerts = hasPermission('can_create_alerts');
  const canViewAlerts = hasPermission('can_view_alerts');

  const metricIds = useMemo(() => (metrics || []).map((m) => m.id), [metrics]);

  const { data: metricsData, isLoading: dataLoading } = useMetricsData(
    metricIds.length > 0 ? metricIds : null
  );

  // Build a map of metric_id → data point
  const dataMap = useMemo(() => {
    const map = new Map<number, typeof metricsData extends Array<infer U> ? U : never>();
    (metricsData || []).forEach((d) => map.set(d.metric_id, d));
    return map;
  }, [metricsData]);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<string>('program');

  // Derive unique tags
  const programTags = useMemo(() => {
    const tags = [...new Set((metrics || []).map((m) => m.program_tag).filter(Boolean))];
    return tags.sort();
  }, [metrics]);

  const metricTypes = [...METRIC_TYPES];

  // Auto-detect: hide filter if only one value
  const showProgramFilter = programTags.length > 1;
  const showTypeFilter = metricTypes.length > 1;

  // Auto-detect groupBy: if only 1 program, default to 'type' or 'none'
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
  const filteredMetrics = useMemo(() => {
    let result = metrics || [];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((m) => m.name.toLowerCase().includes(q));
    }

    if (programFilter !== 'all') {
      result = result.filter((m) => m.program_tag === programFilter);
    }

    if (typeFilter !== 'all') {
      result = result.filter((m) => m.metric_type_tag === typeFilter);
    }

    return result;
  }, [metrics, search, programFilter, typeFilter]);

  // Group metrics
  const groups = useMemo(() => {
    if (effectiveGroupBy === 'none') {
      return [{ key: '', label: '', metrics: filteredMetrics }];
    }

    const tagField = effectiveGroupBy === 'program' ? 'program_tag' : 'metric_type_tag';

    const groupMap = new Map<string, MetricDefinition[]>();
    filteredMetrics.forEach((m) => {
      const key = (m as any)[tagField] || 'Untagged';
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(m);
    });

    return Array.from(groupMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, metrics]) => ({
        key,
        label: key,
        metrics,
      }));
  }, [filteredMetrics, effectiveGroupBy]);

  // ── Config Dialog ─────────────────────────────────────────────────────────
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<MetricDefinition | null>(null);

  const { trigger: createMetric, isMutating: isCreating } = useCreateMetric();
  const { trigger: updateMetric, isMutating: isUpdating } = useUpdateMetric();
  const { trigger: deleteMetric } = useDeleteMetric();
  const [viewAlertsMetric, setViewAlertsMetric] = useState<MetricDefinition | null>(null);
  const createParam = searchParams.get('create');
  const returnToParam = searchParams.get('returnTo');

  // ── Detail Drawer ─────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<MetricDefinition | null>(null);

  useEffect(() => {
    if (createParam === '1') {
      setEditingMetric(null);
      setConfigDialogOpen(true);
    }
  }, [createParam]);

  const handleCardClick = (metric: MetricDefinition) => {
    setSelectedMetric(metric);
    setDrawerOpen(true);
  };

  const handleAddMetric = () => {
    setEditingMetric(null);
    setConfigDialogOpen(true);
  };

  const handleEditMetric = (metric: MetricDefinition) => {
    setDrawerOpen(false);
    setEditingMetric(metric);
    setConfigDialogOpen(true);
  };

  const handleCreateAlert = (metric: MetricDefinition) => {
    setDrawerOpen(false);
    router.push(`/alerts/new?metric_id=${metric.id}`);
  };

  const handleViewAlerts = (metric: MetricDefinition) => {
    setDrawerOpen(false);
    setViewAlertsMetric(metric);
  };

  const handleDeleteMetric = async (metric: MetricDefinition) => {
    const confirmed = await confirm({
      title: 'Delete metric?',
      description: `This will permanently delete "${metric.name}". This action cannot be undone.`,
      confirmText: 'Delete',
      type: 'warning',
    });
    if (!confirmed) return;

    try {
      await deleteMetric(metric.id);
      toastSuccess.deleted(metric.name);
      await refreshMetrics();
    } catch (error: unknown) {
      toastError.delete(error, metric.name);
    }
  };

  const handleSaveMetric = async (data: MetricCreate) => {
    try {
      if (editingMetric) {
        await updateMetric({ id: editingMetric.id, data });
        toastSuccess.updated('Metric');
        await refreshMetrics();
        setConfigDialogOpen(false);
        if (createParam === '1') {
          router.replace('/metrics');
        }
        return;
      } else {
        const createdMetric = (await createMetric(data)) as MetricDefinition;
        toastSuccess.created('Metric');
        await refreshMetrics();
        setConfigDialogOpen(false);

        if (returnToParam) {
          const search = new URLSearchParams();
          search.set('metric_id', String(createdMetric.id));
          router.push(`${returnToParam}?${search.toString()}`);
          return;
        }
      }
      if (createParam === '1') {
        router.replace('/metrics');
      }
    } catch (error: unknown) {
      toastError.save(error, 'metric');
    }
  };

  // ── Empty / Loading states ────────────────────────────────────────────────
  if (metricsLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl border bg-muted" />
        ))}
      </div>
    );
  }

  const isEmpty = !metrics || metrics.length === 0;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6 p-6">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">My Metrics</h1>
          {canEdit && (
            <Button onClick={handleAddMetric} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Metric
            </Button>
          )}
        </div>

        {/* Filter bar */}
        {!isEmpty && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search metrics..."
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

            {/* Program filter */}
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

            {/* Metric type filter */}
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

            {/* Group by */}
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
            <p className="text-lg font-medium text-muted-foreground mb-2">
              No metrics configured yet
            </p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Add metrics from your warehouse to track KPIs with targets and RAG status.
            </p>
            {canEdit && (
              <Button onClick={handleAddMetric}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add Your First Metric
              </Button>
            )}
          </div>
        )}

        {/* Metric groups / cards */}
        {groups.map((group) => (
          <div key={group.key || '__flat'}>
            {/* Group header */}
            {group.label && (
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </h2>
                <span className="text-xs text-muted-foreground">({group.metrics.length})</span>
                <div className="flex-1 border-t" />
              </div>
            )}

            {/* Card grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.metrics.map((metric) => (
                <MetricCard
                  key={metric.id}
                  metric={metric}
                  data={dataMap.get(metric.id)}
                  isLoading={dataLoading}
                  canEdit={canEdit}
                  canCreateAlert={canCreateAlerts}
                  canViewAlerts={canViewAlerts}
                  onClick={() => handleCardClick(metric)}
                  onEdit={() => handleEditMetric(metric)}
                  onCreateAlert={() => handleCreateAlert(metric)}
                  onViewAlerts={() => handleViewAlerts(metric)}
                  onDelete={() => handleDeleteMetric(metric)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Config Dialog */}
        <MetricConfigDialog
          open={configDialogOpen}
          onOpenChange={(open) => {
            setConfigDialogOpen(open);
            if (!open && createParam === '1') {
              router.replace('/metrics');
            }
          }}
          metric={editingMetric}
          existingProgramTags={programTags}
          onSave={handleSaveMetric}
          isSaving={isCreating || isUpdating}
        />

        {/* Detail Drawer */}
        <MetricDetailDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          metric={selectedMetric}
          data={selectedMetric ? dataMap.get(selectedMetric.id) : undefined}
          canEdit={canEdit}
          canCreateAlerts={canCreateAlerts}
          canViewAlerts={canViewAlerts}
          onEditMetric={handleEditMetric}
          onCreateAlert={handleCreateAlert}
          onViewAlerts={handleViewAlerts}
        />
        <DeleteDialog />
        <MetricAlertsDialog
          open={Boolean(viewAlertsMetric)}
          onOpenChange={(open) => {
            if (!open) {
              setViewAlertsMetric(null);
            }
          }}
          metricId={viewAlertsMetric?.id ?? null}
          metricName={viewAlertsMetric?.name ?? null}
          onAlertSelected={() => {
            setSelectedMetric(null);
            setDrawerOpen(false);
          }}
        />
      </div>
    </TooltipProvider>
  );
}
