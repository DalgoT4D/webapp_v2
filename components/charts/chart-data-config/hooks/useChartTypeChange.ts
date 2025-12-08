'use client';

import { useCallback } from 'react';
import pick from 'lodash/pick';
import { generateAutoPrefilledConfig } from '@/lib/chartAutoPrefill';
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

interface UseChartTypeChangeProps {
  formData: ChartBuilderFormData;
  columns: Column[] | undefined;
  normalizedColumns: Column[];
  onChange: (updates: Partial<ChartBuilderFormData>) => void;
}

// Fields to preserve across all chart types
const PRESERVED_FIELDS = ['title', 'schema_name', 'table_name'] as const;

// Fields to preserve for settings
const SETTINGS_FIELDS = ['filters', 'customizations', 'sort', 'pagination'] as const;

/**
 * Get chart-type-specific field configuration
 */
function getChartTypeSpecificFields(
  newChartType: string,
  formData: ChartBuilderFormData
): Partial<ChartBuilderFormData> {
  switch (newChartType) {
    case 'number':
      // Big number only needs aggregate column and function
      return {
        aggregate_column: formData.aggregate_column,
        aggregate_function: formData.aggregate_function,
        // Clear fields not needed for number charts
        x_axis_column: undefined,
        y_axis_column: undefined,
        dimension_column: undefined,
        extra_dimension_column: undefined,
        // Limit metrics to only the first one (single metric)
        metrics: formData.metrics && formData.metrics.length > 0 ? [formData.metrics[0]] : [],
      };

    case 'pie':
      // Pie charts can use dimension and metrics, but limit to single metric
      return {
        x_axis_column: formData.x_axis_column,
        y_axis_column: undefined, // No Y-axis for pie charts
        dimension_column: formData.dimension_column,
        aggregate_column: formData.aggregate_column,
        aggregate_function: formData.aggregate_function,
        extra_dimension_column: formData.extra_dimension_column,
        metrics:
          formData.metrics && formData.metrics.length > 0
            ? [formData.metrics[0]]
            : formData.metrics,
        computation_type: formData.computation_type || 'aggregated',
      };

    case 'bar':
    case 'line':
      // Bar and line charts can use most fields and metrics
      return {
        x_axis_column: formData.x_axis_column,
        y_axis_column: formData.y_axis_column,
        dimension_column: formData.dimension_column,
        aggregate_column: formData.aggregate_column,
        aggregate_function: formData.aggregate_function,
        extra_dimension_column: formData.extra_dimension_column,
        metrics: formData.metrics,
        computation_type: formData.computation_type || 'aggregated',
      };

    case 'table':
      // Tables default to aggregated data
      return {
        computation_type: formData.computation_type || 'aggregated',
        x_axis_column: formData.x_axis_column,
        y_axis_column: undefined, // Tables don't need Y axis
        dimension_column: formData.dimension_column,
        aggregate_column: formData.aggregate_column,
        aggregate_function: formData.aggregate_function,
        extra_dimension_column: formData.extra_dimension_column,
        metrics: formData.metrics, // Preserve all metrics
      };

    default:
      return {};
  }
}

/**
 * useChartTypeChange - Handles chart type change logic
 *
 * Manages:
 * - Field preservation across chart types
 * - Auto-prefill for new chart type
 * - Chart-type-specific field configuration
 */
export function useChartTypeChange({
  formData,
  columns,
  normalizedColumns,
  onChange,
}: UseChartTypeChangeProps) {
  const handleChartTypeChange = useCallback(
    (newChartType: string) => {
      // Pick preserved fields
      const preservedFields = {
        ...pick(formData, PRESERVED_FIELDS),
        chart_type: newChartType as ChartBuilderFormData['chart_type'],
      };

      // Auto-prefill for new chart type if we have columns
      let autoPrefilledFields: Partial<ChartBuilderFormData> = {};
      if (columns && columns.length > 0) {
        // Convert to TableColumn format (filter out columns without name)
        const tableColumns: TableColumn[] = normalizedColumns
          .filter((col): col is Column & { name: string } => !!col.name)
          .map((col) => ({
            name: col.name,
            data_type: col.data_type,
            column_name: col.column_name,
          }));
        autoPrefilledFields = generateAutoPrefilledConfig(
          newChartType as ChartBuilderFormData['chart_type'],
          tableColumns
        );
      }

      // Get chart type specific fields
      const specificFields = getChartTypeSpecificFields(newChartType, formData);

      // Pick settings fields to preserve
      const settingsFields = pick(formData, SETTINGS_FIELDS);

      // Apply the changes with auto-prefill
      onChange({
        ...preservedFields,
        ...autoPrefilledFields,
        ...specificFields,
        ...settingsFields,
      });
    },
    [formData, columns, normalizedColumns, onChange]
  );

  return { handleChartTypeChange };
}
