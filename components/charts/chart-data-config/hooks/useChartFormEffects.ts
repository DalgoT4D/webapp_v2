'use client';

import { useEffect, useCallback, useRef } from 'react';
import debounce from 'lodash/debounce';
import { generateAutoPrefilledConfig } from '@/lib/chartAutoPrefill';
import { DATETIME_COLUMN_TYPES } from '../constants';
import type { ChartBuilderFormData } from '@/types/charts';

interface Column {
  column_name: string;
  data_type: string;
  name?: string;
}

// TableColumn type expected by generateAutoPrefilledConfig
interface TableColumn {
  name: string;
  data_type: string;
  column_name: string;
}

interface UseChartFormEffectsProps {
  formData: ChartBuilderFormData;
  columns: Column[] | undefined;
  normalizedColumns: Column[];
  onChange: (updates: Partial<ChartBuilderFormData>) => void;
}

/**
 * Check if a column is a datetime type
 */
function isDateTimeColumn(column: Column): boolean {
  return DATETIME_COLUMN_TYPES.some((type) => column.data_type.toLowerCase().includes(type));
}

/**
 * Build a set of sortable column/metric names
 */
function buildSortableSet(formData: ChartBuilderFormData): Set<string> {
  const sortable = new Set<string>();

  if (formData.dimension_column) {
    sortable.add(formData.dimension_column);
  }

  if (formData.metrics?.length) {
    formData.metrics.forEach((m) => {
      const alias = m.alias || `${m.aggregation}(${m.column})`;
      sortable.add(alias);
    });
  } else if (formData.aggregate_column && formData.aggregate_function) {
    sortable.add(`${formData.aggregate_function}(${formData.aggregate_column})`);
  }

  return sortable;
}

/**
 * useChartFormEffects - Manages side effects for chart form
 *
 * Handles:
 * - Auto-prefill when columns are loaded (debounced)
 * - Sort reset when sortable columns change
 * - Time grain reset when dimension column changes
 */
export function useChartFormEffects({
  formData,
  columns,
  normalizedColumns,
  onChange,
}: UseChartFormEffectsProps) {
  // Track if we've already auto-prefilled to prevent multiple triggers
  const hasAutoPrefilled = useRef(false);

  // Debounced auto-prefill function
  const debouncedAutoPrefill = useCallback(
    debounce((chartType: ChartBuilderFormData['chart_type'], cols: TableColumn[]) => {
      const autoConfig = generateAutoPrefilledConfig(chartType, cols);
      if (Object.keys(autoConfig).length > 0) {
        onChange(autoConfig);
      }
    }, 300),
    [onChange]
  );

  // Auto-prefill when columns are loaded
  useEffect(() => {
    if (
      columns &&
      formData.schema_name &&
      formData.table_name &&
      formData.chart_type &&
      !hasAutoPrefilled.current
    ) {
      // Check if we should auto-prefill (no existing configuration)
      const hasExistingConfig = !!(
        formData.dimension_column ||
        formData.aggregate_column ||
        formData.geographic_column ||
        formData.x_axis_column ||
        formData.y_axis_column ||
        formData.table_columns?.length ||
        (formData.metrics && formData.metrics.length > 0)
      );

      if (!hasExistingConfig) {
        hasAutoPrefilled.current = true;
        // Convert to TableColumn format (filter out columns without name)
        const tableColumns: TableColumn[] = normalizedColumns
          .filter((col): col is Column & { name: string } => !!col.name)
          .map((col) => ({
            name: col.name,
            data_type: col.data_type,
            column_name: col.column_name,
          }));
        debouncedAutoPrefill(formData.chart_type, tableColumns);
      }
    }

    // Reset auto-prefill flag when dataset changes
    return () => {
      // Cleanup debounce on unmount
      debouncedAutoPrefill.cancel();
    };
  }, [columns, formData.schema_name, formData.table_name, formData.chart_type]);

  // Reset auto-prefill flag when dataset changes
  useEffect(() => {
    hasAutoPrefilled.current = false;
  }, [formData.schema_name, formData.table_name]);

  // Reset sort if current column is no longer available
  useEffect(() => {
    const sortable = buildSortableSet(formData);
    const current = formData.sort?.[0]?.column;

    if (current && !sortable.has(current)) {
      onChange({ sort: [] });
    }
  }, [
    formData.dimension_column,
    formData.metrics,
    formData.aggregate_column,
    formData.aggregate_function,
  ]);

  // Reset time grain if dimension column is not datetime or chart type doesn't support it
  useEffect(() => {
    const supportsTimeGrain = ['bar', 'line'].includes(formData.chart_type || '');
    const dimensionColumn = normalizedColumns.find(
      (col) => col.column_name === formData.dimension_column
    );
    const isDateTime = dimensionColumn && isDateTimeColumn(dimensionColumn);

    const shouldHaveTimeGrain = supportsTimeGrain && formData.dimension_column && isDateTime;

    if (!shouldHaveTimeGrain && formData.time_grain) {
      onChange({ time_grain: null });
    }
  }, [formData.chart_type, formData.dimension_column, normalizedColumns]);
}
