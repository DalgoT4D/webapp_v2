'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PopoverContent } from '@/components/ui/popover';
import { DateFilterValue } from '../types';

interface DateFilterProps {
  value: DateFilterValue;
  onChange: (value: DateFilterValue) => void;
  onClear: () => void;
  title?: string;
  /** Prefix for element IDs to ensure uniqueness when multiple DateFilters exist */
  idPrefix?: string;
}

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
] as const;

export function DateFilter({
  value,
  onChange,
  onClear,
  title = 'Filter by Date Modified',
  idPrefix,
}: DateFilterProps) {
  // Generate a stable unique ID if no prefix provided
  const generatedId = useId();
  const prefix = idPrefix || generatedId;

  const handleRangeChange = (range: DateFilterValue['range']) => {
    // Reset custom dates when switching away from 'custom' range
    if (range !== 'custom') {
      onChange({ range, customStart: null, customEnd: null });
    } else {
      onChange({ ...value, range });
    }
  };

  return (
    <PopoverContent className="w-72" align="start">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">{title}</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </Button>
        </div>

        <div className="space-y-2">
          {DATE_RANGE_OPTIONS.map((option) => {
            const radioId = `${prefix}-${option.value}`;
            return (
              <div key={option.value} className="flex items-center space-x-2">
                <input
                  type="radio"
                  id={radioId}
                  name={`${prefix}-dateRange`}
                  checked={value.range === option.value}
                  onChange={() => handleRangeChange(option.value)}
                  className="w-4 h-4 text-teal-600"
                />
                <Label htmlFor={radioId} className="text-sm cursor-pointer">
                  {option.label}
                </Label>
              </div>
            );
          })}
        </div>

        {value.range === 'custom' && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs text-gray-600">Custom Date Range</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor={`${prefix}-customStart`} className="text-xs">
                  From
                </Label>
                <Input
                  id={`${prefix}-customStart`}
                  type="date"
                  value={value.customStart ? value.customStart.toISOString().split('T')[0] : ''}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      customStart: e.target.value ? new Date(e.target.value) : null,
                    })
                  }
                  className="h-8"
                />
              </div>
              <div>
                <Label htmlFor={`${prefix}-customEnd`} className="text-xs">
                  To
                </Label>
                <Input
                  id={`${prefix}-customEnd`}
                  type="date"
                  value={value.customEnd ? value.customEnd.toISOString().split('T')[0] : ''}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      customEnd: e.target.value ? new Date(e.target.value) : null,
                    })
                  }
                  className="h-8"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </PopoverContent>
  );
}
