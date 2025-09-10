'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChartFiltersConfiguration } from './ChartFiltersConfiguration';
import type { ChartBuilderFormData, TableColumn } from '@/types/charts';

interface SimpleNumberConfigurationProps {
  formData: ChartBuilderFormData;
  columns?: TableColumn[];
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

export function SimpleNumberConfiguration({
  formData,
  columns = [],
  onChange,
  disabled = false,
}: SimpleNumberConfigurationProps) {
  // Filter to numeric columns for most aggregations
  const numericColumns = columns.filter((col) =>
    ['integer', 'bigint', 'numeric', 'double precision', 'real', 'float', 'decimal'].includes(
      col.data_type.toLowerCase()
    )
  );

  // Get available columns based on aggregation function
  const getAvailableColumns = () => {
    // Count can work on any column or no column at all
    if (formData.aggregate_function === 'count') {
      return [...columns, { column_name: '*', data_type: 'any' }];
    }
    // Count distinct can work on all columns (no numeric filter)
    if (formData.aggregate_function === 'count_distinct') {
      return columns;
    }
    // Other aggregations need numeric columns
    return numericColumns;
  };

  const availableColumns = getAvailableColumns();

  return (
    <div className="space-y-6">
      {/* Metric Column */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Metric Column</Label>
        <Select
          value={formData.aggregate_column || ''}
          onValueChange={(value) => onChange({ aggregate_column: value === '*' ? null : value })}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select column to aggregate" />
          </SelectTrigger>
          <SelectContent>
            {availableColumns.map((col) => (
              <SelectItem key={col.column_name} value={col.column_name}>
                {col.column_name === '*'
                  ? '* (Count all rows)'
                  : `${col.column_name} (${col.data_type})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Aggregate Function */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Aggregate Function</Label>
        <Select
          value={formData.aggregate_function || ''}
          onValueChange={(value) => onChange({ aggregate_function: value })}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select aggregation function" />
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

      {/* Data Filters */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-900">Data Filters</h4>
        <p className="text-xs text-gray-500">
          Add conditions to limit which data appears in your chart
        </p>
        <ChartFiltersConfiguration
          formData={formData}
          columns={columns}
          onChange={onChange}
          disabled={disabled || !formData.aggregate_column}
        />
      </div>
    </div>
  );
}
