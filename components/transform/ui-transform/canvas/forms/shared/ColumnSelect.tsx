// components/transform/canvas/forms/shared/ColumnSelect.tsx
'use client';

import { useMemo } from 'react';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import { cn } from '@/lib/utils';

interface ColumnSelectProps {
  /** Selected column value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Available columns */
  columns: string[];
  /** Placeholder text */
  placeholder?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Test ID */
  testId?: string;
  /** Columns to exclude from options */
  excludeColumns?: string[];
}

/**
 * Standard searchable column dropdown selector used across operation forms.
 * Uses Combobox for search/filter when column lists are large.
 */
export function ColumnSelect({
  value,
  onChange,
  columns,
  placeholder = 'Select column',
  disabled = false,
  className,
  testId = 'column-select',
  excludeColumns = [],
}: ColumnSelectProps) {
  const items: ComboboxItem[] = useMemo(
    () =>
      columns
        .filter((col) => !excludeColumns.includes(col))
        .map((col) => ({ value: col, label: col })),
    [columns, excludeColumns]
  );

  return (
    <Combobox
      mode="single"
      items={items}
      value={value}
      onValueChange={onChange}
      placeholder={placeholder}
      searchPlaceholder="Search columns..."
      emptyMessage="No matching columns."
      noItemsMessage="No columns available."
      disabled={disabled}
      className={cn('w-full', className)}
      id={testId}
      compact
    />
  );
}
