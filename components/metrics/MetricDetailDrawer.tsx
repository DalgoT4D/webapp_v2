'use client';

import React, { useState, useMemo } from 'react';
import { Plus, MessageSquare, Quote } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
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
import { useMetricEntries, useCreateEntry } from '@/hooks/api/useMetrics';
import type { MetricDefinition, MetricDataPoint, MetricEntry, RAGStatus } from '@/types/metrics';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatValue(value: number | null | undefined): string {
  if (value == null) return '—';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatPeriodLabel(periodKey: string, timeGrain: string): string {
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

// ── Snapshot badge (compact inline RAG) ────────────────────────────────────

const SNAPSHOT_RAG_COLORS: Record<string, string> = {
  green: 'text-emerald-700',
  amber: 'text-amber-700',
  red: 'text-red-700',
  grey: 'text-gray-500',
};

const SNAPSHOT_RAG_LABELS: Record<string, string> = {
  green: 'On track',
  amber: 'Needs attention',
  red: 'Critical',
  grey: 'No data',
};

// ── Props ──────────────────────────────────────────────────────────────────

interface MetricDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: MetricDefinition | null;
  data?: MetricDataPoint;
  canEdit: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

export function MetricDetailDrawer({
  open,
  onOpenChange,
  metric,
  data,
  canEdit,
}: MetricDetailDrawerProps) {
  const { data: entries, mutate: refreshEntries } = useMetricEntries(
    open && metric ? metric.id : null
  );
  const { trigger: createEntry, isMutating: isCreating } = useCreateEntry(
    metric ? metric.id : null
  );

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
    }
  }, [open, metric]);

  // ── Derived data ──────────────────────────────────────────────────────

  const periodOptions = useMemo(
    () => (metric ? generatePeriodOptions(metric.time_grain) : []),
    [metric]
  );

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    if (filter === 'all') return entries;
    return entries.filter((e) => e.entry_type === filter);
  }, [entries, filter]);

  // Group entries by period
  const groupedEntries = useMemo(() => {
    if (!metric) return [];

    const groups = new Map<string, MetricEntry[]>();

    // Seed all periods from periodOptions so empty ones show
    periodOptions.forEach((p) => {
      groups.set(p.value, []);
    });

    // Fill with actual entries
    filteredEntries.forEach((e) => {
      const list = groups.get(e.period_key) || [];
      list.push(e);
      groups.set(e.period_key, list);
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

  // Compute deltas — build a sorted list of all entries by date asc for delta calculation
  const deltaMap = useMemo(() => {
    if (!entries || entries.length === 0) return new Map<number, number | null>();
    const sorted = [...entries].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const map = new Map<number, number | null>();
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0 || sorted[i].snapshot_value == null) {
        map.set(sorted[i].id, null); // first entry or no snapshot
      } else {
        const prev = sorted[i - 1].snapshot_value;
        const curr = sorted[i].snapshot_value!;
        map.set(sorted[i].id, prev != null ? curr - prev : null);
      }
    }
    return map;
  }, [entries]);

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

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleSaveEntry = async () => {
    if (!entryContent.trim()) return;
    try {
      await createEntry({
        entry_type: entryType,
        period_key: entryPeriod,
        content: entryContent.trim(),
        attribution: entryType === 'quote' ? entryAttribution.trim() : '',
      });
      refreshEntries();
      setShowAddForm(false);
      setEntryContent('');
      setEntryAttribution('');
      setEntryType('comment');
    } catch (err: any) {
      console.error('Failed to create entry:', err);
      alert(err?.message || 'Failed to save entry.');
    }
  };

  if (!metric) return null;

  const currentValue = data?.current_value;
  const ragStatus = (data?.rag_status ?? 'grey') as RAGStatus;
  const trend = data?.trend ?? [];
  const hasTarget = metric.target_value != null;
  const hasEntries = (entries || []).length > 0;

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
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="shrink-0"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Entry
                </Button>
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
                  disabled={!entryContent.trim() || isCreating}
                >
                  {isCreating ? 'Saving...' : 'Save'}
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
                    const delta = deltaMap.get(entry.id);
                    const isQuote = entry.entry_type === 'quote';

                    return (
                      <div
                        key={entry.id}
                        className="relative rounded-lg border bg-card p-3 space-y-2"
                      >
                        {/* Entry type badge */}
                        <div className="flex items-center gap-1.5">
                          {isQuote ? (
                            <Quote className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <MessageSquare className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            {isQuote ? 'Beneficiary Quote' : 'Comment'}
                          </span>
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
                        {entry.snapshot_value != null && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              Value: {formatValue(entry.snapshot_value)}
                              {hasTarget && ` / ${formatValue(metric.target_value)}`}
                            </span>
                            <span
                              className={SNAPSHOT_RAG_COLORS[entry.snapshot_rag] || 'text-gray-500'}
                            >
                              {SNAPSHOT_RAG_LABELS[entry.snapshot_rag] || 'No data'}
                              {entry.snapshot_achievement_pct != null &&
                                ` (${entry.snapshot_achievement_pct}%)`}
                            </span>
                            {delta != null && (
                              <span>
                                {delta >= 0 ? '△ +' : '△ '}
                                {formatValue(delta)} since last entry
                              </span>
                            )}
                            {delta == null &&
                              entries &&
                              entries.indexOf(entry) === entries.length - 1 && (
                                <span className="italic">First entry</span>
                              )}
                          </div>
                        )}

                        {/* Author + timestamp */}
                        <p className="text-[11px] text-muted-foreground/70">
                          by {entry.created_by_name.split('@')[0]} &middot;{' '}
                          {formatTimestamp(entry.created_at)}
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
    </Sheet>
  );
}
