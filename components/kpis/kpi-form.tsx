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
import {
  ANALYTICS_EVENTS,
  KPI_CREATE_SOURCES,
  METRIC_USE_SOURCES,
  type KpiCreateSource,
} from '@/constants/analytics';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
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
  /** Analytics only — which surface opened this wizard (KPI_CREATE_SOURCES). The KPIs page
   *  and the metrics library both open it, and KPI_CREATED cannot tell them apart without it. */
  createSource?: KpiCreateSource;
}

export function KPIForm({
  open,
  onOpenChange,
  onSuccess,
  kpi,
  preselectedMetricId,
  createSource = KPI_CREATE_SOURCES.KPIS_PAGE,
}: KPIFormProps) {
  const isEdit = !!kpi;

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [continuing, setContinuing] = useState(false);
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
    trigger,
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
  const targetValue = watch('target_value');
  const timeDimensionColumn = watch('time_dimension_column');
  const metricTypeTag = watch('metric_type_tag');

  // Watch-based rather than only reacting to the Select's onValueChange: if the table has
  // exactly one date column, Radix's Select never fires onValueChange for re-selecting a
  // value that's already current — the walkthrough would otherwise wait forever for a
  // "change" that can't happen. Firing off the watched value itself (present on mount too,
  // not just on future changes) advances correctly whether the user actively picked it or
  // it was already set. Advances to kpi_continue (not kpi_type) since KPI Type now lives on
  // step 3, only reachable once the user clicks step 2's Continue button.
  useEffect(() => {
    if (!timeDimensionColumn) return;
    const walkthrough = useInsightWalkthroughStore.getState();
    if (walkthrough.active) walkthrough.advanceIfBefore('kpi_continue');
  }, [timeDimensionColumn]);

  // Same watch-based reasoning as the time column effect above — waiting for onBlur
  // requires the user to lose focus on the field first, which they may not do right away
  // (e.g. typing a value then reaching for the mouse instead of tabbing away). Reacting to
  // the value itself advances the moment they've actually entered something.
  useEffect(() => {
    if (!targetValue) return;
    const walkthrough = useInsightWalkthroughStore.getState();
    if (walkthrough.active) walkthrough.advanceIfBefore('kpi_direction');
  }, [targetValue]);

  // KPI Type is the walkthrough's last field, so picking one moves the coachmark onto the
  // Create KPI button. Same watch-based approach as the two effects above; guarded on a
  // truthy value because the type buttons toggle — clicking the selected one clears it back
  // to '', which shouldn't count as having picked anything.
  useEffect(() => {
    if (!metricTypeTag) return;
    const walkthrough = useInsightWalkthroughStore.getState();
    if (walkthrough.active) walkthrough.advanceIfBefore('kpi_submit');
  }, [metricTypeTag]);

  const { data: metrics, mutate: mutateMetrics } = useMetrics({ pageSize: 50 });
  const { tags: existingTags } = useProgramTags();

  const selectedMetric =
    metrics.find((m) => m.id === metricId) ??
    (inlineCreatedMetric?.id === metricId ? inlineCreatedMetric : undefined);

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
    const walkthrough = useInsightWalkthroughStore.getState();
    // NOT kpi_target: that field lives on step 2 and doesn't exist yet. Point the coachmark at
    // the Continue button that gets them there.
    if (walkthrough.active) walkthrough.advanceIfBefore('kpi_step1_continue');
  };

  // Track each step as it becomes visible (fires on open too, since step resets on open).
  // is_edit is sent, not just depended on: the same steps render when editing, so without
  // it an abandoned create is indistinguishable from an abandoned edit.
  useEffect(() => {
    if (open) {
      trackEvent(ANALYTICS_EVENTS.KPI_WIZARD_STEP_VIEWED, { step, is_edit: isEdit });
    }
  }, [step, open, isEdit]);

  const handleStep1Continue = async () => {
    if (continuing) return;
    setStepError(null);
    setContinuing(true);
    try {
      const ok = await metricStepRef.current?.handleContinue();
      if (ok) {
        setStep(2);
        // Step 2's fields are now mounting, so the target hint finally has something to point
        // at. Also catches the user who created a metric inline and never touched the picker.
        const walkthrough = useInsightWalkthroughStore.getState();
        if (walkthrough.active) walkthrough.advanceIfBefore('kpi_target');
      } else if (!metricId) {
        setStepError('Please select a metric, or complete the new metric form');
      }
    } finally {
      setContinuing(false);
    }
  };

  const handleStep2Continue = async () => {
    setStepError(null);
    const ok = await trigger(['name', 'target_value', 'direction', 'time_dimension_column']);
    if (ok) {
      setStep(3);
      // Catches up anyone who skipped the step-2 hints (a defaulted dropdown left alone, a
      // field clicked past) — advanceIfBefore only ever moves forward.
      const walkthrough = useInsightWalkthroughStore.getState();
      if (walkthrough.active) walkthrough.advanceIfBefore('kpi_type');
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
    const walkthrough = useInsightWalkthroughStore.getState();
    if (walkthrough.active) {
      // The selected metric may have no date/timestamp columns — the Time Column field
      // doesn't render at all then (replaced by a "no date columns found" message), so
      // there's nothing for the kpi_time_column stage to highlight. Skip straight to
      // kpi_continue instead of getting stuck waiting for a field that will never appear.
      walkthrough.advanceIfBefore(dateColumns.length === 0 ? 'kpi_continue' : 'kpi_time_column');
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
          kpi_id: kpi.id,
          metric_type_tag: data.metric_type_tag || null,
        });
        // Re-pointing a KPI to a different metric also consumes that metric
        // (metric adoption signal) — same as the create path below.
        if (data.metric_id && data.metric_id !== kpi.metric.id) {
          trackEvent(ANALYTICS_EVENTS.METRIC_USED, {
            metric_id: data.metric_id,
            kpi_id: kpi.id,
            source: METRIC_USE_SOURCES.KPI,
          });
        }
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
        const created = await createKPI(createData);
        // kpi_id from the response — it is the only place the new id exists, and it is what
        // lets created -> viewed -> deleted be joined for one KPI.
        trackEvent(ANALYTICS_EVENTS.KPI_CREATED, {
          kpi_id: created.id,
          source: createSource,
          metric_type_tag: data.metric_type_tag || null,
        });
        if (data.metric_id) {
          trackEvent(ANALYTICS_EVENTS.METRIC_USED, {
            metric_id: data.metric_id,
            kpi_id: created.id,
            source: METRIC_USE_SOURCES.KPI,
          });
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
      {/* preventOutsideClose: a multi-step form with unsaved input — a stray backdrop click
          shouldn't throw the work away. Dismissing is deliberate: the X (or Escape). */}
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" preventOutsideClose>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit KPI' : 'Create KPI'}</DialogTitle>
        </DialogHeader>

        <StepIndicator step={step} />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 3) handleSubmit(onSubmit)(e);
          }}
          className="space-y-4 py-2"
        >
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => (s - 1) as Step)}
              data-testid="kpi-form-back-btn"
            >
              Back
            </Button>
          )}

          {/* Continue / Submit */}
          {step === 1 && (
            <Button
              type="button"
              onClick={handleStep1Continue}
              disabled={continuing}
              data-testid="kpi-form-step1-continue-btn"
            >
              {continuing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Continue
            </Button>
          )}
          {step === 2 && (
            <Button type="button" onClick={handleStep2Continue} data-testid="kpi-form-continue-btn">
              Continue
            </Button>
          )}
          {step === 3 && (
            <Button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={saving}
              data-testid="kpi-form-submit-btn"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? 'Save KPI' : 'Create KPI'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
