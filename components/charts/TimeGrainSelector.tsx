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

interface TimeGrainSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
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

export function TimeGrainSelector({ value, onChange, disabled }: TimeGrainSelectorProps) {
  const handleValueChange = (selectedValue: string) => {
    onChange(selectedValue === '__none__' ? null : selectedValue);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-900">Time Grain</Label>
      <Select value={value || '__none__'} onValueChange={handleValueChange} disabled={disabled}>
        <SelectTrigger className="h-8">
          <SelectValue placeholder="Select time grain" />
        </SelectTrigger>
        <SelectContent>
          {TIME_GRAIN_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
