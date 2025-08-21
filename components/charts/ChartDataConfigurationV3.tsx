'use client';

import React from 'react';
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
import { BarChart3, Table, PieChart, LineChart, Hash, MapPin } from 'lucide-react';
import { useSchemas, useTables, useColumns, useChartDataPreview } from '@/hooks/api/useChart';
import type { ChartBuilderFormData } from '@/types/charts';

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

const chartLabels = {
  bar: 'Bar Chart',
  line: 'Line Chart',
  pie: 'Pie Chart',
  number: 'Number',
  map: 'Map',
};

// Component for searchable value input
function SearchableValueInput({
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
  // Get column values from preview data instead of separate API call
  // This avoids authentication issues and uses existing data
  const { data: previewData } = useChartDataPreview(
    schema && table
      ? {
          chart_type: 'bar',
          computation_type: 'raw',
          schema_name: schema,
          table_name: table,
          x_axis: column,
          y_axis: column,
        }
      : null,
    1,
    500 // Get more rows to have better distinct values
  );

  // Extract distinct values from preview data
  const columnValues = React.useMemo(() => {
    if (!previewData?.data || !column) return null;

    const distinctValues = new Set<string>();
    previewData.data.forEach((row: any) => {
      const value = row[column];
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        distinctValues.add(String(value));
      }
    });

    return Array.from(distinctValues).sort();
  }, [previewData, column]);

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
}

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
    })) || [];

  const numericColumns = normalizedColumns.filter((col) =>
    ['integer', 'bigint', 'numeric', 'double precision', 'real', 'float', 'decimal'].includes(
      col.data_type.toLowerCase()
    )
  );

  const allColumns = normalizedColumns;

  const IconComponent = chartIcons[formData.chart_type as keyof typeof chartIcons] || BarChart3;

  return (
    <div className="space-y-4">
      {/* Chart Type - Show readonly */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Chart Type</Label>
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border w-full">
          <IconComponent className="h-5 w-5 text-blue-600" />
          <span className="font-medium">
            {chartLabels[formData.chart_type as keyof typeof chartLabels] || formData.chart_type}
          </span>
        </div>
      </div>

      {/* Data Source - Show readonly */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Data Source</Label>
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border w-full">
          <Table className="h-5 w-5 text-gray-600" />
          <span className="font-mono text-sm">
            {formData.schema_name}.{formData.table_name}
          </span>
        </div>
      </div>

      {/* X Axis */}
      {formData.chart_type !== 'number' && formData.chart_type !== 'map' && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-900">X Axis</Label>
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

      {/* Y Axis */}
      {formData.chart_type !== 'number' && formData.chart_type !== 'map' && (
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

      {/* For number charts */}
      {formData.chart_type === 'number' && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-900">Metric Column</Label>
          <Select
            value={formData.aggregate_column}
            onValueChange={(value) => onChange({ aggregate_column: value })}
            disabled={disabled}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Select metric column" />
            </SelectTrigger>
            <SelectContent>
              {numericColumns.map((col) => (
                <SelectItem key={col.column_name} value={col.column_name}>
                  {col.column_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Aggregate Function */}
      {formData.chart_type !== 'map' && formData.computation_type !== 'raw' && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-900">Aggregate Function</Label>
          <Select
            value={formData.aggregate_function}
            onValueChange={(value) => onChange({ aggregate_function: value })}
            disabled={disabled}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Select aggregate function" />
            </SelectTrigger>
            <SelectContent>
              {AGGREGATE_FUNCTIONS.map((func) => (
                <SelectItem key={func.value} value={func.value}>
                  {func.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Extra Dimension - for stacked/grouped charts */}
      {['bar', 'line'].includes(formData.chart_type || '') && (
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
      {formData.chart_type !== 'map' && (
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
      {formData.chart_type !== 'map' && (
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
                // Sort by the y-axis/metric column
                const sortColumn =
                  formData.computation_type === 'raw'
                    ? formData.y_axis_column
                    : formData.aggregate_column;

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
