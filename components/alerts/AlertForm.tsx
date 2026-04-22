'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleHelp, Mail, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { useKPIs } from '@/hooks/api/useKPIs';
import type { Alert, AlertFilter, AlertQueryConfig, MetricRagLevel } from '@/types/alert';
import type { KPI } from '@/types/kpis';
import { AGGREGATION_OPTIONS, CONDITION_OPERATORS } from '@/types/alert';

interface AlertSavePayload {
  name: string;
  kpi_id?: number | null;
  metric_rag_level?: MetricRagLevel | null;
  query_config: AlertQueryConfig;
  recipients: string[];
  message: string;
  group_message?: string;
}

interface AlertFormProps {
  alert?: Alert | null;
  // Pre-select a KPI when launched from a KPI card or detail drawer.
  initialKPIId?: number | null;
  compact?: boolean;
  title?: string;
  description?: string;
  onSave: (data: AlertSavePayload) => Promise<void>;
  onCancel: () => void;
}

interface AlertFormState {
  name: string;
  kpi_id: number | null;
  schema_name: string;
  table_name: string;
  filters: AlertFilter[];
  filter_connector: 'AND' | 'OR';
  aggregation: AlertQueryConfig['aggregation'] | '';
  measure_column: string;
  group_by_column: string;
  condition_operator: string;
  condition_value: string;
  metric_rag_level: MetricRagLevel | '';
  recipients: string[];
  message: string;
  group_message: string;
}

const DEFAULT_MESSAGE = '{{alert_name}} fired for {{table_name}}. Current value: {{alert_value}}.';
const DEFAULT_GROUPED_MESSAGE = 'The following {{group_by_column}} values failed {{alert_name}}.';
const DEFAULT_GROUP_TEMPLATE = '{{group_by_value}}\nAlert value: {{alert_value}}';

function generateAlertName(
  kpiName: string | null,
  aggregation: string,
  measureColumn: string,
  conditionOperator: string,
  conditionValue: string,
  groupByColumn: string,
  metricRagLevel: MetricRagLevel | ''
) {
  if (kpiName && metricRagLevel) {
    return `${kpiName} is ${metricRagLevel.charAt(0).toUpperCase()}${metricRagLevel.slice(1)}`;
  }
  const source = kpiName || `${aggregation.toLowerCase()} of ${measureColumn || 'rows'}`;
  const groupSuffix = groupByColumn ? ` by ${groupByColumn}` : '';
  return `${source} ${conditionOperator} ${conditionValue}${groupSuffix}`;
}

function aggregationLabel(value: string) {
  return AGGREGATION_OPTIONS.find((option) => option.value === value.toUpperCase())?.label ?? value;
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

function buildInitialState(alert?: Alert | null, initialKPIId?: number | null): AlertFormState {
  return {
    name: alert?.name ?? '',
    kpi_id: alert?.kpi_id ?? initialKPIId ?? null,
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
    metric_rag_level: alert?.metric_rag_level ?? '',
    recipients: alert?.recipients ?? [],
    message: alert?.message ?? DEFAULT_MESSAGE,
    group_message: alert?.group_message ?? '',
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

function formatMetricValue(value: number | null | undefined) {
  if (value == null) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatMetricPercent(value: number) {
  const rounded = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  return `${rounded}%`;
}

function buildKPIThresholdInfo(kpi: KPI, level: MetricRagLevel) {
  if (kpi.target_value == null || kpi.target_value === 0) {
    return null;
  }

  const amberValue = (kpi.target_value * kpi.amber_threshold_pct) / 100;
  const greenValue = (kpi.target_value * kpi.green_threshold_pct) / 100;

  if (kpi.direction === 'decrease') {
    if (level === 'green') {
      return {
        label: 'Green',
        tone: 'border-emerald-200 bg-emerald-50/80 text-emerald-700',
        percentageRule: `At or below ${formatMetricPercent(kpi.green_threshold_pct)} of target`,
        valueRule: `Value <= ${formatMetricValue(greenValue)}`,
      };
    }
    if (level === 'amber') {
      return {
        label: 'Amber',
        tone: 'border-amber-200 bg-amber-50/80 text-amber-700',
        percentageRule: `Above ${formatMetricPercent(kpi.green_threshold_pct)} and at or below ${formatMetricPercent(kpi.amber_threshold_pct)} of target`,
        valueRule: `${formatMetricValue(greenValue)} < value <= ${formatMetricValue(amberValue)}`,
      };
    }
    return {
      label: 'Red',
      tone: 'border-rose-200 bg-rose-50/80 text-rose-700',
      percentageRule: `Above ${formatMetricPercent(kpi.amber_threshold_pct)} of target`,
      valueRule: `Value > ${formatMetricValue(amberValue)}`,
    };
  }

  if (level === 'green') {
    return {
      label: 'Green',
      tone: 'border-emerald-200 bg-emerald-50/80 text-emerald-700',
      percentageRule: `At or above ${formatMetricPercent(kpi.green_threshold_pct)} of target`,
      valueRule: `Value >= ${formatMetricValue(greenValue)}`,
    };
  }
  if (level === 'amber') {
    return {
      label: 'Amber',
      tone: 'border-amber-200 bg-amber-50/80 text-amber-700',
      percentageRule: `At or above ${formatMetricPercent(kpi.amber_threshold_pct)} and below ${formatMetricPercent(kpi.green_threshold_pct)} of target`,
      valueRule: `${formatMetricValue(amberValue)} <= value < ${formatMetricValue(greenValue)}`,
    };
  }
  return {
    label: 'Red',
    tone: 'border-rose-200 bg-rose-50/80 text-rose-700',
    percentageRule: `Below ${formatMetricPercent(kpi.amber_threshold_pct)} of target`,
    valueRule: `Value < ${formatMetricValue(amberValue)}`,
  };
}

// Helpers to derive aggregation/column from a KPI's underlying Metric.
// Single-term Simple-mode maps cleanly; compound/SQL metrics fall back to
// a summary label with no measure_column (Batch 3 wires full semantics).
function deriveAggregationFromKPI(kpi: KPI): AlertQueryConfig['aggregation'] {
  const firstTerm = kpi.metric.simple_terms?.[0];
  if (
    kpi.metric.creation_mode === 'simple' &&
    kpi.metric.simple_terms?.length === 1 &&
    (kpi.metric.simple_formula === 't1' || !kpi.metric.simple_formula) &&
    firstTerm
  ) {
    const agg = firstTerm.agg.toUpperCase();
    if (['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'].includes(agg)) {
      return agg as AlertQueryConfig['aggregation'];
    }
    // count_distinct collapses to COUNT for the threshold UI; the server-side
    // RAG evaluator uses the Metric's real definition regardless.
    return 'COUNT';
  }
  return 'COUNT';
}

function deriveMeasureColumnFromKPI(kpi: KPI): string {
  const firstTerm = kpi.metric.simple_terms?.[0];
  if (
    kpi.metric.creation_mode === 'simple' &&
    kpi.metric.simple_terms?.length === 1 &&
    (kpi.metric.simple_formula === 't1' || !kpi.metric.simple_formula) &&
    firstTerm
  ) {
    return firstTerm.column;
  }
  return '';
}

export function AlertForm({
  alert,
  initialKPIId,
  compact = false,
  title,
  description,
  onSave,
  onCancel,
}: AlertFormProps) {
  const pathname = usePathname();
  const { data: kpis } = useKPIs();
  const [form, setForm] = useState<AlertFormState>(() => buildInitialState(alert, initialKPIId));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [nameManuallyEdited, setNameManuallyEdited] = useState(Boolean(alert));
  const [activeMessageField, setActiveMessageField] = useState<'message' | 'group_message'>(
    'message'
  );
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
  const groupMessageRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedKPI = useMemo(
    () => (kpis || []).find((k) => k.id === form.kpi_id) || null,
    [form.kpi_id, kpis]
  );

  useEffect(() => {
    if (!selectedKPI) return;
    setForm((current) => ({
      ...current,
      schema_name: selectedKPI.metric.schema_name,
      table_name: selectedKPI.metric.table_name,
      aggregation: deriveAggregationFromKPI(selectedKPI),
      measure_column: deriveMeasureColumnFromKPI(selectedKPI),
      filters: [],
      filter_connector: 'AND',
      group_by_column: '',
      message:
        current.message === DEFAULT_MESSAGE || current.message === ''
          ? DEFAULT_MESSAGE
          : current.message,
      group_message: '',
    }));
  }, [selectedKPI]);

  useEffect(() => {
    if (nameManuallyEdited) {
      return;
    }

    if (selectedKPI) {
      if (!form.metric_rag_level) {
        return;
      }
      setForm((current) => ({
        ...current,
        name: generateAlertName(
          selectedKPI.metric.name,
          current.aggregation,
          current.measure_column,
          current.condition_operator,
          current.condition_value,
          current.group_by_column,
          current.metric_rag_level
        ),
      }));
      return;
    }

    if (form.aggregation && form.condition_operator && form.condition_value.trim()) {
      setForm((current) => ({
        ...current,
        name: generateAlertName(
          null,
          current.aggregation,
          current.measure_column,
          current.condition_operator,
          current.condition_value,
          current.group_by_column,
          current.metric_rag_level
        ),
      }));
    }
  }, [
    form.aggregation,
    form.condition_operator,
    form.condition_value,
    form.group_by_column,
    form.measure_column,
    form.metric_rag_level,
    nameManuallyEdited,
    selectedKPI,
  ]);

  useEffect(() => {
    if (selectedKPI) {
      setForm((current) => ({ ...current, group_message: '' }));
      return;
    }

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
  }, [form.group_by_column, selectedKPI]);

  const { data: tableColumns } = useTableColumns(form.schema_name || null, form.table_name || null);

  const tableColumnOptions = tableColumns || [];
  const numericColumns = tableColumnOptions.filter((column) =>
    isNumericColumnType(column.data_type)
  );
  const aggregationColumnOptions =
    form.aggregation === 'COUNT' ? tableColumnOptions : numericColumns.length ? numericColumns : [];

  const metricRequiresTarget =
    selectedKPI != null && (selectedKPI.target_value == null || selectedKPI.target_value === 0);
  const metricThresholdInfo =
    selectedKPI && form.metric_rag_level
      ? buildKPIThresholdInfo(selectedKPI, form.metric_rag_level)
      : null;

  const queryConfig = useMemo<AlertQueryConfig | null>(() => {
    if (selectedKPI) {
      if (!form.metric_rag_level || metricRequiresTarget) {
        return null;
      }

      return {
        schema_name: selectedKPI.metric.schema_name,
        table_name: selectedKPI.metric.table_name,
        filters: [],
        filter_connector: 'AND',
        aggregation: deriveAggregationFromKPI(selectedKPI),
        measure_column: deriveMeasureColumnFromKPI(selectedKPI) || null,
        group_by_column: null,
        condition_operator: '=',
        condition_value: 0,
      };
    }

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
  }, [form, metricRequiresTarget, selectedKPI]);

  const builtInGlobalTokens = useMemo(
    () => [
      { label: 'Alert name', token: '{{alert_name}}' },
      ...(selectedKPI ? [{ label: 'KPI name', token: '{{kpi_name}}' }] : []),
      { label: 'Table name', token: '{{table_name}}' },
      ...(!form.group_by_column ? [{ label: 'Alert value', token: '{{alert_value}}' }] : []),
      ...(!selectedKPI && form.group_by_column
        ? [
            { label: 'Group by Column', token: '{{group_by_column}}' },
            { label: 'Failing group count', token: '{{failing_group_count}}' },
          ]
        : []),
    ],
    [form.group_by_column, selectedKPI]
  );

  const builtInGroupTokens = useMemo(
    () =>
      !selectedKPI && form.group_by_column
        ? [
            { label: 'Group value', token: '{{group_by_value}}' },
            { label: 'Alert value', token: '{{alert_value}}' },
          ]
        : [],
    [form.group_by_column, selectedKPI]
  );

  const kpiSelectionLocked =
    Boolean(selectedKPI) && (initialKPIId != null || Boolean(alert?.kpi_id));
  // Inline "Create a KPI" link — points to /kpis with the create dialog open.
  const createKPIHref =
    pathname === '/alerts/new'
      ? `/kpis?create=1&returnTo=${encodeURIComponent('/alerts/new')}`
      : null;

  const wrapperClassName = compact
    ? 'flex h-full w-full flex-col overflow-hidden'
    : 'mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6';
  const headerClassName = compact ? 'shrink-0 border-b px-6 py-5' : 'flex flex-col gap-2';
  const errorClassName = compact
    ? 'mx-6 mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive'
    : 'rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive';
  const contentGridClassName = compact
    ? 'flex-1 overflow-y-auto px-8 pb-8 pt-6'
    : 'grid gap-6 lg:grid-cols-[1.15fr_0.85fr]';
  const leftColumnClassName = compact ? 'space-y-4' : 'space-y-6';
  const rightColumnClassName = compact ? 'mt-4 space-y-4' : 'space-y-6';
  const sectionClassName = compact
    ? 'rounded-[28px] border bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.08)]'
    : 'rounded-[28px] border bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]';

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

  const handleSave = async () => {
    setFormError(null);

    if (!queryConfig) {
      setFormError(
        selectedKPI
          ? 'Choose Red, Amber, or Green before saving the alert.'
          : 'Complete the alert condition before saving.'
      );
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
    if (!selectedKPI && form.group_by_column && !form.group_message.trim()) {
      setFormError('Add the per-group message section for grouped alerts.');
      return;
    }
    if (selectedKPI && metricRequiresTarget) {
      setFormError('This KPI needs a target before you can create a RAG-based alert.');
      return;
    }

    const validTokens = new Set(
      [
        'alert_name',
        'table_name',
        'alert_value',
        ...(selectedKPI ? ['kpi_name', 'metric_name'] : []),
        ...(!selectedKPI && form.group_by_column
          ? ['group_by_column', 'group_by_value', 'failing_group_count']
          : []),
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
        kpi_id: form.kpi_id,
        metric_rag_level: form.metric_rag_level || null,
        query_config: queryConfig,
        recipients: form.recipients,
        message: form.message,
        group_message: selectedKPI ? '' : form.group_message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={wrapperClassName}>
      <div className={headerClassName}>
        <div className="flex max-w-4xl flex-col gap-2 pr-10">
          <h1 className={`${compact ? 'text-2xl' : 'text-3xl'} font-bold`}>
            {title || (alert ? 'Edit alert' : 'Create alert')}
          </h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>

      {formError ? <div className={errorClassName}>{formError}</div> : null}

      <div className={contentGridClassName}>
        <div className={leftColumnClassName}>
          <section className={sectionClassName}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {selectedKPI ? 'KPI alert' : 'Alert source'}
              </h2>
              {selectedKPI ? <Badge variant="secondary">KPI-backed</Badge> : null}
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

              {!kpiSelectionLocked ? (
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Label>KPI</Label>
                    <FieldHint text="Choose a KPI to create a RAG-based alert, or continue without one to configure a standalone alert." />
                  </div>
                  <Select
                    value={form.kpi_id != null ? String(form.kpi_id) : 'standalone'}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        kpi_id: value === 'standalone' ? null : Number(value),
                        metric_rag_level: value === 'standalone' ? '' : current.metric_rag_level,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a KPI" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standalone">Proceed without KPI</SelectItem>
                      {(kpis || []).map((kpi) => (
                        <SelectItem key={kpi.id} value={String(kpi.id)}>
                          {kpi.metric.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!selectedKPI && createKPIHref ? (
                    <div className="pt-1">
                      <Link
                        href={createKPIHref}
                        className="text-sm font-medium text-sky-700 transition hover:text-sky-800 hover:underline"
                      >
                        Create a KPI
                      </Link>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {selectedKPI ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>KPI</Label>
                      <Input
                        value={selectedKPI.metric.name}
                        readOnly
                        disabled
                        className="bg-muted/40"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Dataset</Label>
                      <Input
                        value={`${selectedKPI.metric.schema_name}.${selectedKPI.metric.table_name}`}
                        readOnly
                        disabled
                        className="bg-muted/40 font-mono"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Aggregation</Label>
                      <Input
                        value={aggregationLabel(deriveAggregationFromKPI(selectedKPI))}
                        readOnly
                        disabled
                        className="bg-muted/40"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Measure column</Label>
                      <Input
                        value={deriveMeasureColumnFromKPI(selectedKPI) || '(custom formula)'}
                        readOnly
                        disabled
                        className="bg-muted/40"
                      />
                    </div>
                  </div>

                  {metricRequiresTarget ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-800">
                      This KPI needs a target before you can create a Red, Amber, or Green alert.
                    </div>
                  ) : null}

                  <div className="grid gap-2 md:max-w-sm">
                    <div className="flex items-center gap-2">
                      <Label>Alert when KPI is</Label>
                      <FieldHint text="After each successful transform run, this alert fires when the KPI's current RAG status matches the level you choose." />
                    </div>
                    <Select
                      value={form.metric_rag_level || undefined}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          metric_rag_level: value as MetricRagLevel,
                        }))
                      }
                      disabled={metricRequiresTarget}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select RAG status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="red">Red</SelectItem>
                        <SelectItem value="amber">Amber</SelectItem>
                        <SelectItem value="green">Green</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {metricThresholdInfo ? (
                    <div className={`rounded-[24px] border px-4 py-4 ${metricThresholdInfo.tone}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">
                            {metricThresholdInfo.label} threshold
                          </div>
                          <div className="mt-1 text-sm">{metricThresholdInfo.percentageRule}</div>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-current/20 bg-white/60 text-current"
                        >
                          Target {formatMetricValue(selectedKPI.target_value)}
                        </Badge>
                      </div>
                      <div className="mt-3 text-sm">{metricThresholdInfo.valueRule}</div>
                    </div>
                  ) : null}
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
                          {form.aggregation === 'COUNT' ? (
                            <SelectItem value="__rows__">Rows (*)</SelectItem>
                          ) : null}
                          {aggregationColumnOptions.map((column) => (
                            <SelectItem key={column.name} value={column.name}>
                              {column.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

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

                    {form.filters.length > 0 ? (
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
                    ) : null}

                    {form.filters.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        No filters yet. The alert will evaluate the entire dataset.
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
                            setForm((current) => ({
                              ...current,
                              condition_value: event.target.value,
                            }))
                          }
                          placeholder="e.g. 10"
                          inputMode="decimal"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className={sectionClassName}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recipients</h2>
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
              <h2 className="text-lg font-semibold">Email message</h2>
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

              {!selectedKPI && form.group_by_column ? (
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
              ) : null}

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

                {!selectedKPI && form.group_by_column ? (
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
                ) : null}
              </div>
            </div>
          </section>
        </div>

        <div className={rightColumnClassName}>
          <section className={`${sectionClassName} ${compact ? 'flex min-h-0 flex-col' : ''}`}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Preview</h2>
            </div>

            {queryConfig ? (
              <AlertTestPreview
                queryConfig={queryConfig}
                kpiId={form.kpi_id}
                metricRagLevel={form.metric_rag_level || null}
                message={form.message}
                groupMessage={form.group_message}
                disabled={submitting}
              />
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Complete the alert condition to unlock preview.
              </div>
            )}
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
    </div>
  );
}
