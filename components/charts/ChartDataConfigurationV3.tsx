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
import { BarChart3, Table, PieChart, LineChart, Hash, MapPin, Edit2, Check, X } from 'lucide-react';
import { useColumns, useColumnValues } from '@/hooks/api/useChart';
import { ChartTypeSelector } from '@/components/charts/ChartTypeSelector';
import { MetricsSelector } from '@/components/charts/MetricsSelector';
import { DatasetSelector } from '@/components/charts/DatasetSelector';
import { SimpleTableConfiguration } from '@/components/charts/SimpleTableConfiguration';
import type { ChartBuilderFormData, ChartMetric } from '@/types/charts';
import { generateAutoPrefilledConfig } from '@/lib/chartAutoPrefill';

interface ChartDataConfigurationV3Props {
  formData: ChartBuilderFormData;
  onChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

const AGGREGATE_FUNCTIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
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
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedValues.includes(val.toString())}
                        readOnly
                        className="w-4 h-4"
                      />
                      {val}
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
                {val}
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
  const [isEditingDataset, setIsEditingDataset] = useState(false);
  const { data: columns } = useColumns(formData.schema_name || null, formData.table_name || null);

  // Filter columns by type
  const normalizedColumns =
    columns?.map((col) => ({
      column_name: col.column_name || col.name,
      data_type: col.data_type,
    })) || [];

  const numericColumns = normalizedColumns.filter((col) =>
    ['integer', 'bigint', 'numeric', 'double precision', 'real', 'float', 'decimal'].includes(
      col.data_type.toLowerCase()
    )
  );

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
      description: formData.description,
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
      aggregate_function: 'sum', // Default aggregate function
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

    // Exit edit mode after successful change
    setIsEditingDataset(false);
  };

  // Handle canceling dataset edit
  const handleCancelDatasetEdit = () => {
    setIsEditingDataset(false);
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

  // Handle chart type changes with field cleanup and auto-prefill
  const handleChartTypeChange = (newChartType: string) => {
    // Fields to preserve across all chart types
    const preservedFields = {
      title: formData.title,
      description: formData.description,
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

      {/* Data Source - Inline Edit Pattern */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Data Source</Label>
        {!isEditingDataset ? (
          // Read-only view with edit button
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border w-full group hover:bg-gray-100 transition-colors">
            <Table className="h-5 w-5 text-gray-600" />
            <span className="font-mono text-sm flex-1">
              {formData.schema_name}.{formData.table_name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setIsEditingDataset(true)}
              disabled={disabled}
            >
              <Edit2 className="h-3 w-3 text-gray-500" />
            </Button>
          </div>
        ) : (
          // Edit mode with dataset selector
          <div className="space-y-2">
            <DatasetSelector
              schema_name={formData.schema_name}
              table_name={formData.table_name}
              onDatasetChange={handleDatasetChange}
              disabled={disabled}
              className="w-full"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelDatasetEdit}
                disabled={disabled}
                className="h-7 px-2 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
              <span className="text-xs text-gray-500">Select a dataset to continue</span>
            </div>
          </div>
        )}
      </div>

      {/* Computation Type - For bar/line/table charts */}
      {['bar', 'line', 'table'].includes(formData.chart_type || '') && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-900">Data Type</Label>
          <Select
            value={formData.computation_type || 'aggregated'}
            onValueChange={(value) => onChange({ computation_type: value as 'raw' | 'aggregated' })}
            disabled={disabled}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Select data type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="raw">Raw Data</SelectItem>
              <SelectItem value="aggregated">Aggregated Data</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

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
              if (formData.computation_type === 'raw') {
                onChange({ x_axis_column: value });
              } else {
                onChange({ dimension_column: value });
              }
            }}
            disabled={disabled}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Select X axis column" />
            </SelectTrigger>
            <SelectContent>
              {allColumns.map((col) => (
                <SelectItem key={col.column_name} value={col.column_name}>
                  {col.column_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Y Axis - For Raw Data or Single Metric Charts */}
      {formData.chart_type !== 'number' &&
        formData.chart_type !== 'map' &&
        (formData.computation_type === 'raw' ||
          (formData.computation_type === 'aggregated' &&
            !['bar', 'line', 'pie', 'table'].includes(formData.chart_type || ''))) && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-900">Y Axis</Label>
            <Select
              value={formData.aggregate_column || formData.y_axis_column}
              onValueChange={(value) => {
                if (formData.computation_type === 'raw') {
                  onChange({ y_axis_column: value });
                } else {
                  onChange({ aggregate_column: value });
                }
              }}
              disabled={disabled}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Select Y axis column" />
              </SelectTrigger>
              <SelectContent>
                {(formData.computation_type === 'raw' ? allColumns : numericColumns).map((col) => (
                  <SelectItem key={col.column_name} value={col.column_name}>
                    {col.column_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

      {/* Multiple Metrics for Bar, Line, and Table Charts */}
      {['bar', 'line', 'table'].includes(formData.chart_type || '') &&
        formData.computation_type === 'aggregated' && (
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

      {/* Extra Dimension - for stacked/grouped charts */}
      {['bar', 'line', 'pie'].includes(formData.chart_type || '') && (
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
              {allColumns.map((col) => (
                <SelectItem key={col.column_name} value={col.column_name}>
                  {col.column_name}
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
                        {col.column_name}
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
              className="w-full"
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
          <Label className="text-sm font-medium text-gray-900">Sort Metric</Label>
          <Select
            value={
              formData.sort && formData.sort.length > 0 ? formData.sort[0].direction : '__none__'
            }
            onValueChange={(value) => {
              if (value === '__none__') {
                onChange({ sort: [] });
              } else {
                // Sort by the appropriate column based on chart type and computation
                let sortColumn: string | undefined;

                if (formData.computation_type === 'raw') {
                  sortColumn = formData.y_axis_column;
                } else {
                  // For aggregated data with multiple metrics, use the first metric column
                  if (formData.metrics && formData.metrics.length > 0) {
                    sortColumn = formData.metrics[0].column || formData.dimension_column;
                  } else {
                    // Legacy single metric approach
                    sortColumn = formData.aggregate_column;
                  }
                }

                if (sortColumn) {
                  onChange({ sort: [{ column: sortColumn, direction: value as 'asc' | 'desc' }] });
                }
              }
            }}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="Select sort order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              <SelectItem value="asc">Asc</SelectItem>
              <SelectItem value="desc">Desc</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
