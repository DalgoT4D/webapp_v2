'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  formatDateInputValue,
  parseDateInputValue,
  type DateFilter,
  type DateInputMode,
  type DateRange,
} from './list-logic';

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
];

interface DateModifiedFilterProps {
  value: DateFilter;
  onChange: Dispatch<SetStateAction<DateFilter>>;
  /** Radio testids are `${prefix}-${range}`. */
  optionTestIdPrefix: string;
  fromTestId: string;
  toTestId: string;
  dateInputMode: DateInputMode;
}

/** Body of the "Filter by Date Modified" popover: range radios + custom From/To. */
export function DateModifiedFilter({
  value,
  onChange,
  optionTestIdPrefix,
  fromTestId,
  toTestId,
  dateInputMode,
}: DateModifiedFilterProps) {
  return (
    <>
      <div className="space-y-2">
        {DATE_RANGE_OPTIONS.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <input
              type="radio"
              id={option.value}
              data-testid={`${optionTestIdPrefix}-${option.value}`}
              name="dateRange"
              checked={value.range === option.value}
              onChange={() => onChange((prev) => ({ ...prev, range: option.value }))}
              className="w-4 h-4 text-teal-600"
            />
            <Label htmlFor={option.value} className="text-sm cursor-pointer">
              {option.label}
            </Label>
          </div>
        ))}
      </div>

      {value.range === 'custom' && (
        <div className="space-y-2 pt-2 border-t">
          <Label className="text-xs text-gray-600">Custom Date Range</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                data-testid={fromTestId}
                value={formatDateInputValue(value.customStart, dateInputMode)}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    customStart: parseDateInputValue(e.target.value, dateInputMode),
                  }))
                }
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                data-testid={toTestId}
                value={formatDateInputValue(value.customEnd, dateInputMode)}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    customEnd: parseDateInputValue(e.target.value, dateInputMode),
                  }))
                }
                className="h-8"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
