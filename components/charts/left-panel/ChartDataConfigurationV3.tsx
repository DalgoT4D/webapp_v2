'use client';

import { Label } from '@/components/ui/label';
import { useColumns } from '@/hooks/api/useChart';
import { ChartTypeSelector } from './ChartTypeSelector';
import { MetricsSelector } from './MetricsSelector';
import { DatasetSelector } from './DatasetSelector';
import { TimeGrainSelector } from './TimeGrainSelector';
import {
  DimensionSelector,
  ExtraDimensionSelector,
  FiltersSection,
  PaginationSelector,
  SortConfiguration,
  useChartFormEffects,
  useChartTypeChange,
  DATETIME_COLUMN_TYPES,
} from '../chart-data-config';
import type { ChartBuilderFormData, ChartMetric } from '@/types/charts';

interface ChartDataConfigurationV3Props {
  formData: ChartBuilderFormData;
  onChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

/**
 * Check if dimension column is a datetime type
 */
function isDimensionDateTime(
  dimensionColumn: string | undefined,
  columns: Array<{ column_name: string; data_type: string }>
): boolean {
  if (!dimensionColumn) return false;
  const column = columns.find((col) => col.column_name === dimensionColumn);
  if (!column) return false;
  return DATETIME_COLUMN_TYPES.some((type) => column.data_type.toLowerCase().includes(type));
}

/**
 * ChartDataConfigurationV3 - Main data configuration component for charts
 *
 * Orchestrates all the sub-components for configuring chart data:
 * - Chart Type selection
 * - Data Source (dataset) selection
 * - Dimension/X-axis selection
 * - Time Grain (for datetime dimensions)
 * - Metrics configuration
 * - Extra dimension (for stacked/grouped charts)
 * - Data filters
 * - Pagination
 * - Sort configuration
 */
export function ChartDataConfigurationV3({
  formData,
  onChange,
  disabled,
}: ChartDataConfigurationV3Props) {
  const { data: columns } = useColumns(formData.schema_name || null, formData.table_name || null);

  // Normalize columns to consistent format
  const normalizedColumns =
    columns?.map((col) => ({
      column_name: col.column_name || col.name,
      data_type: col.data_type,
      name: col.column_name || col.name,
    })) || [];

  // Use custom hooks for side effects and chart type changes
  useChartFormEffects({
    formData,
    columns,
    normalizedColumns,
    onChange,
  });

  const { handleChartTypeChange } = useChartTypeChange({
    formData,
    columns,
    normalizedColumns,
    onChange,
  });

  // Handle dataset changes with complete form reset
  const handleDatasetChange = (schema_name: string, table_name: string) => {
    // Prevent unnecessary resets if dataset hasn't actually changed
    if (formData.schema_name === schema_name && formData.table_name === table_name) {
      return;
    }

    // Preserve only essential chart identity fields
    const preservedFields = {
      title: formData.title,
      chart_type: formData.chart_type,
      customizations: formData.customizations || {},
    };

    // Reset all data-related fields to ensure compatibility with new dataset
    onChange({
      ...preservedFields,
      schema_name,
      table_name,
      // Reset all column selections
      x_axis_column: undefined,
      y_axis_column: undefined,
      dimension_column: undefined,
      aggregate_column: undefined,
      aggregate_function: 'count',
      extra_dimension_column: undefined,
      geographic_column: undefined,
      value_column: undefined,
      selected_geojson_id: undefined,
      // Reset data configuration
      metrics: [],
      filters: [],
      sort: [],
      pagination: { enabled: false, page_size: 50 },
      computation_type: 'aggregated',
      // Reset map-specific fields
      layers: undefined,
      geojsonPreviewPayload: undefined,
      dataOverlayPayload: undefined,
    });
  };

  // Determine which sections to show based on chart type
  const chartType = formData.chart_type;
  const showDimension = chartType !== 'number' && chartType !== 'map';
  const showTimeGrain =
    ['bar', 'line'].includes(chartType || '') &&
    formData.dimension_column &&
    isDimensionDateTime(formData.dimension_column, normalizedColumns);
  const showMetrics =
    (['bar', 'line'].includes(chartType || '') && formData.computation_type === 'aggregated') ||
    chartType === 'table';
  const showPieMetrics = chartType === 'pie' && formData.computation_type === 'aggregated';
  const showNumberMetrics = chartType === 'number';
  const showExtraDimension = ['bar', 'line', 'pie', 'table'].includes(chartType || '');
  const showFilters = chartType !== 'map';
  const showPagination = chartType !== 'map' && chartType !== 'number';
  const showSort = chartType !== 'map' && chartType !== 'number';

  return (
    <div className="space-y-4">
      {/* Chart Type Selector */}
      <ChartTypeSelector
        value={formData.chart_type}
        onChange={handleChartTypeChange}
        disabled={disabled}
      />

      {/* Data Source */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Data Source</Label>
        <DatasetSelector
          schema_name={formData.schema_name}
          table_name={formData.table_name}
          onDatasetChange={handleDatasetChange}
          disabled={disabled}
          className="w-full"
        />
      </div>

      {/* Dimension / X Axis */}
      {showDimension && (
        <DimensionSelector
          chartType={chartType}
          columns={normalizedColumns}
          value={formData.dimension_column || formData.x_axis_column}
          onChange={(value) => onChange({ dimension_column: value })}
          disabled={disabled}
        />
      )}

      {/* Time Grain - For Bar and Line Charts with DateTime X-axis */}
      {showTimeGrain && (
        <TimeGrainSelector
          value={formData.time_grain || null}
          onChange={(value) =>
            onChange({
              time_grain: value as ChartBuilderFormData['time_grain'],
            })
          }
          disabled={disabled}
        />
      )}

      {/* Multiple Metrics for Bar, Line, and Table Charts */}
      {showMetrics && (
        <MetricsSelector
          metrics={formData.metrics || []}
          onChange={(metrics: ChartMetric[]) => onChange({ metrics })}
          columns={normalizedColumns}
          disabled={disabled}
          chartType={formData.chart_type}
        />
      )}

      {/* Single Metric for Pie Charts */}
      {showPieMetrics && (
        <MetricsSelector
          metrics={formData.metrics || []}
          onChange={(metrics: ChartMetric[]) => onChange({ metrics })}
          columns={normalizedColumns}
          disabled={disabled}
          chartType="pie"
          maxMetrics={1}
        />
      )}

      {/* For number charts - use MetricsSelector with single metric */}
      {showNumberMetrics && (
        <MetricsSelector
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
        />
      )}

      {/* Extra Dimension - for stacked/grouped charts */}
      {showExtraDimension && (
        <ExtraDimensionSelector
          chartType={chartType}
          columns={normalizedColumns}
          value={formData.extra_dimension_column}
          onChange={(value) => onChange({ extra_dimension_column: value })}
          excludeColumn={formData.dimension_column}
          disabled={disabled}
        />
      )}

      {/* Filters Section */}
      {showFilters && (
        <FiltersSection
          filters={formData.filters || []}
          columns={normalizedColumns}
          schemaName={formData.schema_name}
          tableName={formData.table_name}
          onChange={(filters) => onChange({ filters })}
          disabled={disabled}
        />
      )}

      {/* Pagination Section */}
      {showPagination && (
        <PaginationSelector
          value={formData.pagination}
          onChange={(pagination) => onChange({ pagination })}
          disabled={disabled}
        />
      )}

      {/* Sort Section */}
      {showSort && (
        <SortConfiguration
          sort={formData.sort || []}
          dimensionColumn={formData.dimension_column}
          metrics={formData.metrics}
          aggregateColumn={formData.aggregate_column}
          aggregateFunction={formData.aggregate_function}
          onChange={(sort) => onChange({ sort })}
          disabled={disabled}
        />
      )}
    </div>
  );
}
