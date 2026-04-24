'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { Loader2 } from 'lucide-react';
import { DatasetSelector } from '@/components/charts/DatasetSelector';
import { Combobox, highlightText } from '@/components/ui/combobox';
import { ColumnTypeIcon } from '@/lib/columnTypeIcons';
import { useTableColumns } from '@/hooks/api/useWarehouse';
import { createMetric, updateMetric } from '@/hooks/api/useMetrics';
import type { Metric, MetricCreate } from '@/types/metrics';
import { AGGREGATION_OPTIONS } from '@/types/metrics';

const NUMERIC_TYPES = [
  'integer',
  'bigint',
  'numeric',
  'double precision',
  'real',
  'float',
  'decimal',
];

interface MetricFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  metric?: Metric | null;
  prefillData?: Partial<MetricCreate>;
}

export function MetricFormDialog({
  open,
  onOpenChange,
  onSuccess,
  metric,
  prefillData,
}: MetricFormDialogProps) {
  const isEdit = !!metric;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schemaName, setSchemaName] = useState('');
  const [tableName, setTableName] = useState('');
  const [definitionTab, setDefinitionTab] = useState<'simple' | 'expression'>('simple');
  const [column, setColumn] = useState('');
  const [aggregation, setAggregation] = useState('');
  const [columnExpression, setColumnExpression] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch columns for the selected dataset
  const { data: tableColumns } = useTableColumns(schemaName || null, tableName || null);

  // Build column items for the combobox
  const columnItems = React.useMemo(() => {
    if (!tableColumns) return [];

    const getAvailableColumns = () => {
      if (aggregation === 'count') {
        return [
          { value: '*', label: '* (Count all rows)', data_type: 'any', disabled: false },
          ...(tableColumns || []).map((col) => ({
            value: col.name || col.column_name || '',
            label: col.name || col.column_name || '',
            data_type: col.data_type || '',
            disabled: false,
          })),
        ];
      }
      if (aggregation === 'count_distinct') {
        return (tableColumns || []).map((col) => ({
          value: col.name || col.column_name || '',
          label: col.name || col.column_name || '',
          data_type: col.data_type || '',
          disabled: false,
        }));
      }
      // For sum/avg/min/max, show all but disable non-numeric
      return (tableColumns || []).map((col) => ({
        value: col.name || col.column_name || '',
        label: col.name || col.column_name || '',
        data_type: col.data_type || '',
        disabled: !NUMERIC_TYPES.includes((col.data_type || '').toLowerCase()),
      }));
    };

    return getAvailableColumns();
  }, [tableColumns, aggregation]);

  // Initialize form
  useEffect(() => {
    if (open) {
      if (metric) {
        setName(metric.name);
        setDescription(metric.description || '');
        setSchemaName(metric.schema_name);
        setTableName(metric.table_name);
        if (metric.column_expression) {
          setDefinitionTab('expression');
          setColumnExpression(metric.column_expression);
          setColumn('');
          setAggregation('');
        } else {
          setDefinitionTab('simple');
          setColumn(metric.column || '');
          setAggregation(metric.aggregation || '');
          setColumnExpression('');
        }
      } else if (prefillData) {
        setName(prefillData.name || '');
        setDescription(prefillData.description || '');
        setSchemaName(prefillData.schema_name || '');
        setTableName(prefillData.table_name || '');
        setColumn(prefillData.column || '');
        setAggregation(prefillData.aggregation || '');
        setColumnExpression(prefillData.column_expression || '');
        setDefinitionTab(prefillData.column_expression ? 'expression' : 'simple');
      } else {
        setName('');
        setDescription('');
        setSchemaName('');
        setTableName('');
        setColumn('');
        setAggregation('');
        setColumnExpression('');
        setDefinitionTab('simple');
      }
      setError(null);
    }
  }, [open, metric, prefillData]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const data: MetricCreate = {
        name,
        description: description || undefined,
        schema_name: schemaName,
        table_name: tableName,
      };

      if (definitionTab === 'simple') {
        data.aggregation = aggregation;
        data.column = aggregation === 'count' && !column ? undefined : column;
      } else {
        data.column_expression = columnExpression;
      }

      if (isEdit && metric) {
        await updateMetric(metric.id, data);
      } else {
        await createMetric(data);
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save metric');
    } finally {
      setSaving(false);
    }
  };

  const isValid =
    name.trim() !== '' &&
    schemaName.trim() !== '' &&
    tableName.trim() !== '' &&
    (definitionTab === 'simple' ? aggregation !== '' : columnExpression.trim() !== '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Metric' : 'Create Metric'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Total Beneficiaries"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
          </div>

          {/* Data Source — reuse chart builder's DatasetSelector */}
          <div className="space-y-1">
            <Label>Dataset</Label>
            <DatasetSelector
              schema_name={schemaName}
              table_name={tableName}
              onDatasetChange={(schema, table) => {
                setSchemaName(schema);
                setTableName(table);
              }}
            />
          </div>

          {/* Definition */}
          <Tabs
            value={definitionTab}
            onValueChange={(v) => setDefinitionTab(v as 'simple' | 'expression')}
          >
            <TabsList className="w-full">
              <TabsTrigger value="simple" className="flex-1">
                Simple
              </TabsTrigger>
              <TabsTrigger value="expression" className="flex-1">
                Expression
              </TabsTrigger>
            </TabsList>

            <TabsContent value="simple" className="space-y-2 mt-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Aggregation</Label>
                  <Select value={aggregation} onValueChange={setAggregation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select function" />
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
                  <Label className="text-xs">Column</Label>
                  <Combobox
                    items={columnItems}
                    value={aggregation === 'count' && !column ? '*' : column}
                    onValueChange={(value) => setColumn(value === '*' ? '' : value)}
                    disabled={aggregation === 'count' || !schemaName || !tableName}
                    searchPlaceholder="Search columns..."
                    placeholder={
                      !schemaName || !tableName
                        ? 'Select dataset first'
                        : aggregation === 'count'
                          ? '* (all rows)'
                          : 'Select column'
                    }
                    compact
                    renderItem={(item, _isSelected, searchQuery) => (
                      <div className="flex items-center gap-2 min-w-0">
                        {item.value !== '*' && (
                          <ColumnTypeIcon dataType={item.data_type} className="w-4 h-4" />
                        )}
                        <span className="truncate">{highlightText(item.label, searchQuery)}</span>
                      </div>
                    )}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="expression" className="space-y-2 mt-2">
              <div className="space-y-1">
                <Label className="text-xs">SQL Expression</Label>
                <Textarea
                  value={columnExpression}
                  onChange={(e) => setColumnExpression(e.target.value)}
                  placeholder="e.g. SUM(col_a - col_b) / COUNT(DISTINCT id)"
                  rows={3}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Must return a single numeric value. Validated against the warehouse on save.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Error */}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
