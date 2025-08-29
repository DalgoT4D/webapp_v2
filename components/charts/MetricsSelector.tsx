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

interface MetricsSelectorProps {
  metrics: ChartMetric[];
  onChange: (metrics: ChartMetric[]) => void;
  columns: Array<{ column_name: string; data_type: string }>;
  disabled?: boolean;
  chartType?: string;
  maxMetrics?: number;
}

const AGGREGATE_FUNCTIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
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
      column: '',
      aggregation: 'sum',
      alias: '',
    };
    onChange([...metrics, newMetric]);
  };

  const updateMetric = (index: number, updates: Partial<ChartMetric>) => {
    const newMetrics = [...metrics];
    newMetrics[index] = { ...newMetrics[index], ...updates };

    // Auto-generate alias if not manually set
    if (!updates.alias && (updates.column || updates.aggregation)) {
      const metric = newMetrics[index];
      if (metric.column && metric.aggregation) {
        if (metric.aggregation.toLowerCase() === 'count' && !metric.column) {
          metric.alias = 'Total Count';
        } else {
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
      return [...columns, { column_name: '*', data_type: 'any' }];
    }
    // Other aggregations need numeric columns
    return numericColumns;
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
          <div key={index} className="space-y-2 p-3 border rounded-lg bg-gray-50">
            <div className="flex items-center gap-2">
              <div className="flex-1 grid grid-cols-2 gap-2">
                {/* Column Selection */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">{labels.column}</Label>
                  <Select
                    value={metric.column || ''}
                    onValueChange={(value) =>
                      updateMetric(index, { column: value === '*' ? null : value })
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableColumns(metric.aggregation).map((col) => (
                        <SelectItem key={col.column_name} value={col.column_name}>
                          {col.column_name === '*' ? '* (Count all rows)' : col.column_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Aggregation Function */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">{labels.function}</Label>
                  <Select
                    value={metric.aggregation}
                    onValueChange={(value) => updateMetric(index, { aggregation: value })}
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
