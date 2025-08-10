'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { DashboardFilterWidget } from './dashboard-filter-widgets';
import { DashboardFilterConfig } from '@/types/dashboard-filters';

interface FilterElementProps {
  filter: DashboardFilterConfig;
  onRemove: () => void;
  onUpdate?: (filter: DashboardFilterConfig) => void;
  isEditMode?: boolean;
  value?: any;
  onChange?: (filterId: string, value: any) => void;
}

export function FilterElement({
  filter,
  onRemove,
  onUpdate,
  isEditMode = true,
  value,
  onChange,
}: FilterElementProps) {
  const [localValue, setLocalValue] = useState<any>(value || null);

  const handleChange = (filterId: string, newValue: any) => {
    setLocalValue(newValue);
    if (onChange) {
      onChange(filterId, newValue);
    }
  };

  return (
    <div className="h-full w-full relative group">
      {isEditMode && (
        <button
          onClick={onRemove}
          className="absolute -top-2 -right-2 z-10 p-1 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3 text-gray-500 hover:text-red-500" />
        </button>
      )}

      <DashboardFilterWidget
        filter={filter}
        value={localValue}
        onChange={handleChange}
        className="h-full"
      />
    </div>
  );
}
