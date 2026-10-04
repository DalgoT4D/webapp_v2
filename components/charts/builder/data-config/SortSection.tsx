'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Combobox, highlightText } from '@/components/ui/combobox';
import { TooltipLabel } from '@/components/charts/styling/TooltipLabel';
import { getSortOptions } from '@/components/charts/logic/sort-options';
import type { ChartConfigPatch } from '@/components/charts/logic/type-switch';
import type { ChartBuilderFormData } from '@/types/charts';

/** Combobox value meaning "no sort". */
const NO_SORT = '__none__';

interface SortSectionProps {
  formData: ChartBuilderFormData;
  onChange: (patch: ChartConfigPatch) => void;
  disabled?: boolean;
}

/** "Sort Configuration": sort column (dimension or aliased metric) and direction. */
export function SortSection({ formData, onChange, disabled }: SortSectionProps) {
  const sortableOptions = getSortOptions(formData);

  // Get current sort values
  const currentSort = formData.sort && formData.sort.length > 0 ? formData.sort[0] : null;
  const currentColumn = currentSort?.column || NO_SORT;
  const currentDirection = currentSort?.direction || 'asc';

  // Check if current sort column is still available
  const isCurrentColumnAvailable =
    currentColumn === NO_SORT || sortableOptions.some((opt) => opt.value === currentColumn);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-900">Sort Configuration</Label>

      {sortableOptions.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {/* Column/Metric Selection */}
          <Combobox
            id="chart-sort-column-select"
            items={[
              { value: NO_SORT, label: 'None', type: '' },
              ...sortableOptions.map((option) => ({
                value: option.value,
                label: option.label,
                type: option.type,
              })),
            ]}
            value={isCurrentColumnAvailable ? currentColumn : NO_SORT}
            onValueChange={(value) => {
              if (value === NO_SORT) {
                onChange({ sort: [] });
              } else {
                onChange({ sort: [{ column: value, direction: currentDirection }] });
              }
            }}
            disabled={disabled}
            searchPlaceholder="Search..."
            placeholder="Select column to sort"
            compact
            renderItem={(item, _isSelected, searchQuery) => (
              <div className="flex items-center gap-2 min-w-0">
                {item.type && (
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium shrink-0 ${
                      item.type === 'column'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {item.type === 'column' ? 'COL' : 'METRIC'}
                  </span>
                )}
                <TooltipLabel label={item.label} className="flex-1">
                  {highlightText(item.label, searchQuery)}
                </TooltipLabel>
              </div>
            )}
          />

          {/* Direction Selection */}
          <Select
            value={currentSort ? currentDirection : 'asc'}
            onValueChange={(value) => {
              if (currentSort && currentColumn !== NO_SORT) {
                onChange({
                  sort: [{ column: currentColumn, direction: value as 'asc' | 'desc' }],
                });
              }
            }}
            disabled={disabled || !currentSort || currentColumn === NO_SORT}
          >
            <SelectTrigger className="h-8 w-full" data-testid="chart-sort-direction-select">
              <SelectValue placeholder="Sort direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc" data-testid="chart-sort-direction-option-asc">
                Ascending
              </SelectItem>
              <SelectItem value="desc" data-testid="chart-sort-direction-option-desc">
                Descending
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="text-sm text-gray-500">Configure metrics first to enable sorting</div>
      )}
    </div>
  );
}
