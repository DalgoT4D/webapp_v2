'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { MapPin, Table } from 'lucide-react';
import { useColumns } from '@/hooks/api/useChart';
import type { ChartBuilderFormData } from '@/types/charts';

interface MapDataConfigurationV3Props {
  formData: ChartBuilderFormData;
  onFormDataChange: (updates: Partial<ChartBuilderFormData>) => void;
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

export function MapDataConfigurationV3({
  formData,
  onFormDataChange,
  disabled,
}: MapDataConfigurationV3Props) {
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

  return (
    <div className="space-y-4">
      {/* Chart Type - Show readonly */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Chart Type</Label>
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border w-full">
          <MapPin className="h-5 w-5 text-blue-600" />
          <span className="font-medium">Map</span>
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

      {/* Geographic Column */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Geographic Column</Label>
        <Select
          value={formData.geographic_column}
          onValueChange={(value) => onFormDataChange({ geographic_column: value })}
          disabled={disabled}
        >
          <SelectTrigger className="h-10 w-full">
            <SelectValue placeholder="Select geographic column" />
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

      {/* Value Column */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Value Column</Label>
        <Select
          value={formData.value_column || formData.aggregate_column}
          onValueChange={(value) =>
            onFormDataChange({
              value_column: value,
              aggregate_column: value,
            })
          }
          disabled={disabled}
        >
          <SelectTrigger className="h-10 w-full">
            <SelectValue placeholder="Select value column" />
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

      {/* Aggregate Function */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Aggregate Function</Label>
        <Select
          value={formData.aggregate_function}
          onValueChange={(value) => onFormDataChange({ aggregate_function: value })}
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
    </div>
  );
}
