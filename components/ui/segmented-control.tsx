'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SegmentedControlOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SegmentedControlOption[];
  defaultValue?: string;
  className?: string;
}

export function SegmentedControl({
  value,
  onValueChange,
  options,
  defaultValue,
  className,
}: SegmentedControlProps) {
  const currentValue = value || defaultValue || options[0]?.value;

  return (
    <div
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onValueChange(option.value)}
          className={cn(
            'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
            currentValue === option.value
              ? 'bg-background text-foreground shadow-sm'
              : 'hover:bg-background/50'
          )}
        >
          {option.icon && <span className="mr-2 h-4 w-4">{option.icon}</span>}
          {option.label}
        </button>
      ))}
    </div>
  );
}
