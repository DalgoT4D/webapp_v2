'use client';

import React from 'react';
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
import { X, Plus } from 'lucide-react';
import type { ChartMetric } from '@/types/charts';
import { ColumnTypeIcon } from '@/lib/columnTypeIcons';
import { Combobox, highlightText } from '@/components/ui/combobox';

interface MetricsSelectorProps {
  metrics: ChartMetric[];
  onChange: (metrics: ChartMetric[]) => void;
  columns: Array<{ column_name: string; data_type: string }>;
  disabled?: boolean;
  chartType?: string;
  maxMetrics?: number;
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
}: MetricsSelectorProps) {
  // Get chart-type-specific labels
  const getLabels = () => {
    switch (chartType) {
      case 'pie':
        return {
          column: 'Dimension',
          function: 'Metric',
          alias: 'Display Name',
          title: 'Configure Pie Chart Metrics',
          subtitle: 'Select dimensions and their metrics for the pie chart',
        };
      default:
        return {
          column: 'Column',
          function: 'Function',
          alias: 'Display Name',
          title: 'Configure Chart Metrics',
          subtitle: 'Select columns and their aggregation functions',
        };
    }
  };

  const labels = getLabels();

  // Filter to numeric columns for most aggregations
  const numericColumns = columns.filter((col) =>
    ['integer', 'bigint', 'numeric', 'double precision', 'real', 'float', 'decimal'].includes(
      col.data_type.toLowerCase()
    )
  );

  const addMetric = () => {
    const newMetric: ChartMetric = {
      column: null, // For count, use null to display as '*'
      aggregation: 'count',
      alias: '',
    };
    onChange([...metrics, newMetric]);
  };

  const updateMetric = (index: number, updates: Partial<ChartMetric>) => {
    const newMetrics = [...metrics];
    newMetrics[index] = { ...newMetrics[index], ...updates };

    // Auto-generate alias if not manually set
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

  const getAvailableColumns = (aggregation: string) => {
    // Count can work on any column or no column at all
    if (aggregation === 'count') {
      return [...columns, { column_name: '*', data_type: 'any' }].map((col) => ({
        ...col,
        disabled: false,
      }));
    }
    // Count distinct can work on all columns (no numeric filter)
    if (aggregation === 'count_distinct') {
      return columns.map((col) => ({
        ...col,
        disabled: false,
      }));
    }
    // Other aggregations need numeric columns - show all but disable non-numeric
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

  if (metrics.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Metrics</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={addMetric}
          disabled={disabled}
          className="w-full h-8 border-dashed bg-gray-900 text-white hover:bg-gray-700 hover:text-white border-gray-900"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Metric
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-900">Metrics</Label>
      <div className="space-y-3">
        {metrics.map((metric, index) => (
          <div key={index} className="space-y-2 p-3 border rounded-lg bg-white">
            <div className="flex items-center gap-2">
              <div className="flex-1 grid grid-cols-2 gap-2">
                {/* Aggregation Function - Now First */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">{labels.function}</Label>
                  <Select
                    value={metric.aggregation}
                    onValueChange={(value) => {
                      const updates: Partial<ChartMetric> = { aggregation: value };

                      if (value === 'count') {
                        // Count: set to null (displays as '*')
                        updates.column = null;
                      } else {
                        // For other functions, auto-select first valid column
                        const availableColumns = getAvailableColumns(value);
                        const firstValidColumn = availableColumns.find((col) => !col.disabled);

                        if (firstValidColumn) {
                          updates.column = firstValidColumn.column_name;
                        } else {
                          // No valid columns available, clear selection to show error
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

                {/* Column Selection - Now Second */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">{labels.column}</Label>
                  <Combobox
                    items={getAvailableColumns(metric.aggregation)
                      .filter((col) => !col.disabled)
                      .map((col) => ({
                        value: col.column_name,
                        label: col.column_name === '*' ? '* (Count all rows)' : col.column_name,
                        data_type: col.data_type,
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

              {/* Remove Button */}
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

            {/* Display Name (Alias) */}
            <div className="space-y-1">
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
          </div>
        ))}

        {/* Add Metric Button - only show if under maxMetrics limit */}
        {(!maxMetrics || metrics.length < maxMetrics) && (
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
        )}
      </div>
    </div>
  );
}
