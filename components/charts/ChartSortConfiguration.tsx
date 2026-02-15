'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { ChartSort, TableColumn, ChartBuilderFormData } from '@/types/charts';
import { Combobox } from '@/components/ui/combobox';

interface ChartSortConfigurationProps {
  formData: ChartBuilderFormData;
  columns?: TableColumn[];
  onChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

export function ChartSortConfiguration({
  formData,
  columns = [],
  onChange,
  disabled = false,
}: ChartSortConfigurationProps) {
  const [showConfig, setShowConfig] = useState(false);

  const sort = formData.sort || [];

  const normalizedColumns =
    columns?.map((col) => ({
      column_name: col.column_name || col.name,
      data_type: col.data_type,
    })) || [];

  const columnItems = React.useMemo(
    () =>
      normalizedColumns.map((col) => ({
        value: col.column_name,
        label: `${col.column_name} (${col.data_type})`,
      })),
    [normalizedColumns]
  );

  const addSort = () => {
    const newSort: ChartSort = {
      column: '',
      direction: 'asc',
    };

    const updatedSort = [...sort, newSort];
    onChange({ sort: updatedSort });
  };

  const updateSort = (index: number, updates: Partial<ChartSort>) => {
    const updatedSort = sort.map((sortItem, i) =>
      i === index ? { ...sortItem, ...updates } : sortItem
    );
    onChange({ sort: updatedSort });
  };

  const removeSort = (index: number) => {
    const updatedSort = sort.filter((_, i) => i !== index);
    onChange({ sort: updatedSort });
  };

  const moveSort = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sort.length) return;

    const updatedSort = [...sort];
    [updatedSort[index], updatedSort[newIndex]] = [updatedSort[newIndex], updatedSort[index]];
    onChange({ sort: updatedSort });
  };

  const getSortIcon = (direction: ChartSort['direction']) => {
    return direction === 'asc' ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  };

  if (!showConfig) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-gray-600" />
              <span className="text-sm text-gray-600">Sorting ({sort.length})</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(true)}
              disabled={disabled}
            >
              {sort.length > 0 ? 'Edit Sorting' : 'Add Sorting'}
            </Button>
          </div>
          {sort.length > 0 && (
            <div className="mt-3 space-y-1">
              {sort.map((sortItem, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded"
                >
                  <span className="text-gray-400">{index + 1}.</span>
                  {getSortIcon(sortItem.direction)}
                  <span>{sortItem.column}</span>
                  <span className="text-gray-400">({sortItem.direction})</span>
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
            <ArrowUpDown className="h-4 w-4" />
            Chart Sorting
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setShowConfig(false)}>
            Done
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sort.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <ArrowUpDown className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No sorting configured</p>
            <p className="text-xs">Add sort criteria to order the data in your chart</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sort.map((sortItem, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-medium text-gray-700">Sort {index + 1}</Label>
                    {sort.length > 1 && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        Priority {index + 1}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Move buttons */}
                    {sort.length > 1 && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveSort(index, 'up')}
                          disabled={disabled || index === 0}
                          className="h-6 w-6 p-0"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveSort(index, 'down')}
                          disabled={disabled || index === sort.length - 1}
                          className="h-6 w-6 p-0"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    {/* Remove button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSort(index)}
                      disabled={disabled}
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Column Selection */}
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Column</Label>
                    <Combobox
                      items={columnItems}
                      value={sortItem.column}
                      onValueChange={(value) => updateSort(index, { column: value })}
                      disabled={disabled}
                      searchPlaceholder="Search columns..."
                      placeholder="Select column"
                      compact
                    />
                  </div>

                  {/* Direction Selection */}
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Direction</Label>
                    <Select
                      value={sortItem.direction}
                      onValueChange={(value) =>
                        updateSort(index, { direction: value as ChartSort['direction'] })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">
                          <div className="flex items-center gap-2">
                            <ArrowUp className="h-3 w-3" />
                            Ascending (A-Z, 1-9)
                          </div>
                        </SelectItem>
                        <SelectItem value="desc">
                          <div className="flex items-center gap-2">
                            <ArrowDown className="h-3 w-3" />
                            Descending (Z-A, 9-1)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}

            {sort.length > 1 && (
              <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
                <p className="font-medium text-blue-700 mb-1">Sort Priority</p>
                <p>Data will be sorted by the first criteria, then by the second, and so on.</p>
              </div>
            )}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={addSort}
          disabled={disabled}
          className="w-full"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Sort Criteria
        </Button>

        {sort.length === 0 && (
          <div className="text-xs text-gray-500 space-y-1">
            <p>• Sorting controls the order of data points in your chart</p>
            <p>• Multiple sort criteria are applied in the order they appear</p>
            <p>• Numerical columns sort by value, text columns sort alphabetically</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
