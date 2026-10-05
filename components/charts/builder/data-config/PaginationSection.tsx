'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ChartConfigPatch } from '@/components/charts/logic/type-switch';
import type { ChartBuilderFormData } from '@/types/charts';

/** Page size used when pagination is off or has no size saved. */
const DEFAULT_PAGE_SIZE = 50;
/** Select value meaning "no pagination". */
const NO_PAGINATION = '__none__';

interface PaginationSectionProps {
  formData: ChartBuilderFormData;
  onChange: (patch: ChartConfigPatch) => void;
  disabled?: boolean;
}

/** Pagination page-size picker. */
export function PaginationSection({ formData, onChange, disabled }: PaginationSectionProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-900">Pagination</Label>
      <Select
        value={
          formData.pagination?.enabled
            ? (formData.pagination?.page_size || DEFAULT_PAGE_SIZE).toString()
            : NO_PAGINATION
        }
        onValueChange={(value) => {
          if (value === NO_PAGINATION) {
            onChange({ pagination: { enabled: false, page_size: DEFAULT_PAGE_SIZE } });
          } else {
            onChange({
              pagination: {
                enabled: true,
                page_size: parseInt(value),
              },
            });
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 w-full" data-testid="chart-pagination-select">
          <SelectValue placeholder="Select pagination" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__" data-testid="chart-pagination-option-__none__">
            No pagination
          </SelectItem>
          <SelectItem value="20" data-testid="chart-pagination-option-20">
            20 items
          </SelectItem>
          <SelectItem value="50" data-testid="chart-pagination-option-50">
            50 items
          </SelectItem>
          <SelectItem value="100" data-testid="chart-pagination-option-100">
            100 items
          </SelectItem>
          <SelectItem value="200" data-testid="chart-pagination-option-200">
            200 items
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
