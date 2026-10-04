'use client';

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Combobox, highlightText } from '@/components/ui/combobox';
import { TooltipLabel } from '@/components/charts/styling/TooltipLabel';
import { ColumnTypeIcon } from '@/lib/columnTypeIcons';
import type { ChartMetric } from '@/types/charts';
import { getAvailableColumns, AGGREGATE_FUNCTIONS } from '@/components/charts/MetricsSelector';

export interface SimpleMetricTabProps {
  index: number;
  metric: ChartMetric;
  columns: Array<{ column_name: string; data_type: string }>;
  chartType?: string;
  labels: { column: string; function: string };
  disabled?: boolean;
  // withAutoAlias is applied by the caller, so onUpdate here already carries the auto-alias wrap.
  onUpdate: (partial: Partial<ChartMetric>) => void;
}

/** Body of the Simple tab — pick an aggregation function and a column (or "* / count all rows"). */
export function SimpleMetricTab({
  index,
  metric,
  columns,
  labels,
  disabled,
  onUpdate,
}: SimpleMetricTabProps) {
  return (
    <>
      <div className="space-y-1">
        <Label className="text-xs text-gray-600">{labels.function} *</Label>
        <Select
          value={metric.aggregation || 'count'}
          onValueChange={(v) => onUpdate({ aggregation: v, column_expression: undefined })}
          disabled={disabled}
        >
          <SelectTrigger className="h-8" data-testid={`metric-agg-${index}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGGREGATE_FUNCTIONS.map((f) => (
              <SelectItem
                key={f.value}
                value={f.value}
                data-testid={`metric-agg-${index}-option-${f.value}`}
              >
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-gray-600">{labels.column} *</Label>
        <Combobox
          id={`metric-column-${index}`}
          items={getAvailableColumns(columns, metric.aggregation || 'count').map((col) => ({
            value: col.column_name,
            label: col.column_name === '*' ? '* (Count all rows)' : col.column_name,
            data_type: col.data_type,
            disabled: col.disabled,
          }))}
          value={metric.aggregation === 'count' && !metric.column ? '*' : metric.column || ''}
          onValueChange={(v) => onUpdate({ column: v === '*' ? null : v })}
          disabled={disabled}
          searchPlaceholder="Search columns..."
          placeholder="Select column"
          compact
          renderItem={(item, _sel, q) => (
            <div className="flex items-center gap-2 min-w-0">
              {item.value !== '*' && (
                <ColumnTypeIcon dataType={item.data_type} className="w-4 h-4" />
              )}
              <TooltipLabel label={item.label}>{highlightText(item.label, q)}</TooltipLabel>
            </div>
          )}
        />
      </div>
    </>
  );
}
