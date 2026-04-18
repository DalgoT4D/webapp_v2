'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { DatasetSelector } from '@/components/charts/DatasetSelector';
import { FilterRow } from '@/components/alerts/FilterRow';
import { AlertTestPreview } from '@/components/alerts/AlertTestPreview';
import { useTableColumns } from '@/hooks/api/useWarehouse';
import { WEEKDAYS, SCHEDULE_OPTIONS } from '@/constants/pipeline';
import {
  convertToCronExpression,
  convertCronToSchedule,
  localTimeToUTC,
  utcTimeToLocal,
} from '@/components/pipeline/utils';
import type { Alert, AlertFilter, AlertQueryConfig } from '@/types/alert';
import { AGGREGATION_OPTIONS, CONDITION_OPERATORS } from '@/types/alert';

interface AlertFormProps {
  alert?: Alert | null;
  onSave: (data: {
    name: string;
    query_config: AlertQueryConfig;
    cron: string;
    recipients: string[];
    message: string;
  }) => Promise<void>;
  onCancel: () => void;
}

interface FormValues {
  name: string;
  schema_name: string;
  table_name: string;
  filters: AlertFilter[];
  filter_connector: 'AND' | 'OR';
  aggregation: string;
  measure_column: string;
  group_by_column: string;
  condition_operator: string;
  condition_value: string;
  schedule_type: string;
  cronDaysOfWeek: { id: string; label: string }[];
  cronTimeOfDay: string;
  recipients: string[];
  message: string;
}

function generateAlertName(
  aggregation: string,
  measureColumn: string,
  conditionOperator: string,
  conditionValue: string,
  groupByColumn: string
): string {
  const col = measureColumn || 'rows';
  const group = groupByColumn ? ` per ${groupByColumn}` : '';
  return `${aggregation} of ${col} ${conditionOperator} ${conditionValue}${group}`;
}

export function AlertForm({ alert, onSave, onCancel }: AlertFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [nameManuallyEdited, setNameManuallyEdited] = useState(!!alert);

  const existingCron = alert ? convertCronToSchedule(alert.cron) : null;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: alert?.name ?? '',
      schema_name: alert?.query_config?.schema_name ?? '',
      table_name: alert?.query_config?.table_name ?? '',
      filters: alert?.query_config?.filters ?? [],
      filter_connector: alert?.query_config?.filter_connector ?? 'AND',
      aggregation: alert?.query_config?.aggregation ?? '',
      measure_column: alert?.query_config?.measure_column ?? '',
      group_by_column: alert?.query_config?.group_by_column ?? '',
      condition_operator: alert?.query_config?.condition_operator ?? '',
      condition_value: alert?.query_config?.condition_value?.toString() ?? '',
      schedule_type: existingCron?.schedule ?? 'daily',
      cronDaysOfWeek:
        existingCron?.daysOfWeek.map((d) => ({
          id: d,
          label: WEEKDAYS[d],
        })) ?? [],
      cronTimeOfDay: existingCron?.timeOfDay ? utcTimeToLocal(existingCron.timeOfDay) : '09:00',
      recipients: alert?.recipients ?? [],
      message: alert?.message ?? '',
    },
  });

  const schemaName = watch('schema_name');
  const tableName = watch('table_name');
  const filters = watch('filters');
  const filterConnector = watch('filter_connector');
  const aggregation = watch('aggregation');
  const measureColumn = watch('measure_column');
  const groupByColumn = watch('group_by_column');
  const conditionOperator = watch('condition_operator');
  const conditionValue = watch('condition_value');
  const scheduleType = watch('schedule_type');
  const recipients = watch('recipients');

  const { data: tableColumns } = useTableColumns(schemaName || null, tableName || null);

  const handleDatasetChange = useCallback(
    (schema: string, table: string) => {
      setValue('schema_name', schema);
      setValue('table_name', table);
      setValue('filters', []);
      setValue('measure_column', '');
      setValue('group_by_column', '');
    },
    [setValue]
  );

  const columnItems: ComboboxItem[] = useMemo(() => {
    if (!tableColumns) return [];
    return tableColumns.map((col) => ({ value: col.name, label: col.name }));
  }, [tableColumns]);

  const weekdayItems: ComboboxItem[] = useMemo(
    () => Object.entries(WEEKDAYS).map(([id, label]) => ({ value: id, label })),
    []
  );

  const scheduleItems: ComboboxItem[] = useMemo(
    () =>
      SCHEDULE_OPTIONS.filter((s) => s.id !== 'manual').map((s) => ({
        value: s.id,
        label: s.label,
      })),
    []
  );

  // Auto-generate name
  useEffect(() => {
    if (!nameManuallyEdited && aggregation && conditionOperator && conditionValue) {
      setValue(
        'name',
        generateAlertName(
          aggregation,
          measureColumn,
          conditionOperator,
          conditionValue,
          groupByColumn
        )
      );
    }
  }, [
    aggregation,
    measureColumn,
    conditionOperator,
    conditionValue,
    groupByColumn,
    nameManuallyEdited,
    setValue,
  ]);

  // Build query config for test preview
  const currentQueryConfig: AlertQueryConfig | null = useMemo(() => {
    if (!schemaName || !tableName || !aggregation || !conditionOperator || !conditionValue) {
      return null;
    }
    return {
      schema_name: schemaName,
      table_name: tableName,
      filters: filters ?? [],
      filter_connector: filterConnector,
      aggregation: aggregation as AlertQueryConfig['aggregation'],
      measure_column: measureColumn || null,
      group_by_column: groupByColumn || null,
      condition_operator: conditionOperator,
      condition_value: parseFloat(conditionValue),
    };
  }, [
    schemaName,
    tableName,
    filters,
    filterConnector,
    aggregation,
    measureColumn,
    groupByColumn,
    conditionOperator,
    conditionValue,
  ]);

  // Filter management
  const addFilter = useCallback(() => {
    const current = filters ?? [];
    setValue('filters', [...current, { column: '', operator: '', value: '' }]);
  }, [filters, setValue]);

  const updateFilter = useCallback(
    (index: number, updated: AlertFilter) => {
      const current = [...(filters ?? [])];
      current[index] = updated;
      setValue('filters', current);
    },
    [filters, setValue]
  );

  const removeFilter = useCallback(
    (index: number) => {
      const current = [...(filters ?? [])];
      current.splice(index, 1);
      setValue('filters', current);
    },
    [filters, setValue]
  );

  // Recipients management
  const addRecipient = useCallback(() => {
    const email = newEmail.trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (recipients.includes(email)) return;
    setValue('recipients', [...recipients, email]);
    setNewEmail('');
  }, [newEmail, recipients, setValue]);

  const removeRecipient = useCallback(
    (index: number) => {
      const current = [...recipients];
      current.splice(index, 1);
      setValue('recipients', current);
    },
    [recipients, setValue]
  );

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      const cronExpression = convertToCronExpression(
        data.schedule_type,
        data.cronDaysOfWeek.map((d) => d.id),
        data.cronTimeOfDay ? localTimeToUTC(data.cronTimeOfDay) : '9 0'
      );

      await onSave({
        name: data.name,
        query_config: {
          schema_name: data.schema_name,
          table_name: data.table_name,
          filters: data.filters.filter((f) => f.column && f.operator),
          filter_connector: data.filter_connector,
          aggregation: data.aggregation as AlertQueryConfig['aggregation'],
          measure_column: data.measure_column || null,
          group_by_column: data.group_by_column || null,
          condition_operator: data.condition_operator,
          condition_value: parseFloat(data.condition_value),
        },
        cron: cronExpression,
        recipients: data.recipients,
        message: data.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const defaultOpenSections = useMemo(() => {
    const sections = ['condition', 'schedule'];
    if (alert && (alert.query_config.filters?.length ?? 0) > 0) {
      sections.push('filters');
    }
    return sections;
  }, [alert]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{alert ? 'Edit Alert' : 'Create Alert'}</h1>
            <p className="text-muted-foreground mt-1">
              Configure when to check your data and who to notify
            </p>
          </div>
        </div>
      </div>

      {/* Split pane: Form (left) + Preview (right) */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left: Form */}
        <div className="w-1/2 overflow-y-auto px-6 pb-20 mt-6 border-r">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-testid="alert-form">
            {/* Top: Dataset */}
            <div className="border rounded-lg p-4 bg-white">
              <div className="space-y-2">
                <Label>Dataset</Label>
                <DatasetSelector
                  schema_name={schemaName}
                  table_name={tableName}
                  onDatasetChange={handleDatasetChange}
                />
              </div>
            </div>

            {/* Collapsible sections */}
            {tableName && (
              <Accordion type="multiple" defaultValue={defaultOpenSections} className="space-y-3">
                {/* Alert Condition */}
                <AccordionItem value="condition" className="border rounded-lg bg-white px-4">
                  <AccordionTrigger className="text-base font-semibold">
                    Alert Condition
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Check if [aggregation] of [column] per [group] is [operator] [value]
                      </p>
                      <div className="space-y-3">
                        {/* Row 1: Check if [agg] of [column] */}
                        <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-3">
                          <span className="text-sm font-medium text-right">Check if</span>
                          <Controller
                            name="aggregation"
                            control={control}
                            rules={{ required: 'Required' }}
                            render={({ field }) => (
                              <Combobox
                                items={AGGREGATION_OPTIONS.map((o) => ({
                                  value: o.value,
                                  label: o.label,
                                }))}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="aggregation"
                              />
                            )}
                          />
                          <span className="text-sm font-medium text-right">of</span>
                          <Controller
                            name="measure_column"
                            control={control}
                            render={({ field }) => (
                              <Combobox
                                items={columnItems}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder={aggregation === 'COUNT' ? 'all rows' : 'column'}
                              />
                            )}
                          />
                        </div>

                        {/* Row 2: per [group] */}
                        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3">
                          <span className="text-sm font-medium text-right min-w-[60px]">per</span>
                          <Controller
                            name="group_by_column"
                            control={control}
                            render={({ field }) => (
                              <Combobox
                                items={[{ value: '', label: '(no grouping)' }, ...columnItems]}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="(no grouping)"
                              />
                            )}
                          />
                        </div>

                        {/* Row 3: is [operator] [value] */}
                        <div className="grid grid-cols-[auto_auto_1fr] items-center gap-x-3">
                          <span className="text-sm font-medium text-right min-w-[60px]">is</span>
                          <Controller
                            name="condition_operator"
                            control={control}
                            rules={{ required: 'Required' }}
                            render={({ field }) => (
                              <Combobox
                                items={CONDITION_OPERATORS.map((o) => ({
                                  value: o.value,
                                  label: o.label,
                                }))}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="operator"
                                className="w-32"
                              />
                            )}
                          />
                          <Input
                            type="number"
                            step="any"
                            placeholder="value"
                            {...register('condition_value', {
                              required: 'Required',
                            })}
                            data-testid="condition-value-input"
                          />
                        </div>
                      </div>
                      {(errors.aggregation ||
                        errors.condition_operator ||
                        errors.condition_value) && (
                        <p className="text-sm text-red-500">
                          Aggregation, operator, and value are required
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Filters */}
                <AccordionItem value="filters" className="border rounded-lg bg-white px-4">
                  <AccordionTrigger className="text-base font-semibold">
                    Filters
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      (Optional)
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Narrow down which rows to include before computing the measure.
                      </p>
                      {(filters ?? []).length > 1 && (
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Join filters with:</Label>
                          <Controller
                            name="filter_connector"
                            control={control}
                            render={({ field }) => (
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant={field.value === 'AND' ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => field.onChange('AND')}
                                  data-testid="filter-connector-and"
                                >
                                  AND
                                </Button>
                                <Button
                                  type="button"
                                  variant={field.value === 'OR' ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => field.onChange('OR')}
                                  data-testid="filter-connector-or"
                                >
                                  OR
                                </Button>
                              </div>
                            )}
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        {(filters ?? []).map((filter, index) => (
                          <FilterRow
                            key={index}
                            filter={filter}
                            columns={tableColumns ?? []}
                            onChange={(updated) => updateFilter(index, updated)}
                            onRemove={() => removeFilter(index)}
                          />
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addFilter}
                          data-testid="add-filter-btn"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add filter
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Schedule & Delivery */}
                <AccordionItem value="schedule" className="border rounded-lg bg-white px-4">
                  <AccordionTrigger className="text-base font-semibold">
                    Schedule & Delivery
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Frequency</Label>
                          <Controller
                            name="schedule_type"
                            control={control}
                            render={({ field }) => (
                              <Combobox
                                items={scheduleItems}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="Select frequency"
                              />
                            )}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Time of day</Label>
                          <Input
                            type="time"
                            {...register('cronTimeOfDay')}
                            data-testid="cron-time-input"
                          />
                        </div>
                      </div>

                      {scheduleType === 'weekly' && (
                        <div className="space-y-2">
                          <Label>Days of the week</Label>
                          <Controller
                            name="cronDaysOfWeek"
                            control={control}
                            rules={{ required: 'Select at least one day' }}
                            render={({ field }) => (
                              <Combobox
                                mode="multi"
                                items={weekdayItems}
                                values={field.value.map((d) => d.id)}
                                onValuesChange={(values) =>
                                  field.onChange(
                                    values.map((v) => ({
                                      id: v,
                                      label: WEEKDAYS[v],
                                    }))
                                  )
                                }
                                placeholder="Select days"
                              />
                            )}
                          />
                          {errors.cronDaysOfWeek && (
                            <p className="text-sm text-red-500">{errors.cronDaysOfWeek.message}</p>
                          )}
                        </div>
                      )}

                      {/* Recipients */}
                      <div className="space-y-2">
                        <Label>Recipients</Label>
                        <div className="flex gap-2">
                          <Input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="Enter email address"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addRecipient();
                              }
                            }}
                            data-testid="recipient-email-input"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={addRecipient}
                            data-testid="add-recipient-btn"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {recipients.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {recipients.map((email, index) => (
                              <span
                                key={email}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-sm"
                                data-testid={`recipient-${index}`}
                              >
                                {email}
                                <button
                                  type="button"
                                  onClick={() => removeRecipient(index)}
                                  className="hover:text-destructive"
                                  data-testid={`remove-recipient-${index}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Message */}
                      <div className="space-y-2">
                        <Label htmlFor="alert-message">Message</Label>
                        <Textarea
                          id="alert-message"
                          placeholder="Enter the message that will be emailed when this alert fires..."
                          rows={3}
                          {...register('message', {
                            required: 'Message is required',
                          })}
                          data-testid="alert-message-input"
                        />
                        {errors.message && (
                          <p className="text-sm text-red-500">{errors.message.message}</p>
                        )}
                      </div>

                      {/* Alert Title */}
                      <div className="space-y-2">
                        <Label htmlFor="alert-title">Alert Title</Label>
                        <Input
                          id="alert-title"
                          placeholder="Auto-generated from configuration"
                          {...register('name', {
                            required: 'Title is required',
                          })}
                          onChange={(e) => {
                            setNameManuallyEdited(true);
                            register('name').onChange(e);
                          }}
                          data-testid="alert-title-input"
                        />
                        <p className="text-xs text-muted-foreground">
                          Auto-filled based on your alert condition. You can edit it.
                        </p>
                        {errors.name && (
                          <p className="text-sm text-red-500">{errors.name.message}</p>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {/* Hidden submit button for form */}
            <button type="submit" hidden data-testid="alert-submit-hidden" />
          </form>
        </div>

        {/* Right: Preview Panel */}
        <div className="w-1/2 overflow-y-auto px-6 pt-6 pb-6 bg-gray-50/50">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Preview</h2>
            {currentQueryConfig ? (
              <AlertTestPreview queryConfig={currentQueryConfig} />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <p className="text-muted-foreground text-sm">
                  Select a dataset and configure the alert condition to preview results.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Footer */}
      <div className="flex-shrink-0 border-t bg-background px-6 py-3">
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="alert-cancel-btn">
            Cancel
          </Button>
          <Button
            type="button"
            disabled={submitting}
            className="text-white"
            style={{ backgroundColor: 'var(--primary)' }}
            data-testid="alert-save-btn"
            onClick={() => handleSubmit(onSubmit)()}
          >
            {submitting ? 'Saving...' : alert ? 'Update Alert' : 'Save Alert'}
          </Button>
        </div>
      </div>
    </div>
  );
}
