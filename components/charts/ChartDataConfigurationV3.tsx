'use client';

import React, { useState } from 'react';
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
import { BarChart3, PieChart, LineChart, Hash, MapPin, Check } from 'lucide-react';
import { useColumns, useColumnValues } from '@/hooks/api/useChart';
import { ChartTypeSelector } from '@/components/charts/ChartTypeSelector';
import { MetricsSelector } from '@/components/charts/MetricsSelector';
import { DatasetSelector } from '@/components/charts/DatasetSelector';
import { SimpleTableConfiguration } from '@/components/charts/SimpleTableConfiguration';
import { TimeGrainSelector } from '@/components/charts/TimeGrainSelector';
import type { ChartBuilderFormData, ChartMetric } from '@/types/charts';
import { generateAutoPrefilledConfig } from '@/lib/chartAutoPrefill';

interface ChartDataConfigurationV3Props {
  formData: ChartBuilderFormData;
  onChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

const AGGREGATE_FUNCTIONS = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'count_distinct', label: 'Count Distinct' },
];

const chartIcons = {
  bar: BarChart3,
  line: LineChart,
  pie: PieChart,
  number: Hash,
  map: MapPin,
};

// Component for searchable value input
const SearchableValueInput = React.memo(function SearchableValueInput({
  schema,
  table,
  column,
  operator,
  value,
  onChange,
  disabled,
}: {
  schema?: string;
  table?: string;
  column: string;
  operator: string;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}) {
  // Get column values using the warehouse API
  const { data: columnValues } = useColumnValues(schema || null, table || null, column || null);

  // For null checks, no value input needed
  if (operator === 'is_null' || operator === 'is_not_null') {
    return null;
  }

  // For 'in' and 'not_in' operators, show multiselect dropdown if we have column values
  if (operator === 'in' || operator === 'not_in') {
    if (columnValues && columnValues.length > 0) {
      const selectedValues = Array.isArray(value)
        ? value
        : value
          ? value.split(',').map((v: string) => v.trim())
          : [];

      return (
        <div className="h-8 flex-1">
          <Select
            value={selectedValues.length > 0 ? selectedValues.join(',') : ''}
            onValueChange={(selectedValue) => {
              // For multiselect, we'll handle this differently
              const currentSelected = selectedValues.includes(selectedValue)
                ? selectedValues.filter((v: string) => v !== selectedValue)
                : [...selectedValues, selectedValue];
              onChange(currentSelected.join(', '));
            }}
            disabled={disabled}
          >
            <SelectTrigger className="h-8">
              <SelectValue
                placeholder={
                  selectedValues.length > 0 ? `${selectedValues.length} selected` : 'Select values'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {columnValues
                .filter((val) => val !== null && val !== undefined && val.toString().trim() !== '')
                .slice(0, 100)
                .map((val) => (
                  <SelectItem key={val} value={val.toString()}>
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedValues.includes(val.toString())}
                        readOnly
                        className="w-4 h-4 flex-shrink-0"
                      />
                      <span className="truncate" title={val.toString()}>
                        {val}
                      </span>
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      );
    } else {
      // Fallback to text input for in/not_in when no column values
      return (
        <Input
          type="text"
          placeholder="value1, value2, value3"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-8 flex-1"
        />
      );
    }
  }

  // If we have column values, show searchable dropdown
  if (columnValues && columnValues.length > 0) {
    return (
      <Select
        value={value || ''}
        onValueChange={(selectedValue) => onChange(selectedValue)}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 flex-1">
          <SelectValue placeholder="Select or type value" />
        </SelectTrigger>
        <SelectContent>
          <div className="p-2">
            <Input
              type="text"
              placeholder="Type to search..."
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="h-8 mb-2"
            />
          </div>
          {columnValues
            .filter(
              (val) =>
                val !== null &&
                val !== undefined &&
                val.toString().trim() !== '' &&
                val
                  .toString()
                  .toLowerCase()
                  .includes((value || '').toString().toLowerCase())
            )
            .slice(0, 100)
            .map((val) => (
              <SelectItem key={val} value={val.toString()}>
                <span className="truncate" title={val.toString()}>
                  {val}
                </span>
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    );
  }

  // Fallback to regular input
  return (
    <Input
      type="text"
      placeholder="Enter value"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-8 flex-1"
    />
  );
});

export function ChartDataConfigurationV3({
  formData,
  onChange,
  disabled,
}: ChartDataConfigurationV3Props) {
  const { data: columns } = useColumns(formData.schema_name || null, formData.table_name || null);

  // Filter columns by type
  const normalizedColumns =
    columns?.map((col) => ({
      column_name: col.column_name || col.name,
      data_type: col.data_type,
      name: col.column_name || col.name,
    })) || [];

  const allColumns = normalizedColumns;

  // Handle dataset changes with complete form reset
  const handleDatasetChange = (schema_name: string, table_name: string) => {
    // Prevent unnecessary resets if dataset hasn't actually changed
    if (formData.schema_name === schema_name && formData.table_name === table_name) {
      setIsEditingDataset(false);
      return;
    }

    // Preserve only essential chart identity fields
    const preservedFields = {
      title: formData.title,
      chart_type: formData.chart_type,
      customizations: formData.customizations || {}, // Keep styling preferences
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
      aggregate_function: 'count', // Default aggregate function
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

  // Auto-prefill when columns are loaded
  React.useEffect(() => {
    if (columns && formData.schema_name && formData.table_name && formData.chart_type) {
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
        const autoConfig = generateAutoPrefilledConfig(formData.chart_type, normalizedColumns);
        if (Object.keys(autoConfig).length > 0) {
          console.log('🤖 [CHART-DATA-CONFIG-V3] Auto-prefilling configuration:', autoConfig);
          onChange(autoConfig);
        }
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
    const sortable = new Set<string>();
    if (formData.dimension_column) sortable.add(formData.dimension_column);
    if (formData.metrics?.length) {
      formData.metrics.forEach((m) => {
        const alias = m.alias || `${m.aggregation}(${m.column})`;
        sortable.add(alias);
      });
    } else if (formData.aggregate_column && formData.aggregate_function) {
      sortable.add(`${formData.aggregate_function}(${formData.aggregate_column})`);
    }

    const current = formData.sort?.[0]?.column;
    if (current && !sortable.has(current)) {
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
    const shouldHaveTimeGrain =
      ['bar', 'line'].includes(formData.chart_type || '') &&
      formData.dimension_column &&
      allColumns.find(
        (col) =>
          col.column_name === formData.dimension_column &&
          ['timestamp', 'timestamptz', 'date', 'datetime', 'time'].some((type) =>
            col.data_type.toLowerCase().includes(type)
          )
      );

    if (!shouldHaveTimeGrain && formData.time_grain) {
      onChange({ time_grain: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.chart_type, formData.dimension_column, allColumns]);

  // Handle chart type changes with field cleanup and auto-prefill
  const handleChartTypeChange = (newChartType: string) => {
    // Fields to preserve across all chart types
    const preservedFields = {
      title: formData.title,
      schema_name: formData.schema_name,
      table_name: formData.table_name,
      chart_type: newChartType as 'bar' | 'line' | 'pie' | 'number' | 'map',
    };

    // Auto-prefill for new chart type if we have columns
    let autoPrefilledFields = {};
    if (columns && columns.length > 0) {
      autoPrefilledFields = generateAutoPrefilledConfig(newChartType as any, normalizedColumns);
      console.log('🤖 [CHART-TYPE-CHANGE] Auto-prefilling for', newChartType, autoPrefilledFields);
    }

    // Chart type specific field handling
    let specificFields = {};

    switch (newChartType) {
      case 'number':
        // Big number only needs aggregate column and function
        // Limit metrics to only the first one (single metric)
        specificFields = {
          aggregate_column: formData.aggregate_column,
          aggregate_function: formData.aggregate_function,
          // Clear fields not needed for number charts
          x_axis_column: null,
          y_axis_column: null,
          dimension_column: null,
          extra_dimension_column: null,
          metrics: formData.metrics && formData.metrics.length > 0 ? [formData.metrics[0]] : [],
        };
        break;

      case 'pie':
        // Pie charts can use dimension, metrics, and extra dimension like bar/line charts
        // But limit metrics to only the first one (single metric)
        specificFields = {
          x_axis_column: formData.x_axis_column,
          y_axis_column: null, // No Y-axis for pie charts
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
        break;

      case 'bar':
      case 'line':
        // Bar and line charts can use most fields and metrics, default to aggregated
        specificFields = {
          x_axis_column: formData.x_axis_column,
          y_axis_column: formData.y_axis_column,
          dimension_column: formData.dimension_column,
          aggregate_column: formData.aggregate_column,
          aggregate_function: formData.aggregate_function,
          extra_dimension_column: formData.extra_dimension_column,
          metrics: formData.metrics,
          computation_type: formData.computation_type || 'aggregated',
        };
        break;

      case 'table':
        // Tables default to aggregated data like other charts
        specificFields = {
          computation_type: formData.computation_type || 'aggregated',
          x_axis_column: formData.x_axis_column,
          y_axis_column: null, // Tables don't need Y axis
          dimension_column: formData.dimension_column,
          aggregate_column: formData.aggregate_column,
          aggregate_function: formData.aggregate_function,
          extra_dimension_column: formData.extra_dimension_column,
          metrics: formData.metrics, // Preserve all metrics
        };
        break;
    }

    // Apply the changes with auto-prefill
    onChange({
      ...preservedFields,
      ...autoPrefilledFields,
      ...specificFields,
      // Preserve other settings like filters, customizations, etc.
      filters: formData.filters,
      customizations: formData.customizations,
      sort: formData.sort,
      pagination: formData.pagination,
    });
  };

  return (
    <div className="space-y-4">
      {/* Chart Type Selector - Interactive */}
      <ChartTypeSelector
        value={formData.chart_type}
        onChange={handleChartTypeChange}
        disabled={disabled}
      />

      {/* Data Source - Simple Search Dropdown */}
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

      {/* X Axis / Dimension */}
      {formData.chart_type !== 'number' && formData.chart_type !== 'map' && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-900">
            {formData.chart_type === 'table'
              ? 'Group By Column'
              : formData.chart_type === 'pie'
                ? 'Dimension'
                : 'X Axis'}
          </Label>
          <Select
            value={formData.dimension_column || formData.x_axis_column}
            onValueChange={(value) => {
              onChange({ dimension_column: value });
            }}
            disabled={disabled}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Select X axis column" />
            </SelectTrigger>
            <SelectContent>
              {allColumns.map((col) => (
                <SelectItem key={col.column_name} value={col.column_name}>
                  <span className="truncate" title={col.column_name}>
                    {col.column_name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Time Grain - For Bar and Line Charts with DateTime X-axis */}
      {['bar', 'line'].includes(formData.chart_type || '') &&
        formData.dimension_column &&
        allColumns.find(
          (col) =>
            col.column_name === formData.dimension_column &&
            ['timestamp', 'timestamptz', 'date', 'datetime', 'time'].some((type) =>
              col.data_type.toLowerCase().includes(type)
            )
        ) && (
          <TimeGrainSelector
            value={formData.time_grain || null}
            onChange={(value) => onChange({ time_grain: value })}
            disabled={disabled}
          />
        )}

      {/* Y Axis - For Raw Data or Single Metric Charts (but NOT tables) */}
      {formData.chart_type !== 'number' &&
        formData.chart_type !== 'map' &&
        formData.chart_type !== 'table' &&
        !['bar', 'line', 'pie'].includes(formData.chart_type || '') && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-900">Y Axis</Label>
            <Select
              value={formData.aggregate_column || formData.y_axis_column}
              onValueChange={(value) => {
                onChange({ aggregate_column: value });
              }}
              disabled={disabled}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Select Y axis column" />
              </SelectTrigger>
              <SelectContent>
                {allColumns.map((col) => {
                  const isDisabled =
                    formData.computation_type === 'aggregated' &&
                    formData.aggregate_function !== 'count_distinct' &&
                    ![
                      'integer',
                      'bigint',
                      'numeric',
                      'double precision',
                      'real',
                      'float',
                      'decimal',
                    ].includes(col.data_type.toLowerCase());

                  return (
                    <SelectItem
                      key={col.column_name}
                      value={col.column_name}
                      disabled={isDisabled}
                      className={isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                      <span
                        className={`truncate ${isDisabled ? 'text-gray-400' : ''}`}
                        title={
                          isDisabled
                            ? `${col.column_name} (Not compatible with ${formData.aggregate_function})`
                            : col.column_name
                        }
                      >
                        {col.column_name}
                        {isDisabled && (
                          <span className="ml-2 text-xs text-gray-400">(Not compatible)</span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

      {/* Multiple Metrics for Bar, Line, and Table Charts */}
      {((['bar', 'line'].includes(formData.chart_type || '') &&
        formData.computation_type === 'aggregated') ||
        formData.chart_type === 'table') && (
        <MetricsSelector
          metrics={formData.metrics || []}
          onChange={(metrics: ChartMetric[]) => onChange({ metrics })}
          columns={normalizedColumns}
          disabled={disabled}
          chartType={formData.chart_type}
        />
      )}

      {/* Single Metric for Pie Charts */}
      {formData.chart_type === 'pie' && formData.computation_type === 'aggregated' && (
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
      {formData.chart_type === 'number' && (
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

      {/* Extra Dimension - for stacked/grouped charts AND tables */}
      {['bar', 'line', 'pie', 'table'].includes(formData.chart_type || '') && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-900">Extra Dimension</Label>
          <Select
            value={formData.extra_dimension_column || 'none'}
            onValueChange={(value) =>
              onChange({ extra_dimension_column: value === 'none' ? undefined : value })
            }
            disabled={disabled}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue
                placeholder={`Select dimension (for ${formData.chart_type === 'bar' ? 'stacked bar' : 'multi-line chart'})`}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {allColumns
                .filter((col) => {
                  // Only exclude the X-axis column (dimension column in aggregated mode)
                  const xAxisColumn = formData.dimension_column;

                  return col.column_name !== xAxisColumn;
                })
                .map((col) => (
                  <SelectItem key={col.column_name} value={col.column_name}>
                    <span className="truncate" title={col.column_name}>
                      {col.column_name}
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Filters Section */}
      {formData.chart_type !== 'map' && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-900">Data Filters</Label>
          <div className="space-y-2">
            {(formData.filters || []).map((filter, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Select
                  value={filter.column}
                  onValueChange={(value) => {
                    const newFilters = [...(formData.filters || [])];
                    newFilters[index] = { ...filter, column: value };
                    onChange({ filters: newFilters });
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8 flex-1">
                    <SelectValue placeholder="Column" />
                  </SelectTrigger>
                  <SelectContent>
                    {allColumns.map((col) => (
                      <SelectItem key={col.column_name} value={col.column_name}>
                        <span className="truncate" title={col.column_name}>
                          {col.column_name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filter.operator}
                  onValueChange={(value) => {
                    const newFilters = [...(formData.filters || [])];
                    newFilters[index] = { ...filter, operator: value as any };
                    onChange({ filters: newFilters });
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue placeholder="Operator" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="not_equals">Not equals</SelectItem>
                    <SelectItem value="greater_than">Greater than (&gt;)</SelectItem>
                    <SelectItem value="greater_than_equal">Greater or equal (&gt;=)</SelectItem>
                    <SelectItem value="less_than">Less than (&lt;)</SelectItem>
                    <SelectItem value="less_than_equal">Less or equal (&lt;=)</SelectItem>
                    <SelectItem value="like">Like</SelectItem>
                    <SelectItem value="like_case_insensitive">Like (case insensitive)</SelectItem>
                    <SelectItem value="in">In</SelectItem>
                    <SelectItem value="not_in">Not in</SelectItem>
                    <SelectItem value="is_null">Is null</SelectItem>
                    <SelectItem value="is_not_null">Is not null</SelectItem>
                  </SelectContent>
                </Select>

                <SearchableValueInput
                  schema={formData.schema_name}
                  table={formData.table_name}
                  column={filter.column}
                  operator={filter.operator}
                  value={filter.value}
                  onChange={(value) => {
                    const newFilters = [...(formData.filters || [])];
                    newFilters[index] = { ...filter, value };
                    onChange({ filters: newFilters });
                  }}
                  disabled={disabled}
                />

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    const newFilters = (formData.filters || []).filter((_, i) => i !== index);
                    onChange({ filters: newFilters });
                  }}
                  disabled={disabled}
                >
                  ✕
                </Button>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newFilters = [
                  ...(formData.filters || []),
                  { column: '', operator: 'equals' as any, value: '' },
                ];
                onChange({ filters: newFilters });
              }}
              disabled={disabled}
              className="w-full border-dashed bg-gray-900 text-white hover:bg-gray-700 hover:text-white border-gray-900"
            >
              + Add Filter
            </Button>
          </div>
        </div>
      )}

      {/* Pagination Section */}
      {formData.chart_type !== 'map' && formData.chart_type !== 'number' && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-900">Pagination</Label>
          <Select
            value={
              formData.pagination?.enabled
                ? (formData.pagination?.page_size || 50).toString()
                : '__none__'
            }
            onValueChange={(value) => {
              if (value === '__none__') {
                onChange({ pagination: { enabled: false, page_size: 50 } });
              } else {
                onChange({
                  pagination: {
                    enabled: true,
                    page_size: parseInt(value),
                  },
                });
              }
            }}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="Select pagination" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No pagination</SelectItem>
              <SelectItem value="20">20 items</SelectItem>
              <SelectItem value="50">50 items</SelectItem>
              <SelectItem value="100">100 items</SelectItem>
              <SelectItem value="200">200 items</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Sort Section */}
      {formData.chart_type !== 'map' && formData.chart_type !== 'number' && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-900">Sort Configuration</Label>

          {(() => {
            // Build sortable options list
            const sortableOptions: Array<{
              value: string;
              label: string;
              type: 'column' | 'metric';
            }> = [];

            // Add dimension column if available
            if (formData.dimension_column) {
              sortableOptions.push({
                value: formData.dimension_column,
                label: formData.dimension_column,
                type: 'column',
              });
            }

            // Add configured metrics using their aliases
            if (formData.metrics && formData.metrics.length > 0) {
              formData.metrics.forEach((metric) => {
                if (metric.alias) {
                  sortableOptions.push({
                    value: metric.alias,
                    label: metric.alias,
                    type: 'metric',
                  });
                }
              });
            } else if (formData.aggregate_column && formData.aggregate_function) {
              // Legacy single metric - create an alias for it
              const defaultAlias = `${formData.aggregate_function}(${formData.aggregate_column})`;
              sortableOptions.push({
                value: defaultAlias,
                label: defaultAlias,
                type: 'metric',
              });
            }

            // Get current sort values
            const currentSort = formData.sort && formData.sort.length > 0 ? formData.sort[0] : null;
            const currentColumn = currentSort?.column || '__none__';
            const currentDirection = currentSort?.direction || 'asc';

            // Check if current sort column is still available
            const isCurrentColumnAvailable =
              currentColumn === '__none__' ||
              sortableOptions.some((opt) => opt.value === currentColumn);

            if (sortableOptions.length > 0) {
              return (
                <div className="grid grid-cols-2 gap-2">
                  {/* Column/Metric Selection */}
                  <Select
                    value={isCurrentColumnAvailable ? currentColumn : '__none__'}
                    onValueChange={(value) => {
                      if (value === '__none__') {
                        onChange({ sort: [] });
                      } else {
                        onChange({
                          sort: [
                            {
                              column: value,
                              direction: currentDirection,
                            },
                          ],
                        });
                      }
                    }}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue placeholder="Select column to sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {sortableOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                                option.type === 'column'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {option.type === 'column' ? 'COL' : 'METRIC'}
                            </span>
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Direction Selection */}
                  <Select
                    value={currentSort ? currentDirection : 'asc'}
                    onValueChange={(value) => {
                      if (currentSort && currentColumn !== '__none__') {
                        onChange({
                          sort: [
                            {
                              column: currentColumn,
                              direction: value as 'asc' | 'desc',
                            },
                          ],
                        });
                      }
                    }}
                    disabled={disabled || !currentSort || currentColumn === '__none__'}
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue placeholder="Sort direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            } else {
              return (
                <div className="text-sm text-gray-500">
                  Configure metrics first to enable sorting
                </div>
              );
            }
          })()}
        </div>
      )}
    </div>
  );
}
