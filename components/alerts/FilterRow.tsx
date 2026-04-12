'use client';

import { useState } from 'react';
import { format, parse } from 'date-fns';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import type { AlertFilter } from '@/types/alert';
import { getFilterOperatorsForDataType } from '@/types/alert';

interface ColumnInfo {
  name: string;
  data_type?: string;
  translated_type?: string;
}

interface FilterRowProps {
  filter: AlertFilter;
  columns: ColumnInfo[];
  onChange: (updated: AlertFilter) => void;
  onRemove: () => void;
}

// Relative date options for date/datetime columns
const DATE_VALUE_OPTIONS = [
  { value: '__today__', label: 'Today' },
  { value: '__yesterday__', label: 'Yesterday' },
  { value: '__custom__', label: 'Custom date...' },
];

function isDateType(dataType: string): boolean {
  const lower = dataType.toLowerCase();
  return ['timestamp', 'datetime', 'date', 'time'].some((t) => lower.includes(t));
}

export function FilterRow({ filter, columns, onChange, onRemove }: FilterRowProps) {
  const columnItems = columns.map((col) => ({
    value: col.name,
    label: col.name,
  }));

  const selectedColumn = columns.find((col) => col.name === filter.column);
  const dataType = selectedColumn?.data_type ?? selectedColumn?.translated_type ?? 'text';
  const operatorOptions = getFilterOperatorsForDataType(dataType);

  const operatorItems = operatorOptions.map((op) => ({
    value: op.value,
    label: op.label,
  }));

  const isBooleanOperator = filter.operator === 'is true' || filter.operator === 'is false';
  const isDate = isDateType(dataType);

  const isRelativeDate = filter.value === '__today__' || filter.value === '__yesterday__';

  // Track custom date mode explicitly — stays true once selected until user picks a relative option
  const [isCustomMode, setIsCustomMode] = useState(
    isDate && !isRelativeDate && filter.value !== ''
  );

  const showDatePicker = isDate && isCustomMode;

  const dateDropdownValue = isRelativeDate ? filter.value : isCustomMode ? '__custom__' : '';

  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const customDateValue =
    showDatePicker && filter.value ? parse(filter.value, 'yyyy-MM-dd', new Date()) : undefined;

  return (
    <div className="border rounded-md p-3 space-y-2 bg-gray-50/50" data-testid="filter-row">
      {/* Row 1: Column, Operator, Remove */}
      <div className="flex items-center gap-2">
        <Combobox
          items={columnItems}
          value={filter.column}
          onValueChange={(value) => onChange({ ...filter, column: value, operator: '', value: '' })}
          placeholder="Column"
          className="flex-1"
        />
        <Combobox
          items={operatorItems}
          value={filter.operator}
          onValueChange={(value) => onChange({ ...filter, operator: value })}
          placeholder="Operator"
          className="flex-1"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="shrink-0"
          data-testid="filter-remove-btn"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Row 2: Value */}
      {!isBooleanOperator && filter.operator && (
        <div className="flex items-center gap-2">
          {isDate ? (
            <>
              <Combobox
                items={DATE_VALUE_OPTIONS}
                value={dateDropdownValue}
                onValueChange={(value) => {
                  if (value === '__custom__') {
                    setIsCustomMode(true);
                    onChange({ ...filter, value: '' });
                    setDatePickerOpen(true);
                  } else {
                    setIsCustomMode(false);
                    onChange({ ...filter, value });
                  }
                }}
                placeholder="Select date"
                className="flex-1"
              />
              {showDatePicker && (
                <div className="flex-1">
                  <DatePicker
                    value={customDateValue}
                    placeholder="Pick a date"
                    open={datePickerOpen}
                    onOpenChange={setDatePickerOpen}
                    selected={customDateValue}
                    onSelect={(date) => {
                      if (date) {
                        onChange({
                          ...filter,
                          value: format(date, 'yyyy-MM-dd'),
                        });
                      }
                      setDatePickerOpen(false);
                    }}
                  />
                </div>
              )}
            </>
          ) : (
            <Input
              value={filter.value}
              onChange={(e) => onChange({ ...filter, value: e.target.value })}
              placeholder="Value"
              className="flex-1"
              data-testid="filter-value-input"
            />
          )}
        </div>
      )}
    </div>
  );
}
