'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { DatasetSelector } from '@/components/charts/DatasetSelector';
import { useColumns } from '@/hooks/api/useChart';
import { useValidateMetricSql } from '@/hooks/api/useMetrics';
import type { Metric, MetricCreate, Aggregation } from '@/types/metrics';

interface WarehouseColumn {
  name: string;
  data_type?: string;
}

const AGGREGATIONS: { value: Aggregation; label: string }[] = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
  { value: 'count_distinct', label: 'Count Distinct' },
];

interface MetricLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric?: Metric | null; // null = create mode
  onSave: (data: MetricCreate) => void | Promise<void>;
  isSaving?: boolean;
}

export function MetricLibraryDialog({
  open,
  onOpenChange,
  metric,
  onSave,
  isSaving = false,
}: MetricLibraryDialogProps) {
  const isEditing = !!metric;

  // Shared identity
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [schemaName, setSchemaName] = useState('');
  const [tableName, setTableName] = useState('');
  const [timeColumn, setTimeColumn] = useState('');

  // Mode + per-mode fields
  const [creationMode, setCreationMode] = useState<'simple' | 'sql'>('simple');
  const [simpleAgg, setSimpleAgg] = useState<Aggregation>('sum');
  const [simpleColumn, setSimpleColumn] = useState('');
  const [sqlExpression, setSqlExpression] = useState('');

  // SQL validation preview
  const [validateResult, setValidateResult] = useState<{
    ok: boolean;
    value: number | null;
    error: string | null;
  } | null>(null);

  const { data: columns } = useColumns(schemaName || null, tableName || null);
  const { trigger: validateSql, isMutating: isValidating } = useValidateMetricSql();

  useEffect(() => {
    if (!open) return;
    if (metric) {
      setName(metric.name);
      setDescription(metric.description);
      setTagsText(metric.tags.join(', '));
      setSchemaName(metric.schema_name);
      setTableName(metric.table_name);
      setTimeColumn(metric.time_column ?? '');
      setCreationMode(metric.creation_mode);
      if (metric.creation_mode === 'simple') {
        const t = metric.simple_terms?.[0];
        setSimpleAgg((t?.agg ?? 'sum') as Aggregation);
        setSimpleColumn(t?.column ?? '');
        setSqlExpression('');
      } else {
        setSimpleAgg('sum');
        setSimpleColumn('');
        setSqlExpression(metric.sql_expression);
      }
    } else {
      setName('');
      setDescription('');
      setTagsText('');
      setSchemaName('');
      setTableName('');
      setTimeColumn('');
      setCreationMode('simple');
      setSimpleAgg('sum');
      setSimpleColumn('');
      setSqlExpression('');
    }
    setValidateResult(null);
  }, [metric, open]);

  const numericColumns = (columns || []).filter((c: WarehouseColumn) => {
    const dt = (c.data_type || '').toLowerCase();
    return [
      'int',
      'float',
      'numeric',
      'decimal',
      'double',
      'real',
      'bigint',
      'smallint',
      'number',
    ].some((t) => dt.includes(t));
  });
  const allColumns = columns || [];
  const dateColumns = (columns || []).slice().sort((a: WarehouseColumn, b: WarehouseColumn) => {
    const isDateA = ['date', 'time', 'timestamp'].some((t) =>
      (a.data_type || '').toLowerCase().includes(t)
    );
    const isDateB = ['date', 'time', 'timestamp'].some((t) =>
      (b.data_type || '').toLowerCase().includes(t)
    );
    return isDateA === isDateB ? 0 : isDateA ? -1 : 1;
  });

  const handleValidate = async () => {
    if (!schemaName || !tableName || !sqlExpression.trim()) {
      setValidateResult({
        ok: false,
        value: null,
        error: 'Dataset and SQL expression are required.',
      });
      return;
    }
    try {
      const result = (await validateSql({
        schema_name: schemaName,
        table_name: tableName,
        sql_expression: sqlExpression,
        filters: [],
      })) as { ok: boolean; value: number | null; error: string | null };
      setValidateResult(result);
    } catch {
      setValidateResult({
        ok: false,
        value: null,
        error: 'Validation failed — check the network.',
      });
    }
  };

  const handleSave = () => {
    if (!name || !schemaName || !tableName) return;
    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (creationMode === 'simple' && !simpleColumn && simpleAgg !== 'count') {
      return;
    }
    if (creationMode === 'sql' && !sqlExpression.trim()) {
      return;
    }

    const payload: MetricCreate = {
      name,
      description,
      tags,
      schema_name: schemaName,
      table_name: tableName,
      time_column: timeColumn || null,
      creation_mode: creationMode,
      simple_terms:
        creationMode === 'simple' ? [{ id: 't1', agg: simpleAgg, column: simpleColumn }] : [],
      simple_formula: creationMode === 'simple' ? 't1' : '',
      sql_expression: creationMode === 'sql' ? sqlExpression : '',
      filters: [],
    };
    onSave(payload);
  };

  const canSave =
    Boolean(name && schemaName && tableName) &&
    (creationMode === 'simple'
      ? Boolean(simpleAgg && (simpleColumn || simpleAgg === 'count'))
      : Boolean(sqlExpression.trim()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Metric' : 'New Metric'}</DialogTitle>
          <DialogDescription>
            A Metric is a reusable aggregation — once saved, it can back KPIs, alerts, and chart
            measures.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="metric-name">Name</Label>
            <Input
              id="metric-name"
              placeholder="e.g. Active beneficiaries this month"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="metric-desc">Description</Label>
            <Textarea
              id="metric-desc"
              placeholder="What does this Metric measure?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="metric-tags">Tags (comma-separated)</Label>
            <Input
              id="metric-tags"
              placeholder="e.g. enrolment, weekly"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
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
                setSimpleColumn('');
                setTimeColumn('');
                setValidateResult(null);
              }}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Time column (optional, enables trends)</Label>
            <Select
              value={timeColumn || '__none__'}
              onValueChange={(v) => setTimeColumn(v === '__none__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {dateColumns.map((c: WarehouseColumn) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mode toggle */}
          <div className="grid gap-2">
            <Label>Mode</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCreationMode('simple')}
                className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm transition-colors ${
                  creationMode === 'simple'
                    ? 'border-primary bg-primary/5 font-medium'
                    : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                Simple (column + aggregation)
              </button>
              <button
                type="button"
                onClick={() => setCreationMode('sql')}
                className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm transition-colors ${
                  creationMode === 'sql'
                    ? 'border-primary bg-primary/5 font-medium'
                    : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                Calculated SQL
              </button>
            </div>
          </div>

          {creationMode === 'simple' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Aggregation</Label>
                <Select value={simpleAgg} onValueChange={(v) => setSimpleAgg(v as Aggregation)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGGREGATIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Column</Label>
                <Select value={simpleColumn} onValueChange={setSimpleColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {(simpleAgg === 'count' ? allColumns : numericColumns).map(
                      (c: WarehouseColumn) => (
                        <SelectItem key={c.name} value={c.name}>
                          {c.name}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="sql-expression">SQL expression</Label>
              <Textarea
                id="sql-expression"
                placeholder="e.g. SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)"
                value={sqlExpression}
                onChange={(e) => {
                  setSqlExpression(e.target.value);
                  setValidateResult(null);
                }}
                rows={4}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Any scalar SQL expression. Runs against <code>{schemaName || '<schema>'}</code>.
                <code>{tableName || '<table>'}</code>. DML / DDL keywords and semicolons are
                rejected.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleValidate}
                  disabled={isValidating || !schemaName || !tableName || !sqlExpression.trim()}
                >
                  {isValidating ? 'Validating…' : 'Validate against warehouse'}
                </Button>
                {validateResult ? (
                  validateResult.ok ? (
                    <span className="text-xs text-emerald-700">
                      ✓ Runs and returns{' '}
                      {validateResult.value == null
                        ? 'NULL'
                        : Number(validateResult.value).toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-xs text-red-600">✗ {validateResult.error}</span>
                  )
                ) : null}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isSaving}>
            {isSaving ? 'Saving…' : isEditing ? 'Update Metric' : 'Save Metric'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
