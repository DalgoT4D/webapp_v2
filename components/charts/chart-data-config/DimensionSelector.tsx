'use client';

import { Label } from '@/components/ui/label';
import { ColumnSelector } from './ColumnSelector';

interface DimensionSelectorProps {
  chartType: string | undefined;
  columns: Array<{ column_name: string; data_type: string }>;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
}

/**
 * Get the appropriate label based on chart type
 */
function getDimensionLabel(chartType: string | undefined): string {
  switch (chartType) {
    case 'table':
      return 'Group By Column';
    case 'pie':
      return 'Dimension';
    default:
      return 'X Axis';
  }
}

/**
 * DimensionSelector - X-axis/dimension column selector
 *
 * Shows different labels based on chart type:
 * - 'table' -> "Group By Column"
 * - 'pie' -> "Dimension"
 * - others -> "X Axis"
 */
export function DimensionSelector({
  chartType,
  columns,
  value,
  onChange,
  disabled,
}: DimensionSelectorProps) {
  const label = getDimensionLabel(chartType);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-900">{label}</Label>
      <ColumnSelector
        columns={columns}
        value={value}
        onChange={onChange}
        placeholder={`Select ${label.toLowerCase()}...`}
        disabled={disabled}
      />
    </div>
  );
}
