'use client';

import React from 'react';
import { format } from 'date-fns';
import { DebouncedInput } from '@/components/charts/debounced-input';
import { useColumnValues } from '@/hooks/api/useChart';
import { isDateAndTimestampColumn } from '@/lib/columnTypeIcons';
import { DatePicker } from '@/components/ui/date-picker';
import { Combobox } from '@/components/ui/combobox';
import type { ChartFilter } from '@/types/charts';

/** Most distinct values offered in the value dropdowns. */
const MAX_VALUE_OPTIONS = 100;

interface FilterValueInputProps {
  schema?: string;
  table?: string;
  column: string;
  operator: string;
  value: ChartFilter['value'];
  onChange: (value: string) => void;
  disabled?: boolean;
  dataType?: string;
  /** Stable prefix for data-testids / Combobox ids (E2E selectors) */
  idPrefix?: string;
}

/** Filter value input: none for null checks, multi-select for in/not_in, date picker, value dropdown or text. */
export const FilterValueInput = React.memo(function FilterValueInput({
  schema,
  table,
  column,
  operator,
  value,
  onChange,
  disabled,
  dataType,
  idPrefix,
}: FilterValueInputProps) {
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);

  // Get column values using the warehouse API
  const { data: columnValues } = useColumnValues(schema || null, table || null, column || null);

  // Memoize combobox items unconditionally (before any early returns)
  const comboboxItems = React.useMemo(
    () =>
      (columnValues || [])
        .filter((val) => val !== null && val !== undefined && val.toString().trim() !== '')
        .slice(0, MAX_VALUE_OPTIONS)
        .map((val) => ({ value: val.toString(), label: val.toString() })),
    [columnValues]
  );

  // For null checks, no value input needed
  if (operator === 'is_null' || operator === 'is_not_null') {
    return null;
  }

  // For 'in' and 'not_in' operators, show multiselect dropdown if we have column values
  if (operator === 'in' || operator === 'not_in') {
    if (columnValues && columnValues.length > 0) {
      const selectedValues = Array.isArray(value)
        ? value
        : value
          ? value.split(',').map((v: string) => v.trim())
          : [];

      return (
        <div className="h-8 flex-1">
          <Combobox
            id={idPrefix}
            mode="multi"
            items={comboboxItems}
            values={selectedValues}
            onValuesChange={(vals) => onChange(vals.join(', '))}
            disabled={disabled}
            placeholder={
              selectedValues.length > 0 ? `${selectedValues.length} selected` : 'Select values'
            }
            compact
          />
        </div>
      );
    } else {
      // Fallback to text input for in/not_in when no column values
      return (
        <DebouncedInput
          placeholder="value1, value2, value3"
          data-testid={idPrefix ? `${idPrefix}-text` : undefined}
          value={value || ''}
          onChange={onChange}
          disabled={disabled}
          className="h-8 flex-1"
        />
      );
    }
  }

  // Date/timestamp columns get a calendar picker
  if (dataType && isDateAndTimestampColumn(dataType)) {
    const selectedDate = !value
      ? undefined
      : value.includes('T')
        ? new Date(value)
        : new Date(value + 'T00:00:00');
    return (
      <div className="flex-1" data-testid={idPrefix ? `${idPrefix}-date` : undefined}>
        <DatePicker
          testId={idPrefix ? `${idPrefix}-date-picker` : undefined}
          value={selectedDate}
          placeholder="Pick a date"
          disabled={disabled}
          open={datePickerOpen}
          onOpenChange={setDatePickerOpen}
          selected={selectedDate}
          onSelect={(date) => {
            onChange(date ? format(date, 'yyyy-MM-dd') : '');
            setDatePickerOpen(false);
          }}
        />
      </div>
    );
  }

  // If we have column values, show searchable dropdown
  if (columnValues && columnValues.length > 0) {
    return (
      <Combobox
        id={idPrefix}
        items={comboboxItems}
        value={value || ''}
        onValueChange={(val) => onChange(val)}
        disabled={disabled}
        searchPlaceholder="Search values..."
        placeholder="Select value"
        compact
        className="flex-1"
      />
    );
  }

  // Fallback to regular input
  return (
    <DebouncedInput
      placeholder="Enter value"
      data-testid={idPrefix ? `${idPrefix}-text` : undefined}
      value={value || ''}
      onChange={onChange}
      disabled={disabled}
      className="h-8 flex-1"
    />
  );
});
