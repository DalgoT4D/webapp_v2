'use client';

import { Label } from '@/components/ui/label';
import { ColumnSelector } from './ColumnSelector';

interface ExtraDimensionSelectorProps {
  chartType: string | undefined;
  columns: Array<{ column_name: string; data_type: string }>;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  excludeColumn?: string; // The main dimension column to exclude
  disabled?: boolean;
}

/**
 * Get placeholder text based on chart type
 */
function getPlaceholder(chartType: string | undefined): string {
  switch (chartType) {
    case 'bar':
      return 'Select dimension (for stacked bar)';
    case 'line':
      return 'Select dimension (for multi-line chart)';
    default:
      return 'Select extra dimension...';
  }
}

/**
 * ExtraDimensionSelector - Extra dimension for stacked/grouped charts
 *
 * Used for:
 * - Stacked bar charts
 * - Multi-line charts
 * - Grouped tables
 *
 * Filters out the main dimension column and includes a "None" option.
 */
export function ExtraDimensionSelector({
  chartType,
  columns,
  value,
  onChange,
  excludeColumn,
  disabled,
}: ExtraDimensionSelectorProps) {
  const placeholder = getPlaceholder(chartType);

  // Filter out the main dimension column
  const filterFn = excludeColumn
    ? (col: { column_name: string }) => col.column_name !== excludeColumn
    : undefined;

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-900">Extra Dimension</Label>
      <ColumnSelector
        columns={columns}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        filterFn={filterFn}
        includeNone={true}
        noneLabel="None"
      />
    </div>
  );
}
