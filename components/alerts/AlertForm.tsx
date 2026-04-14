'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleHelp, Mail, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DatasetSelector } from '@/components/charts/DatasetSelector';
import { FilterRow } from '@/components/alerts/FilterRow';
import { AlertTestPreview } from '@/components/alerts/AlertTestPreview';
import { useTableColumns } from '@/hooks/api/useWarehouse';
import { useMetrics } from '@/hooks/api/useMetrics';
import type { Alert, AlertFilter, AlertMessagePlaceholder, AlertQueryConfig } from '@/types/alert';
import { AGGREGATION_OPTIONS, CONDITION_OPERATORS } from '@/types/alert';

interface AlertSavePayload {
  name: string;
  metric_id?: number | null;
  query_config: AlertQueryConfig;
  recipients: string[];
  message: string;
  group_message?: string;
  message_placeholders: AlertMessagePlaceholder[];
}

interface AlertFormProps {
  alert?: Alert | null;
  initialMetricId?: number | null;
  compact?: boolean;
  title?: string;
  description?: string;
  onSave: (data: AlertSavePayload) => Promise<void>;
  onCancel: () => void;
}

interface AlertFormState {
  name: string;
  metric_id: number | null;
  schema_name: string;
  table_name: string;
  filters: AlertFilter[];
  filter_connector: 'AND' | 'OR';
  aggregation: AlertQueryConfig['aggregation'] | '';
  measure_column: string;
  group_by_column: string;
  condition_operator: string;
  condition_value: string;
  recipients: string[];
  message: string;
  group_message: string;
  message_placeholders: AlertMessagePlaceholder[];
}

const DEFAULT_MESSAGE = '{{alert_name}} fired for {{table_name}}. Current value: {{alert_value}}.';
const DEFAULT_GROUPED_MESSAGE = 'The following {{group_by_column}} values failed {{alert_name}}:';
const DEFAULT_GROUP_TEMPLATE = '{{group_by_value}}\nAlert value: {{alert_value}}';

function generateAlertName(
  metricName: string | null,
  aggregation: string,
  measureColumn: string,
  conditionOperator: string,
  conditionValue: string,
  groupByColumn: string
) {
  const source = metricName || `${aggregation.toLowerCase()} of ${measureColumn || 'rows'}`;
  const groupSuffix = groupByColumn ? ` by ${groupByColumn}` : '';
  return `${source} ${conditionOperator} ${conditionValue}${groupSuffix}`;
}

function placeholderLabel(placeholder: AlertMessagePlaceholder) {
  if (placeholder.aggregation === 'COUNT' && !placeholder.column) {
    return 'COUNT(rows)';
  }
  return `${placeholder.aggregation}(${placeholder.column || '*'})`;
}

function autoPlaceholderKey(aggregation: string, column: string | null) {
  if (aggregation === 'COUNT' && !column) {
    return 'count_rows';
  }
  const safeColumn = (column || 'value').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return `${aggregation.toLowerCase()}_${safeColumn}`.replace(/^_+|_+$/g, '');
}

function aggregationLabel(value: string) {
  return AGGREGATION_OPTIONS.find((option) => option.value === value.toLowerCase())?.label ?? value;
}

function isNumericColumnType(dataType?: string) {
  const lower = (dataType || '').toLowerCase();
  return [
    'integer',
    'bigint',
    'numeric',
    'decimal',
    'double',
    'real',
    'float',
    'money',
    'int',
    'smallint',
    'number',
  ].some((token) => lower.includes(token));
}

function buildInitialState(alert?: Alert | null, initialMetricId?: number | null): AlertFormState {
  return {
    name: alert?.name ?? '',
    metric_id: alert?.metric_id ?? initialMetricId ?? null,
    schema_name: alert?.query_config.schema_name ?? '',
    table_name: alert?.query_config.table_name ?? '',
    filters: alert?.query_config.filters ?? [],
    filter_connector: alert?.query_config.filter_connector ?? 'AND',
    aggregation: alert?.query_config.aggregation ?? '',
    measure_column: alert?.query_config.measure_column ?? '',
    group_by_column: alert?.query_config.group_by_column ?? '',
    condition_operator: alert?.query_config.condition_operator ?? '>',
    condition_value:
      alert?.query_config.condition_value != null ? String(alert.query_config.condition_value) : '',
    recipients: alert?.recipients ?? [],
    message: alert?.message ?? DEFAULT_MESSAGE,
    group_message: alert?.group_message ?? '',
    message_placeholders: alert?.message_placeholders ?? [],
  };
}

function FieldHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-muted-foreground">
          <CircleHelp className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{text}</TooltipContent>
    </Tooltip>
  );
}

function TokenButton({
  label,
  token,
  onClick,
}: {
  label: string;
  token: string;
  onClick: (token: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(token)}
      className="rounded-full border bg-white px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
    >
      {label}
    </button>
  );
}

function extractTemplateTokens(template: string) {
  const matches = template.match(/{{\s*([A-Za-z_][A-Za-z0-9_]*)\s*}}/g) || [];
  return matches.map((match) => match.replace(/[{} ]/g, ''));
}

export function AlertForm({
  alert,
  initialMetricId,
  compact = false,
  title,
  description,
  onSave,
  onCancel,
}: AlertFormProps) {
  const { data: metrics } = useMetrics();
  const [form, setForm] = useState<AlertFormState>(() => buildInitialState(alert, initialMetricId));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [nameManuallyEdited, setNameManuallyEdited] = useState(Boolean(alert));
  const [activeMessageField, setActiveMessageField] = useState<'message' | 'group_message'>(
    'message'
  );
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
  const groupMessageRef = useRef<HTMLTextAreaElement | null>(null);
  const [placeholderDialogOpen, setPlaceholderDialogOpen] = useState(false);
  const [placeholderDialogError, setPlaceholderDialogError] = useState<string | null>(null);
  const [placeholderDraft, setPlaceholderDraft] = useState<AlertMessagePlaceholder>({
    aggregation: 'SUM',
    column: null,
    key: 'sum_value',
  });

  const selectedMetric = useMemo(
    () => (metrics || []).find((metric) => metric.id === form.metric_id) || null,
    [form.metric_id, metrics]
  );

  useEffect(() => {
    if (!selectedMetric) return;
    setForm((current) => ({
      ...current,
      schema_name: selectedMetric.schema_name,
      table_name: selectedMetric.table_name,
      aggregation: selectedMetric.aggregation.toUpperCase() as AlertQueryConfig['aggregation'],
      measure_column: selectedMetric.column,
      message:
        current.message === DEFAULT_MESSAGE || current.message === ''
          ? DEFAULT_MESSAGE
          : current.message,
    }));
  }, [selectedMetric]);

  useEffect(() => {
    if (
      !nameManuallyEdited &&
      form.aggregation &&
      form.condition_operator &&
      form.condition_value.trim()
    ) {
      setForm((current) => ({
        ...current,
        name: generateAlertName(
          selectedMetric?.name ?? null,
          current.aggregation,
          current.measure_column,
          current.condition_operator,
          current.condition_value,
          current.group_by_column
        ),
      }));
    }
  }, [
    form.aggregation,
    form.condition_operator,
    form.condition_value,
    form.group_by_column,
    form.measure_column,
    nameManuallyEdited,
    selectedMetric?.name,
  ]);

  useEffect(() => {
    if (!form.group_by_column) {
      setForm((current) => ({
        ...current,
        group_message: '',
        message:
          current.message === DEFAULT_GROUPED_MESSAGE || !current.message
            ? DEFAULT_MESSAGE
            : current.message,
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      message:
        current.message === DEFAULT_MESSAGE || !current.message
          ? DEFAULT_GROUPED_MESSAGE
          : current.message,
      group_message: current.group_message || DEFAULT_GROUP_TEMPLATE,
    }));
  }, [form.group_by_column]);

  const { data: tableColumns } = useTableColumns(form.schema_name || null, form.table_name || null);

  const tableColumnOptions = tableColumns || [];
  const numericColumns = tableColumnOptions.filter((column) =>
    isNumericColumnType(column.data_type)
  );
  const aggregationColumnOptions =
    form.aggregation === 'COUNT' ? tableColumnOptions : numericColumns.length ? numericColumns : [];

  const buildPlaceholderDraft = () => {
    const aggregation: AlertMessagePlaceholder['aggregation'] =
      numericColumns.length > 0 ? 'SUM' : 'COUNT';
    const defaultColumn =
      aggregation === 'COUNT'
        ? null
        : numericColumns[0]?.name || tableColumnOptions[0]?.name || null;
    return {
      aggregation,
      column: defaultColumn,
      key: autoPlaceholderKey(aggregation, defaultColumn),
    };
  };

  const availablePlaceholderColumns =
    placeholderDraft.aggregation === 'COUNT'
      ? tableColumnOptions
      : numericColumns.length
        ? numericColumns
        : tableColumnOptions;

  const queryConfig = useMemo<AlertQueryConfig | null>(() => {
    if (
      !form.schema_name ||
      !form.table_name ||
      !form.aggregation ||
      !form.condition_operator ||
      form.condition_value.trim() === ''
    ) {
      return null;
    }

    const parsedCondition = Number.parseFloat(form.condition_value);
    if (Number.isNaN(parsedCondition)) {
      return null;
    }

    return {
      schema_name: form.schema_name,
      table_name: form.table_name,
      filters: form.filters,
      filter_connector: form.filter_connector,
      aggregation: form.aggregation,
      measure_column: form.measure_column || null,
      group_by_column: form.group_by_column || null,
      condition_operator: form.condition_operator,
      condition_value: parsedCondition,
    };
  }, [form]);

  const builtInGlobalTokens = useMemo(
    () => [
      { label: 'Alert name', token: '{{alert_name}}' },
      { label: 'Metric name', token: '{{metric_name}}' },
      { label: 'Table name', token: '{{table_name}}' },
      ...(form.group_by_column
        ? [
            { label: 'Group by Column', token: '{{group_by_column}}' },
            { label: 'Failing group count', token: '{{failing_group_count}}' },
          ]
        : []),
      ...(!form.group_by_column ? [{ label: 'Alert value', token: '{{alert_value}}' }] : []),
    ],
    [form.group_by_column]
  );

  const builtInGroupTokens = useMemo(
    () =>
      form.group_by_column
        ? [
            { label: 'Group value', token: '{{group_by_value}}' },
            { label: 'Alert value', token: '{{alert_value}}' },
          ]
        : [],
    [form.group_by_column]
  );

  const metricSelectionLocked = compact && initialMetricId != null && !alert;
  const wrapperClassName = compact
    ? 'flex h-full w-full flex-col overflow-hidden'
    : 'mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6';
  const headerClassName = compact ? 'shrink-0 border-b px-6 py-5' : 'flex flex-col gap-2';
  const headerCopyClassName = compact
    ? 'flex max-w-4xl flex-col gap-2 pr-10'
    : 'flex flex-col gap-2';
  const errorClassName = compact
    ? 'mx-6 mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive'
    : 'rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive';
  const contentGridClassName = compact
    ? 'flex-1 overflow-y-auto px-10 pb-10 pt-6'
    : 'grid gap-6 lg:grid-cols-[1.2fr_0.8fr]';
  const leftColumnClassName = compact ? 'space-y-4' : 'space-y-6';
  const rightColumnClassName = compact ? 'mt-4 space-y-4' : 'space-y-6';
  const sectionClassName = compact
    ? 'rounded-[28px] border bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.08)]'
    : 'rounded-[28px] border bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]';
  const sectionTitleClassName = compact ? 'text-base font-semibold' : 'text-lg font-semibold';
  const sectionDescriptionClassName = compact
    ? 'text-xs text-muted-foreground'
    : 'text-sm text-muted-foreground';

  const insertToken = (token: string) => {
    const field = activeMessageField;
    const ref = field === 'message' ? messageRef : groupMessageRef;
    const currentValue = form[field];

    if (!ref.current) {
      setForm((current) => ({
        ...current,
        [field]: `${current[field]}${current[field] ? ' ' : ''}${token}`,
      }));
      return;
    }

    const start = ref.current.selectionStart ?? currentValue.length;
    const end = ref.current.selectionEnd ?? currentValue.length;
    const nextValue = `${currentValue.slice(0, start)}${token}${currentValue.slice(end)}`;

    setForm((current) => ({
      ...current,
      [field]: nextValue,
    }));

    window.requestAnimationFrame(() => {
      ref.current?.focus();
      const nextCursor = start + token.length;
      ref.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const addRecipient = () => {
    const email = newEmail.trim();
    if (!email || form.recipients.includes(email)) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('Enter a valid recipient email address.');
      return;
    }
    setFormError(null);
    setForm((current) => ({ ...current, recipients: [...current.recipients, email] }));
    setNewEmail('');
  };

  const removeRecipient = (email: string) => {
    setForm((current) => ({
      ...current,
      recipients: current.recipients.filter((recipient) => recipient !== email),
    }));
  };

  const addFilter = () => {
    setForm((current) => ({
      ...current,
      filters: [...current.filters, { column: '', operator: '', value: '' }],
    }));
  };

  const updateFilter = (index: number, updated: AlertFilter) => {
    setForm((current) => ({
      ...current,
      filters: current.filters.map((filter, filterIndex) =>
        filterIndex === index ? updated : filter
      ),
    }));
  };

  const removeFilter = (index: number) => {
    setForm((current) => ({
      ...current,
      filters: current.filters.filter((_, filterIndex) => filterIndex !== index),
    }));
  };

  const openAddPlaceholderDialog = () => {
    setPlaceholderDialogError(null);
    setPlaceholderDraft(buildPlaceholderDraft());
    setPlaceholderDialogOpen(true);
  };

  const updatePlaceholderDraft = (
    updates: Partial<AlertMessagePlaceholder> & { column?: string | null }
  ) => {
    setPlaceholderDraft((current) => {
      const nextAggregation = updates.aggregation ?? current.aggregation;
      const nextColumn =
        updates.column === undefined
          ? current.column
          : updates.column === '__rows__'
            ? null
            : updates.column;

      return {
        aggregation: nextAggregation,
        column: nextColumn,
        key: autoPlaceholderKey(nextAggregation, nextColumn),
      };
    });
  };

  const savePlaceholderDraft = () => {
    const key = autoPlaceholderKey(placeholderDraft.aggregation, placeholderDraft.column);

    const duplicate = form.message_placeholders.some((placeholder) => placeholder.key === key);
    if (duplicate) {
      setPlaceholderDialogError('That dataset token already exists.');
      return;
    }

    const nextPlaceholder = {
      aggregation: placeholderDraft.aggregation,
      column: placeholderDraft.column,
      key,
    };

    setForm((current) => ({
      ...current,
      message_placeholders: [...current.message_placeholders, nextPlaceholder],
    }));
    setPlaceholderDialogError(null);
    setPlaceholderDialogOpen(false);
  };

  const removePlaceholder = (index: number) => {
    setForm((current) => ({
      ...current,
      message_placeholders: current.message_placeholders.filter(
        (_, placeholderIndex) => placeholderIndex !== index
      ),
    }));
  };

  const handleSave = async () => {
    setFormError(null);

    if (!queryConfig) {
      setFormError('Complete the alert condition before saving.');
      return;
    }
    if (!form.name.trim()) {
      setFormError('Alert name is required.');
      return;
    }
    if (form.recipients.length === 0) {
      setFormError('Add at least one recipient.');
      return;
    }
    if (!form.message.trim()) {
      setFormError('Add an email message.');
      return;
    }
    if (form.group_by_column && !form.group_message.trim()) {
      setFormError('Add the per-group message section for grouped alerts.');
      return;
    }

    const validTokens = new Set(
      [
        'alert_name',
        'metric_name',
        'table_name',
        'alert_value',
        'group_by_column',
        'group_by_value',
        'failing_group_count',
        ...form.message_placeholders.map((placeholder) => placeholder.key),
      ].filter(Boolean)
    );

    const unknownTokens = [
      ...extractTemplateTokens(form.message),
      ...extractTemplateTokens(form.group_message),
    ].filter((token) => !validTokens.has(token));

    if (unknownTokens.length > 0) {
      setFormError(
        `Unknown message token${unknownTokens.length > 1 ? 's' : ''}: ${Array.from(new Set(unknownTokens)).join(', ')}`
      );
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        name: form.name.trim(),
        metric_id: form.metric_id,
        query_config: queryConfig,
        recipients: form.recipients,
        message: form.message,
        group_message: form.group_message,
        message_placeholders: form.message_placeholders,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={wrapperClassName}>
      <div className={headerClassName}>
        <div className={headerCopyClassName}>
          <h1 className={`${compact ? 'text-2xl' : 'text-3xl'} font-bold`}>
            {title || (alert ? 'Edit alert' : 'Create alert')}
          </h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>

      {formError && <div className={errorClassName}>{formError}</div>}

      <div className={contentGridClassName}>
        <div className={leftColumnClassName}>
          <section className={sectionClassName}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className={sectionTitleClassName}>
                  {metricSelectionLocked ? 'Metric alert setup' : 'Alert source'}
                </h2>
                {!metricSelectionLocked ? (
                  <p className={sectionDescriptionClassName}>
                    Choose a metric or configure a standalone alert.
                  </p>
                ) : null}
              </div>
              {selectedMetric && <Badge variant="secondary">Metric-backed</Badge>}
            </div>

            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="alert-name">Alert name</Label>
                <Input
                  id="alert-name"
                  value={form.name}
                  onChange={(event) => {
                    setNameManuallyEdited(true);
                    setForm((current) => ({ ...current, name: event.target.value }));
                  }}
                  placeholder="e.g. Attendance fell below threshold"
                />
              </div>

              {!metricSelectionLocked && (
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Label>Metric</Label>
                    <FieldHint text="Choosing a metric locks the dataset, aggregation, and measure column to that metric. You only configure the alert condition, filters, grouping, and message here." />
                  </div>
                  <Select
                    value={form.metric_id != null ? String(form.metric_id) : 'standalone'}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        metric_id: value === 'standalone' ? null : Number(value),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a metric" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standalone">Proceed without metric</SelectItem>
                      {(metrics || []).map((metric) => (
                        <SelectItem key={metric.id} value={String(metric.id)}>
                          {metric.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedMetric ? (
                <div className="space-y-3">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="grid gap-2">
                      <Label>Dataset</Label>
                      <Input
                        value={`${selectedMetric.schema_name}.${selectedMetric.table_name}`}
                        readOnly
                        disabled
                        className="bg-muted/40 font-mono"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Aggregation</Label>
                      <Input
                        value={aggregationLabel(selectedMetric.aggregation)}
                        readOnly
                        disabled
                        className="bg-muted/40"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Measure column</Label>
                      <Input
                        value={selectedMetric.column}
                        readOnly
                        disabled
                        className="bg-muted/40"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label>Dataset</Label>
                    <DatasetSelector
                      schema_name={form.schema_name}
                      table_name={form.table_name}
                      onDatasetChange={(schema_name, table_name) =>
                        setForm((current) => ({
                          ...current,
                          schema_name,
                          table_name,
                          filters: [],
                          measure_column: '',
                          group_by_column: '',
                          message_placeholders: [],
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Aggregation</Label>
                      <Select
                        value={form.aggregation || undefined}
                        onValueChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            aggregation: value as AlertQueryConfig['aggregation'],
                            measure_column: '',
                            message_placeholders: [],
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select aggregation" />
                        </SelectTrigger>
                        <SelectContent>
                          {AGGREGATION_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Measure column</Label>
                      <Select
                        value={
                          form.measure_column || (form.aggregation === 'COUNT' ? '__rows__' : '')
                        }
                        onValueChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            measure_column: value === '__rows__' ? '' : value,
                          }))
                        }
                        disabled={!form.aggregation}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          {form.aggregation === 'COUNT' && (
                            <SelectItem value="__rows__">Rows (*)</SelectItem>
                          )}
                          {aggregationColumnOptions.map((column) => (
                            <SelectItem key={column.name} value={column.name}>
                              {column.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Filters</h3>
                    <p className="text-sm text-muted-foreground">
                      Narrow the rows included before the alert aggregate is computed.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addFilter}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add filter
                  </Button>
                </div>

                {form.filters.length > 0 && (
                  <div className="grid max-w-[220px] gap-2">
                    <Label>Filter connector</Label>
                    <Select
                      value={form.filter_connector}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          filter_connector: value as 'AND' | 'OR',
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AND">AND</SelectItem>
                        <SelectItem value="OR">OR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {form.filters.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No filters yet. The alert will evaluate the entire dataset or metric table.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {form.filters.map((filter, index) => (
                      <FilterRow
                        key={`filter-${index}`}
                        filter={filter}
                        columns={tableColumnOptions}
                        onChange={(updated) => updateFilter(index, updated)}
                        onRemove={() => removeFilter(index)}
                      />
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="grid gap-2 md:max-w-md">
                  <div className="flex items-center gap-2">
                    <Label>
                      Group by Column <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <FieldHint text="If you pick a column, the alert evaluates the aggregate separately for each value in that column and sends one email containing all failing groups." />
                  </div>
                  <Select
                    value={form.group_by_column || 'none'}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        group_by_column: value === 'none' ? '' : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No grouping" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No grouping</SelectItem>
                      {tableColumnOptions.map((column) => (
                        <SelectItem key={column.name} value={column.name}>
                          {column.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Condition</Label>
                    <Select
                      value={form.condition_operator}
                      onValueChange={(value) =>
                        setForm((current) => ({ ...current, condition_operator: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPERATORS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Threshold</Label>
                    <Input
                      value={form.condition_value}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, condition_value: event.target.value }))
                      }
                      placeholder="e.g. 10"
                      inputMode="decimal"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className={sectionClassName}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className={sectionTitleClassName}>Recipients</h2>
                <p className={sectionDescriptionClassName}>
                  Everyone listed here receives the same alert email.
                </p>
              </div>
              <Badge variant="secondary">{form.recipients.length} recipients</Badge>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Input
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder="name@example.com"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addRecipient();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addRecipient}>
                  Add
                </Button>
              </div>

              {form.recipients.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {form.recipients.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-2 rounded-full border bg-muted/20 px-3 py-1 text-sm"
                    >
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      {email}
                      <button type="button" onClick={() => removeRecipient(email)}>
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No recipients added yet.</p>
              )}
            </div>
          </section>

          <section className={sectionClassName}>
            <div className="mb-4">
              <h2 className={sectionTitleClassName}>Email message</h2>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Built-in tokens</Label>
                  <FieldHint text="Click any token to insert it into the active message field." />
                </div>
                <div className="flex flex-wrap gap-2">
                  {builtInGlobalTokens.map((token) => (
                    <TokenButton
                      key={token.token}
                      label={token.label}
                      token={token.token}
                      onClick={insertToken}
                    />
                  ))}
                </div>
              </div>

              {form.group_by_column && (
                <div className="space-y-2">
                  <Label>Group tokens</Label>
                  <div className="flex flex-wrap gap-2">
                    {builtInGroupTokens.map((token) => (
                      <TokenButton
                        key={token.token}
                        label={token.label}
                        token={token.token}
                        onClick={insertToken}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label>Dataset tokens</Label>
                  <FieldHint text="Create extra aggregated values from the dataset, then place those tokens anywhere in the email." />
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.message_placeholders.map((placeholder, index) => (
                    <span
                      key={`${placeholder.key}-${index}`}
                      className="inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1 text-xs text-muted-foreground transition hover:border-primary"
                    >
                      <button
                        type="button"
                        onClick={() => insertToken(`{{${placeholder.key}}}`)}
                        className="text-xs font-medium text-foreground transition hover:text-primary"
                        aria-label={`Insert ${placeholderLabel(placeholder)} token`}
                      >
                        {placeholderLabel(placeholder)}
                      </button>
                      <button
                        type="button"
                        onClick={() => removePlaceholder(index)}
                        className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground transition hover:text-foreground"
                        aria-label={`Remove ${placeholderLabel(placeholder)} token`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}

                  <button
                    type="button"
                    onClick={openAddPlaceholderDialog}
                    disabled={!tableColumnOptions.length}
                    aria-label="Add dataset token"
                    className="inline-flex items-center justify-center rounded-full border border-dashed bg-white px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="alert-message">Email body</Label>
                    <FieldHint text="This text appears once at the top of the email. For non-grouped alerts, this is the full email message." />
                  </div>
                  <Textarea
                    id="alert-message"
                    ref={messageRef}
                    value={form.message}
                    onFocus={() => setActiveMessageField('message')}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, message: event.target.value }))
                    }
                    rows={4}
                  />
                </div>

                {form.group_by_column && (
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="alert-group-message">Per failing group section</Label>
                      <FieldHint text="This block is rendered once for each failing Group by Column value, then combined into one email." />
                    </div>
                    <Textarea
                      id="alert-group-message"
                      ref={groupMessageRef}
                      value={form.group_message}
                      onFocus={() => setActiveMessageField('group_message')}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, group_message: event.target.value }))
                      }
                      rows={6}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className={rightColumnClassName}>
          <section className={`${sectionClassName} ${compact ? 'flex min-h-0 flex-col' : ''}`}>
            <div className="mb-4">
              <h2 className={sectionTitleClassName}>Preview</h2>
            </div>

            <div>
              {queryConfig ? (
                <AlertTestPreview
                  queryConfig={queryConfig}
                  metricId={form.metric_id}
                  message={form.message}
                  groupMessage={form.group_message}
                  messagePlaceholders={form.message_placeholders}
                  disabled={submitting}
                />
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Complete the alert condition to unlock preview.
                </div>
              )}
            </div>
          </section>

          <section className={sectionClassName}>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onCancel} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={submitting}>
                {submitting ? 'Saving...' : alert ? 'Save changes' : 'Create alert'}
              </Button>
            </div>
          </section>
        </div>
      </div>

      <Dialog open={placeholderDialogOpen} onOpenChange={setPlaceholderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add dataset token</DialogTitle>
            <DialogDescription>
              Configure an extra aggregate from the alert dataset and reuse it inside the email.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Aggregation</Label>
                <Select
                  value={placeholderDraft.aggregation}
                  onValueChange={(value) =>
                    updatePlaceholderDraft({
                      aggregation: value as AlertMessagePlaceholder['aggregation'],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGGREGATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Column</Label>
                <Select
                  value={placeholderDraft.column || '__rows__'}
                  onValueChange={(value) => updatePlaceholderDraft({ column: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {placeholderDraft.aggregation === 'COUNT' && (
                      <SelectItem value="__rows__">Rows (*)</SelectItem>
                    )}
                    {availablePlaceholderColumns.map((column) => (
                      <SelectItem key={column.name} value={column.name}>
                        {column.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {placeholderDialogError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {placeholderDialogError}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPlaceholderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePlaceholderDraft}>Add token</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
