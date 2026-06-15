'use client';

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { DatasetSelector } from '@/components/charts/DatasetSelector';
import { MetricPicker } from '@/components/metrics/MetricPicker';
import { KpiPicker } from '@/components/kpis/KpiPicker';
import { useTableColumns } from '@/hooks/api/useWarehouse';
import { useMetric } from '@/hooks/api/useMetrics';
import { useKPI } from '@/hooks/api/useKPIs';
import { formatMetricExpression } from '@/lib/metrics';
import { AGGREGATION_OPTIONS } from '@/types/metrics';
import {
  RAG_STATE_OPTIONS,
  THRESHOLD_OPERATOR_OPTIONS,
  type AlertType,
  type RagState,
  type ScheduleSpec,
  type StandaloneConfig,
  type ThresholdOperator,
} from '@/types/alerts';
import { ScheduleField } from './ScheduleField';

const NUMERIC_TYPES = [
  'integer',
  'bigint',
  'numeric',
  'double precision',
  'real',
  'float',
  'decimal',
];

export interface AlertDefineState {
  name: string;
  alertType: AlertType;
  metricId: number | null;
  kpiId: number | null;
  standaloneConfig: StandaloneConfig;
  conditionOperator: ThresholdOperator;
  conditionValue: string; // string for input; parsed to float at submit
  conditionRagStates: RagState[];
  schedule: ScheduleSpec;
}

interface AlertDefineStepProps {
  value: AlertDefineState;
  onChange: (next: AlertDefineState) => void;
  /** Disables source-picking when launched from a Metric/KPI context. */
  sourceLocked: boolean;
  errors?: Record<string, string>;
}

export function AlertDefineStep({ value, onChange, sourceLocked, errors }: AlertDefineStepProps) {
  const { metric } = useMetric(value.alertType === 'metric_threshold' ? value.metricId : null);
  const { kpi } = useKPI(value.alertType === 'kpi_rag' ? value.kpiId : null);

  // Pickers appear when the source can be switched (creating from /alerts, or editing).
  const canPickMetric = value.alertType === 'metric_threshold' && !sourceLocked;
  const canPickKpi = value.alertType === 'kpi_rag' && !sourceLocked;

  const { data: tableColumns } = useTableColumns(
    value.alertType === 'standalone' ? value.standaloneConfig.schema_name || null : null,
    value.alertType === 'standalone' ? value.standaloneConfig.table_name || null : null
  );

  const columnItems = useMemo(() => {
    if (!tableColumns) return [];
    const agg = value.standaloneConfig.aggregation || '';
    if (agg === 'count') {
      return [
        { value: '*', label: '* (Count all rows)', data_type: 'any', disabled: false },
        ...tableColumns.map((c) => ({
          value: c.name || '',
          label: c.name || '',
          data_type: c.data_type || '',
          disabled: false,
        })),
      ];
    }
    return tableColumns.map((c) => ({
      value: c.name || '',
      label: c.name || '',
      data_type: c.data_type || '',
      disabled:
        agg !== 'count_distinct' && !NUMERIC_TYPES.includes((c.data_type || '').toLowerCase()),
    }));
  }, [tableColumns, value.standaloneConfig.aggregation]);

  const setStandalone = (patch: Partial<StandaloneConfig>) =>
    onChange({
      ...value,
      standaloneConfig: { ...value.standaloneConfig, ...patch },
    });

  const toggleRag = (state: RagState) => {
    const has = value.conditionRagStates.includes(state);
    if (has) {
      onChange({
        ...value,
        conditionRagStates: value.conditionRagStates.filter((s) => s !== state),
      });
      return;
    }
    // cap at 2
    if (value.conditionRagStates.length >= 2) return;
    onChange({ ...value, conditionRagStates: [...value.conditionRagStates, state] });
  };

  return (
    <div className="space-y-5">
      {/* Alert name */}
      <div className="space-y-1">
        <Label>
          Alert name <span className="text-destructive">*</span>
        </Label>
        <Input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="e.g. Daily new signups alert"
        />
        {errors?.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      {/* Type-specific source */}
      {value.alertType === 'metric_threshold' && (
        <div className="space-y-1">
          <Label>Metric {canPickMetric && <span className="text-destructive">*</span>}</Label>
          {canPickMetric ? (
            <div className="space-y-1">
              <MetricPicker
                value={value.metricId}
                onChange={(id) => onChange({ ...value, metricId: id })}
              />
              {metric && (
                <p className="text-[11px] text-muted-foreground font-mono">
                  {metric.schema_name}.{metric.table_name} · {formatMetricExpression(metric)}
                </p>
              )}
            </div>
          ) : value.metricId && metric ? (
            <div className="space-y-1">
              <Badge variant="secondary" className="text-sm" data-testid="source-chip-metric">
                {metric.name}
              </Badge>
              <p className="text-[11px] text-muted-foreground font-mono">
                {metric.schema_name}.{metric.table_name} · {formatMetricExpression(metric)}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              {sourceLocked ? 'Loading metric…' : 'Open this wizard from a Metric to scope it.'}
            </p>
          )}
        </div>
      )}

      {value.alertType === 'kpi_rag' && (
        <div className="space-y-1">
          <Label>KPI {canPickKpi && <span className="text-destructive">*</span>}</Label>
          {canPickKpi ? (
            <div className="space-y-1">
              <KpiPicker value={value.kpiId} onChange={(id) => onChange({ ...value, kpiId: id })} />
              {kpi && (
                <p className="text-[11px] text-muted-foreground">
                  Target {kpi.target_value ?? '—'} · Green ±{kpi.green_threshold_pct}% · Amber ±
                  {kpi.amber_threshold_pct}% ·{' '}
                  {kpi.direction === 'increase' ? 'increase is better' : 'decrease is better'}
                </p>
              )}
            </div>
          ) : value.kpiId && kpi ? (
            <div className="space-y-1">
              <Badge variant="secondary" className="text-sm" data-testid="source-chip-kpi">
                {kpi.name}
              </Badge>
              <p className="text-[11px] text-muted-foreground">
                Target {kpi.target_value ?? '—'} · Green ±{kpi.green_threshold_pct}% · Amber ±
                {kpi.amber_threshold_pct}% ·{' '}
                {kpi.direction === 'increase' ? 'increase is better' : 'decrease is better'}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              {sourceLocked ? 'Loading KPI…' : 'Open this wizard from a KPI to scope it.'}
            </p>
          )}
        </div>
      )}

      {value.alertType === 'standalone' && (
        <>
          <div className="space-y-1">
            <Label>
              Datasource <span className="text-destructive">*</span>
            </Label>
            <DatasetSelector
              schema_name={value.standaloneConfig.schema_name}
              table_name={value.standaloneConfig.table_name}
              onDatasetChange={(schema, table) =>
                setStandalone({
                  schema_name: schema,
                  table_name: table,
                  column: '',
                  aggregation: value.standaloneConfig.aggregation || '',
                })
              }
            />
            {errors?.standalone_table && (
              <p className="text-xs text-destructive">{errors.standalone_table}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>
                Function <span className="text-destructive">*</span>
              </Label>
              <Select
                value={value.standaloneConfig.aggregation || ''}
                onValueChange={(v) => setStandalone({ aggregation: v })}
              >
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
            </div>
            <div className="space-y-1">
              <Label>
                Column <span className="text-destructive">*</span>
              </Label>
              <Combobox
                items={columnItems}
                value={
                  value.standaloneConfig.aggregation === 'count' && !value.standaloneConfig.column
                    ? '*'
                    : value.standaloneConfig.column || ''
                }
                onValueChange={(v) => setStandalone({ column: v === '*' ? '' : v })}
                disabled={!value.standaloneConfig.schema_name || !value.standaloneConfig.table_name}
                searchPlaceholder="Search columns..."
                compact
                placeholder={
                  !value.standaloneConfig.schema_name || !value.standaloneConfig.table_name
                    ? 'Select datasource first'
                    : value.standaloneConfig.aggregation === 'count'
                      ? '* (count all rows)'
                      : 'Choose a column'
                }
              />
            </div>
          </div>
        </>
      )}

      {/* Condition */}
      <div className="space-y-2 border-t pt-4">
        <p className="text-sm font-medium text-muted-foreground">Condition</p>
        {value.alertType === 'kpi_rag' ? (
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Fire when the KPI is in any of these states (pick 1–2):
            </p>
            <div className="flex flex-wrap gap-2">
              {RAG_STATE_OPTIONS.map((opt) => {
                const checked = value.conditionRagStates.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 rounded border px-2 py-1 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleRag(opt.value)}
                      data-testid={`rag-checkbox-${opt.value}`}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                );
              })}
            </div>
            {errors?.rag_states && (
              <p className="text-xs text-destructive mt-1">{errors.rag_states}</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>
                Operator <span className="text-destructive">*</span>
              </Label>
              <Select
                value={value.conditionOperator}
                onValueChange={(v) =>
                  onChange({ ...value, conditionOperator: v as ThresholdOperator })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THRESHOLD_OPERATOR_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>
                Value <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                value={value.conditionValue}
                onChange={(e) => onChange({ ...value, conditionValue: e.target.value })}
                placeholder="e.g. 50"
              />
              {errors?.condition_value && (
                <p className="text-xs text-destructive">{errors.condition_value}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Schedule */}
      <div className="space-y-2 border-t pt-4">
        <p className="text-sm font-medium text-muted-foreground">Schedule</p>
        <ScheduleField
          value={value.schedule}
          onChange={(schedule) => onChange({ ...value, schedule })}
        />
      </div>
    </div>
  );
}
