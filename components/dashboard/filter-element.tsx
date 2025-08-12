'use client';

import { useState } from 'react';
import { X, Edit2 } from 'lucide-react';
import { DashboardFilterWidget } from './dashboard-filter-widgets';
import { DashboardFilterConfig } from '@/types/dashboard-filters';

interface FilterElementProps {
  filter: DashboardFilterConfig;
  onRemove: () => void;
  onUpdate?: (filter: DashboardFilterConfig) => void;
  onEdit?: () => void;
  isEditMode?: boolean;
  value?: any;
  onChange?: (filterId: string, value: any) => void;
}

export function FilterElement({
  filter,
  onRemove,
  onUpdate,
  onEdit,
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
    <div className="h-full w-full relative">
      {isEditMode && (
        <div className="absolute -top-2 -right-2 z-10 flex gap-1">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all"
              title="Edit filter"
            >
              <Edit2 className="w-3 h-3 text-gray-600 hover:text-blue-600" />
            </button>
          )}
          <button
            onClick={onRemove}
            className="p-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all"
            title="Remove filter"
          >
            <X className="w-3 h-3 text-gray-600 hover:text-red-600" />
          </button>
        </div>
      )}

      <DashboardFilterWidget
        filter={filter}
        value={localValue}
        onChange={handleChange}
        className="h-full"
        isEditMode={isEditMode}
      />
    </div>
  );
}
