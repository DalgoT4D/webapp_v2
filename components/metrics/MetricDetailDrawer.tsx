'use client';

import React, { useState, useMemo } from 'react';
import { Plus, MessageSquare, Quote, Trash2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RAGBadge } from './RAGBadge';
import { MetricSparkline } from './MetricSparkline';
import { useAnnotations, useSaveAnnotation, useDeleteAnnotation } from '@/hooks/api/useMetrics';
import { toastError, toastSuccess } from '@/lib/toast';
import type {
  AnnotationCreate,
  MetricDefinition,
  MetricDataPoint,
  RAGStatus,
} from '@/types/metrics';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatValue(value: number | null | undefined): string {
  if (value == null) return '—';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatPeriodLabel(periodKey: string | undefined, timeGrain: string): string {
  if (!periodKey) return 'Unknown period';

  if (timeGrain === 'month') {
    // "2026-03" → "March 2026"
    const [year, month] = periodKey.split('-');
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  if (timeGrain === 'quarter') {
    // "2026-Q1" → "Q1 2026"
    return periodKey.replace(/^(\d{4})-/, '$1 ').replace(/(\d{4}) (Q\d)/, '$2 $1');
  }
  return periodKey; // year
}

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function generatePeriodOptions(timeGrain: string): { value: string; label: string }[] {
  const now = new Date();
  const options: { value: string; label: string }[] = [];

  if (timeGrain === 'month') {
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
  } else if (timeGrain === 'quarter') {
    const currentQ = Math.floor(now.getMonth() / 3) + 1;
    for (let i = 0; i < 8; i++) {
      let q = currentQ - i;
      let y = now.getFullYear();
      while (q <= 0) {
        q += 4;
        y -= 1;
      }
      options.push({ value: `${y}-Q${q}`, label: `Q${q} ${y}` });
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const y = now.getFullYear() - i;
      options.push({ value: `${y}`, label: `${y}` });
    }
  }
  return options;
}

type DrawerEntry = {
  key: string;
  annotationId: number;
  entryType: 'comment' | 'quote';
  periodKey: string;
  content: string;
  attribution: string;
  createdAt: string;
  updatedAt: string;
};

// ── Props ──────────────────────────────────────────────────────────────────

interface MetricDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: MetricDefinition | null;
  data?: MetricDataPoint;
  canEdit: boolean;
  canCreateAlerts: boolean;
  canViewAlerts: boolean;
  onEditMetric: (metric: MetricDefinition) => void;
  onCreateAlert: (metric: MetricDefinition) => void;
  onViewAlerts: (metric: MetricDefinition) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function MetricDetailDrawer({
  open,
  onOpenChange,
  metric,
  data,
  canEdit,
  canCreateAlerts,
  canViewAlerts,
  onEditMetric,
  onCreateAlert,
  onViewAlerts,
}: MetricDetailDrawerProps) {
  const { confirm, DialogComponent: DeleteDialog } = useConfirmationDialog();
  const { data: annotations, mutate: refreshAnnotations } = useAnnotations(
    open && metric ? metric.id : null
  );
  const { trigger: saveAnnotation, isMutating: isSaving } = useSaveAnnotation(metric?.id ?? null);
  const { trigger: deleteAnnotation } = useDeleteAnnotation(metric?.id ?? null);

  // ── Add entry form state ──────────────────────────────────────────────
  const [showAddForm, setShowAddForm] = useState(false);
  const [entryType, setEntryType] = useState<'comment' | 'quote'>('comment');
  const [entryPeriod, setEntryPeriod] = useState('');
  const [entryContent, setEntryContent] = useState('');
  const [entryAttribution, setEntryAttribution] = useState('');

  // ── Filter state ──────────────────────────────────────────────────────
  const [filter, setFilter] = useState<'all' | 'comment' | 'quote'>('all');

  // Reset form state when drawer opens/closes
  React.useEffect(() => {
    if (open && metric) {
      setShowAddForm(false);
      setFilter('all');
      const periods = generatePeriodOptions(metric.time_grain);
      setEntryPeriod(periods[0]?.value || '');
      setEntryType('comment');
      setEntryContent('');
      setEntryAttribution('');
    }
  }, [open, metric]);

  // ── Derived data ──────────────────────────────────────────────────────

  const periodOptions = useMemo(
    () => (metric ? generatePeriodOptions(metric.time_grain) : []),
    [metric]
  );

  const allEntries = useMemo<DrawerEntry[]>(() => {
    if (!annotations) return [];

    return annotations.flatMap((annotation) => {
      const items: DrawerEntry[] = [];

      if (annotation.rationale.trim()) {
        items.push({
          key: `${annotation.id}-comment`,
          annotationId: annotation.id,
          entryType: 'comment',
          periodKey: annotation.period_key,
          content: annotation.rationale,
          attribution: '',
          createdAt: annotation.created_at,
          updatedAt: annotation.updated_at,
        });
      }

      if (annotation.quote_text.trim()) {
        items.push({
          key: `${annotation.id}-quote`,
          annotationId: annotation.id,
          entryType: 'quote',
          periodKey: annotation.period_key,
          content: annotation.quote_text,
          attribution: annotation.quote_attribution,
          createdAt: annotation.created_at,
          updatedAt: annotation.updated_at,
        });
      }

      return items;
    });
  }, [annotations]);

  const filteredEntries = useMemo(() => {
    if (filter === 'all') return allEntries;
    return allEntries.filter((entry) => entry.entryType === filter);
  }, [allEntries, filter]);

  // Group entries by period
  const groupedEntries = useMemo(() => {
    if (!metric) return [];

    const groups = new Map<string, DrawerEntry[]>();

    // Seed all periods from periodOptions so empty ones show
    periodOptions.forEach((p) => {
      groups.set(p.value, []);
    });

    // Fill with actual entries
    filteredEntries.forEach((e) => {
      const list = groups.get(e.periodKey) || [];
      list.push(e);
      groups.set(e.periodKey, list);
    });

    // Sort periods descending
    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([period, items]) => ({
        period,
        label: formatPeriodLabel(period, metric.time_grain),
        entries: items,
      }));
  }, [filteredEntries, periodOptions, metric]);

  // Period-over-period change for the header
  const periodChange = useMemo(() => {
    if (!data?.trend || data.trend.length < 2) return null;
    const validPoints = data.trend.filter((t) => t.value != null);
    if (validPoints.length < 2) return null;
    const prev = validPoints[validPoints.length - 2].value!;
    const curr = validPoints[validPoints.length - 1].value!;
    if (prev === 0) return null;
    const pct = ((curr - prev) / Math.abs(prev)) * 100;
    return { pct: Math.round(pct), raw: curr - prev };
  }, [data?.trend]);

  React.useEffect(() => {
    if (!showAddForm) return;

    const existing = annotations?.find((annotation) => annotation.period_key === entryPeriod);
    if (!existing) {
      setEntryContent('');
      setEntryAttribution('');
      return;
    }

    if (entryType === 'comment') {
      setEntryContent(existing.rationale);
      setEntryAttribution('');
      return;
    }

    setEntryContent(existing.quote_text);
    setEntryAttribution(existing.quote_attribution);
  }, [annotations, entryPeriod, entryType, showAddForm]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleSaveEntry = async () => {
    if (!entryContent.trim()) return;

    const existing = annotations?.find((annotation) => annotation.period_key === entryPeriod);
    const payload: AnnotationCreate =
      entryType === 'comment'
        ? {
            period_key: entryPeriod,
            rationale: entryContent.trim(),
            quote_text: existing?.quote_text ?? '',
            quote_attribution: existing?.quote_attribution ?? '',
          }
        : {
            period_key: entryPeriod,
            rationale: existing?.rationale ?? '',
            quote_text: entryContent.trim(),
            quote_attribution: entryAttribution.trim(),
          };

    try {
      await saveAnnotation(payload);
      refreshAnnotations();
      toastSuccess.saved('Metric note');
      setShowAddForm(false);
      setEntryContent('');
      setEntryAttribution('');
      setEntryType('comment');
    } catch (error: unknown) {
      console.error('Failed to save metric note:', error);
      toastError.save(error, 'metric note');
    }
  };

  const handleDeleteEntry = async (entry: DrawerEntry) => {
    const confirmed = await confirm({
      title: `Delete ${entry.entryType === 'quote' ? 'beneficiary quote' : 'comment'}?`,
      description: 'This cannot be undone.',
      confirmText: 'Delete',
      type: 'warning',
    });
    if (!confirmed) return;

    const existing = annotations?.find((annotation) => annotation.id === entry.annotationId);
    if (!existing) return;

    try {
      const nextRationale = entry.entryType === 'comment' ? '' : existing.rationale;
      const nextQuoteText = entry.entryType === 'quote' ? '' : existing.quote_text;
      const nextQuoteAttribution = entry.entryType === 'quote' ? '' : existing.quote_attribution;

      if (!nextRationale.trim() && !nextQuoteText.trim()) {
        await deleteAnnotation(existing.id);
      } else {
        await saveAnnotation({
          period_key: existing.period_key,
          rationale: nextRationale,
          quote_text: nextQuoteText,
          quote_attribution: nextQuoteAttribution,
        });
      }

      refreshAnnotations();
      toastSuccess.deleted('Metric note');
    } catch (error: unknown) {
      console.error('Failed to delete metric note:', error);
      toastError.delete(error, 'metric note');
    }
  };

  if (!metric) return null;

  const currentValue = data?.current_value;
  const ragStatus = (data?.rag_status ?? 'grey') as RAGStatus;
  const trend = data?.trend ?? [];
  const hasTarget = metric.target_value != null;
  const hasEntries = allEntries.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] flex flex-col p-0 overflow-hidden"
      >
        {/* ── Fixed header ────────────────────────────────────────── */}
        <div className="border-b px-6 pt-6 pb-4 space-y-4">
          <SheetHeader className="p-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg">
                {metric.name}
                <span className="ml-1.5 text-sm text-muted-foreground font-normal">
                  {metric.direction === 'decrease' ? '↓' : '↑'}
                </span>
              </SheetTitle>
              {(canEdit || canCreateAlerts || canViewAlerts) && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEditMetric(metric)}
                      className="shrink-0"
                    >
                      Edit metric
                    </Button>
                  )}
                  {canViewAlerts && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onViewAlerts(metric)}
                      className="shrink-0"
                    >
                      View alerts
                    </Button>
                  )}
                  {canCreateAlerts && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onCreateAlert(metric)}
                      className="shrink-0"
                    >
                      Create alert
                    </Button>
                  )}
                  {canEdit ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAddForm(!showAddForm)}
                      className="shrink-0"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add Entry
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
            <SheetDescription className="sr-only">Activity feed for {metric.name}</SheetDescription>
          </SheetHeader>

          {/* Metric summary */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tabular-nums">{formatValue(currentValue)}</span>
                {hasTarget && (
                  <span className="text-sm text-muted-foreground">
                    / {formatValue(metric.target_value)}
                  </span>
                )}
              </div>
              <RAGBadge
                status={ragStatus}
                achievementPct={data?.achievement_pct}
                hasTarget={hasTarget}
                hasError={!!data?.error}
              />
            </div>

            {/* Sparkline */}
            {trend.length >= 2 && (
              <MetricSparkline
                data={trend}
                direction={metric.direction}
                width={400}
                height={48}
                className="w-full"
              />
            )}

            {/* Period-over-period change */}
            {periodChange && (
              <p className="text-xs text-muted-foreground">
                {periodChange.pct >= 0 ? '+' : ''}
                {periodChange.pct}% from last period
              </p>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1">
            {(['all', 'comment', 'quote'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  filter === f
                    ? 'bg-foreground text-background font-medium'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {f === 'all' ? 'All' : f === 'comment' ? 'Comments' : 'Quotes'}
              </button>
            ))}
            {hasEntries && (
              <span className="ml-auto text-xs text-muted-foreground self-center">
                {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
              </span>
            )}
          </div>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {/* Inline add form */}
          {showAddForm && (
            <div className="rounded-lg border-2 border-dashed p-4 mb-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">New Entry</p>

              {/* Type toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setEntryType('comment')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    entryType === 'comment'
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <MessageSquare className="h-3 w-3" />
                  Comment
                </button>
                <button
                  onClick={() => setEntryType('quote')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    entryType === 'quote'
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Quote className="h-3 w-3" />
                  Beneficiary Quote
                </button>
              </div>

              {/* Period selector */}
              <div className="grid gap-1.5">
                <Label className="text-xs">Period</Label>
                <Select value={entryPeriod} onValueChange={setEntryPeriod}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {periodOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Content */}
              <Textarea
                placeholder={
                  entryType === 'comment'
                    ? 'Write your comment...'
                    : 'Enter the beneficiary quote...'
                }
                value={entryContent}
                onChange={(e) => setEntryContent(e.target.value)}
                rows={3}
                className="text-sm"
              />

              {/* Attribution (quotes only) */}
              {entryType === 'quote' && (
                <Input
                  placeholder="Attribution — e.g. Beneficiary, Karnataka"
                  value={entryAttribution}
                  onChange={(e) => setEntryAttribution(e.target.value)}
                  className="h-8 text-sm"
                />
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setEntryContent('');
                    setEntryAttribution('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveEntry}
                  disabled={!entryContent.trim() || isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          )}

          {/* Timeline */}
          {groupedEntries.map((group) => (
            <div key={group.period}>
              {/* Period divider */}
              <div className="flex items-center gap-2 py-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  {group.label}
                </span>
                <div className="flex-1 border-t" />
              </div>

              {/* Entries for this period */}
              {group.entries.length > 0 ? (
                <div className="space-y-3 ml-2 pl-3 border-l-2 border-muted">
                  {group.entries.map((entry) => {
                    const isQuote = entry.entryType === 'quote';

                    return (
                      <div
                        key={entry.key}
                        className="relative rounded-lg border bg-card p-3 space-y-2"
                      >
                        {/* Entry type badge + delete */}
                        <div className="flex items-center gap-1.5">
                          {isQuote ? (
                            <Quote className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <MessageSquare className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            {isQuote ? 'Beneficiary Quote' : 'Comment'}
                          </span>
                          {canEdit && (
                            <button
                              onClick={() => handleDeleteEntry(entry)}
                              className="ml-auto p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Delete entry"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Content */}
                        {isQuote ? (
                          <blockquote className="text-sm italic border-l-2 border-muted-foreground/30 pl-3">
                            &ldquo;{entry.content}&rdquo;
                          </blockquote>
                        ) : (
                          <p className="text-sm">{entry.content}</p>
                        )}

                        {/* Quote attribution */}
                        {isQuote && entry.attribution && (
                          <p className="text-xs text-muted-foreground">— {entry.attribution}</p>
                        )}

                        {/* Snapshot */}
                        {/* Timestamp */}
                        <p className="text-[11px] text-muted-foreground/70">
                          Saved {formatTimestamp(entry.updatedAt || entry.createdAt)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="ml-2 pl-3 border-l-2 border-muted py-2 text-xs text-muted-foreground/50 italic">
                  No entries this period
                </p>
              )}
            </div>
          ))}

          {/* Empty state */}
          {!hasEntries && !showAddForm && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">No entries yet</p>
              <p className="text-xs text-muted-foreground/70 mb-4 max-w-[240px]">
                Add comments or beneficiary quotes to build a timeline for this metric.
              </p>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add First Entry
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
      <DeleteDialog />
    </Sheet>
  );
}
