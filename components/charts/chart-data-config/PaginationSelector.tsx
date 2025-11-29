'use client';

import { Label } from '@/components/ui/label';
import { SimpleSelect, type SelectOption } from '@/components/ui/simple-select';
import { PAGINATION_OPTIONS } from './constants';

interface PaginationConfig {
  enabled: boolean;
  page_size: number;
}

interface PaginationSelectorProps {
  value: PaginationConfig | undefined;
  onChange: (pagination: PaginationConfig) => void;
  disabled?: boolean;
}

// Convert pagination options to SelectOption format (excluding __none__ as we use includeNone)
const PAGINATION_SELECT_OPTIONS: SelectOption[] = PAGINATION_OPTIONS.filter(
  (opt) => opt.value !== '__none__'
).map((opt) => ({
  value: opt.value,
  label: opt.label,
}));

/**
 * PaginationSelector - Pagination configuration
 *
 * Static dropdown with common pagination options:
 * - No pagination
 * - 20 items
 * - 50 items
 * - 100 items
 * - 200 items
 */
export function PaginationSelector({ value, onChange, disabled }: PaginationSelectorProps) {
  const currentValue = value?.enabled ? (value.page_size || 50).toString() : undefined;

  const handleChange = (selectedValue: string | undefined) => {
    if (!selectedValue) {
      onChange({ enabled: false, page_size: 50 });
    } else {
      onChange({
        enabled: true,
        page_size: parseInt(selectedValue),
      });
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-900">Pagination</Label>
      <SimpleSelect
        options={PAGINATION_SELECT_OPTIONS}
        value={currentValue}
        onChange={handleChange}
        placeholder="Select pagination"
        disabled={disabled}
        height="sm"
        includeNone
        noneLabel="No Pagination"
      />
    </div>
  );
}
