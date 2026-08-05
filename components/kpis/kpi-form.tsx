'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useMetrics } from '@/hooks/api/useMetrics';
import { useTableColumns } from '@/hooks/api/useWarehouse';
import { createKPI, updateKPI, useProgramTags } from '@/hooks/api/useKPIs';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import type { KPI, KPICreate, KPIUpdate, KPIExtraConfig } from '@/types/kpis';
import type { Metric } from '@/types/metrics';
import { cn } from '@/lib/utils';
import type { KPIFormData } from './kpi-form-types';
import { KpiMetricStep, type KpiMetricStepHandle } from './KpiMetricStep';
import { KpiSetupStep } from './KpiSetupStep';
import { KpiThresholdsStep } from './KpiThresholdsStep';

export type { KPIFormData };

const DATE_TYPES = [
  'date',
  'timestamp',
  'timestamp without time zone',
  'timestamp with time zone',
  'timestamptz',
  'datetime',
];

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: 'Metric',
  2: 'KPI Setup',
  3: 'Thresholds & Display',
};

const STEPS: Step[] = [1, 2, 3];

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="w-full px-2 pt-4 pb-2">
      {/* Row 1: circles connected by equal-length lines */}
      <div className="flex items-center">
        {STEPS.map((s, i) => {
          const done = s < step;
          const active = s === step;
          return (
            <React.Fragment key={s}>
              {i > 0 && (
                <div className={cn('flex-1 h-px', s <= step ? 'bg-teal-700' : 'bg-gray-200')} />
              )}
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                  done && 'border-transparent bg-teal-50 text-teal-700',
                  active && 'border-transparent bg-teal-700 text-white',
                  !done && !active && 'border-gray-300 bg-white text-gray-400'
                )}
              >
                {s}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {/* Row 2: labels aligned under each circle */}
      <div className="grid grid-cols-3 mt-1.5">
        {STEPS.map((s) => {
          const done = s < step;
          const active = s === step;
          return (
            <span
              key={s}
              className={cn(
                'text-xs',
                s === 1 && 'text-left',
                s === 2 && 'text-center',
                s === 3 && 'text-right',
                active && 'font-semibold text-gray-900',
                done && 'text-gray-600',
                !done && !active && 'text-gray-400'
              )}
            >
              {STEP_LABELS[s]}
            </span>
          );
        })}
      </div>
    </div>
  );
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

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  // Stores the Metric object returned from an inline creation so Step 2's
  // dateColumns lookup works immediately (before mutateMetrics re-fetches).
  const [inlineCreatedMetric, setInlineCreatedMetric] = useState<Metric | null>(null);

  const metricStepRef = useRef<KpiMetricStepHandle>(null);

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
      green_threshold_pct: '80',
      amber_threshold_pct: '50',
      time_grain: 'monthly',
      time_dimension_column: '',
      metric_type_tag: '',
      program_tags: [],
      numberFormat: '',
      decimalPlaces: '',
      numberPrefix: '',
      numberSuffix: '',
    },
  });

  const metricId = watch('metric_id');

  const { data: metrics, mutate: mutateMetrics } = useMetrics({ pageSize: 50 });
  const { tags: existingTags } = useProgramTags();

  const selectedMetric = metrics.find((m) => m.id === metricId) ?? inlineCreatedMetric ?? undefined;

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
      setInlineCreatedMetric(null);
      if (kpi) {
        setStep(2);
        const c = kpi.extra_config?.customizations;
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
          program_tags: kpi.program_tags || [],
          numberFormat: c?.numberFormat ?? '',
          decimalPlaces: c?.decimalPlaces != null ? c.decimalPlaces.toString() : '',
          numberPrefix: c?.numberPrefix ?? '',
          numberSuffix: c?.numberSuffix ?? '',
        });
      } else {
        setStep(1);
        reset({
          metric_id: preselectedMetricId || null,
          name: '',
          target_value: '',
          direction: 'increase',
          green_threshold_pct: '80',
          amber_threshold_pct: '50',
          time_grain: 'monthly',
          time_dimension_column: '',
          metric_type_tag: '',
          program_tags: [],
          numberFormat: '',
          decimalPlaces: '',
          numberPrefix: '',
          numberSuffix: '',
        });
      }
      setSaveError(null);
      setStepError(null);
    }
  }, [open, kpi, preselectedMetricId, reset, mutateMetrics]);

  const handleMetricSelected = (id: number, name: string) => {
    const existing = metrics.find((m) => m.id === id);
    const currentName = watch('name');
    const metricChanged = metricId !== null && metricId !== id;
    setValue('metric_id', id);
    // Auto-fill KPI name from metric name if not already set or metric changed
    const resolvedName = name || existing?.name || '';
    if (resolvedName && (!currentName || metricChanged)) setValue('name', resolvedName);
    if (metricChanged) {
      setValue('time_dimension_column', '');
      setValue('time_grain', 'monthly');
    }
  };

  const handleStep1Continue = async () => {
    setStepError(null);
    const ok = await metricStepRef.current?.handleContinue();
    if (ok) {
      setStep(2);
    } else if (!metricId) {
      setStepError('Please select or create a metric');
    }
  };

  const handleDirectionChange = (direction: string) => {
    if (direction === 'increase') {
      setValue('green_threshold_pct', '80');
      setValue('amber_threshold_pct', '50');
    } else {
      setValue('green_threshold_pct', '50');
      setValue('amber_threshold_pct', '80');
    }
  };

  const onSubmit = async (data: KPIFormData) => {
    setSaveError(null);
    setSaving(true);

    const customizations: NonNullable<KPIExtraConfig['customizations']> = {};
    if (data.numberFormat) customizations.numberFormat = data.numberFormat;
    if (data.decimalPlaces !== '') {
      const n = parseInt(data.decimalPlaces, 10);
      if (!Number.isNaN(n)) customizations.decimalPlaces = n;
    }
    if (data.numberPrefix) customizations.numberPrefix = data.numberPrefix;
    if (data.numberSuffix) customizations.numberSuffix = data.numberSuffix;
    const extraConfig: KPIExtraConfig =
      Object.keys(customizations).length > 0 ? { customizations } : {};

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
          program_tags: data.program_tags,
          extra_config: extraConfig,
        };
        await updateKPI(kpi.id, updateData);
        trackEvent(ANALYTICS_EVENTS.KPI_UPDATED, {
          metric_type_tag: data.metric_type_tag || null,
        });
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
          program_tags: data.program_tags,
          extra_config: extraConfig,
        };
        await createKPI(createData);
        trackEvent(ANALYTICS_EVENTS.KPI_CREATED, {
          metric_type_tag: data.metric_type_tag || null,
        });
        if (data.metric_id) {
          trackEvent(ANALYTICS_EVENTS.METRIC_USED, { metric_id: data.metric_id });
        }
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save KPI');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit KPI' : 'Create KPI'}</DialogTitle>
        </DialogHeader>

        <StepIndicator step={step} />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {step === 1 && (
            <KpiMetricStep
              ref={metricStepRef}
              metricId={metricId}
              onMetricSelected={handleMetricSelected}
              onInlineMetricCreated={(m) => setInlineCreatedMetric(m)}
              mutateMetrics={mutateMetrics}
            />
          )}

          {step === 2 && (
            <KpiSetupStep
              control={control}
              register={register}
              errors={errors}
              isEdit={isEdit}
              dateColumns={dateColumns}
              selectedMetric={selectedMetric}
              onDirectionChange={handleDirectionChange}
            />
          )}

          {step === 3 && (
            <KpiThresholdsStep
              control={control}
              register={register}
              watch={watch}
              errors={errors}
              existingTags={existingTags}
            />
          )}

          {stepError && <p className="text-sm text-destructive">{stepError}</p>}
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            CANCEL
          </Button>

          {/* Back button — step 2 in create mode, or step 3 */}
          {((!isEdit && step === 2) || step === 3) && (
            <Button type="button" variant="outline" onClick={() => setStep((s) => (s - 1) as Step)}>
              Back
            </Button>
          )}

          {/* Continue / Submit */}
          {step === 1 && (
            <Button type="button" onClick={handleStep1Continue}>
              Continue
            </Button>
          )}
          {step === 2 && (
            <Button type="button" onClick={() => setStep(3)}>
              Continue
            </Button>
          )}
          {step === 3 && (
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
