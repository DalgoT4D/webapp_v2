'use client';

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { isDateOnlyColumn } from '@/lib/columnTypeIcons';

interface TimeGrainSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  columnDataType?: string;
}

const TIME_GRAIN_OPTIONS = [
  { value: '__none__', label: 'None' },
  { value: 'year', label: 'Year' },
  { value: 'month', label: 'Month' },
  { value: 'day', label: 'Day' },
  { value: 'hour', label: 'Hour' },
  { value: 'minute', label: 'Minute' },
  { value: 'second', label: 'Second' },
];

export function TimeGrainSelector({
  value,
  onChange,
  disabled,
  columnDataType,
}: TimeGrainSelectorProps) {
  const handleValueChange = (selectedValue: string) => {
    onChange(selectedValue === '__none__' ? null : selectedValue);
  };

  // Determine which options should be disabled based on column type
  const isDateOnly = columnDataType ? isDateOnlyColumn(columnDataType) : false;

  const getOptionDisabledState = (optionValue: string) => {
    if (!columnDataType) return false;
    if (isDateOnly && ['hour', 'minute', 'second'].includes(optionValue)) {
      return true;
    }
    return false;
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-900">Time Grain</Label>
      <Select value={value || '__none__'} onValueChange={handleValueChange} disabled={disabled}>
        <SelectTrigger className="h-8">
          <SelectValue placeholder="Select time grain" />
        </SelectTrigger>
        <SelectContent>
          {TIME_GRAIN_OPTIONS.map((option) => {
            const isDisabled = getOptionDisabledState(option.value);

            if (isDisabled) {
              return (
                <Tooltip key={option.value} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <div>
                      <SelectItem
                        value={option.value}
                        disabled={true}
                        className="opacity-50 cursor-not-allowed"
                      >
                        {option.label}
                      </SelectItem>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    Not available for date columns
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
