'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Combobox, highlightText } from '@/components/ui/combobox';
import { ColumnTypeIcon } from '@/lib/columnTypeIcons';
import { TooltipLabel } from '@/components/charts/styling/TooltipLabel';
import type { ChartConfigPatch } from '@/components/charts/logic/type-switch';
import type { ChartBuilderFormData, ChartFilter } from '@/types/charts';
import type { ColumnItem, NormalizedColumn } from './column-types';
import { FilterOperatorSelect } from './FilterOperatorSelect';
import { FilterValueInput } from './FilterValueInput';

interface FiltersSectionProps {
  formData: ChartBuilderFormData;
  onChange: (patch: ChartConfigPatch) => void;
  disabled?: boolean;
  normalizedColumns: NormalizedColumn[];
  columnItems: ColumnItem[];
}

/** "Data Filters": one row per filter (column, operator, value, remove) plus "+ Add Filter". */
export function FiltersSection({
  formData,
  onChange,
  disabled,
  normalizedColumns,
  columnItems,
}: FiltersSectionProps) {
  const filterIds = useRef<string[]>([]);
  const nextFilterId = useRef(0);

  // Keep filter IDs in sync with formData.filters length
  const filters = formData.filters || [];
  while (filterIds.current.length < filters.length) {
    filterIds.current.push(`filter-${nextFilterId.current++}`);
  }
  if (filterIds.current.length > filters.length) {
    filterIds.current.length = filters.length;
  }

  const updateFilter = (index: number, filter: ChartFilter) => {
    const newFilters = [...(formData.filters || [])];
    newFilters[index] = filter;
    onChange({ filters: newFilters });
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-900">Data Filters</Label>
      <div className="space-y-2">
        {filters.map((filter, index) => {
          const filterId = filterIds.current[index];
          const filterColumnDataType = normalizedColumns.find(
            (col) => col.column_name === filter.column
          )?.data_type;

          return (
            <div key={filterId} className="flex gap-2 items-center">
              <Combobox
                id={`chart-filter-column-${index}`}
                items={columnItems}
                value={filter.column}
                onValueChange={(value) => {
                  const newColDataType = normalizedColumns.find(
                    (col) => col.column_name === value
                  )?.data_type;
                  updateFilter(index, {
                    ...filter,
                    column: value,
                    value: '',
                    ...(newColDataType && { data_type: newColDataType }),
                  });
                }}
                disabled={disabled}
                searchPlaceholder="Search columns..."
                placeholder="Column"
                compact
                className="flex-1"
                renderItem={(item, _isSelected, searchQuery) => (
                  <div className="flex items-center gap-2 min-w-0">
                    <ColumnTypeIcon dataType={item.data_type} className="w-4 h-4" />
                    <TooltipLabel label={item.label}>
                      {highlightText(item.label, searchQuery)}
                    </TooltipLabel>
                  </div>
                )}
              />

              <FilterOperatorSelect
                index={index}
                value={filter.operator}
                onChange={(operator) => updateFilter(index, { ...filter, operator })}
                disabled={disabled}
              />

              <FilterValueInput
                schema={formData.schema_name}
                table={formData.table_name}
                column={filter.column}
                operator={filter.operator}
                value={filter.value}
                dataType={filterColumnDataType}
                idPrefix={`chart-filter-value-${index}`}
                onChange={(value) => updateFilter(index, { ...filter, value })}
                disabled={disabled}
              />

              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="Remove filter"
                data-testid={`remove-filter-${index}`}
                onClick={() => {
                  filterIds.current.splice(index, 1);
                  const newFilters = filters.filter((_, i) => i !== index);
                  onChange({ filters: newFilters });
                }}
                disabled={disabled}
              >
                ✕
              </Button>
            </div>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            filterIds.current.push(`filter-${nextFilterId.current++}`);
            const newFilters = [
              ...filters,
              { column: '', operator: 'equals' as ChartFilter['operator'], value: '' },
            ];
            onChange({ filters: newFilters });
          }}
          disabled={disabled}
          data-testid="chart-add-filter-btn"
          className="w-full border-dashed bg-gray-900 text-white hover:bg-gray-700 hover:text-white border-gray-900"
        >
          + Add Filter
        </Button>
      </div>
    </div>
  );
}
