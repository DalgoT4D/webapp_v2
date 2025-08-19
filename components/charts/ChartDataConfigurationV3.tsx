'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BarChart3, Table, PieChart, LineChart, Hash, MapPin } from 'lucide-react';
import { useSchemas, useTables, useColumns } from '@/hooks/api/useChart';
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
    </div>
  );
}
