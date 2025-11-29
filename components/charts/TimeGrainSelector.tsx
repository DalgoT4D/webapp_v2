'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { SimpleSelect, type SelectOption } from './chart-data-config/SimpleSelect';

interface TimeGrainSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

const TIME_GRAIN_OPTIONS: SelectOption[] = [
  { value: 'year', label: 'Year' },
  { value: 'month', label: 'Month' },
  { value: 'day', label: 'Day' },
  { value: 'hour', label: 'Hour' },
  { value: 'minute', label: 'Minute' },
  { value: 'second', label: 'Second' },
];

export function TimeGrainSelector({ value, onChange, disabled }: TimeGrainSelectorProps) {
  const handleValueChange = (selectedValue: string | undefined) => {
    onChange(selectedValue || null);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-900">Time Grain</Label>
      <SimpleSelect
        options={TIME_GRAIN_OPTIONS}
        value={value || undefined}
        onChange={handleValueChange}
        placeholder="Select time grain"
        disabled={disabled}
        height="sm"
        includeNone
        noneLabel="None"
      />
    </div>
  );
}
