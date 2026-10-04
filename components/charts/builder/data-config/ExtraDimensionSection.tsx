'use client';

import { Label } from '@/components/ui/label';
import { Combobox, highlightText } from '@/components/ui/combobox';
import { ColumnTypeIcon } from '@/lib/columnTypeIcons';
import { TooltipLabel } from '@/components/charts/styling/TooltipLabel';
import type { ChartConfigPatch } from '@/components/charts/logic/type-switch';
import type { ChartBuilderFormData } from '@/types/charts';
import type { NormalizedColumn } from './column-types';

interface ExtraDimensionSectionProps {
  formData: ChartBuilderFormData;
  onChange: (patch: ChartConfigPatch) => void;
  disabled?: boolean;
  allColumns: NormalizedColumn[];
}

/** Extra dimension for stacked/grouped charts (NOT tables - tables use dimensions array). */
export function ExtraDimensionSection({
  formData,
  onChange,
  disabled,
  allColumns,
}: ExtraDimensionSectionProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-900">Extra Dimension</Label>
      <Combobox
        id="chart-extra-dimension-select"
        items={[
          { value: 'none', label: 'None' },
          ...allColumns
            .filter((col) => col.column_name !== formData.dimension_column)
            .map((col) => ({
              value: col.column_name,
              label: col.column_name,
              data_type: col.data_type,
            })),
        ]}
        value={formData.extra_dimension_column || 'none'}
        onValueChange={(value) =>
          onChange({ extra_dimension_column: value === 'none' ? undefined : value })
        }
        disabled={disabled}
        searchPlaceholder="Search columns..."
        placeholder={`Select dimension (for ${formData.chart_type === 'bar' ? 'stacked bar' : 'multi-line chart'})`}
        renderItem={(item, _isSelected, searchQuery) => (
          <div className="flex items-center gap-2 min-w-0">
            {item.data_type && <ColumnTypeIcon dataType={item.data_type} className="w-4 h-4" />}
            <TooltipLabel label={item.label}>{highlightText(item.label, searchQuery)}</TooltipLabel>
          </div>
        )}
      />
    </div>
  );
}
