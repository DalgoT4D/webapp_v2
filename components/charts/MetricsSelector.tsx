'use client';

import React, { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Plus, Library, Save, Loader2, Info, ChevronDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ChartMetric } from '@/types/charts';
import { ColumnTypeIcon } from '@/lib/columnTypeIcons';
import { Combobox, highlightText } from '@/components/ui/combobox';
import { useMetrics, createMetric, validateMetric } from '@/hooks/api/useMetrics';
import type { Metric } from '@/types/metrics';
import { toastSuccess, toastError } from '@/lib/toast';

interface MetricsSelectorProps {
  metrics: ChartMetric[];
  onChange: (metrics: ChartMetric[]) => void;
  columns: Array<{ column_name: string; data_type: string }>;
  disabled?: boolean;
  chartType?: string;
  maxMetrics?: number;
  schemaName?: string;
  tableName?: string;
}

const AGGREGATE_FUNCTIONS = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'count_distinct', label: 'Count Distinct' },
];

export function MetricsSelector({
  metrics,
  onChange,
  columns,
  disabled,
  chartType = 'bar',
  maxMetrics,
  schemaName,
  tableName,
}: MetricsSelectorProps) {
  const [mode, setMode] = useState<'saved' | 'simple' | 'calculated'>('simple');
  const [showForm, setShowForm] = useState(false);
  const [showSaveSection, setShowSaveSection] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Simple mode state
  const [simpleAgg, setSimpleAgg] = useState('count');
  const [simpleCol, setSimpleCol] = useState('');

  // Calculated mode state
  const [exprText, setExprText] = useState('');

  // Shared
  const [metricName, setMetricName] = useState('');
  const [displayName, setDisplayName] = useState('');

  const {
    data: savedMetrics,
    isLoading: savedMetricsLoading,
    mutate: mutateSavedMetrics,
  } = useMetrics({
    schemaName,
    tableName,
    pageSize: 50,
  });

  const getLabels = () => {
    switch (chartType) {
      case 'pie':
        return { column: 'Dimension', function: 'Metric' };
      default:
        return { column: 'Column', function: 'Function' };
    }
  };

  const labels = getLabels();

  const addSavedMetric = (savedMetricId: string) => {
    const sm = savedMetrics.find((m) => m.id.toString() === savedMetricId);
    if (!sm) return;
    const newMetric: ChartMetric = {
      saved_metric_id: sm.id,
      column: sm.column_expression ? null : sm.column,
      aggregation: sm.column_expression ? null : sm.aggregation || 'count',
      column_expression: sm.column_expression || undefined,
      alias: sm.name,
    };
    onChange([...metrics, newMetric]);
    setShowForm(false);
  };

  const addInlineMetric = async () => {
    if (mode === 'simple') {
      const newMetric: ChartMetric = {
        column: simpleAgg === 'count' && !simpleCol ? null : simpleCol || null,
        aggregation: simpleAgg,
        alias: displayName || `${simpleAgg.toUpperCase()}(${simpleCol || '*'})`,
      };
      onChange([...metrics, newMetric]);
      resetForm();
    } else {
      if (!exprText.trim() || !schemaName || !tableName) return;

      // Validate expression against warehouse
      setValidating(true);
      setValidationError(null);
      try {
        const result = await validateMetric({
          name: metricName || 'validation_check',
          schema_name: schemaName,
          table_name: tableName,
          column_expression: exprText.trim(),
        });
        if (!result.valid) {
          setValidationError(result.error || 'Invalid expression');
          return;
        }
      } catch (err: any) {
        setValidationError(err.message || 'Validation failed');
        return;
      } finally {
        setValidating(false);
      }

      const newMetric: ChartMetric = {
        column: null,
        aggregation: null,
        column_expression: exprText.trim(),
        alias: displayName || exprText.trim().slice(0, 30),
      };
      onChange([...metrics, newMetric]);
      resetForm();
    }
  };

  const handleSaveToLibrary = async () => {
    if (!schemaName || !tableName || !metricName.trim()) return;
    setSavingIndex(-1);
    try {
      const payload: any = {
        name: metricName.trim(),
        schema_name: schemaName,
        table_name: tableName,
      };
      if (mode === 'simple') {
        payload.aggregation = simpleAgg;
        payload.column = simpleAgg === 'count' && !simpleCol ? undefined : simpleCol || undefined;
      } else {
        payload.column_expression = exprText.trim();
      }

      const saved = await createMetric(payload);
      const newMetric: ChartMetric = {
        saved_metric_id: saved.id,
        column: saved.column_expression ? null : saved.column,
        aggregation: saved.column_expression ? null : saved.aggregation || 'count',
        column_expression: saved.column_expression || undefined,
        alias: displayName || saved.name,
      };
      onChange([...metrics, newMetric]);
      mutateSavedMetrics();
      resetForm();
      toastSuccess.generic(`Saved metric "${saved.name}"`);
    } catch (err: any) {
      toastError.save(err, 'metric');
    } finally {
      setSavingIndex(null);
    }
  };

  const resetForm = () => {
    setSimpleAgg('count');
    setSimpleCol('');
    setExprText('');
    setMetricName('');
    setDisplayName('');
    setMode('simple');
    setShowSaveSection(false);
    setShowForm(false);
  };

  const removeMetric = (index: number) => {
    onChange(metrics.filter((_, i) => i !== index));
  };

  const updateMetricAlias = (index: number, alias: string) => {
    const newMetrics = [...metrics];
    newMetrics[index] = { ...newMetrics[index], alias };
    onChange(newMetrics);
  };

  const getAvailableColumns = (aggregation: string) => {
    if (aggregation === 'count') {
      return [...columns, { column_name: '*', data_type: 'any' }].map((col) => ({
        ...col,
        disabled: false,
      }));
    }
    if (aggregation === 'count_distinct') {
      return columns.map((col) => ({ ...col, disabled: false }));
    }
    return columns.map((col) => ({
      ...col,
      disabled: ![
        'integer',
        'bigint',
        'numeric',
        'double precision',
        'real',
        'float',
        'decimal',
      ].includes(col.data_type.toLowerCase()),
    }));
  };

  const canAddMore = !maxMetrics || metrics.length < maxMetrics;
  const canAddInline = mode === 'simple' ? !!simpleAgg : !!exprText.trim();

  const isSavedMetricAdded = (id: number) => metrics.some((m) => m.saved_metric_id === id);

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-gray-900">Metrics</Label>

      {/* Existing metrics */}
      {metrics.length > 0 && (
        <div className="space-y-2">
          {metrics.map((metric, index) => {
            const summary = metric.column_expression
              ? metric.column_expression.slice(0, 40)
              : `${(metric.aggregation || '').toUpperCase()}(${metric.column || '*'})`;
            return (
              <div key={index} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-sm font-medium truncate"
                        style={{ color: 'var(--primary)' }}
                      >
                        {metric.alias || summary}
                      </span>
                      {metric.saved_metric_id && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Library className="h-3 w-3 text-blue-600 shrink-0 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              Saved to library
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <div className="text-sm text-foreground">{summary}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-gray-400 hover:text-red-500 shrink-0"
                    onClick={() => removeMetric(index)}
                    disabled={disabled}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Display Name In Charts</Label>
                  <Input
                    value={metric.alias || ''}
                    onChange={(e) => updateMetricAlias(index, e.target.value)}
                    placeholder="Pick a label"
                    className="h-8 text-sm"
                    disabled={disabled}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add metric form */}
      {canAddMore && (
        <>
          {showForm && (
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Defined Metrics</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                  onClick={() => {
                    resetForm();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {/* Saved / Simple / Calculated tabs */}
              <Tabs
                value={mode}
                onValueChange={(v) => setMode(v as 'saved' | 'simple' | 'calculated')}
              >
                <TabsList className="w-full h-8">
                  <TabsTrigger value="simple" className="flex-1 text-xs">
                    Simple
                  </TabsTrigger>
                  <TabsTrigger value="calculated" className="flex-1 text-xs">
                    Calculated
                  </TabsTrigger>
                  <TabsTrigger value="saved" className="flex-1 text-xs">
                    Saved
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="saved" className="mt-2 space-y-2">
                  <Select
                    onValueChange={(v) => {
                      if (v !== '__none__') addSavedMetric(v);
                    }}
                    value="__none__"
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select a metric from pre-defined list" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" disabled className="hidden">
                        Select a metric from pre-defined list
                      </SelectItem>
                      {savedMetrics
                        .filter((sm) => !isSavedMetricAdded(sm.id))
                        .map((sm) => (
                          <SelectItem key={sm.id} value={sm.id.toString()}>
                            <div className="flex flex-col">
                              <span>{sm.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {sm.column_expression
                                  ? sm.column_expression.slice(0, 40)
                                  : `${(sm.aggregation || '').toUpperCase()}(${sm.column || '*'})`}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </TabsContent>

                <TabsContent value="simple" className="mt-2 space-y-2">
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">{labels.function} *</Label>
                      <Select value={simpleAgg} onValueChange={setSimpleAgg} disabled={disabled}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AGGREGATE_FUNCTIONS.map((func) => (
                            <SelectItem key={func.value} value={func.value}>
                              {func.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">{labels.column} *</Label>
                      <Combobox
                        items={getAvailableColumns(simpleAgg).map((col) => ({
                          value: col.column_name,
                          label: col.column_name === '*' ? '* (Count all rows)' : col.column_name,
                          data_type: col.data_type,
                          disabled: col.disabled,
                        }))}
                        value={simpleAgg === 'count' && !simpleCol ? '*' : simpleCol}
                        onValueChange={(value) => setSimpleCol(value === '*' ? '' : value)}
                        disabled={disabled}
                        searchPlaceholder="Search columns..."
                        placeholder="Select column"
                        compact
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
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="calculated" className="mt-2 space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Expression *</Label>
                    <Textarea
                      value={exprText}
                      onChange={(e) => {
                        setExprText(e.target.value);
                        setValidationError(null);
                      }}
                      placeholder="Add an expression eg. SUM(column_name)/10"
                      rows={2}
                      className="font-mono text-sm"
                      disabled={disabled}
                    />
                    {validating && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Validating expression...</span>
                      </div>
                    )}
                    {validationError && (
                      <p className="text-xs text-destructive">{validationError}</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Display Name / Metric Name / Save — only for Simple and Calculated */}
              {mode !== 'saved' && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Display Name In Charts</Label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Auto-generated display name"
                      className="h-8 text-sm"
                      disabled={disabled}
                    />
                  </div>

                  {/* Save to library (optional, collapsible) */}
                  {schemaName && tableName && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full"
                        onClick={() => setShowSaveSection(!showSaveSection)}
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${showSaveSection ? '' : '-rotate-90'}`}
                        />
                        Add metric to library
                      </button>
                      {showSaveSection && (
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Metric Name *</Label>
                            <Input
                              value={metricName}
                              onChange={(e) => setMetricName(e.target.value)}
                              placeholder="Give a unique name"
                              className="h-8 text-sm"
                              disabled={disabled}
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={handleSaveToLibrary}
                            disabled={
                              disabled || !metricName.trim() || !canAddInline || savingIndex === -1
                            }
                            className="w-full h-8 text-xs bg-gray-900 text-white hover:bg-gray-700"
                          >
                            {savingIndex === -1 ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5 mr-1" />
                            )}
                            SAVE METRIC TO LIBRARY
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Add button — outside the form box */}
          {showForm ? (
            <Button
              size="sm"
              onClick={addInlineMetric}
              disabled={disabled || !canAddInline || validating}
              className="w-full border-dashed bg-gray-900 text-white hover:bg-gray-700 hover:text-white border-gray-900"
            >
              + ADD ANOTHER METRIC
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setShowForm(true)}
              disabled={disabled}
              className="w-full border-dashed bg-gray-900 text-white hover:bg-gray-700 hover:text-white border-gray-900"
            >
              + ADD ANOTHER METRIC
            </Button>
          )}
        </>
      )}
    </div>
  );
}
