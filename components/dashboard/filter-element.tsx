'use client';

import { useState } from 'react';
import { X, Edit2, GripVertical } from 'lucide-react';
import { DashboardFilterWidget } from './dashboard-filter-widgets';
import type { DashboardFilterConfig } from '@/types/dashboard-filters';

interface FilterElementProps {
  filter: DashboardFilterConfig;
  onRemove?: () => void;
  onUpdate?: (filter: DashboardFilterConfig) => void;
  onEdit?: () => void;
  isEditMode?: boolean;
  value?: any;
  onChange?: (filterId: string, value: any) => void;
  showTitle?: boolean;
  compact?: boolean;
  dragHandleProps?: any; // DnD Kit listeners for drag handle
}

export function FilterElement({
  filter,
  onRemove,
  onUpdate,
  onEdit,
  isEditMode = true,
  value,
  onChange,
  showTitle = true,
  compact = false,
  dragHandleProps,
}: FilterElementProps) {
  const [localValue, setLocalValue] = useState<any>(value || null);

  const handleChange = (filterId: string, newValue: any) => {
    setLocalValue(newValue);
    if (onChange) {
      onChange(filterId, newValue);
    }
  };

  return (
    <div className={`w-full relative ${compact ? '' : 'h-full'}`}>
      {/* Drag handle for reordering (only in edit mode) */}
      {isEditMode && dragHandleProps && (
        <div
          {...dragHandleProps}
          className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 p-1 bg-white border border-gray-200 rounded shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all"
          title="Drag to reorder"
        >
          <GripVertical className="w-3 h-3 text-gray-500" />
        </div>
      )}

      {/* Action buttons */}
      {isEditMode && (onRemove || onEdit) && (
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
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all"
              title="Remove filter"
            >
              <X className="w-3 h-3 text-gray-600 hover:text-red-600" />
            </button>
          )}
        </div>
      )}

      <DashboardFilterWidget
        filter={filter}
        value={localValue}
        onChange={handleChange}
        className={compact ? '' : 'h-full'}
        isEditMode={isEditMode}
        showTitle={showTitle}
        compact={compact}
      />
    </div>
  );
}
