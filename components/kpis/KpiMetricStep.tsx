'use client';

import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useSWRConfig } from 'swr';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { MetricPicker } from '@/components/metrics/MetricPicker';
import { DatasetSelector } from '@/components/charts/DatasetSelector';
import { Combobox, highlightText } from '@/components/ui/combobox';
import { ColumnTypeIcon } from '@/lib/columnTypeIcons';
import { useTableColumns } from '@/hooks/api/useWarehouse';
import { createMetric, validateMetric } from '@/hooks/api/useMetrics';
import type { Metric, MetricPayload } from '@/types/metrics';
import { AGGREGATION_OPTIONS } from '@/types/metrics';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS, METRIC_CREATE_SOURCES } from '@/constants/analytics';

const NUMERIC_TYPES = [
  'integer',
  'bigint',
  'numeric',
  'double precision',
  'real',
  'float',
  'decimal',
];

type ValidationState = 'idle' | 'validating' | 'valid' | 'error';

interface MetricFormData {
  name: string;
  description: string;
  schema_name: string;
  table_name: string;
  mode: 'simple' | 'calculated';
  aggregation: string;
  column: string;
  column_expression: string;
}

export interface KpiMetricStepHandle {
  handleContinue: () => Promise<boolean>;
}

interface KpiMetricStepProps {
  metricId: number | null;
  onMetricSelected: (id: number, name: string) => void;
  onInlineMetricCreated: (metric: Metric) => void;
  mutateMetrics: () => void;
}

export const KpiMetricStep = forwardRef<KpiMetricStepHandle, KpiMetricStepProps>(
  function KpiMetricStep(
    { metricId, onMetricSelected, onInlineMetricCreated, mutateMetrics },
    ref
  ) {
    const { mutate: globalMutate } = useSWRConfig();

    const [mode, setMode] = useState<'select' | 'create'>('select');
    const [validationState, setValidationState] = useState<ValidationState>('idle');
    const [validationError, setValidationError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const {
      register,
      control,
      watch,
      setValue,
      trigger,
      getValues,
      reset,
      formState: { errors },
    } = useForm<MetricFormData>({
      mode: 'onChange',
      defaultValues: {
        name: '',
        description: '',
        schema_name: '',
        table_name: '',
        mode: 'simple',
        aggregation: '',
        column: '',
        column_expression: '',
      },
    });

    const formMode = watch('mode');
    const schemaName = watch('schema_name');
    const tableName = watch('table_name');
    const aggregation = watch('aggregation');
    const columnExpression = watch('column_expression');

    const { data: tableColumns } = useTableColumns(schemaName || null, tableName || null);

    const columnItems = useMemo(() => {
      if (!tableColumns) return [];
      if (aggregation === 'count') {
        return [
          { value: '*', label: '* (Count all rows)', data_type: 'any', disabled: false },
          ...tableColumns.map((col) => ({
            value: col.name || '',
            label: col.name || '',
            data_type: col.data_type || '',
            disabled: false,
          })),
        ];
      }
      if (aggregation === 'count_distinct') {
        return tableColumns.map((col) => ({
          value: col.name || '',
          label: col.name || '',
          data_type: col.data_type || '',
          disabled: false,
        }));
      }
      return tableColumns.map((col) => ({
        value: col.name || '',
        label: col.name || '',
        data_type: col.data_type || '',
        disabled: !NUMERIC_TYPES.includes((col.data_type || '').toLowerCase()),
      }));
    }, [tableColumns, aggregation]);

    // Reset validation when expression or datasource changes
    useEffect(() => {
      if (formMode === 'calculated') {
        setValidationState('idle');
        setValidationError(null);
      }
    }, [columnExpression, schemaName, tableName, formMode]);

    // When switching back to select mode, reset the inline form
    useEffect(() => {
      if (mode === 'select') {
        reset();
        setValidationState('idle');
        setValidationError(null);
        setCreateError(null);
      }
    }, [mode, reset]);

    const buildPayload = (data: MetricFormData): MetricPayload => {
      const payload: MetricPayload = {
        name: data.name,
        description: data.description || undefined,
        schema_name: data.schema_name,
        table_name: data.table_name,
      };
      if (data.mode === 'simple') {
        payload.aggregation = data.aggregation;
        payload.column = data.column || undefined;
      } else {
        payload.column_expression = data.column_expression;
      }
      return payload;
    };

    useImperativeHandle(ref, () => ({
      async handleContinue(): Promise<boolean> {
        if (mode === 'select') {
          if (!metricId) return false;
          return true;
        }

        // Create new mode — validate the form first
        const valid = await trigger();
        if (!valid) return false;

        const data = getValues();
        const payload = buildPayload(data);

        // Validate expression if calculated
        if (data.mode === 'calculated') {
          setValidationState('validating');
          setValidationError(null);
          try {
            const result = await validateMetric(payload);
            if (!result.valid) {
              setValidationState('error');
              setValidationError(result.error || 'Expression is invalid');
              return false;
            }
            setValidationState('valid');
          } catch (err: unknown) {
            setValidationState('error');
            setValidationError(err instanceof Error ? err.message : 'Validation failed');
            return false;
          }
        }

        // Create the metric
        setCreating(true);
        setCreateError(null);
        try {
          const newMetric = await createMetric(payload);
          // `metric_type` (not `mode`) — one property name for this concept across
          // every METRIC_CREATED site, so a single breakdown covers all three.
          trackEvent(ANALYTICS_EVENTS.METRIC_CREATED, {
            metric_type: data.mode,
            metric_id: newMetric.id,
            source: METRIC_CREATE_SOURCES.KPI_WIZARD,
          });
          // Invalidate all /api/metrics/ SWR cache keys (MetricPicker uses a
          // different pageSize than the parent, so a targeted mutate won't reach it).
          globalMutate((key) => typeof key === 'string' && key.startsWith('/api/metrics/'));
          mutateMetrics();
          onInlineMetricCreated(newMetric);
          onMetricSelected(newMetric.id, newMetric.name);
          return true;
        } catch (err: unknown) {
          setCreateError(err instanceof Error ? err.message : 'Failed to create metric');
          return false;
        } finally {
          setCreating(false);
        }
      },
    }));

    return (
      <div className="space-y-4">
        {mode === 'select' ? (
          <div className="space-y-3">
            <div className="space-y-1" data-testid="kpi-form-metric-field">
              <Label>
                Select metric <span className="text-destructive">*</span>
              </Label>
              <MetricPicker
                value={metricId}
                onChange={(id) => {
                  if (id !== null) onMetricSelected(id, '');
                }}
                hideCreateLink
              />
            </div>
            <button
              type="button"
              onClick={() => setMode('create')}
              className="flex items-center gap-1 text-sm font-medium"
              style={{ color: 'var(--primary)' }}
            >
              Or create a new metric →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setMode('select')}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-gray-900"
            >
              ← Back to search
            </button>
            {/* Name */}
            <div className="space-y-1">
              <Label>
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                {...register('name', { required: 'Name is required' })}
                placeholder="Metric name"
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            {/* Definition */}
            <div className="space-y-1">
              <Label>Definition</Label>
              <Textarea
                {...register('description')}
                placeholder="Define it so others can make sense of it"
                rows={2}
                className="break-words overflow-wrap-anywhere"
                style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
              />
            </div>

            {/* Datasource */}
            <div className="space-y-1">
              <Label>
                Datasource <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="schema_name"
                rules={{ required: 'Datasource is required' }}
                render={() => (
                  <DatasetSelector
                    schema_name={schemaName}
                    table_name={tableName}
                    onDatasetChange={(schema, table) => {
                      setValue('schema_name', schema, { shouldValidate: true });
                      setValue('table_name', table, { shouldValidate: true });
                    }}
                  />
                )}
              />
              {errors.schema_name && (
                <p className="text-xs text-destructive">{errors.schema_name.message}</p>
              )}
            </div>

            {/* Simple / Calculated tabs */}
            <Controller
              control={control}
              name="mode"
              render={({ field }) => (
                <Tabs value={field.value} onValueChange={(v) => field.onChange(v)}>
                  <TabsList className="w-full">
                    <TabsTrigger
                      value="simple"
                      className="flex-1 data-[state=active]:text-white"
                      style={{
                        backgroundColor: field.value === 'simple' ? 'var(--primary)' : undefined,
                      }}
                    >
                      Simple
                    </TabsTrigger>
                    <TabsTrigger
                      value="calculated"
                      className="flex-1 data-[state=active]:text-white"
                      style={{
                        backgroundColor:
                          field.value === 'calculated' ? 'var(--primary)' : undefined,
                      }}
                    >
                      Calculated
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="simple" className="space-y-2 mt-1 min-h-[100px]">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Function <span className="text-destructive">*</span>
                        </Label>
                        <Controller
                          control={control}
                          name="aggregation"
                          rules={{
                            validate: (val) =>
                              field.value !== 'simple' || val !== '' || 'Function is required',
                          }}
                          render={({ field: aggField }) => (
                            <Select value={aggField.value} onValueChange={aggField.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a function" />
                              </SelectTrigger>
                              <SelectContent>
                                {AGGREGATION_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {errors.aggregation && (
                          <p className="text-xs text-destructive">{errors.aggregation.message}</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Column <span className="text-destructive">*</span>
                        </Label>
                        <Controller
                          control={control}
                          name="column"
                          rules={{
                            validate: (val) =>
                              field.value !== 'simple' ||
                              aggregation === 'count' ||
                              (val ?? '') !== '' ||
                              'Column is required',
                          }}
                          render={({ field: colField }) => (
                            <Combobox
                              items={columnItems}
                              value={
                                aggregation === 'count' && !colField.value ? '*' : colField.value
                              }
                              onValueChange={(value) =>
                                colField.onChange(value === '*' ? '' : value)
                              }
                              disabled={aggregation === 'count' || !schemaName || !tableName}
                              searchPlaceholder="Search columns..."
                              compact
                              className="[&_input]:!h-9"
                              placeholder={
                                !schemaName || !tableName
                                  ? 'Select datasource first'
                                  : aggregation === 'count'
                                    ? '* (count all rows)'
                                    : 'Choose a column'
                              }
                              renderItem={(item, _isSelected, searchQuery) => (
                                <div className="flex items-center gap-2 min-w-0">
                                  {item.value !== '*' && (
                                    <ColumnTypeIcon dataType={item.data_type} className="w-4 h-4" />
                                  )}
                                  <span className="truncate">
                                    {highlightText(item.label, searchQuery)}
                                  </span>
                                </div>
                              )}
                            />
                          )}
                        />
                        {errors.column && (
                          <p className="text-xs text-destructive">{errors.column.message}</p>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="calculated" className="space-y-2 mt-1 min-h-[100px]">
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        Expression <span className="text-destructive">*</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Write a SQL expression that returns a single numeric value
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <Textarea
                        {...register('column_expression', {
                          validate: (val) =>
                            formMode !== 'calculated' ||
                            val.trim() !== '' ||
                            'Expression is required',
                        })}
                        placeholder="Add a expression eg. SUM(column_name)/10"
                        rows={3}
                        className="font-mono text-sm"
                      />
                      {errors.column_expression && (
                        <p className="text-xs text-destructive">
                          {errors.column_expression.message}
                        </p>
                      )}

                      {validationState === 'validating' && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>running expression</span>
                        </div>
                      )}
                      {validationState === 'valid' && (
                        <div className="flex items-center gap-1.5 text-sm text-green-600 mt-1">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Expression valid</span>
                        </div>
                      )}
                      {validationState === 'error' && validationError && (
                        <div className="flex items-center gap-1.5 text-sm mt-1">
                          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                          <span className="text-muted-foreground">{validationError}</span>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            />

            {createError && <p className="text-sm text-destructive">{createError}</p>}
            {creating && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating metric…
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);
