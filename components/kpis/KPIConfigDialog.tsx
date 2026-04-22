'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { DatasetSelector } from '@/components/charts/DatasetSelector';
import { useColumns } from '@/hooks/api/useChart';
import type { KPI, KPICreate } from '@/types/kpis';
import { METRIC_TYPES, METRIC_TYPE_DESCRIPTIONS, METRIC_TYPE_ICONS } from '@/types/kpis';
import type { MetricCreate } from '@/types/metrics';

const AGGREGATION_OPTIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
  { value: 'count_distinct', label: 'Count Distinct' },
];

const TIME_GRAIN_OPTIONS = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

// Minimum viable shape of a column record the backend returns.
interface WarehouseColumn {
  name: string;
  data_type?: string;
}

interface KPIConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kpi?: KPI | null; // null = create mode
  existingProgramTags: string[];
  existingMetricTypes?: string[];
  onSave: (data: KPICreate) => void | Promise<void>;
  isSaving?: boolean;
}

export function KPIConfigDialog({
  open,
  onOpenChange,
  kpi,
  existingProgramTags,
  onSave,
  isSaving = false,
}: KPIConfigDialogProps) {
  const isEditing = !!kpi;

  // ── Metric-primitive fields (only used in create mode; Batch 5 library will
  //    own full Metric editing UX). In edit mode these are read-only hints.
  const [name, setName] = useState('');
  const [schemaName, setSchemaName] = useState('');
  const [tableName, setTableName] = useState('');
  const [valueColumn, setValueColumn] = useState('');
  const [aggregation, setAggregation] = useState('sum');
  const [timeColumn, setTimeColumn] = useState<string>('');

  // ── KPI-level fields
  const [trendGrain, setTrendGrain] = useState('month');
  const [trendPeriods, setTrendPeriods] = useState(12);
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase');
  const [targetValue, setTargetValue] = useState<string>('');
  const [greenPct, setGreenPct] = useState(100);
  const [amberPct, setAmberPct] = useState(80);
  const [programTag, setProgramTag] = useState('');
  const [metricType, setMetricType] = useState('');

  const { data: columns } = useColumns(schemaName || null, tableName || null);

  useEffect(() => {
    if (kpi) {
      const m = kpi.metric;
      setName(m.name);
      setSchemaName(m.schema_name);
      setTableName(m.table_name);
      // Flat form preview uses the first Simple-mode term; multi-term and SQL
      // metrics show read-only summaries inline. Batch 5 wires the full editor.
      const firstTerm = m.simple_terms?.[0];
      setValueColumn(firstTerm?.column || '');
      setAggregation(firstTerm?.agg || 'sum');
      setTimeColumn(m.time_column || '');
      setTrendGrain(kpi.trend_grain);
      setTrendPeriods(kpi.trend_periods);
      setDirection(kpi.direction || 'increase');
      setTargetValue(kpi.target_value?.toString() ?? '');
      setGreenPct(kpi.green_threshold_pct);
      setAmberPct(kpi.amber_threshold_pct);
      setProgramTag(kpi.program_tag);
      setMetricType(kpi.metric_type_tag);
    } else {
      setName('');
      setSchemaName('');
      setTableName('');
      setValueColumn('');
      setAggregation('sum');
      setTimeColumn('');
      setTrendGrain('month');
      setTrendPeriods(12);
      setDirection('increase');
      setTargetValue('');
      setGreenPct(100);
      setAmberPct(80);
      setProgramTag('');
      setMetricType('');
    }
  }, [kpi, open]);

  const numericColumns = (columns || []).filter((c: WarehouseColumn) => {
    const dt = (c.data_type || '').toLowerCase();
    return (
      dt.includes('int') ||
      dt.includes('float') ||
      dt.includes('numeric') ||
      dt.includes('decimal') ||
      dt.includes('double') ||
      dt.includes('real') ||
      dt.includes('bigint') ||
      dt.includes('smallint') ||
      dt.includes('number')
    );
  });

  const dateColumns = (columns || []).slice().sort((a: WarehouseColumn, b: WarehouseColumn) => {
    const isDateA = ['date', 'time', 'timestamp'].some((t) =>
      (a.data_type || '').toLowerCase().includes(t)
    );
    const isDateB = ['date', 'time', 'timestamp'].some((t) =>
      (b.data_type || '').toLowerCase().includes(t)
    );
    return isDateA === isDateB ? 0 : isDateA ? -1 : 1;
  });

  const allColumns = columns || [];

  const handleSave = () => {
    const kpiFields: Partial<KPICreate> = {
      direction,
      target_value: targetValue ? parseFloat(targetValue) : null,
      amber_threshold_pct: amberPct,
      green_threshold_pct: greenPct,
      trend_grain: trendGrain as 'month' | 'quarter' | 'year',
      trend_periods: trendPeriods,
      program_tag: programTag,
      metric_type_tag: metricType,
    };

    if (isEditing) {
      // Edit path updates KPI-level fields only. Metric-level edits happen in
      // the Metric library (Batch 5).
      onSave(kpiFields as KPICreate);
      return;
    }

    // Create path: build an inline Metric + KPI payload. Simple single-term
    // mapping (formula "t1") gives us parity with today's flat form UX.
    if (!name || !schemaName || !tableName || !valueColumn || !aggregation) return;

    const inlineMetric: MetricCreate = {
      name,
      schema_name: schemaName,
      table_name: tableName,
      time_column: timeColumn || null,
      default_time_grain: trendGrain as 'month' | 'quarter' | 'year',
      creation_mode: 'simple',
      simple_terms: [
        {
          id: 't1',
          agg: aggregation as 'sum' | 'avg' | 'count' | 'min' | 'max' | 'count_distinct',
          column: valueColumn,
        },
      ],
      simple_formula: 't1',
    };

    onSave({
      inline_metric: inlineMetric,
      ...kpiFields,
    });
  };

  const canSave = isEditing
    ? Boolean(metricType)
    : Boolean(name && schemaName && tableName && valueColumn && aggregation && metricType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit KPI' : 'Add KPI'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the target, RAG thresholds, grain, and tags for this KPI. To change the underlying Metric definition, visit the Metrics library.'
              : 'Create a new KPI. Define the underlying Metric inline, set a target, and configure RAG thresholds.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Metric-primitive fields (create mode only) */}
          {!isEditing && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="metric-name">KPI Name</Label>
                <Input
                  id="metric-name"
                  placeholder="e.g. Children vaccinated"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid gap-1.5">
                <Label>Dataset</Label>
                <DatasetSelector
                  schema_name={schemaName}
                  table_name={tableName}
                  onDatasetChange={(s, t) => {
                    setSchemaName(s);
                    setTableName(t);
                    setValueColumn('');
                    setTimeColumn('');
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Value Column</Label>
                  <Select value={valueColumn} onValueChange={setValueColumn}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {(aggregation === 'count' ? allColumns : numericColumns).map(
                        (col: WarehouseColumn) => (
                          <SelectItem key={col.name} value={col.name}>
                            {col.name}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Aggregation</Label>
                  <Select value={aggregation} onValueChange={setAggregation}>
                    <SelectTrigger>
                      <SelectValue />
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
              </div>
            </>
          )}

          {/* Read-only underlying Metric summary in edit mode */}
          {isEditing && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
              <p className="font-medium text-foreground">Underlying Metric: {name}</p>
              <p className="text-muted-foreground">
                {schemaName}.{tableName}
                {valueColumn && aggregation && ` — ${aggregation.toUpperCase()}(${valueColumn})`}
              </p>
              <p className="text-muted-foreground">
                To change the Metric definition, edit it in the Metrics library.
              </p>
            </div>
          )}

          {/* Target & RAG section */}
          <div className="border-t pt-3 mt-1">
            <p className="text-xs font-medium text-muted-foreground mb-3">Target & RAG Status</p>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Direction</Label>
                <Select
                  value={direction}
                  onValueChange={(v) => {
                    const dir = v as 'increase' | 'decrease';
                    setDirection(dir);
                    if (dir === 'decrease') {
                      setGreenPct(100);
                      setAmberPct(130);
                    } else {
                      setGreenPct(100);
                      setAmberPct(80);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">Increase</SelectItem>
                    <SelectItem value="decrease">Decrease</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {direction === 'increase' ? 'Higher is better' : 'Lower is better'}
                </p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="target-value">Target Value</Label>
                <Input
                  id="target-value"
                  type="number"
                  placeholder="e.g. 5000"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="green-pct" className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Green when {direction === 'increase' ? '≥' : '≤'}
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      id="green-pct"
                      type="number"
                      min={0}
                      max={300}
                      value={greenPct}
                      onChange={(e) => setGreenPct(Number(e.target.value))}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">% of target</span>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="amber-pct" className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                    Amber when {direction === 'increase' ? '≥' : '≤'}
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      id="amber-pct"
                      type="number"
                      min={0}
                      max={300}
                      value={amberPct}
                      onChange={(e) => setAmberPct(Number(e.target.value))}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">% of target</span>
                  </div>
                </div>
              </div>

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                Red when {direction === 'increase' ? '<' : '>'} {amberPct}% of target
              </p>
            </div>
          </div>

          {/* Time configuration */}
          <div className="border-t pt-3 mt-1">
            <p className="text-xs font-medium text-muted-foreground mb-3">Trend Configuration</p>
            <div className="grid grid-cols-3 gap-3">
              {!isEditing && (
                <div className="grid gap-1.5">
                  <Label>Time Column</Label>
                  <Select
                    value={timeColumn || '__none__'}
                    onValueChange={(v) => setTimeColumn(v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {dateColumns.map((col: WarehouseColumn) => {
                        const isDate = ['date', 'time', 'timestamp'].some((t) =>
                          (col.data_type || '').toLowerCase().includes(t)
                        );
                        return (
                          <SelectItem key={col.name} value={col.name}>
                            {col.name}
                            {!isDate && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({col.data_type})
                              </span>
                            )}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-1.5">
                <Label>Grain</Label>
                <Select value={trendGrain} onValueChange={setTrendGrain}>
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
              <div className="grid gap-1.5">
                <Label>Periods</Label>
                <Input
                  type="number"
                  min={2}
                  max={60}
                  value={trendPeriods}
                  onChange={(e) => setTrendPeriods(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Classification */}
          <div className="border-t pt-3 mt-1">
            <p className="text-xs font-medium text-muted-foreground mb-3">Classification</p>

            <div className="grid gap-1.5 mb-4">
              <Label>Program</Label>
              <Input
                placeholder="e.g. Health Program"
                value={programTag}
                onChange={(e) => setProgramTag(e.target.value)}
                list="program-tags"
              />
              <datalist id="program-tags">
                {existingProgramTags.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            <div className="grid gap-2">
              <Label>KPI Type</Label>
              <div className="grid grid-cols-4 gap-2">
                {METRIC_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMetricType(type)}
                    className={`flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-2.5 text-xs transition-colors ${
                      metricType === type
                        ? 'border-primary bg-primary/5 text-foreground font-medium'
                        : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="text-base">{METRIC_TYPE_ICONS[type]}</span>
                    {type}
                  </button>
                ))}
              </div>
              {metricType && (
                <p className="text-xs text-muted-foreground">
                  {METRIC_TYPE_DESCRIPTIONS[metricType]}
                </p>
              )}
              {!metricType && (
                <p className="text-xs text-muted-foreground">
                  How does this KPI fit in your theory of change?
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isSaving}>
            {isSaving ? 'Saving...' : isEditing ? 'Update KPI' : 'Save KPI'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
