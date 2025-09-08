'use client';

import { useState, useEffect } from 'react';
import { X, Edit2, GripVertical, RotateCcw } from 'lucide-react';
import { DashboardFilterWidget } from './dashboard-filter-widgets';
import type { DashboardFilterConfig } from '@/types/dashboard-filters';

interface FilterElementProps {
  filter: DashboardFilterConfig;
  onRemove?: () => void;
  onUpdate?: (filter: DashboardFilterConfig) => void;
  onEdit?: () => void;
  onClear?: () => void;
  isEditMode?: boolean;
  value?: any;
  onChange?: (filterId: string, value: any) => void;
  showTitle?: boolean;
  compact?: boolean;
  dragHandleProps?: any; // DnD Kit listeners for drag handle
  isPublicMode?: boolean;
  publicToken?: string;
}

export function FilterElement({
  filter,
  onRemove,
  onUpdate,
  onEdit,
  onClear,
  isEditMode = true,
  value,
  onChange,
  showTitle = true,
  compact = false,
  dragHandleProps,
  isPublicMode = false,
  publicToken,
}: FilterElementProps) {
  // Validate filter before proceeding
  if (!filter || !filter.id) {
    console.error('Invalid filter passed to FilterElement:', filter);
    return (
      <div className="p-4 text-red-500 border border-red-200 rounded">
        Invalid filter configuration
      </div>
    );
  }

  const [localValue, setLocalValue] = useState<any>(value || null);

  // Sync localValue when value prop changes (for default values)
  useEffect(() => {
    try {
      if (value !== localValue) {
        setLocalValue(value);
      }
    } catch (error) {
      console.error('Error syncing filter value:', error);
    }
  }, [value, localValue, filter.id]);

  const handleChange = (filterId: string, newValue: any) => {
    setLocalValue(newValue);
    if (onChange) {
      onChange(filterId, newValue);
    }
  };

  const handleClear = () => {
    setLocalValue(null);
    if (onChange) {
      onChange(filter.id, null);
    }
    if (onClear) {
      onClear();
    }
  };

  // Check if filter has a value
  const hasValue = () => {
    if (localValue === null || localValue === undefined) return false;
    if (Array.isArray(localValue)) return localValue.length > 0;
    if (typeof localValue === 'object') {
      // For numerical range or date range
      return Object.values(localValue).some((v) => v !== null && v !== undefined);
    }
    return true;
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
      {(isEditMode && (onRemove || onEdit)) || hasValue() ? (
        <div className="absolute -top-2 -right-2 z-10 flex gap-1">
          {hasValue() && (
            <button
              onClick={handleClear}
              className="p-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all"
              title="Clear filter"
            >
              <RotateCcw className="w-3 h-3 text-gray-600 hover:text-orange-600" />
            </button>
          )}
          {isEditMode && onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all"
              title="Edit filter"
            >
              <Edit2 className="w-3 h-3 text-gray-600 hover:text-blue-600" />
            </button>
          )}
          {isEditMode && onRemove && (
            <button
              onClick={onRemove}
              className="p-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all"
              title="Remove filter"
            >
              <X className="w-3 h-3 text-gray-600 hover:text-red-600" />
            </button>
          )}
        </div>
      ) : null}

      <DashboardFilterWidget
        filter={filter}
        value={localValue}
        onChange={handleChange}
        className={compact ? '' : 'h-full'}
        isEditMode={isEditMode}
        showTitle={showTitle}
        compact={compact}
        isPublicMode={isPublicMode}
        publicToken={publicToken}
      />
    </div>
  );
}
