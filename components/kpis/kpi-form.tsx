'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Download, Upload, Target, Hammer } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { useMetrics } from '@/hooks/api/useMetrics';
import { useTableColumns } from '@/hooks/api/useWarehouse';
import { createKPI, updateKPI } from '@/hooks/api/useKPIs';
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

interface KPIFormData {
  metric_id: number | null;
  name: string;
  target_value: string;
  direction: string;
  green_threshold_pct: string;
  amber_threshold_pct: string;
  time_grain: string;
  time_dimension_column: string;
  metric_type_tag: string;
  program_tags_input: string;
}

interface KPIFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  kpi?: KPI | null;
  preselectedMetricId?: number;
}

export function KPIForm({ open, onOpenChange, onSuccess, kpi, preselectedMetricId }: KPIFormProps) {
  const isEdit = !!kpi;

  // Step 1 = metric + target + direction, Step 2 = RAG + time + classification
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    register,
    control,
    watch,
    setValue,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<KPIFormData>({
    mode: 'onChange',
    defaultValues: {
      metric_id: null,
      name: '',
      target_value: '',
      direction: 'increase',
      green_threshold_pct: '100',
      amber_threshold_pct: '80',
      time_grain: 'monthly',
      time_dimension_column: '',
      metric_type_tag: '',
      program_tags_input: '',
    },
  });

  const metricId = watch('metric_id');
  const direction = watch('direction');
  const targetValue = watch('target_value');
  const greenThreshold = watch('green_threshold_pct');
  const amberThreshold = watch('amber_threshold_pct');
  const metricTypeTag = watch('metric_type_tag');

  const { data: metrics, mutate: mutateMetrics } = useMetrics({ pageSize: 50 });

  const selectedMetric = metrics.find((m) => m.id === metricId);

  const { data: tableColumns } = useTableColumns(
    selectedMetric?.schema_name || null,
    selectedMetric?.table_name || null
  );

  const dateColumns = useMemo(() => {
    if (!tableColumns) return [];
    return tableColumns.filter((col) => DATE_TYPES.includes((col.data_type || '').toLowerCase()));
  }, [tableColumns]);

  useEffect(() => {
    if (open) {
      mutateMetrics();
      if (kpi) {
        setStep(2); // Edit: show full form
        reset({
          metric_id: kpi.metric.id,
          name: kpi.name,
          target_value: kpi.target_value?.toString() || '',
          direction: kpi.direction,
          green_threshold_pct: kpi.green_threshold_pct.toString(),
          amber_threshold_pct: kpi.amber_threshold_pct.toString(),
          time_grain: kpi.time_grain,
          time_dimension_column: kpi.time_dimension_column || '',
          metric_type_tag: kpi.metric_type_tag || '',
          program_tags_input: kpi.program_tags.join(', '),
        });
      } else {
        setStep(1);
        reset({
          metric_id: preselectedMetricId || null,
          name: '',
          target_value: '',
          direction: 'increase',
          green_threshold_pct: '100',
          amber_threshold_pct: '80',
          time_grain: 'monthly',
          time_dimension_column: '',
          metric_type_tag: '',
          program_tags_input: '',
        });
      }
      setSaveError(null);
    }
  }, [open, kpi, preselectedMetricId, reset, mutateMetrics]);

  const handleSelectMetric = (id: number) => {
    const m = metrics.find((m) => m.id === id);
    if (!m) return;
    const currentName = watch('name');
    const metricChanged = metricId !== null && metricId !== id;
    setValue('metric_id', id);
    if (!currentName || metricChanged) setValue('name', m.name);
    if (metricChanged) {
      setValue('time_dimension_column', '');
      setValue('time_grain', 'monthly');
    }
  };

  const handleContinue = () => {
    if (!metricId) {
      setSaveError('Please select a metric');
      return;
    }
    setSaveError(null);
    setStep(2);
  };

  const onSubmit = async (data: KPIFormData) => {
    setSaveError(null);
    setSaving(true);

    const programTags = data.program_tags_input
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (isEdit && kpi) {
        const updateData: KPIUpdate = {
          metric_id: data.metric_id !== kpi.metric.id ? (data.metric_id ?? undefined) : undefined,
          name: data.name || undefined,
          target_value: data.target_value ? parseFloat(data.target_value) : undefined,
          direction: data.direction,
          green_threshold_pct: parseFloat(data.green_threshold_pct),
          amber_threshold_pct: parseFloat(data.amber_threshold_pct),
          time_grain: data.time_grain,
          time_dimension_column: data.time_dimension_column || null,
          metric_type_tag: data.metric_type_tag || undefined,
          program_tags: programTags,
        };
        await updateKPI(kpi.id, updateData);
      } else {
        const createData: KPICreate = {
          metric_id: data.metric_id!,
          name: data.name || undefined,
          target_value: data.target_value ? parseFloat(data.target_value) : undefined,
          direction: data.direction,
          green_threshold_pct: parseFloat(data.green_threshold_pct),
          amber_threshold_pct: parseFloat(data.amber_threshold_pct),
          time_grain: data.time_grain,
          time_dimension_column: data.time_dimension_column || null,
          metric_type_tag: data.metric_type_tag || undefined,
          program_tags: programTags,
        };
        await createKPI(createData);
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save KPI');
    } finally {
      setSaving(false);
    }
  };

  const targetNum = targetValue ? parseFloat(targetValue) : null;
  const greenVal = targetNum ? (targetNum * parseFloat(greenThreshold)) / 100 : null;
  const amberVal = targetNum ? (targetNum * parseFloat(amberThreshold)) / 100 : null;

  const typeIcons: Record<string, React.ReactNode> = {
    input: <Download className="h-4 w-4" />,
    output: <Upload className="h-4 w-4" />,
    outcome: <Target className="h-4 w-4" />,
    impact: <Hammer className="h-4 w-4" />,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit KPI' : 'Create KPI'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* ── Section 1: Metric + Target + Direction ──────────────── */}

          {/* Metric selector */}
          <div className="space-y-1">
            <Label>
              Select metric <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="metric_id"
              rules={{ required: 'Metric is required' }}
              render={({ field }) => (
                <Combobox
                  items={metrics.map((m) => ({
                    value: m.id.toString(),
                    label: m.name,
                    data_type: `${m.schema_name}.${m.table_name}${m.description ? ' · ' + m.description : ''}`,
                    disabled: false,
                  }))}
                  value={field.value?.toString() || ''}
                  onValueChange={(v) => handleSelectMetric(parseInt(v))}
                  placeholder="Search from your Metrics Library"
                  searchPlaceholder="Search metrics..."
                  renderItem={(item) => {
                    const metric = metrics.find((m) => m.id.toString() === item.value);
                    return (
                      <div className="flex items-center justify-between w-full gap-2">
                        <div className="min-w-0">
                          <div className="font-medium">{item.label}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {item.data_type}
                          </div>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                            metric?.column_expression
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-gray-50 text-gray-600 border-gray-200'
                          )}
                        >
                          {metric?.column_expression ? 'Calculated' : 'Simple'}
                        </span>
                      </div>
                    );
                  }}
                  footer={
                    <a
                      href="/metrics?create=true"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 w-full py-1 text-sm font-medium"
                      style={{ color: 'var(--primary)' }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      CREATE A NEW METRIC
                    </a>
                  }
                />
              )}
            />
            {errors.metric_id && (
              <p className="text-xs text-destructive">{errors.metric_id.message}</p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-1">
            <Label>
              Name this KPI <span className="text-destructive">*</span>
            </Label>
            <Input
              {...register('name', { required: 'KPI name is required' })}
              placeholder="Choose a unique KPI name"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Target + Direction */}
          <div className="space-y-1">
            <Label>
              Target Value <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              {...register('target_value', { required: 'Target value is required' })}
              placeholder="What is the desired value of this indicator"
            />
            {errors.target_value && (
              <p className="text-xs text-destructive">{errors.target_value.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>
              Direction <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="direction"
              rules={{ required: 'Direction is required' }}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    if (v === 'increase') {
                      setValue('green_threshold_pct', '100');
                      setValue('amber_threshold_pct', '80');
                    } else {
                      setValue('green_threshold_pct', '100');
                      setValue('amber_threshold_pct', '120');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIRECTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              Should this indicator increase or decrease to meet the target
            </p>
          </div>

          {/* ── Section 2: RAG + Time + Classification ──────────────── */}
          {step >= 2 && (
            <>
              {/* RAG Thresholds */}
              {targetValue && (
                <>
                  <p className="text-sm text-muted-foreground font-medium mt-6 mb-1">
                    Target &amp; RAG Status
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        <Label className="text-sm">On Track</Label>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">
                          {direction === 'increase' ? '≥' : '≤'}
                        </span>
                        <Input
                          type="number"
                          {...register('green_threshold_pct')}
                          className="w-16 h-8"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                      {greenVal !== null && (
                        <p className="text-xs text-muted-foreground">
                          {direction === 'increase' ? '≥' : '≤'} {greenVal.toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <Label className="text-sm">Needs Attention</Label>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          {...register('amber_threshold_pct')}
                          className="w-16 h-8"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                      {amberVal !== null && (
                        <p className="text-xs text-muted-foreground">{amberVal.toLocaleString()}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        <Label className="text-sm">Off Track</Label>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">
                          {direction === 'increase' ? '<' : '>'}
                        </span>
                        <Input
                          type="number"
                          value={amberThreshold}
                          disabled
                          className="w-16 h-8 bg-gray-50"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Time Configuration */}
              <p className="text-sm text-muted-foreground font-medium mt-6 mb-1">
                Time Configuration
              </p>

              {dateColumns.length === 0 && selectedMetric ? (
                <p className="text-sm text-muted-foreground">
                  No date/timestamp columns found in {selectedMetric.schema_name}.
                  {selectedMetric.table_name}. Trend charts require a time column.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">
                      Time Column <span className="text-destructive">*</span>
                    </Label>
                    <Controller
                      control={control}
                      name="time_dimension_column"
                      rules={{ required: 'Time column is required' }}
                      render={({ field }) => (
                        <Select
                          value={field.value || '__none__'}
                          onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {dateColumns.map((col) => (
                              <SelectItem key={col.name} value={col.name || ''}>
                                {col.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.time_dimension_column && (
                      <p className="text-xs text-destructive">
                        {errors.time_dimension_column.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">
                      Time Grain <span className="text-destructive">*</span>
                    </Label>
                    <Controller
                      control={control}
                      name="time_grain"
                      rules={{ required: 'Time grain is required' }}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
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
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Classification */}
              <div className="space-y-1">
                <Label>Program Name</Label>
                <Input {...register('program_tags_input')} placeholder="eg. WASH Program" />
                <p className="text-xs text-muted-foreground">Separate multiple tags with commas</p>
              </div>

              <div className="space-y-2">
                <Label>KPI Type</Label>
                <Controller
                  control={control}
                  name="metric_type_tag"
                  render={({ field }) => (
                    <div className="grid grid-cols-4 gap-2">
                      {METRIC_TYPE_TAG_OPTIONS.map((opt) => (
                        <button
                          type="button"
                          key={opt.value}
                          onClick={() => field.onChange(field.value === opt.value ? '' : opt.value)}
                          className={cn(
                            'flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium uppercase transition-colors',
                            field.value === opt.value
                              ? 'text-white'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          )}
                          style={
                            field.value === opt.value
                              ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' }
                              : undefined
                          }
                        >
                          {typeIcons[opt.value]}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                />
              </div>
            </>
          )}

          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            CANCEL
          </Button>
          {step < 2 ? (
            <Button type="button" onClick={handleContinue} disabled={!metricId}>
              Continue
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit(onSubmit)} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? 'Save KPI' : 'Create KPI'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
