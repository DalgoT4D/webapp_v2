'use client';

import React from 'react';
import { Combobox, highlightText } from '@/components/ui/combobox';
import { TooltipLabel } from '@/components/charts/styling/TooltipLabel';
import type { ChartMetric } from '@/types/charts';

export interface SavedMetric {
  id: number;
  name: string;
  column?: string | null;
  aggregation?: string | null;
  column_expression?: string | null;
}

export interface SavedMetricTabProps {
  index: number;
  metric: ChartMetric;
  savedMetrics: SavedMetric[];
  isSavedMetricAdded?: (id: number) => boolean;
  disabled?: boolean;
  onPick: (savedMetricId: string) => void;
}

/** Body of the Saved tab — pick (or swap) a saved-library metric to link this row to. */
export function SavedMetricTab({
  index,
  metric,
  savedMetrics,
  isSavedMetricAdded,
  disabled,
  onPick,
}: SavedMetricTabProps) {
  return (
    <Combobox
      id={`metric-saved-${index}`}
      items={savedMetrics
        // Hide metrics already added in other rows, but keep this row's own selection.
        .filter((sm) => !isSavedMetricAdded?.(sm.id) || sm.id === metric.saved_metric_id)
        .map((sm) => ({
          value: sm.id.toString(),
          label: sm.name,
          summary: sm.column_expression
            ? sm.column_expression.slice(0, 40)
            : `${(sm.aggregation || '').toUpperCase()}(${sm.column || '*'})`,
        }))}
      value={metric.saved_metric_id?.toString() ?? ''}
      onValueChange={(v) => v && onPick(v)}
      disabled={disabled}
      searchPlaceholder="Search metrics..."
      placeholder="Select a metric from pre-defined list"
      emptyMessage="No metrics match your search"
      noItemsMessage="No saved metrics yet"
      renderItem={(item, _sel, q) => (
        <div className="flex flex-col min-w-0">
          <TooltipLabel label={item.label}>{highlightText(item.label, q)}</TooltipLabel>
          <TooltipLabel label={item.summary} className="text-xs text-muted-foreground">
            {item.summary}
          </TooltipLabel>
        </div>
      )}
    />
  );
}
