'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ChartFilter } from '@/types/charts';

/** The operators offered in the filter row, in display order. */
const FILTER_OPERATOR_OPTIONS: Array<{ value: ChartFilter['operator']; label: string }> = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not equals' },
  { value: 'greater_than', label: 'Greater than (>)' },
  { value: 'greater_than_equal', label: 'Greater or equal (>=)' },
  { value: 'less_than', label: 'Less than (<)' },
  { value: 'less_than_equal', label: 'Less or equal (<=)' },
  { value: 'like', label: 'Like' },
  { value: 'like_case_insensitive', label: 'Like (case insensitive)' },
  { value: 'in', label: 'In' },
  { value: 'not_in', label: 'Not in' },
  { value: 'is_null', label: 'Is null' },
  { value: 'is_not_null', label: 'Is not null' },
];

interface FilterOperatorSelectProps {
  index: number;
  value: ChartFilter['operator'];
  onChange: (operator: ChartFilter['operator']) => void;
  disabled?: boolean;
}

/** Operator dropdown for filter row `index`, shared by the chart and map data panels. */
export function FilterOperatorSelect({
  index,
  value,
  onChange,
  disabled,
}: FilterOperatorSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(op) => onChange(op as ChartFilter['operator'])}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 w-32" data-testid={`chart-filter-operator-${index}`}>
        <SelectValue placeholder="Operator" />
      </SelectTrigger>
      <SelectContent>
        {FILTER_OPERATOR_OPTIONS.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            data-testid={`chart-filter-operator-${index}-option-${option.value}`}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
