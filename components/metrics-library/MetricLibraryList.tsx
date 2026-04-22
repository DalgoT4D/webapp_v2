'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MetricLibraryDialog } from './MetricLibraryDialog';
import {
  useMetrics,
  useCreateMetric,
  useUpdateMetric,
  useDeleteMetric,
} from '@/hooks/api/useMetrics';
import { toastError, toastSuccess } from '@/lib/toast';
import type { Metric, MetricCreate } from '@/types/metrics';

interface MetricLibraryListProps {
  canEdit: boolean;
}

export function MetricLibraryList({ canEdit }: MetricLibraryListProps) {
  const { data: metrics, isLoading, mutate: refreshMetrics } = useMetrics();
  const { trigger: createMetric, isMutating: isCreating } = useCreateMetric();
  const { trigger: updateMetric, isMutating: isUpdating } = useUpdateMetric();
  const { trigger: deleteMetric } = useDeleteMetric();
  const { confirm, DialogComponent: DeleteDialog } = useConfirmationDialog();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<Metric | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!metrics) return [];
    if (!search) return metrics;
    const q = search.toLowerCase();
    return metrics.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [metrics, search]);

  const handleSave = async (data: MetricCreate) => {
    try {
      if (editingMetric) {
        await updateMetric({ id: editingMetric.id, data });
        toastSuccess.updated('Metric');
      } else {
        await createMetric(data);
        toastSuccess.created('Metric');
      }
      await refreshMetrics();
      setDialogOpen(false);
      setEditingMetric(null);
    } catch (error: unknown) {
      toastError.save(error, 'Metric');
    }
  };

  const handleDelete = async (m: Metric) => {
    const confirmed = await confirm({
      title: 'Delete Metric?',
      description: `"${m.name}" will be permanently removed. This is blocked when any KPI, alert, or chart references this Metric.`,
      confirmText: 'Delete',
      type: 'warning',
    });
    if (!confirmed) return;
    try {
      await deleteMetric(m.id);
      toastSuccess.deleted(m.name);
      await refreshMetrics();
    } catch (error: unknown) {
      toastError.delete(error, m.name);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const isEmpty = !metrics || metrics.length === 0;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Metrics library</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Saved aggregations reused across KPIs, alerts, and charts.
            </p>
          </div>
          {canEdit && (
            <Button
              onClick={() => {
                setEditingMetric(null);
                setDialogOpen(true);
              }}
              size="sm"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New Metric
            </Button>
          )}
        </div>

        {!isEmpty && (
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search metrics…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        )}

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
            <p className="text-lg font-medium text-muted-foreground mb-2">No Metrics yet</p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              A Metric is a saved aggregation (column + aggregation, or a Calculated SQL
              expression). Once saved, it can back a KPI, an alert, or a chart measure.
            </p>
            {canEdit && (
              <Button
                onClick={() => {
                  setEditingMetric(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Create your first Metric
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Dataset</th>
                  <th className="px-4 py-2.5 font-medium">Mode</th>
                  <th className="px-4 py-2.5 font-medium">Tags</th>
                  {canEdit && <th className="px-4 py-2.5 font-medium w-24">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-t hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">{m.name}</div>
                      {m.description && (
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {m.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground align-top">
                      {m.schema_name}.{m.table_name}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge variant={m.creation_mode === 'sql' ? 'outline' : 'secondary'}>
                        {m.creation_mode === 'sql' ? 'Calculated SQL' : 'Simple'}
                      </Badge>
                      {m.creation_mode === 'simple' && m.simple_terms?.[0] ? (
                        <div className="text-[11px] text-muted-foreground font-mono mt-1">
                          {m.simple_terms[0].agg.toUpperCase()}({m.simple_terms[0].column})
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-1">
                        {m.tags.map((t) => (
                          <Badge key={t} variant="outline" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingMetric(m);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(m)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="flex items-center gap-1 text-xs">
                                <AlertCircle className="h-3 w-3" />
                                Blocked if this Metric has references
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={canEdit ? 5 : 4}
                      className="px-4 py-8 text-center text-sm text-muted-foreground"
                    >
                      <Info className="inline-block h-4 w-4 mr-1.5 align-text-bottom" />
                      No metrics match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <MetricLibraryDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingMetric(null);
          }}
          metric={editingMetric}
          onSave={handleSave}
          isSaving={isCreating || isUpdating}
        />
        <DeleteDialog />
      </div>
    </TooltipProvider>
  );
}
