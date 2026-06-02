'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { DatasetSelector } from '@/components/charts/DatasetSelector';
import { Combobox, highlightText } from '@/components/ui/combobox';
import { ColumnTypeIcon } from '@/lib/columnTypeIcons';
import { useTableColumns } from '@/hooks/api/useWarehouse';
import {
  createMetric,
  updateMetric,
  validateMetric,
  getMetricConsumers,
} from '@/hooks/api/useMetrics';
import type { Metric, MetricPayload, MetricConsumersResponse } from '@/types/metrics';
import { AGGREGATION_OPTIONS } from '@/types/metrics';
import { ConsumerLinks } from './consumer-links';

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

interface MetricFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  metric?: Metric | null;
  prefillData?: Partial<MetricPayload>;
}

export function MetricFormDialog({
  open,
  onOpenChange,
  onSuccess,
  metric,
  prefillData,
}: MetricFormDialogProps) {
  const isEdit = !!metric;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isValid },
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

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [consumers, setConsumers] = useState<MetricConsumersResponse | null>(null);

  const mode = watch('mode');
  const schemaName = watch('schema_name');
  const tableName = watch('table_name');
  const aggregation = watch('aggregation');
  const column = watch('column');
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

  // Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      if (metric) {
        reset({
          name: metric.name,
          description: metric.description || '',
          schema_name: metric.schema_name,
          table_name: metric.table_name,
          mode: metric.column_expression ? 'calculated' : 'simple',
          aggregation: metric.aggregation || '',
          column: metric.column || '',
          column_expression: metric.column_expression || '',
        });
        getMetricConsumers(metric.id)
          .then(setConsumers)
          .catch(() => setConsumers(null));
      } else if (prefillData) {
        reset({
          name: prefillData.name || '',
          description: prefillData.description || '',
          schema_name: prefillData.schema_name || '',
          table_name: prefillData.table_name || '',
          mode: prefillData.column_expression ? 'calculated' : 'simple',
          aggregation: prefillData.aggregation || '',
          column: prefillData.column || '',
          column_expression: prefillData.column_expression || '',
        });
      } else {
        reset({
          name: '',
          description: '',
          schema_name: '',
          table_name: '',
          mode: 'simple',
          aggregation: '',
          column: '',
          column_expression: '',
        });
      }
      setSaveError(null);
      setValidationState('idle');
      setValidationError(null);
      setConsumers(null);
    }
  }, [open, metric, prefillData, reset]);

  // Reset validation when expression or datasource changes
  useEffect(() => {
    if (mode === 'calculated') {
      setValidationState('idle');
      setValidationError(null);
    }
  }, [columnExpression, schemaName, tableName, mode]);

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

  const onSubmit = async (data: MetricFormData) => {
    setSaveError(null);
    const payload = buildPayload(data);

    // For calculated mode, validate expression first
    if (data.mode === 'calculated') {
      setValidationState('validating');
      setValidationError(null);

      try {
        const result = await validateMetric(payload);
        if (!result.valid) {
          setValidationState('error');
          setValidationError(result.error || 'Expression is invalid');
          return;
        }
        setValidationState('valid');
      } catch (err: any) {
        setValidationState('error');
        setValidationError(err.message || 'Validation failed');
        return;
      }
    }

    // Save
    setSaving(true);
    try {
      if (isEdit && metric) {
        await updateMetric(metric.id, payload);
      } else {
        await createMetric(payload);
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save metric');
    } finally {
      setSaving(false);
    }
  };

  const hasConsumers = consumers && (consumers.charts.length > 0 || consumers.kpis.length > 0);

  const canSave = isValid && !saving && validationState !== 'validating';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Metric' : 'Create Metric'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
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

          {/* Definition (description) */}
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

          {/* Mode tabs: Simple / Calculated */}
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
                      backgroundColor: field.value === 'calculated' ? 'var(--primary)' : undefined,
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
                        render={({ field: colField }) => (
                          <Combobox
                            items={columnItems}
                            value={
                              aggregation === 'count' && !colField.value ? '*' : colField.value
                            }
                            onValueChange={(value) => colField.onChange(value === '*' ? '' : value)}
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
                          mode !== 'calculated' || val.trim() !== '' || 'Expression is required',
                      })}
                      placeholder="Add a expression eg. SUM(column_name)/10"
                      rows={3}
                      className="font-mono text-sm"
                    />
                    {errors.column_expression && (
                      <p className="text-xs text-destructive">{errors.column_expression.message}</p>
                    )}

                    {/* Validation state */}
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

          {/* Edit blast radius warning */}
          {isEdit && hasConsumers && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="text-sm font-medium text-amber-700 mb-1">
                This metric has been used in multiple places. Editing and changing it can affect
                them.
              </p>
              <ConsumerLinks consumers={consumers!} variant="inherit" />
            </div>
          )}

          {/* Save error */}
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            CANCEL
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={!canSave}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saving ? 'Validating…' : isEdit ? 'Save' : 'Create Metric'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
