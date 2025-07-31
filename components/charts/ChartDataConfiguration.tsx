'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useSchemas, useTables, useColumns } from '@/hooks/api/useChart';
import type { ChartBuilderFormData } from '@/types/charts';

interface ChartDataConfigurationProps {
  formData: ChartBuilderFormData;
  onChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

const AGGREGATE_FUNCTIONS = [
  { value: 'sum', label: 'SUM' },
  { value: 'avg', label: 'AVG' },
  { value: 'count', label: 'COUNT' },
  { value: 'min', label: 'MIN' },
  { value: 'max', label: 'MAX' },
  { value: 'count_distinct', label: 'COUNT DISTINCT' },
];

export function ChartDataConfiguration({
  formData,
  onChange,
  disabled,
}: ChartDataConfigurationProps) {
  const { data: schemas } = useSchemas();
  const { data: tables } = useTables(formData.schema_name || null);
  const { data: columns } = useColumns(formData.schema_name || null, formData.table_name || null);

  // Filter columns by type
  const normalizedColumns =
    columns?.map((col) => ({
      column_name: col.column_name || col.name,
      data_type: col.data_type,
    })) || [];

  const numericColumns = normalizedColumns.filter((col) =>
    ['integer', 'bigint', 'numeric', 'double precision', 'real'].includes(
      col.data_type.toLowerCase()
    )
  );

  const allColumns = normalizedColumns;

  const handleSchemaChange = (schema_name: string) => {
    onChange({
      schema_name,
      table_name: undefined,
      x_axis_column: undefined,
      y_axis_column: undefined,
      dimension_column: undefined,
      aggregate_column: undefined,
      aggregate_function: undefined,
      extra_dimension_column: undefined,
    });
  };

  const handleTableChange = (table_name: string) => {
    const updates: any = {
      table_name,
      x_axis_column: undefined,
      y_axis_column: undefined,
      dimension_column: undefined,
      aggregate_column: undefined,
      aggregate_function: undefined,
      extra_dimension_column: undefined,
    };

    // For number charts, always set computation_type to aggregated
    if (formData.chart_type === 'number') {
      updates.computation_type = 'aggregated';
    }

    onChange(updates);
  };

  const handleComputationTypeChange = (computation_type: 'raw' | 'aggregated') => {
    onChange({
      computation_type,
      x_axis_column: undefined,
      y_axis_column: undefined,
      dimension_column: undefined,
      aggregate_column: undefined,
      aggregate_function: undefined,
      extra_dimension_column: undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Schema Selection */}
      <div className="space-y-2">
        <Label htmlFor="schema">Schema</Label>
        <Select value={formData.schema_name} onValueChange={handleSchemaChange} disabled={disabled}>
          <SelectTrigger id="schema">
            <SelectValue placeholder="Select a schema" />
          </SelectTrigger>
          <SelectContent>
            {schemas?.map((schema: string) => (
              <SelectItem key={schema} value={schema}>
                {schema}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table Selection */}
      <div className="space-y-2">
        <Label htmlFor="table">Table</Label>
        <Select
          value={formData.table_name}
          onValueChange={handleTableChange}
          disabled={disabled || !formData.schema_name}
        >
          <SelectTrigger id="table">
            <SelectValue placeholder="Select a table" />
          </SelectTrigger>
          <SelectContent>
            {tables?.map((table: any) => {
              const tableName = typeof table === 'string' ? table : table.table_name;
              return (
                <SelectItem key={tableName} value={tableName}>
                  {tableName}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Computation Type - Hide for number charts as they're always aggregated */}
      {formData.table_name && formData.chart_type !== 'number' && (
        <div className="space-y-2">
          <Label>Data Type</Label>
          <RadioGroup
            value={formData.computation_type}
            onValueChange={(value) => handleComputationTypeChange(value as 'raw' | 'aggregated')}
          >
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem value="raw" id="raw" />
              <Label htmlFor="raw">Raw Data</Label>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem value="aggregated" id="aggregated" />
              <Label htmlFor="aggregated">Aggregated Data</Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {/* Special handling for number charts - always aggregated */}
      {formData.chart_type === 'number' && formData.table_name && columns && (
        <>
          <div className="space-y-2">
            <Label htmlFor="aggregate-col">Metric Column</Label>
            <Select
              value={formData.aggregate_column}
              onValueChange={(value) => onChange({ aggregate_column: value })}
            >
              <SelectTrigger id="aggregate-col">
                <SelectValue placeholder="Select column to aggregate" />
              </SelectTrigger>
              <SelectContent>
                {numericColumns?.map((col) => (
                  <SelectItem key={col.column_name} value={col.column_name}>
                    {col.column_name} ({col.data_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aggregate-func">Aggregate Function</Label>
            <Select
              value={formData.aggregate_function}
              onValueChange={(value) => onChange({ aggregate_function: value })}
            >
              <SelectTrigger id="aggregate-func">
                <SelectValue placeholder="Select function" />
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
        </>
      )}

      {/* Column Configuration based on computation type */}
      {formData.chart_type !== 'number' && formData.computation_type === 'raw' && columns && (
        <>
          <div className="space-y-2">
            <Label htmlFor="x-axis">X-Axis Column</Label>
            <Select
              value={formData.x_axis_column}
              onValueChange={(value) => onChange({ x_axis_column: value })}
            >
              <SelectTrigger id="x-axis">
                <SelectValue placeholder="Select X-axis column" />
              </SelectTrigger>
              <SelectContent>
                {allColumns.map((col) => (
                  <SelectItem key={col.column_name} value={col.column_name}>
                    {col.column_name} ({col.data_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="y-axis">Y-Axis Column</Label>
            <Select
              value={formData.y_axis_column}
              onValueChange={(value) => onChange({ y_axis_column: value })}
            >
              <SelectTrigger id="y-axis">
                <SelectValue placeholder="Select Y-axis column (numeric)" />
              </SelectTrigger>
              <SelectContent>
                {numericColumns?.map((col) => (
                  <SelectItem key={col.column_name} value={col.column_name}>
                    {col.column_name} ({col.data_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {!['number'].includes(formData.chart_type as string) &&
        formData.computation_type === 'aggregated' &&
        columns && (
          <>
            {/* Only show dimension column for non-number charts */}
            {!['number'].includes(formData.chart_type as string) && (
              <div className="space-y-2">
                <Label htmlFor="dimension">Dimension Column</Label>
                <Select
                  value={formData.dimension_column}
                  onValueChange={(value) => onChange({ dimension_column: value })}
                >
                  <SelectTrigger id="dimension">
                    <SelectValue placeholder="Select grouping column" />
                  </SelectTrigger>
                  <SelectContent>
                    {allColumns.map((col) => (
                      <SelectItem key={col.column_name} value={col.column_name}>
                        {col.column_name} ({col.data_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="aggregate-col">Aggregate Column</Label>
              <Select
                value={formData.aggregate_column}
                onValueChange={(value) => onChange({ aggregate_column: value })}
              >
                <SelectTrigger id="aggregate-col">
                  <SelectValue placeholder="Select column to aggregate" />
                </SelectTrigger>
                <SelectContent>
                  {numericColumns?.map((col) => (
                    <SelectItem key={col.column_name} value={col.column_name}>
                      {col.column_name} ({col.data_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aggregate-func">Aggregate Function</Label>
              <Select
                value={formData.aggregate_function}
                onValueChange={(value) => onChange({ aggregate_function: value })}
              >
                <SelectTrigger id="aggregate-func">
                  <SelectValue placeholder="Select function" />
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
          </>
        )}

      {/* Extra Dimension (optional) */}
      {formData.chart_type !== 'pie' &&
        formData.chart_type !== 'number' &&
        formData.chart_type !== 'map' &&
        ((formData.computation_type === 'raw' && formData.y_axis_column) ||
          (formData.computation_type === 'aggregated' && formData.aggregate_column)) && (
          <div className="space-y-2">
            <Label htmlFor="extra-dimension">
              Extra Dimension (Optional) - For grouped/stacked charts
            </Label>
            <Select
              value={formData.extra_dimension_column || ''}
              onValueChange={(value) =>
                onChange({ extra_dimension_column: value === 'none' ? undefined : value })
              }
            >
              <SelectTrigger id="extra-dimension">
                <SelectValue placeholder="Select additional grouping" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {allColumns
                  .filter(
                    (col) =>
                      col.column_name !== formData.x_axis_column &&
                      col.column_name !== formData.y_axis_column &&
                      col.column_name !== formData.dimension_column &&
                      col.column_name !== formData.aggregate_column
                  )
                  .map((col) => (
                    <SelectItem key={col.column_name} value={col.column_name}>
                      {col.column_name} ({col.data_type})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
    </div>
  );
}
