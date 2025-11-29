'use client';

import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { FilterRow } from './FilterRow';
import type { ChartFilter } from '@/types/charts';

interface FiltersSectionProps {
  filters: ChartFilter[];
  columns: Array<{ column_name: string; data_type: string }>;
  schemaName?: string;
  tableName?: string;
  onChange: (filters: ChartFilter[]) => void;
  disabled?: boolean;
}

/**
 * FiltersSection - Data filters builder
 *
 * Allows users to add/remove/edit multiple filters.
 * Each filter has: column, operator, and value.
 */
export function FiltersSection({
  filters,
  columns,
  schemaName,
  tableName,
  onChange,
  disabled,
}: FiltersSectionProps) {
  const handleUpdateFilter = (index: number, updates: Partial<ChartFilter>) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], ...updates };
    onChange(newFilters);
  };

  const handleRemoveFilter = (index: number) => {
    onChange(filters.filter((_, i) => i !== index));
  };

  const handleAddFilter = () => {
    const newFilter: ChartFilter = {
      column: '',
      operator: 'equals',
      value: '',
    };
    onChange([...filters, newFilter]);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-900">Data Filters</Label>
      <div className="space-y-2">
        {filters.map((filter, index) => (
          <FilterRow
            key={index}
            filter={filter}
            index={index}
            columns={columns}
            schemaName={schemaName}
            tableName={tableName}
            onUpdate={handleUpdateFilter}
            onRemove={handleRemoveFilter}
            disabled={disabled}
          />
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={handleAddFilter}
          disabled={disabled}
          className="w-full border-dashed bg-gray-900 text-white hover:bg-gray-700 hover:text-white border-gray-900"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Filter
        </Button>
      </div>
    </div>
  );
}
