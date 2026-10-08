'use client';

import React from 'react';
import { useColumns } from '@/hooks/api/useChart';
import { ChartTypeSelector } from '@/components/charts/ChartTypeSelector';
import PivotDataConfiguration from '@/components/charts/chart-types/pivot-table/PivotDataConfiguration';
import { TimeGrainSelector } from '@/components/charts/TimeGrainSelector';
import { applyChartTypeChange } from '@/components/charts/logic/type-switch';
import { buildDatasetChangePatch } from '@/components/charts/logic/dataset-change';
import { hasExistingChartConfig } from '@/components/charts/logic/auto-prefill';
import { getSortableColumns } from '@/components/charts/logic/sort-options';
import { findTimeGrainColumn } from '@/components/charts/logic/time-grain';
import { DataSourceSection } from '@/components/charts/builder/data-config/DataSourceSection';
import { AxisDimensionSection } from '@/components/charts/builder/data-config/AxisDimensionSection';
import { TableDimensionsSection } from '@/components/charts/builder/data-config/TableDimensionsSection';
import { MetricsSection } from '@/components/charts/builder/data-config/MetricsSection';
import { ExtraDimensionSection } from '@/components/charts/builder/data-config/ExtraDimensionSection';
import { FiltersSection } from '@/components/charts/builder/data-config/FiltersSection';
import { PaginationSection } from '@/components/charts/builder/data-config/PaginationSection';
import { SortSection } from '@/components/charts/builder/data-config/SortSection';
import type { ChartBuilderFormData } from '@/types/charts';
import { generateAutoPrefilledConfig } from '@/lib/chartAutoPrefill';

interface ChartDataConfigurationProps {
  formData: ChartBuilderFormData;
  onChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
  /** True when any conditional formatting rule has a level scope — for T7 reorder warning */
  hasLevelScopedRules?: boolean;
  /** Called after dimension reorder when level-scoped rules exist — for T7 */
  onReorderWithScopedRules?: () => void;
  /** Maps dimension column name → count of rules scoped to it — for T9 remove warning */
  scopedRuleCountByLevel?: Record<string, number>;
  /** New-chart flow only: lets MetricsSelector auto-expand the prefilled metric on mount/async prefill. */
  isNewChart?: boolean;
}

/** Chart types without an X axis / single dimension picker. */
const NO_AXIS_CHART_TYPES = ['number', 'map', 'table', 'pivot_table'];
/** Chart types with an extra (stack / series) dimension. */
const EXTRA_DIMENSION_CHART_TYPES = ['bar', 'line', 'pie'];
/** Chart types without pagination and sort (pivot: v1 has no pivot sort). */
const NO_PAGINATION_SORT_CHART_TYPES = ['map', 'number', 'pivot_table'];

export function ChartDataConfiguration({
  formData,
  onChange,
  disabled,
  hasLevelScopedRules,
  onReorderWithScopedRules,
  scopedRuleCountByLevel,
  isNewChart,
}: ChartDataConfigurationProps) {
  const { data: columns } = useColumns(formData.schema_name || null, formData.table_name || null);

  // Memoize normalized columns to prevent unnecessary re-renders
  const normalizedColumns = React.useMemo(
    () =>
      columns?.map((col) => ({
        column_name: col.column_name || col.name,
        data_type: col.data_type,
        name: col.column_name || col.name,
      })) || [],
    [columns]
  );

  // Memoize column items for Combobox to prevent unnecessary re-renders
  const columnItems = React.useMemo(
    () =>
      columns?.map((col) => ({
        value: col.column_name || col.name,
        label: col.column_name || col.name,
        data_type: col.data_type,
      })) || [],
    [columns]
  );

  // Handle dataset changes with complete form reset
  const handleDatasetChange = (schema_name: string, table_name: string) => {
    const patch = buildDatasetChangePatch(formData, schema_name, table_name, 'chart');
    if (patch) onChange(patch);
  };

  // Auto-prefill when columns load — only once per (chart_type, schema, table).
  // Without the key guard, removing the last metric on a number chart re-triggers prefill
  // because nothing else in `hasExistingChartConfig` stays truthy for number charts.
  const autoPrefillKeyRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!columns || !formData.schema_name || !formData.table_name || !formData.chart_type) return;

    const key = `${formData.chart_type}|${formData.schema_name}|${formData.table_name}`;
    if (autoPrefillKeyRef.current === key) return;
    autoPrefillKeyRef.current = key;

    if (!hasExistingChartConfig(formData)) {
      const autoConfig = generateAutoPrefilledConfig(formData.chart_type, normalizedColumns);
      if (Object.keys(autoConfig).length > 0) {
        console.log('🤖 [CHART-DATA-CONFIG-V3] Auto-prefilling configuration:', autoConfig);
        onChange(autoConfig);
      }
    }
  }, [
    columns,
    formData.schema_name,
    formData.table_name,
    formData.chart_type,
    normalizedColumns,
    onChange,
  ]);

  // Reset sort if current column is no longer available (avoid render-time side effects)
  React.useEffect(() => {
    const current = formData.sort?.[0]?.column;
    if (current && !getSortableColumns(formData).has(current)) {
      onChange({ sort: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.dimension_column,
    formData.metrics,
    formData.aggregate_column,
    formData.aggregate_function,
  ]);

  // Reset time grain if dimension column is not datetime or chart type doesn't support it
  React.useEffect(() => {
    // Only run this effect if columns are loaded to avoid clearing time_grain during initial load
    if (!columns || columns.length === 0) return;

    if (!findTimeGrainColumn(formData, normalizedColumns) && formData.time_grain) {
      onChange({ time_grain: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.chart_type, formData.dimension_column, normalizedColumns, columns]);

  // Handle chart type changes with field cleanup and auto-prefill
  const handleChartTypeChange = (newChartType: string) => {
    onChange(applyChartTypeChange(formData, newChartType, normalizedColumns));
  };

  const chartType = formData.chart_type || '';
  const timeGrainColumn = findTimeGrainColumn(formData, normalizedColumns);

  return (
    <div className="space-y-4">
      {/* Chart Type Selector - Interactive */}
      <ChartTypeSelector
        value={formData.chart_type}
        onChange={handleChartTypeChange}
        disabled={disabled}
      />

      <DataSourceSection
        schemaName={formData.schema_name}
        tableName={formData.table_name}
        onDatasetChange={handleDatasetChange}
        disabled={disabled}
      />

      {!NO_AXIS_CHART_TYPES.includes(chartType) && (
        <AxisDimensionSection
          formData={formData}
          onChange={onChange}
          disabled={disabled}
          columnItems={columnItems}
        />
      )}

      {chartType === 'table' && (
        <TableDimensionsSection
          formData={formData}
          onChange={onChange}
          disabled={disabled}
          normalizedColumns={normalizedColumns}
          hasLevelScopedRules={hasLevelScopedRules}
          onReorderWithScopedRules={onReorderWithScopedRules}
          scopedRuleCountByLevel={scopedRuleCountByLevel}
        />
      )}

      {/* Pivot Table Data Configuration — dimensions only; totals render after metrics/filters */}
      {chartType === 'pivot_table' && (
        <PivotDataConfiguration
          formData={formData}
          availableColumns={normalizedColumns}
          onChange={onChange}
          disabled={disabled}
          section="dimensions"
        />
      )}

      {/* Time Grain - For Bar and Line Charts with DateTime X-axis */}
      {timeGrainColumn && (
        <TimeGrainSelector
          value={formData.time_grain || null}
          // The selector only emits its own time-grain option values, but types them as strings.
          onChange={(value) =>
            onChange({ time_grain: value as ChartBuilderFormData['time_grain'] })
          }
          disabled={disabled}
          columnDataType={timeGrainColumn.data_type}
        />
      )}

      <MetricsSection
        formData={formData}
        onChange={onChange}
        disabled={disabled}
        normalizedColumns={normalizedColumns}
        isNewChart={isNewChart}
      />

      {EXTRA_DIMENSION_CHART_TYPES.includes(chartType) && (
        <ExtraDimensionSection
          formData={formData}
          onChange={onChange}
          disabled={disabled}
          allColumns={normalizedColumns}
        />
      )}

      {chartType !== 'map' && (
        <FiltersSection
          formData={formData}
          onChange={onChange}
          disabled={disabled}
          normalizedColumns={normalizedColumns}
          columnItems={columnItems}
        />
      )}

      {/* Pivot Table subtotals & grand totals — placed after metrics/filters */}
      {chartType === 'pivot_table' && (
        <PivotDataConfiguration
          formData={formData}
          availableColumns={normalizedColumns}
          onChange={onChange}
          disabled={disabled}
          section="totals"
        />
      )}

      {!NO_PAGINATION_SORT_CHART_TYPES.includes(chartType) && (
        <PaginationSection formData={formData} onChange={onChange} disabled={disabled} />
      )}

      {!NO_PAGINATION_SORT_CHART_TYPES.includes(chartType) && (
        <SortSection formData={formData} onChange={onChange} disabled={disabled} />
      )}
    </div>
  );
}
