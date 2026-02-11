'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Filter } from 'lucide-react';
import type { ChartFilter, TableColumn, ChartBuilderFormData } from '@/types/charts';
import { Combobox } from '@/components/ui/combobox';

interface ChartFiltersConfigurationProps {
  formData: ChartBuilderFormData;
  columns?: TableColumn[];
  onChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

const FILTER_OPERATORS = [
  { value: 'equals', label: 'Equals (=)', types: ['text', 'number', 'date'] },
  { value: 'not_equals', label: 'Not Equals (≠)', types: ['text', 'number', 'date'] },
  { value: 'greater_than', label: 'Greater Than (>)', types: ['number', 'date'] },
  { value: 'less_than', label: 'Less Than (<)', types: ['number', 'date'] },
  { value: 'greater_than_equal', label: 'Greater Than or Equal (≥)', types: ['number', 'date'] },
  { value: 'less_than_equal', label: 'Less Than or Equal (≤)', types: ['number', 'date'] },
  { value: 'contains', label: 'Contains', types: ['text'] },
  { value: 'not_contains', label: 'Does Not Contain', types: ['text'] },
  { value: 'in', label: 'In (comma-separated)', types: ['text', 'number'] },
  { value: 'not_in', label: 'Not In (comma-separated)', types: ['text', 'number'] },
  { value: 'is_null', label: 'Is Empty/Null', types: ['text', 'number', 'date'] },
  { value: 'is_not_null', label: 'Is Not Empty/Null', types: ['text', 'number', 'date'] },
];

export function ChartFiltersConfiguration({
  formData,
  columns = [],
  onChange,
  disabled = false,
}: ChartFiltersConfigurationProps) {
  const [showConfig, setShowConfig] = useState(false);

  const filters = formData.filters || [];

  const normalizedColumns =
    columns?.map((col) => ({
      column_name: col.column_name || col.name,
      data_type: col.data_type,
    })) || [];

  // Show loading state if columns are not available yet
  if (!columns && !disabled) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-4">
            <div className="text-sm text-gray-500">Loading columns...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getColumnDataType = (columnName: string): string => {
    const column = normalizedColumns.find((col) => col.column_name === columnName);
    if (!column) return 'text';

    const dataType = column.data_type.toLowerCase();
    if (
      ['integer', 'bigint', 'numeric', 'double precision', 'real', 'float', 'decimal'].includes(
        dataType
      )
    ) {
      return 'number';
    }
    if (['timestamp', 'date', 'datetime'].includes(dataType)) {
      return 'date';
    }
    return 'text';
  };

  const getAvailableOperators = (columnName: string) => {
    const dataType = getColumnDataType(columnName);
    return FILTER_OPERATORS.filter((op) => op.types.includes(dataType));
  };

  const addFilter = () => {
    const newFilter: ChartFilter = {
      column: '',
      operator: 'equals',
      value: '',
    };

    const updatedFilters = [...filters, newFilter];
    onChange({ filters: updatedFilters });
  };

  const updateFilter = (index: number, updates: Partial<ChartFilter>) => {
    const updatedFilters = filters.map((filter, i) =>
      i === index ? { ...filter, ...updates } : filter
    );
    onChange({ filters: updatedFilters });
  };

  const removeFilter = (index: number) => {
    const updatedFilters = filters.filter((_, i) => i !== index);
    onChange({ filters: updatedFilters });
  };

  const renderValueInput = (filter: ChartFilter, index: number) => {
    const dataType = getColumnDataType(filter.column);

    // For null checks, no value input needed
    if (filter.operator === 'is_null' || filter.operator === 'is_not_null') {
      return null;
    }

    // For 'in' and 'not_in' operators, show text input with comma-separated hint
    if (filter.operator === 'in' || filter.operator === 'not_in') {
      return (
        <Input
          type="text"
          placeholder="value1, value2, value3"
          value={filter.value || ''}
          onChange={(e) => updateFilter(index, { value: e.target.value })}
          disabled={disabled}
        />
      );
    }

    // Regular value input based on data type
    return (
      <Input
        type={dataType === 'number' ? 'number' : dataType === 'date' ? 'date' : 'text'}
        placeholder={`Enter ${dataType} value`}
        value={filter.value || ''}
        onChange={(e) => updateFilter(index, { value: e.target.value })}
        disabled={disabled}
      />
    );
  };

  if (!showConfig) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-600" />
              <span className="text-sm text-gray-600">Filters ({filters.length})</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(true)}
              disabled={disabled}
            >
              {filters.length > 0 ? 'Edit Filters' : 'Add Filters'}
            </Button>
          </div>
          {filters.length > 0 && (
            <div className="mt-3 space-y-1">
              {filters.map((filter, index) => (
                <div key={index} className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                  {filter.column} {filter.operator.replace(/_/g, ' ')} {filter.value}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Chart Filters
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setShowConfig(false)}>
            Done
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {filters.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Filter className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No filters configured</p>
            <p className="text-xs">Add filters to limit the data shown in your chart</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filters.map((filter, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-gray-700">Filter {index + 1}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFilter(index)}
                    disabled={disabled}
                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                {/* Column Selection */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Column</Label>
                  <Combobox
                    items={normalizedColumns.map((col) => ({
                      value: col.column_name,
                      label: `${col.column_name} (${col.data_type})`,
                    }))}
                    value={filter.column}
                    onValueChange={(value) => {
                      const availableOps = getAvailableOperators(value);
                      const defaultOp = availableOps.length > 0 ? availableOps[0].value : 'equals';
                      updateFilter(index, {
                        column: value,
                        operator: defaultOp as ChartFilter['operator'],
                        value: '',
                      });
                    }}
                    disabled={disabled}
                    searchPlaceholder="Search columns..."
                    placeholder="Select column"
                    compact
                  />
                </div>

                {/* Operator Selection */}
                {filter.column && (
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Operator</Label>
                    <Select
                      value={filter.operator}
                      onValueChange={(value) =>
                        updateFilter(index, {
                          operator: value as ChartFilter['operator'],
                          value: '', // Reset value when operator changes
                        })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select operator" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableOperators(filter.column).map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Value Input */}
                {filter.column && filter.operator && (
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Value</Label>
                    {renderValueInput(filter, index)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={addFilter}
          disabled={disabled}
          className="w-full"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Filter
        </Button>
      </CardContent>
    </Card>
  );
}
