'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, ArrowLeft, Search, Check } from 'lucide-react';
import { useMetrics } from '@/hooks/api/useMetrics';
import { useTableColumns } from '@/hooks/api/useWarehouse';
import { createKPI, updateKPI } from '@/hooks/api/useKPIs';
import { MetricFormDialog } from '@/components/metrics/metric-form-dialog';
import type { KPI, KPICreate, KPIUpdate } from '@/types/kpis';
import { DIRECTION_OPTIONS, TIME_GRAIN_OPTIONS, METRIC_TYPE_TAG_OPTIONS } from '@/types/kpis';
import { cn } from '@/lib/utils';

const DATE_TYPES = [
  'date',
  'timestamp',
  'timestamp without time zone',
  'timestamp with time zone',
  'timestamptz',
  'datetime',
];

interface KPIFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  kpi?: KPI | null;
  preselectedMetricId?: number;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Separator />
      <p className="text-sm text-muted-foreground font-medium">{children}</p>
    </>
  );
}

export function KPIForm({ open, onOpenChange, onSuccess, kpi, preselectedMetricId }: KPIFormProps) {
  const isEdit = !!kpi;

  // Step 1 = metric selection, Step 2 = KPI config
  const [step, setStep] = useState<1 | 2>(1);
  const [metricId, setMetricId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [direction, setDirection] = useState('increase');
  const [targetValue, setTargetValue] = useState('');
  const [greenThreshold, setGreenThreshold] = useState('100');
  const [amberThreshold, setAmberThreshold] = useState('80');
  const [timeGrain, setTimeGrain] = useState('monthly');
  const [timeDimensionColumn, setTimeDimensionColumn] = useState('');
  const [trendPeriods, setTrendPeriods] = useState('12');
  const [metricTypeTag, setMetricTypeTag] = useState('');
  const [programTagsInput, setProgramTagsInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metricSearch, setMetricSearch] = useState('');
  const [createMetricOpen, setCreateMetricOpen] = useState(false);

  const { data: metrics, mutate: mutateMetrics } = useMetrics({
    search: metricSearch || undefined,
    pageSize: 50,
  });

  const selectedMetric = metrics.find((m) => m.id === metricId);

  const { data: tableColumns } = useTableColumns(
    selectedMetric?.schema_name || null,
    selectedMetric?.table_name || null
  );

  const dateColumns = useMemo(() => {
    if (!tableColumns) return [];
    return tableColumns.filter((col) => DATE_TYPES.includes((col.data_type || '').toLowerCase()));
  }, [tableColumns]);

  // Initialize form
  useEffect(() => {
    if (open) {
      if (kpi) {
        setStep(2); // Edit mode lands on step 2, metric already selected
        setMetricId(kpi.metric.id);
        setName(kpi.name);
        setDirection(kpi.direction);
        setTargetValue(kpi.target_value?.toString() || '');
        setGreenThreshold(kpi.green_threshold_pct.toString());
        setAmberThreshold(kpi.amber_threshold_pct.toString());
        setTimeGrain(kpi.time_grain);
        setTimeDimensionColumn(kpi.time_dimension_column || '');
        setTrendPeriods(kpi.trend_periods.toString());
        setMetricTypeTag(kpi.metric_type_tag || '');
        setProgramTagsInput(kpi.program_tags.join(', '));
      } else {
        setStep(preselectedMetricId ? 2 : 1);
        setMetricId(preselectedMetricId || null);
        setName('');
        setDirection('increase');
        setTargetValue('');
        setGreenThreshold('100');
        setAmberThreshold('80');
        setTimeGrain('monthly');
        setTimeDimensionColumn('');
        setTrendPeriods('12');
        setMetricTypeTag('');
        setProgramTagsInput('');
      }
      setError(null);
      setMetricSearch('');
    }
  }, [open, kpi, preselectedMetricId]);

  const handleSelectMetric = (m: { id: number; name: string }) => {
    const metricChanged = metricId !== null && metricId !== m.id;
    setMetricId(m.id);
    if (!name || metricChanged) setName(m.name);
    if (metricChanged) {
      setTimeDimensionColumn('');
      setTimeGrain('monthly');
      setTrendPeriods('12');
    }
  };

  const handleNext = () => {
    if (!metricId) {
      setError('Please select a metric');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    const programTags = programTagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (isEdit && kpi) {
        const updateData: KPIUpdate = {
          metric_id: metricId !== kpi.metric.id ? (metricId ?? undefined) : undefined,
          name: name || undefined,
          target_value: targetValue ? parseFloat(targetValue) : undefined,
          direction,
          green_threshold_pct: parseFloat(greenThreshold),
          amber_threshold_pct: parseFloat(amberThreshold),
          time_grain: timeGrain,
          time_dimension_column: timeDimensionColumn || null,
          trend_periods: parseInt(trendPeriods),
          metric_type_tag: metricTypeTag || undefined,
          program_tags: programTags,
        };
        await updateKPI(kpi.id, updateData);
      } else {
        const createData: KPICreate = {
          metric_id: metricId!,
          name: name || undefined,
          target_value: targetValue ? parseFloat(targetValue) : undefined,
          direction,
          green_threshold_pct: parseFloat(greenThreshold),
          amber_threshold_pct: parseFloat(amberThreshold),
          time_grain: timeGrain,
          time_dimension_column: timeDimensionColumn || null,
          trend_periods: parseInt(trendPeriods),
          metric_type_tag: metricTypeTag || undefined,
          program_tags: programTags,
        };
        await createKPI(createData);
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save KPI');
    } finally {
      setSaving(false);
    }
  };

  const handleMetricCreated = () => {
    mutateMetrics();
    setCreateMetricOpen(false);
  };

  const directionHint = direction === 'increase' ? 'Higher is better' : 'Lower is better';
  const redLabel = targetValue
    ? direction === 'increase'
      ? `Red when < ${amberThreshold}% of target`
      : `Red when > ${amberThreshold}% of target`
    : null;

  // ─── Step 1: Metric Selection ────────────────────────────────────────────

  const renderStep1 = () => (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit KPI — Step 1 of 2' : 'Create KPI — Step 1 of 2'}</DialogTitle>
        <p className="text-sm text-muted-foreground">
          {isEdit ? 'Change the metric this KPI tracks' : 'Choose which metric this KPI will track'}
        </p>
      </DialogHeader>

      <div className="space-y-3 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search metrics..."
            value={metricSearch}
            onChange={(e) => setMetricSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-64 overflow-y-auto border rounded-lg p-1.5 space-y-1">
          {[...metrics]
            .sort((a, b) => {
              // Selected metric always appears first
              if (a.id === metricId) return -1;
              if (b.id === metricId) return 1;
              return 0;
            })
            .map((m) => (
              <button
                key={m.id}
                onClick={() => handleSelectMetric(m)}
                className={cn(
                  'w-full text-left p-3 rounded-lg text-sm transition-colors flex items-center justify-between',
                  metricId === m.id ? 'bg-gray-100 border border-gray-300' : 'hover:bg-muted/50'
                )}
              >
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.schema_name}.{m.table_name}
                    {' · '}
                    {m.column_expression
                      ? 'Expression'
                      : `${(m.aggregation || '').toUpperCase()}(${m.column || '*'})`}
                  </div>
                </div>
                {metricId === m.id && <Check className="h-4 w-4 text-gray-600 shrink-0" />}
              </button>
            ))}
          {metrics.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              {metricSearch ? 'No metrics match your search' : 'No metrics yet'}
            </p>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed"
          onClick={() => setCreateMetricOpen(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Create a new metric
        </Button>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={handleNext} disabled={!metricId}>
          Next
        </Button>
      </DialogFooter>
    </>
  );

  // ─── Step 2: KPI Configuration ──────────────────────────────────────────

  const renderStep2 = () => (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit KPI' : 'Create KPI — Step 2 of 2'}</DialogTitle>
        {selectedMetric && !isEdit && (
          <p className="text-sm text-muted-foreground">Based on: {selectedMetric.name}</p>
        )}
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Display Name */}
        <div className="space-y-1">
          <Label className="font-semibold">Display Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={selectedMetric?.name || 'Defaults to metric name'}
          />
        </div>

        {/* ── Target & RAG Status ── */}
        <SectionHeader>Target &amp; RAG Status</SectionHeader>

        <div className="space-y-1">
          <Label className="font-semibold">Direction</Label>
          <Select
            value={direction}
            onValueChange={(v) => {
              setDirection(v);
              // Auto-adjust default thresholds when switching direction
              if (v === 'increase') {
                setGreenThreshold('100');
                setAmberThreshold('80');
              } else {
                setGreenThreshold('100');
                setAmberThreshold('120');
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIRECTION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.value === 'increase' ? 'Increase' : 'Decrease'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{directionHint}</p>
        </div>

        <div className="space-y-1">
          <Label className="font-semibold">Target Value</Label>
          <Input
            type="number"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder="e.g. 5000"
          />
        </div>

        {targetValue && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <Label className="font-semibold text-sm">
                    Green when {direction === 'increase' ? '\u2265' : '\u2264'}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={greenThreshold}
                    onChange={(e) => setGreenThreshold(e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">% of target</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <Label className="font-semibold text-sm">
                    Amber when {direction === 'increase' ? '\u2265' : '\u2264'}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={amberThreshold}
                    onChange={(e) => setAmberThreshold(e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">% of target</span>
                </div>
              </div>
            </div>
            {redLabel && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                {redLabel}
              </div>
            )}
          </>
        )}

        {/* ── Time Configuration ── */}
        <SectionHeader>Time Configuration (optional)</SectionHeader>

        {dateColumns.length === 0 && selectedMetric ? (
          <p className="text-sm text-muted-foreground">
            No date/timestamp columns found in {selectedMetric.schema_name}.
            {selectedMetric.table_name}. Trend charts require a time column.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="font-semibold text-sm">Time Column</Label>
              <Select
                value={timeDimensionColumn || '__none__'}
                onValueChange={(v) => setTimeDimensionColumn(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {dateColumns.map((col) => (
                    <SelectItem
                      key={col.name || col.column_name}
                      value={col.name || col.column_name || ''}
                    >
                      {col.name || col.column_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="font-semibold text-sm">Time Grain</Label>
              <Select value={timeGrain} onValueChange={setTimeGrain}>
                <SelectTrigger>
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
            <div className="space-y-1">
              <Label className="font-semibold text-sm">Periods</Label>
              <Input
                type="number"
                value={trendPeriods}
                onChange={(e) => setTrendPeriods(e.target.value)}
                min={1}
                max={52}
              />
            </div>
          </div>
        )}

        {/* ── Classification ── */}
        <SectionHeader>Classification</SectionHeader>

        <div className="space-y-1">
          <Label className="font-semibold">Program</Label>
          <Input
            value={programTagsInput}
            onChange={(e) => setProgramTagsInput(e.target.value)}
            placeholder="e.g. Health Program"
          />
          <p className="text-xs text-muted-foreground">Separate multiple tags with commas</p>
        </div>

        <div className="space-y-2">
          <Label className="font-semibold">Metric Type</Label>
          <div className="grid grid-cols-4 gap-2">
            {METRIC_TYPE_TAG_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMetricTypeTag(metricTypeTag === opt.value ? '' : opt.value)}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition-colors',
                  metricTypeTag === opt.value
                    ? 'bg-gray-100 border-gray-400 text-gray-800'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                <span className="text-lg">
                  {opt.value === 'input' && '\u{1F4E5}'}
                  {opt.value === 'output' && '\u{1F4E4}'}
                  {opt.value === 'outcome' && '\u{1F3AF}'}
                  {opt.value === 'impact' && '\u{1F4A5}'}
                </span>
                <span className="font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            How does this metric fit in your theory of change?
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <DialogFooter className="flex justify-between">
        <div>
          <Button variant="ghost" onClick={() => setStep(1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? 'Save KPI' : 'Create KPI'}
          </Button>
        </div>
      </DialogFooter>
    </>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {step === 1 ? renderStep1() : renderStep2()}
        </DialogContent>
      </Dialog>

      <MetricFormDialog
        open={createMetricOpen}
        onOpenChange={setCreateMetricOpen}
        onSuccess={handleMetricCreated}
      />
    </>
  );
}
