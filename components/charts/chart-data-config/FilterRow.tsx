'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import { ColumnSelector } from './ColumnSelector';
import { SimpleSelect } from '@/components/ui/simple-select';
import { SearchableValueInput } from './SearchableValueInput';
import { FILTER_OPERATORS } from './constants';
import type { ChartFilter } from '@/types/charts';

// Convert filter operators to SimpleSelect options
const OPERATOR_OPTIONS = FILTER_OPERATORS.map((op) => ({
  value: op.value,
  label: op.label,
}));

interface FilterRowProps {
  filter: ChartFilter;
  index: number;
  columns: Array<{ column_name: string; data_type: string }>;
  schemaName?: string;
  tableName?: string;
  onUpdate: (index: number, updates: Partial<ChartFilter>) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

/**
 * FilterRow - Single filter row component (styled like MetricsSelector)
 *
 * Layout:
 * - Row 1: Column selector + Operator selector + Remove button
 * - Row 2: Value input (if needed)
 * All wrapped in a bordered box
 */
export function FilterRow({
  filter,
  index,
  columns,
  schemaName,
  tableName,
  onUpdate,
  onRemove,
  disabled,
}: FilterRowProps) {
  const showValueInput = filter.operator !== 'is_null' && filter.operator !== 'is_not_null';

  return (
    <div className="space-y-2 p-3 border rounded-lg bg-white">
      {/* Row 1: Column + Operator + Remove Button */}
      <div className="flex items-center gap-2">
        <div className="flex-1 grid grid-cols-2 gap-2">
          {/* Column Selector */}
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">Column</Label>
            <ColumnSelector
              columns={columns}
              value={filter.column}
              onChange={(value) => onUpdate(index, { column: value || '' })}
              placeholder="Select column..."
              disabled={disabled}
              height="sm"
            />
          </div>

          {/* Operator Selector */}
          <div className="space-y-1">
            <Label className="text-xs text-gray-600">Operator</Label>
            <SimpleSelect
              options={OPERATOR_OPTIONS}
              value={filter.operator}
              onChange={(value) =>
                onUpdate(index, { operator: (value || 'equals') as ChartFilter['operator'] })
              }
              placeholder="Select operator"
              disabled={disabled}
              height="sm"
            />
          </div>
        </div>

        {/* Remove Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 mt-5"
          onClick={() => onRemove(index)}
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Row 2: Value Input */}
      {showValueInput && (
        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Value</Label>
          <SearchableValueInput
            schema={schemaName}
            table={tableName}
            column={filter.column}
            operator={filter.operator}
            value={filter.value}
            onChange={(value) => onUpdate(index, { value })}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
