'use client';

import React, { useState, useEffect } from 'react';
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
import { DatasetSelector } from '@/components/charts/DatasetSelector';
import { useColumns } from '@/hooks/api/useChart';
import type { MetricDefinition, MetricCreate } from '@/types/metrics';

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

const METRIC_TYPE_PRESETS = ['Input', 'Output', 'Outcome', 'Impact'];

interface MetricConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric?: MetricDefinition | null; // null = create mode
  existingProgramTags: string[];
  existingMetricTypes: string[];
  onSave: (data: MetricCreate) => void;
  isSaving?: boolean;
}

export function MetricConfigDialog({
  open,
  onOpenChange,
  metric,
  existingProgramTags,
  existingMetricTypes,
  onSave,
  isSaving = false,
}: MetricConfigDialogProps) {
  const isEditing = !!metric;

  const [name, setName] = useState('');
  const [schemaName, setSchemaName] = useState('');
  const [tableName, setTableName] = useState('');
  const [valueColumn, setValueColumn] = useState('');
  const [aggregation, setAggregation] = useState('sum');
  const [timeColumn, setTimeColumn] = useState<string>('');
  const [timeGrain, setTimeGrain] = useState('month');
  const [trendPeriods, setTrendPeriods] = useState(12);
  const [targetValue, setTargetValue] = useState<string>('');
  const [greenPct, setGreenPct] = useState(100);
  const [amberPct, setAmberPct] = useState(80);
  const [programTag, setProgramTag] = useState('');
  const [metricType, setMetricType] = useState('');

  // Fetch columns when dataset changes
  const { data: columns } = useColumns(schemaName || null, tableName || null);

  // Populate form when editing
  useEffect(() => {
    if (metric) {
      setName(metric.name);
      setSchemaName(metric.schema_name);
      setTableName(metric.table_name);
      setValueColumn(metric.column);
      setAggregation(metric.aggregation);
      setTimeColumn(metric.time_column || '');
      setTimeGrain(metric.time_grain);
      setTrendPeriods(metric.trend_periods);
      setTargetValue(metric.target_value?.toString() ?? '');
      setGreenPct(metric.green_threshold_pct);
      setAmberPct(metric.amber_threshold_pct);
      setProgramTag(metric.program_tag);
      setMetricType(metric.metric_type_tag);
    } else {
      // Reset for create mode
      setName('');
      setSchemaName('');
      setTableName('');
      setValueColumn('');
      setAggregation('sum');
      setTimeColumn('');
      setTimeGrain('month');
      setTrendPeriods(12);
      setTargetValue('');
      setGreenPct(100);
      setAmberPct(80);
      setProgramTag('');
      setMetricType('');
    }
  }, [metric, open]);

  // Filter numeric columns for the value column dropdown
  const numericColumns = (columns || []).filter((c: any) => {
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

  // Filter date/timestamp columns for the time column dropdown
  const dateColumns = (columns || []).filter((c: any) => {
    const dt = (c.data_type || '').toLowerCase();
    return dt.includes('date') || dt.includes('time') || dt.includes('timestamp');
  });

  const allColumns = columns || [];

  const handleSave = () => {
    if (!name || !schemaName || !tableName || !valueColumn || !aggregation) return;

    onSave({
      name,
      schema_name: schemaName,
      table_name: tableName,
      column: valueColumn,
      aggregation,
      time_column: timeColumn || null,
      time_grain: timeGrain,
      trend_periods: trendPeriods,
      target_value: targetValue ? parseFloat(targetValue) : null,
      green_threshold_pct: greenPct,
      amber_threshold_pct: amberPct,
      program_tag: programTag,
      metric_type_tag: metricType,
    });
  };

  const canSave = name && schemaName && tableName && valueColumn && aggregation;

  // Merge presets with existing values for suggestions
  const metricTypeSuggestions = [
    ...new Set([...METRIC_TYPE_PRESETS, ...existingMetricTypes].filter(Boolean)),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Metric' : 'Add Metric'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Metric name */}
          <div className="grid gap-1.5">
            <Label htmlFor="metric-name">Metric Name</Label>
            <Input
              id="metric-name"
              placeholder="e.g. Children vaccinated"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Dataset */}
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

          {/* Value column + Aggregation */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Value Column</Label>
              <Select value={valueColumn} onValueChange={setValueColumn}>
                <SelectTrigger>
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {(aggregation === 'count' ? allColumns : numericColumns).map((col: any) => (
                    <SelectItem key={col.name} value={col.name}>
                      {col.name}
                    </SelectItem>
                  ))}
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

          {/* Target & RAG section */}
          <div className="border-t pt-3 mt-1">
            <p className="text-xs font-medium text-muted-foreground mb-3">Target & RAG Status</p>
            <div className="grid grid-cols-3 gap-3">
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
              <div className="grid gap-1.5">
                <Label htmlFor="green-pct">Green ≥ %</Label>
                <Input
                  id="green-pct"
                  type="number"
                  min={0}
                  max={200}
                  value={greenPct}
                  onChange={(e) => setGreenPct(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="amber-pct">Amber ≥ %</Label>
                <Input
                  id="amber-pct"
                  type="number"
                  min={0}
                  max={200}
                  value={amberPct}
                  onChange={(e) => setAmberPct(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Time configuration */}
          <div className="border-t pt-3 mt-1">
            <p className="text-xs font-medium text-muted-foreground mb-3">
              Time Configuration (optional)
            </p>
            <div className="grid grid-cols-3 gap-3">
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
                    {dateColumns.map((col: any) => (
                      <SelectItem key={col.name} value={col.name}>
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Time Grain</Label>
                <Select value={timeGrain} onValueChange={setTimeGrain}>
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

          {/* Tags */}
          <div className="border-t pt-3 mt-1">
            <p className="text-xs font-medium text-muted-foreground mb-3">Tags</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
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
              <div className="grid gap-1.5">
                <Label>Metric Type</Label>
                <Input
                  placeholder="e.g. Output"
                  value={metricType}
                  onChange={(e) => setMetricType(e.target.value)}
                  list="metric-types"
                />
                <datalist id="metric-types">
                  {metricTypeSuggestions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isSaving}>
            {isSaving ? 'Saving...' : isEditing ? 'Update Metric' : 'Save Metric'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
