'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Accordion } from '@/components/ui/accordion';
import type { ChartMetric } from '@/types/charts';
import { useMetrics, createMetric } from '@/hooks/api/useMetrics';
import { toastSuccess, toastError } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { MetricAccordionItem } from './MetricAccordionItem';

// Default Display Name for the auto-added count-all metric. Matches the auto-prefill label in
// lib/chartAutoPrefill and MetricAccordionItem's autoLabel(), so an unedited default is recognised
// as auto-generated (not a user customization).
export const DEFAULT_METRIC_ALIAS = 'Total Count';

interface MetricsSelectorProps {
  metrics: ChartMetric[];
  onChange: (metrics: ChartMetric[]) => void;
  columns: Array<{ column_name: string; data_type: string }>;
  disabled?: boolean;
  chartType?: string;
  maxMetrics?: number;
  schemaName?: string;
  tableName?: string;
  /** New-chart flow only: auto-expand the prefilled metric on mount/async prefill. */
  isNewChart?: boolean;
}

export const AGGREGATE_FUNCTIONS = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'count_distinct', label: 'Count Distinct' },
];

const NUMERIC_TYPES = [
  'integer',
  'bigint',
  'numeric',
  'double precision',
  'real',
  'float',
  'decimal',
];

/** Columns selectable for a given aggregation. COUNT allows `*`; non-count aggregations only numerics. */
export function getAvailableColumns(
  columns: Array<{ column_name: string; data_type: string }>,
  aggregation: string
) {
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
    disabled: !NUMERIC_TYPES.includes(col.data_type.toLowerCase()),
  }));
}

/** Default metric appended by "+ ADD ANOTHER METRIC" — a valid COUNT(*) with the shared default name. */
const buildDefaultMetric = (): ChartMetric => ({
  column: null,
  aggregation: 'count',
  alias: DEFAULT_METRIC_ALIAS,
});

export function MetricsSelector({
  metrics,
  onChange,
  columns,
  disabled,
  chartType = 'bar',
  maxMetrics,
  schemaName,
  tableName,
  isNewChart,
}: MetricsSelectorProps) {
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  // ---- Accordion uid tracking (client-only; never written into ChartMetric / onChange payloads) ----
  const uidCounter = useRef(0);
  const newUid = () => `m${uidCounter.current++}`;
  const [uids, setUids] = useState<string[]>(() => metrics.map(newUid));
  const [expandedUids, setExpandedUids] = useState<string[]>(() =>
    isNewChart
      ? (metrics.map((m, i) => (m.saved_metric_id ? null : uids[i])).filter(Boolean) as string[])
      : []
  );
  // Set true by emit() so the reconciliation effect knows a metrics change was internal (uids already
  // updated in lockstep) and must NOT regenerate. External changes (prefill/edit-load/chart switch) regenerate.
  const internalRef = useRef(false);
  const mountedRef = useRef(false);

  const { data: savedMetrics, mutate: mutateSavedMetrics } = useMetrics({
    schemaName,
    tableName,
    pageSize: 50,
  });

  // emit — single choke-point for internal metrics mutations; keeps `uids` 1:1 with `metrics`.
  // Pass nextUids explicitly for non-end edits (e.g. middle removal); otherwise align by appending/
  // truncating at the END (append, replace-in-place keep length and reuse uids).
  const emit = (nextMetrics: ChartMetric[], nextUids?: string[]) => {
    internalRef.current = true;
    if (nextUids) {
      setUids(nextUids);
    } else if (nextMetrics.length > uids.length) {
      const added = Array.from({ length: nextMetrics.length - uids.length }, newUid);
      setUids([...uids, ...added]);
    } else if (nextMetrics.length < uids.length) {
      setUids(uids.slice(0, nextMetrics.length));
    }
    onChange(nextMetrics);
  };

  // Reconcile uids/expansion on EXTERNAL metrics changes (async prefill, edit-page load, chart switch).
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (internalRef.current) {
      internalRef.current = false;
      return;
    }
    const regenerated = metrics.map(newUid);
    setUids(regenerated);
    setExpandedUids(
      isNewChart
        ? (metrics
            .map((m, i) => (m.saved_metric_id ? null : regenerated[i]))
            .filter(Boolean) as string[])
        : []
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- regenerate only on external metrics-array changes
  }, [metrics]);

  const committedCount = metrics.length;
  const canAddMore = !maxMetrics || committedCount < maxMetrics;

  const isSavedMetricAdded = (id: number) => metrics.some((m) => m.saved_metric_id === id);

  const addMetric = () => {
    const uid = newUid();
    internalRef.current = true;
    setUids([...uids, uid]);
    // Collapse the others, expand the newly added one.
    setExpandedUids([uid]);
    onChange([...metrics, buildDefaultMetric()]);
  };

  const removeMetric = (index: number) => {
    const removedUid = uids[index];
    emit(
      metrics.filter((_, i) => i !== index),
      uids.filter((_, i) => i !== index)
    );
    setExpandedUids((prev) => prev.filter((u) => u !== removedUid));
  };

  // In-place edit of a metric (function/column/expression/alias/type) — drives a live chart refetch.
  const updateMetric = (index: number, partial: Partial<ChartMetric>) => {
    const next = [...metrics];
    next[index] = { ...next[index], ...partial };
    emit(next, uids);
  };

  // Save the metric at `index` to the library, converting it into a saved-metric reference.
  const saveMetricToLibrary = async (
    index: number,
    metricName: string,
    mode: 'simple' | 'calculated'
  ) => {
    if (!schemaName || !tableName || !metricName.trim()) return;
    const metric = metrics[index];
    setSavingIndex(index);
    try {
      const payload: {
        name: string;
        schema_name: string;
        table_name: string;
        aggregation?: string;
        column?: string;
        column_expression?: string;
      } = {
        name: metricName.trim(),
        schema_name: schemaName,
        table_name: tableName,
      };
      if (mode === 'simple') {
        payload.aggregation = metric.aggregation || 'count';
        payload.column =
          metric.aggregation === 'count' && !metric.column ? undefined : metric.column || undefined;
      } else {
        payload.column_expression = metric.column_expression?.trim();
      }

      const saved = await createMetric(payload);
      updateMetric(index, {
        saved_metric_id: saved.id,
        column: saved.column_expression ? null : saved.column,
        aggregation: saved.column_expression ? null : saved.aggregation || 'count',
        column_expression: saved.column_expression || undefined,
        alias: metric.alias || saved.name,
      });
      mutateSavedMetrics();
      trackEvent(ANALYTICS_EVENTS.METRIC_CREATED, { source: 'chart_builder', metric_type: mode });
      toastSuccess.generic(`Saved metric "${saved.name}"`);
    } catch (err) {
      toastError.save(err, 'metric');
    } finally {
      setSavingIndex(null);
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-gray-900">Metrics</Label>

      {metrics.length > 0 && (
        <Accordion
          type="multiple"
          value={expandedUids}
          onValueChange={setExpandedUids}
          className="space-y-2"
        >
          {metrics.map((metric, index) => (
            <MetricAccordionItem
              key={uids[index]}
              uid={uids[index]}
              index={index}
              metric={metric}
              columns={columns}
              disabled={disabled}
              chartType={chartType}
              schemaName={schemaName}
              tableName={tableName}
              savedMetrics={savedMetrics}
              isSavedMetricAdded={isSavedMetricAdded}
              saving={savingIndex === index}
              onUpdate={(partial) => updateMetric(index, partial)}
              onRemove={() => removeMetric(index)}
              onSaveToLibrary={(name, mode) => saveMetricToLibrary(index, name, mode)}
            />
          ))}
        </Accordion>
      )}

      {canAddMore && (
        <Button
          size="sm"
          onClick={addMetric}
          disabled={disabled}
          data-testid="add-metric-button"
          className="w-full border-dashed bg-gray-900 text-white hover:bg-gray-700 hover:text-white border-gray-900"
        >
          + ADD ANOTHER METRIC
        </Button>
      )}
    </div>
  );
}
