// components/transform/canvas/forms/shared/ColumnSelect.tsx
'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
 * Standard column dropdown selector used across operation forms.
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
  const filteredColumns = columns.filter((col) => !excludeColumns.includes(col));

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn('w-full', className)} data-testid={testId}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {filteredColumns.length === 0 ? (
          <div className="p-2 text-sm text-muted-foreground">No columns available</div>
        ) : (
          filteredColumns.map((col) => (
            <SelectItem key={col} value={col}>
              {col}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

interface MultiColumnSelectProps {
  /** Selected column values */
  values: string[];
  /** Change handler */
  onChange: (values: string[]) => void;
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
}

/**
 * Multi-column selector with checkboxes.
 * Used for operations that need multiple column selection.
 */
export function MultiColumnSelect({
  values,
  onChange,
  columns,
  placeholder = 'Select columns',
  disabled = false,
  className,
  testId = 'multi-column-select',
}: MultiColumnSelectProps) {
  const toggleColumn = (column: string) => {
    if (values.includes(column)) {
      onChange(values.filter((v) => v !== column));
    } else {
      onChange([...values, column]);
    }
  };

  return (
    <div className={cn('border rounded-md', className)} data-testid={testId}>
      <div className="max-h-48 overflow-y-auto p-2 space-y-1">
        {columns.length === 0 ? (
          <div className="p-2 text-sm text-muted-foreground">{placeholder}</div>
        ) : (
          columns.map((col) => (
            <label
              key={col}
              className={cn(
                'flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50',
                values.includes(col) && 'bg-teal-50',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <input
                type="checkbox"
                checked={values.includes(col)}
                onChange={() => !disabled && toggleColumn(col)}
                disabled={disabled}
                className="rounded border-gray-300"
                data-testid={`${testId}-${col}`}
              />
              <span className="text-sm">{col}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
