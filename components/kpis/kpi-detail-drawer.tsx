'use client';

import { useState, useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { format as formatDate } from 'date-fns';
import { formatMetricValue, computePopChanges } from '@/lib/formatters';
import { useAuthStore } from '@/stores/authStore';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil, X, MoreVertical, Trash2, BellRing } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DurationPicker } from '@/components/ui/duration-picker';
import {
  useKPIData,
  useAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
} from '@/hooks/api/useKPIs';
import type { KPI, NoteType } from '@/types/kpis';
import type { RAGStatus } from '@/types/kpis';
import { RAG_COLORS, TIME_GRAIN_OPTIONS } from '@/types/kpis';
import { formatDistanceToNow } from 'date-fns';
import { toastSuccess, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { AlertWizardModal } from '@/components/alerts/AlertWizardModal';
import { ALERT_PERMISSIONS } from '@/types/alerts';
import { useUserPermissions } from '@/hooks/api/usePermissions';

const grainLabel: Record<string, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
  yearly: 'year',
};

interface KPIDetailDrawerProps {
  kpi: KPI | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function TrendChart({ config, height = 'h-64' }: { config: Record<string, any>; height?: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || !config || Object.keys(config).length === 0) return;

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
      <div className={`${height} flex items-center justify-center text-sm text-muted-foreground`}>
        Not enough data for a trend yet.
      </div>
    );
  }

  return <div ref={chartRef} className={`${height} w-full`} />;
}

export function KPIDetailDrawer({
  kpi,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: KPIDetailDrawerProps) {
  const [timeGrain, setTimeGrain] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [defaultPeriods, setDefaultPeriods] = useState<
    { period: string; period_date: string | null; value: number | null }[]
  >([]);
  const [alertWizardOpen, setAlertWizardOpen] = useState(false);
  const { hasPermission: hasAlertPermission } = useUserPermissions();
  const canCreateAlert = hasAlertPermission(ALERT_PERMISSIONS.create);

  // Reset filters when KPI changes or drawer closes
  useEffect(() => {
    if (kpi && open) {
      setTimeGrain(kpi.time_grain);
      setDateFrom(undefined);
      setDateTo(undefined);
      setDefaultPeriods([]);
    }
  }, [kpi?.id, open]);

  const activeTimeGrain = timeGrain || kpi?.time_grain || '';

  const { chartData, echartsConfig, isLoading } = useKPIData(
    open && kpi ? kpi.id : null,
    undefined,
    {
      timeGrain: activeTimeGrain !== kpi?.time_grain ? activeTimeGrain : undefined,
      dateFrom: dateFrom ? formatDate(dateFrom, 'yyyy-MM-dd') : undefined,
      dateTo: dateTo ? formatDate(dateTo, 'yyyy-MM-dd') : undefined,
    }
  );

  // Capture default periods from the first fetch (KPI's own time grain)
  useEffect(() => {
    if (chartData?.periods && defaultPeriods.length === 0) {
      setDefaultPeriods(chartData.periods);
    }
  }, [chartData?.periods, defaultPeriods.length]);

  if (!kpi) return null;

  const ragStatus = chartData?.rag_status as RAGStatus | null;
  const ragInfo = ragStatus ? RAG_COLORS[ragStatus] : null;
  const currentValue = chartData?.current_value;
  const periods = chartData?.periods || [];

  const lastTwo = periods.slice(-2).map((p) => p.value);
  const popChange = computePopChanges(lastTwo)[1] ?? null;

  const isPositiveChange =
    popChange !== null &&
    ((kpi.direction === 'increase' && popChange > 0) ||
      (kpi.direction === 'decrease' && popChange < 0));
  const isNegativeChange =
    popChange !== null &&
    ((kpi.direction === 'increase' && popChange < 0) ||
      (kpi.direction === 'decrease' && popChange > 0));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:max-w-[600px] p-0 overflow-y-auto [&>button]:hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b">
          <div className="flex items-start justify-between gap-2">
            <div>
              <a
                href={`/metrics?highlight=${kpi.metric.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-semibold text-gray-900 hover:underline block"
              >
                {kpi.name}
              </a>
              <p className="text-sm text-muted-foreground">
                {kpi.metric.description && <>{kpi.metric.description} &middot; </>}
                <span style={{ color: 'var(--primary)' }}>
                  {kpi.metric.schema_name}.{kpi.metric.table_name}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {canCreateAlert && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setAlertWizardOpen(true)}
                  aria-label="Create alert"
                  title="Create alert"
                >
                  <BellRing className="w-4 h-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Value section */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-start justify-between">
            <div>
              {isLoading ? (
                <Skeleton className="h-12 w-32" />
              ) : (
                <>
                  <p className="text-4xl font-bold text-gray-900">
                    {formatMetricValue(currentValue)}
                  </p>
                  {kpi.target_value !== null && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Target: {formatMetricValue(kpi.target_value)}
                    </p>
                  )}
                  {popChange !== null && (
                    <p
                      className={`text-sm font-medium mt-0.5 ${
                        isPositiveChange
                          ? 'text-green-600'
                          : isNegativeChange
                            ? 'text-red-600'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {popChange > 0 ? '\u2191' : popChange < 0 ? '\u2193' : '\u2014'}{' '}
                      {popChange > 0 ? '+' : ''}
                      {popChange.toFixed(1)}% from last {grainLabel[activeTimeGrain] || 'period'}
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <DurationPicker
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  onApply={(from, to) => {
                    setDateFrom(from);
                    setDateTo(to);
                  }}
                  minDate={
                    defaultPeriods[0]?.period_date
                      ? new Date(defaultPeriods[0].period_date)
                      : undefined
                  }
                  maxDate={
                    defaultPeriods[defaultPeriods.length - 1]?.period_date
                      ? new Date(defaultPeriods[defaultPeriods.length - 1].period_date)
                      : undefined
                  }
                />
                <Select value={activeTimeGrain} onValueChange={setTimeGrain}>
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_GRAIN_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {ragInfo && (
                <Badge
                  variant="outline"
                  className={`${ragInfo.bg} ${ragInfo.text} border-0 text-xs`}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${ragInfo.dot}`} />
                  {ragInfo.label}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="px-4 pb-2">
          {isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <TrendChart config={echartsConfig || {}} height="h-56" />
          )}
        </div>

        {/* Divider */}
        <div className="mx-6 border-t" />

        {/* Notes section */}
        <NotesSection kpi={kpi} periods={defaultPeriods} />
      </SheetContent>
      <AlertWizardModal
        open={alertWizardOpen}
        onOpenChange={setAlertWizardOpen}
        initial={{ alertType: 'kpi_rag', kpiId: kpi?.id ?? null }}
      />
    </Sheet>
  );
}

// ── Notes Section ──────────────────────────────────────────────────────

function NotesSection({
  kpi,
  periods,
}: {
  kpi: KPI;
  periods: { period: string; period_date: string | null; value: number | null }[];
}) {
  const { annotations, mutate } = useAnnotations(kpi.id);
  const currentUserEmail = useAuthStore((s) => s.getCurrentOrgUser()?.email ?? '');
  const [showForm, setShowForm] = useState(false);
  const [noteType, setNoteType] = useState<NoteType>('beneficiary_quote');
  const [periodKey, setPeriodKey] = useState('');
  const [periodDate, setPeriodDate] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editNoteType, setEditNoteType] = useState<NoteType>('note');
  const [editPeriodKey, setEditPeriodKey] = useState('');
  const [editPeriodDate, setEditPeriodDate] = useState('');

  const handleSave = async () => {
    if (!periodKey || !content.trim()) return;
    setSaving(true);

    // Compute snapshot from periods
    const idx = periods.findIndex((p) => p.period === periodKey);
    const snapshotValue = idx >= 0 ? periods[idx]?.value : null;
    let snapshotPopChange: number | null = null;
    if (
      idx >= 1 &&
      periods[idx]?.value != null &&
      periods[idx - 1]?.value != null &&
      periods[idx - 1]!.value !== 0
    ) {
      snapshotPopChange =
        Math.round(
          ((periods[idx]!.value! - periods[idx - 1]!.value!) / Math.abs(periods[idx - 1]!.value!)) *
            1000
        ) / 10;
    }

    try {
      await createAnnotation(kpi.id, {
        note_type: noteType,
        period_key: periodKey,
        period_date: periodDate || undefined,
        content: content.trim(),
        snapshot_value: snapshotValue ?? undefined,
        snapshot_pop_change: snapshotPopChange ?? undefined,
      });
      mutate();
      setShowForm(false);
      setContent('');
      setPeriodKey('');
      toastSuccess.created('Note');
    } catch (err: any) {
      toastError.create(err, 'Note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entryId: number) => {
    try {
      await deleteAnnotation(kpi.id, entryId);
      mutate();
      toastSuccess.deleted('Note');
    } catch (err: any) {
      toastError.delete(err, 'Note');
    }
  };

  const handleEditSave = async (entryId: number) => {
    if (!editContent.trim() || !editPeriodKey) return;

    // Recompute snapshot if period changed
    const idx = periods.findIndex((p) => p.period === editPeriodKey);
    const snapshotValue = idx >= 0 ? periods[idx]?.value : undefined;
    let snapshotPopChange: number | undefined;
    if (
      idx >= 1 &&
      periods[idx]?.value != null &&
      periods[idx - 1]?.value != null &&
      periods[idx - 1]!.value !== 0
    ) {
      snapshotPopChange =
        Math.round(
          ((periods[idx]!.value! - periods[idx - 1]!.value!) / Math.abs(periods[idx - 1]!.value!)) *
            1000
        ) / 10;
    }

    const selectedPeriod = periods.find((p) => p.period === editPeriodKey);

    try {
      await updateAnnotation(kpi.id, entryId, {
        content: editContent.trim(),
        note_type: editNoteType,
        period_key: editPeriodKey,
        period_date: selectedPeriod?.period_date || editPeriodDate || undefined,
        snapshot_value: snapshotValue ?? undefined,
        snapshot_pop_change: snapshotPopChange ?? undefined,
      });
      mutate();
      setEditingId(null);
    } catch (err: any) {
      toastError.create(err, 'Note');
    }
  };

  return (
    <div className="px-6 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Notes</h3>
          <p className="text-xs text-muted-foreground">Add beneficiary quotes or notes</p>
        </div>
        {!showForm && (
          <Button
            size="sm"
            className="text-white"
            style={{ backgroundColor: 'var(--primary)' }}
            onClick={() => setShowForm(true)}
          >
            + ADD NOTE
          </Button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="border rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Time Period *</label>
              <Select
                value={periodKey}
                onValueChange={(value) => {
                  const selected = periods.find((p) => p.period === value);
                  setPeriodKey(value);
                  setPeriodDate(selected?.period_date || '');
                }}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {[...periods].reverse().map((p) => (
                    <SelectItem key={p.period} value={p.period}>
                      {p.period}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Note type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                    noteType === 'beneficiary_quote'
                      ? 'text-white'
                      : 'bg-white text-gray-600 border-gray-200'
                  )}
                  style={
                    noteType === 'beneficiary_quote'
                      ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' }
                      : undefined
                  }
                  onClick={() => setNoteType('beneficiary_quote')}
                >
                  Beneficiary Quote
                </button>
                <button
                  type="button"
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                    noteType === 'note' ? 'text-white' : 'bg-white text-gray-600 border-gray-200'
                  )}
                  style={
                    noteType === 'note'
                      ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' }
                      : undefined
                  }
                  onClick={() => setNoteType('note')}
                >
                  Note
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Note *</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add your note here"
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-destructive text-destructive"
              onClick={() => {
                setShowForm(false);
                setContent('');
                setPeriodKey('');
              }}
            >
              CANCEL
            </Button>
            <Button
              size="sm"
              className="text-white"
              style={{ backgroundColor: 'var(--primary)' }}
              disabled={!periodKey || !content.trim() || saving}
              onClick={handleSave}
            >
              {saving ? 'Saving...' : 'SAVE'}
            </Button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {annotations.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm font-medium text-gray-700">No Notes added yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add notes and beneficiary quotes on relevant KPI markers to track progress
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {annotations.map((entry) => (
            <div key={entry.id}>
              {/* Period header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-800">{entry.period_key}</span>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">
                  {entry.last_modified_by_email || entry.created_by_email}
                </span>
                <span className="text-sm text-muted-foreground">|</span>
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(entry.updated_at))} ago
                </span>
              </div>
              {/* Note card */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm">
                    {entry.snapshot_value != null && (
                      <span className="font-medium text-gray-700">
                        Value: {formatMetricValue(entry.snapshot_value)}
                      </span>
                    )}
                    {entry.snapshot_pop_change != null && (
                      <span
                        className={cn(
                          'font-medium',
                          entry.snapshot_pop_change > 0 ? 'text-green-600' : 'text-red-600'
                        )}
                      >
                        {entry.snapshot_pop_change > 0 ? '↑' : '↓'}
                        {Math.abs(entry.snapshot_pop_change)}% from last{' '}
                        {grainLabel[kpi.time_grain] || 'period'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-sm px-3 py-1',
                        entry.note_type === 'beneficiary_quote'
                          ? 'bg-amber-50 text-green-700 border-amber-200'
                          : 'bg-red-50 text-red-600 border-red-200'
                      )}
                    >
                      {entry.note_type === 'beneficiary_quote' ? 'Beneficiary Quote' : 'Note'}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                          <MoreVertical className="w-3.5 h-3.5 text-gray-400" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingId(entry.id);
                            setEditContent(entry.content);
                            setEditNoteType(entry.note_type);
                            setEditPeriodKey(entry.period_key);
                            setEditPeriodDate(entry.period_date || '');
                          }}
                          className="cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1.5" />
                          Edit
                        </DropdownMenuItem>
                        {entry.created_by_email === currentUserEmail && (
                          <DropdownMenuItem
                            onClick={() => handleDelete(entry.id)}
                            className="cursor-pointer text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {editingId === entry.id ? (
                  <div className="mt-3 space-y-3 border-t pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Time Period *</label>
                        <Select
                          value={editPeriodKey}
                          onValueChange={(value) => {
                            const selected = periods.find((p) => p.period === value);
                            setEditPeriodKey(value);
                            setEditPeriodDate(selected?.period_date || '');
                          }}
                        >
                          <SelectTrigger className="w-full text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {periods.map((p) => (
                              <SelectItem key={p.period} value={p.period}>
                                {p.period}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Note type</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={cn(
                              'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                              editNoteType === 'beneficiary_quote'
                                ? 'text-white'
                                : 'bg-white text-gray-600 border-gray-200'
                            )}
                            style={
                              editNoteType === 'beneficiary_quote'
                                ? {
                                    backgroundColor: 'var(--primary)',
                                    borderColor: 'var(--primary)',
                                  }
                                : undefined
                            }
                            onClick={() => setEditNoteType('beneficiary_quote')}
                          >
                            Beneficiary Quote
                          </button>
                          <button
                            type="button"
                            className={cn(
                              'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                              editNoteType === 'note'
                                ? 'text-white'
                                : 'bg-white text-gray-600 border-gray-200'
                            )}
                            style={
                              editNoteType === 'note'
                                ? {
                                    backgroundColor: 'var(--primary)',
                                    borderColor: 'var(--primary)',
                                  }
                                : undefined
                            }
                            onClick={() => setEditNoteType('note')}
                          >
                            Note
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Note *</label>
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive text-destructive text-xs"
                        onClick={() => {
                          setEditingId(null);
                          setEditContent('');
                        }}
                      >
                        CANCEL
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs text-white"
                        style={{ backgroundColor: 'var(--primary)' }}
                        onClick={() => handleEditSave(entry.id)}
                        disabled={!editContent.trim() || !editPeriodKey}
                      >
                        SAVE
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 mt-2">{entry.content}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
