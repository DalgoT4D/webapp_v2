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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Plus, Search, Library, Save, Loader2 } from 'lucide-react';
import type { ChartMetric } from '@/types/charts';
import { ColumnTypeIcon } from '@/lib/columnTypeIcons';
import { Combobox, highlightText } from '@/components/ui/combobox';
import { useMetrics, createMetric } from '@/hooks/api/useMetrics';
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
  const [activeTab, setActiveTab] = useState<string>('adhoc');
  const [savedSearch, setSavedSearch] = useState('');
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  // Fetch saved metrics filtered by the chart's current dataset
  const {
    data: savedMetrics,
    isLoading: savedMetricsLoading,
    mutate: mutateSavedMetrics,
  } = useMetrics({
    schemaName,
    tableName,
    search: savedSearch || undefined,
    pageSize: 50,
  });

  const getLabels = () => {
    switch (chartType) {
      case 'pie':
        return {
          column: 'Dimension',
          function: 'Metric',
          alias: 'Display Name',
        };
      default:
        return {
          column: 'Column',
          function: 'Function',
          alias: 'Display Name',
        };
    }
  };

  const labels = getLabels();

  const addMetric = () => {
    const newMetric: ChartMetric = {
      column: null,
      aggregation: 'count',
      alias: '',
    };
    onChange([...metrics, newMetric]);
  };

  const addSavedMetric = (savedMetric: Metric) => {
    const newMetric: ChartMetric = {
      saved_metric_id: savedMetric.id,
      column: savedMetric.column,
      aggregation: savedMetric.aggregation || 'count',
      column_expression: savedMetric.column_expression || undefined,
      alias: savedMetric.name,
    };
    onChange([...metrics, newMetric]);
  };

  const updateMetric = (index: number, updates: Partial<ChartMetric>) => {
    const newMetrics = [...metrics];
    newMetrics[index] = { ...newMetrics[index], ...updates };

    if (!updates.alias && (updates.column !== undefined || updates.aggregation)) {
      const metric = newMetrics[index];
      if (metric.aggregation) {
        if (metric.aggregation.toLowerCase() === 'count' && !metric.column) {
          metric.alias = 'Total Count';
        } else if (metric.column) {
          metric.alias = `${metric.aggregation.toUpperCase()}(${metric.column})`;
        }
      }
    }

    onChange(newMetrics);
  };

  const removeMetric = (index: number) => {
    onChange(metrics.filter((_, i) => i !== index));
  };

  // Save an ad-hoc metric directly to the library, then replace it with a saved reference
  const handleSaveAsMetric = async (metric: ChartMetric, index: number) => {
    if (!schemaName || !tableName || !metric.aggregation) return;

    const name = metric.alias || `${metric.aggregation.toUpperCase()}(${metric.column || '*'})`;

    setSavingIndex(index);
    try {
      const saved = await createMetric({
        name,
        schema_name: schemaName,
        table_name: tableName,
        column: metric.column || undefined,
        aggregation: metric.aggregation,
      });

      // Replace the ad-hoc entry with a saved_metric_id reference
      const newMetrics = [...metrics];
      newMetrics[index] = {
        saved_metric_id: saved.id,
        column: saved.column,
        aggregation: saved.aggregation || 'count',
        alias: metric.alias || saved.name,
      };
      onChange(newMetrics);
      mutateSavedMetrics();
      toastSuccess.generic(`Saved metric "${saved.name}"`);
    } catch (err: any) {
      toastError.save(err, 'metric');
    } finally {
      setSavingIndex(null);
    }
  };

  const getAvailableColumns = (aggregation: string) => {
    if (aggregation === 'count') {
      return [...columns, { column_name: '*', data_type: 'any' }].map((col) => ({
        ...col,
        disabled: false,
      }));
    }
    if (aggregation === 'count_distinct') {
      return columns.map((col) => ({
        ...col,
        disabled: false,
      }));
    }
    return [...columns].map((col) => ({
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

  const isSavedMetricAdded = (id: number) => metrics.some((m) => m.saved_metric_id === id);

  // Render a saved metric row — with editable alias
  const renderSavedMetricRow = (metric: ChartMetric, index: number) => (
    <div key={index} className="space-y-2 p-3 border rounded-lg bg-blue-50/50">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Library className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
            <span className="text-xs text-blue-600 font-medium">Saved Metric</span>
          </div>
          {metric.column_expression ? (
            <code className="text-xs text-muted-foreground">{metric.column_expression}</code>
          ) : (
            <span className="text-xs text-muted-foreground">
              {(metric.aggregation || '').toUpperCase()}({metric.column || '*'})
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
          onClick={() => removeMetric(index)}
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {/* Editable alias for saved metric */}
      <div className="space-y-1">
        <Label className="text-xs text-gray-600">Display Name</Label>
        <Input
          type="text"
          placeholder="Override display name"
          value={metric.alias || ''}
          onChange={(e) => updateMetric(index, { alias: e.target.value })}
          disabled={disabled}
          className="h-8 text-sm"
        />
      </div>
    </div>
  );

  // Render an ad-hoc metric row — with "Save as Metric" action
  const renderAdHocMetricRow = (metric: ChartMetric, index: number) => (
    <div key={index} className="space-y-2 p-3 border rounded-lg bg-white">
      <div className="flex items-center gap-2">
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">{labels.function}</Label>
            <Select
              value={metric.aggregation}
              onValueChange={(value) => {
                const updates: Partial<ChartMetric> = { aggregation: value };
                if (value === 'count') {
                  updates.column = null;
                } else {
                  const availableColumns = getAvailableColumns(value);
                  const firstValidColumn = availableColumns.find((col) => !col.disabled);
                  if (firstValidColumn) {
                    updates.column = firstValidColumn.column_name;
                  } else {
                    updates.column = '';
                  }
                }
                updateMetric(index, updates);
              }}
              disabled={disabled}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Function" />
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
            <Label className="text-xs text-gray-600">{labels.column}</Label>
            <Combobox
              items={getAvailableColumns(metric.aggregation).map((col) => ({
                value: col.column_name,
                label: col.column_name === '*' ? '* (Count all rows)' : col.column_name,
                data_type: col.data_type,
                disabled: col.disabled,
              }))}
              value={
                metric.aggregation?.toLowerCase() === 'count' && !metric.column
                  ? '*'
                  : metric.column || ''
              }
              onValueChange={(value) =>
                updateMetric(index, { column: value === '*' ? null : value })
              }
              disabled={disabled || !metric.aggregation}
              searchPlaceholder="Search columns..."
              placeholder={metric.aggregation ? 'Select column' : 'Select function first'}
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

        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
          onClick={() => removeMetric(index)}
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs text-gray-600">{labels.alias}</Label>
          <Input
            type="text"
            placeholder="Auto-generated display name"
            value={metric.alias || ''}
            onChange={(e) => updateMetric(index, { alias: e.target.value })}
            disabled={disabled}
            className="h-8 text-sm"
          />
        </div>
        {/* Save as Metric button */}
        {schemaName && tableName && metric.aggregation && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground hover:text-blue-600"
            onClick={() => handleSaveAsMetric(metric, index)}
            disabled={disabled || savingIndex === index}
            title="Save to Metrics library"
          >
            {savingIndex === index ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1" />
            )}
            Save
          </Button>
        )}
      </div>
    </div>
  );

  const renderMetricRow = (metric: ChartMetric, index: number) => {
    if (metric.saved_metric_id) {
      return renderSavedMetricRow(metric, index);
    }
    return renderAdHocMetricRow(metric, index);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-900">Metrics</Label>

      {/* Existing metrics list */}
      {metrics.length > 0 && (
        <div className="space-y-3">
          {metrics.map((metric, index) => renderMetricRow(metric, index))}
        </div>
      )}

      {/* Add metric area with tabs */}
      {canAddMore && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full h-8">
            <TabsTrigger value="adhoc" className="flex-1 text-xs">
              Ad-hoc
            </TabsTrigger>
            <TabsTrigger value="saved" className="flex-1 text-xs">
              Saved Metrics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="adhoc" className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addMetric}
              disabled={disabled}
              className="w-full h-8 border-dashed text-sm bg-gray-900 text-white hover:bg-gray-700 hover:text-white border-gray-900"
            >
              <Plus className="h-4 w-4 mr-2" />
              {maxMetrics === 1 ? 'Add Metric' : 'Add Another Metric'}
            </Button>
          </TabsContent>

          <TabsContent value="saved" className="mt-2 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search saved metrics..."
                value={savedSearch}
                onChange={(e) => setSavedSearch(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-1">
              {savedMetricsLoading ? (
                <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
              ) : savedMetrics.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {savedSearch ? 'No saved metrics match' : 'No saved metrics for this dataset'}
                </p>
              ) : (
                savedMetrics.map((sm) => {
                  const alreadyAdded = isSavedMetricAdded(sm.id);
                  return (
                    <button
                      key={sm.id}
                      onClick={() => !alreadyAdded && addSavedMetric(sm)}
                      disabled={disabled || alreadyAdded}
                      className={`w-full text-left p-2 rounded text-sm hover:bg-muted/50 transition-colors ${
                        alreadyAdded ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <div className="font-medium">{sm.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {sm.column_expression
                          ? sm.column_expression.length > 50
                            ? sm.column_expression.slice(0, 50) + '...'
                            : sm.column_expression
                          : `${(sm.aggregation || '').toUpperCase()}(${sm.column || '*'})`}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
