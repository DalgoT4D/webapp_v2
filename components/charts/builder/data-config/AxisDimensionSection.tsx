'use client';

import { Label } from '@/components/ui/label';
import { Combobox, highlightText } from '@/components/ui/combobox';
import { ColumnTypeIcon } from '@/lib/columnTypeIcons';
import { TooltipLabel } from '@/components/charts/styling/TooltipLabel';
import type { ChartConfigPatch } from '@/components/charts/logic/type-switch';
import type { ChartBuilderFormData } from '@/types/charts';
import type { ColumnItem } from './column-types';

interface AxisDimensionSectionProps {
  formData: ChartBuilderFormData;
  onChange: (patch: ChartConfigPatch) => void;
  disabled?: boolean;
  columnItems: ColumnItem[];
}

/** X axis (or pie "Dimension") column picker. */
export function AxisDimensionSection({
  formData,
  onChange,
  disabled,
  columnItems,
}: AxisDimensionSectionProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-900">
        {formData.chart_type === 'pie' ? 'Dimension' : 'X Axis'}
      </Label>
      <Combobox
        id="chart-x-axis-select"
        items={columnItems}
        value={formData.dimension_column || formData.x_axis_column}
        onValueChange={(value) => onChange({ dimension_column: value })}
        disabled={disabled}
        searchPlaceholder="Search columns..."
        placeholder="Select X axis column"
        renderItem={(item, _isSelected, searchQuery) => (
          <div className="flex items-center gap-2 min-w-0">
            <ColumnTypeIcon dataType={item.data_type} className="w-4 h-4" />
            <TooltipLabel label={item.label}>{highlightText(item.label, searchQuery)}</TooltipLabel>
          </div>
        )}
      />
    </div>
  );
}
