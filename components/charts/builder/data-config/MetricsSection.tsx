'use client';

import { MetricsSelector } from '@/components/charts/MetricsSelector';
import type { ChartConfigPatch } from '@/components/charts/logic/type-switch';
import type { ChartBuilderFormData, ChartMetric } from '@/types/charts';
import type { NormalizedColumn } from './column-types';

/** Chart types that take any number of metrics. */
const MULTI_METRIC_CHART_TYPES = ['bar', 'line', 'table', 'pivot_table'];

interface MetricsSectionProps {
  formData: ChartBuilderFormData;
  onChange: (patch: ChartConfigPatch) => void;
  disabled?: boolean;
  normalizedColumns: NormalizedColumn[];
  /** New-chart flow only: lets MetricsSelector auto-expand the prefilled metric on mount/async prefill. */
  isNewChart?: boolean;
}

/**
 * Metrics picker: many for bar/line/table/pivot, one for pie and number (number also writes the legacy fields).
 * Each branch has its own key so switching between them remounts MetricsSelector, as the three
 * separate slots in ChartDataConfigurationV3 did (bar <-> line keeps the same instance).
 */
export function MetricsSection({
  formData,
  onChange,
  disabled,
  normalizedColumns,
  isNewChart,
}: MetricsSectionProps) {
  // Multiple Metrics for Bar, Line, Table, and Pivot Table Charts
  if (MULTI_METRIC_CHART_TYPES.includes(formData.chart_type || '')) {
    return (
      <MetricsSelector
        key="multi"
        metrics={formData.metrics || []}
        onChange={(metrics: ChartMetric[]) => onChange({ metrics })}
        columns={normalizedColumns}
        disabled={disabled}
        chartType={formData.chart_type}
        schemaName={formData.schema_name}
        tableName={formData.table_name}
        isNewChart={isNewChart}
      />
    );
  }

  // Single Metric for Pie Charts
  if (formData.chart_type === 'pie') {
    return (
      <MetricsSelector
        key="pie"
        metrics={formData.metrics || []}
        onChange={(metrics: ChartMetric[]) => onChange({ metrics })}
        columns={normalizedColumns}
        disabled={disabled}
        chartType="pie"
        maxMetrics={1}
        schemaName={formData.schema_name}
        tableName={formData.table_name}
        isNewChart={isNewChart}
      />
    );
  }

  // For number charts - use MetricsSelector with single metric
  if (formData.chart_type === 'number') {
    return (
      <MetricsSelector
        key="number"
        metrics={formData.metrics || []}
        onChange={(metrics: ChartMetric[]) => {
          // Map metrics to legacy fields for compatibility
          const metric = metrics[0];
          onChange({
            metrics,
            aggregate_column: metric?.column,
            aggregate_function: metric?.aggregation,
          });
        }}
        columns={normalizedColumns}
        disabled={disabled}
        chartType="number"
        maxMetrics={1}
        schemaName={formData.schema_name}
        tableName={formData.table_name}
        isNewChart={isNewChart}
      />
    );
  }

  return null;
}
