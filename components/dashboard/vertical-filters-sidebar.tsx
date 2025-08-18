'use client';

import React, { useState } from 'react';
import { FilterElement } from './filter-element';
import type { DashboardFilterConfig, AppliedFilters } from '@/types/dashboard-filters';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Plus, Filter as FilterIcon, RotateCcw, Check } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface VerticalFiltersSidebarProps {
  filters: DashboardFilterConfig[];
  onFilterChange: (filterId: string, value: any) => void;
  appliedFilters: AppliedFilters;
  isEditMode?: boolean;
  onRemove?: (filterId: string) => void;
  onAddFilter?: () => void;
  onEditFilter?: (filter: DashboardFilterConfig) => void;
  onApplyFilters?: () => void;
  onClearAll?: () => void;
  onReorderFilters?: (newOrder: DashboardFilterConfig[]) => void;
  isApplyingFilters?: boolean;
}

// Sortable filter item component
interface SortableFilterItemProps {
  filter: DashboardFilterConfig;
  appliedFilters: AppliedFilters;
  onFilterChange: (filterId: string, value: any) => void;
  onRemove?: (filterId: string) => void;
  onEdit?: (filter: DashboardFilterConfig) => void;
  isEditMode?: boolean;
}

function SortableFilterItem({
  filter,
  appliedFilters,
  onFilterChange,
  onRemove,
  onEdit,
  isEditMode = false,
}: SortableFilterItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: filter.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border border-gray-100 rounded-lg p-3 bg-gray-50 transition-all',
        isDragging && 'shadow-lg scale-105 z-50',
        isEditMode && 'hover:border-gray-300'
      )}
      {...attributes}
    >
      <FilterElement
        filter={filter}
        value={appliedFilters[filter.id]}
        onChange={onFilterChange}
        onRemove={isEditMode ? () => onRemove?.(filter.id) : undefined}
        onEdit={isEditMode ? () => onEdit?.(filter) : undefined}
        isEditMode={isEditMode}
        showTitle={true}
        compact={false}
        dragHandleProps={isEditMode ? listeners : undefined}
      />
    </div>
  );
}

export function VerticalFiltersSidebar({
  filters,
  onFilterChange,
  appliedFilters,
  isEditMode = false,
  onRemove,
  onAddFilter,
  onEditFilter,
  onApplyFilters,
  onClearAll,
  onReorderFilters,
  isApplyingFilters = false,
}: VerticalFiltersSidebarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = filters.findIndex((filter) => filter.id === active.id);
      const newIndex = filters.findIndex((filter) => filter.id === over.id);
      const newOrder = arrayMove(filters, oldIndex, newIndex);
      onReorderFilters?.(newOrder);
    }
  };

  // Check if any filters have values
  const hasActiveFilters = Object.values(appliedFilters).some(
    (value) =>
      value !== null && value !== undefined && (Array.isArray(value) ? value.length > 0 : true)
  );

  if (!filters || filters.length === 0) {
    if (isEditMode) {
      // Show placeholder in edit mode with add button
      return (
        <div className="w-80 border-r border-gray-200 bg-white flex-shrink-0">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
              <Button onClick={onAddFilter} size="sm" variant="outline" className="h-7 px-2">
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            </div>
            <div className="text-center py-8 text-gray-500">
              <FilterIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm font-medium">No filters added yet</p>
              <p className="text-xs mt-1">Click "Add" to create your first filter</p>
            </div>
          </div>
        </div>
      );
    }
    return null; // Don't show sidebar in preview mode if no filters
  }

  return (
    <div className="w-80 border-r border-gray-200 bg-white flex-shrink-0 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
          {isEditMode && (
            <Button onClick={onAddFilter} size="sm" variant="outline" className="h-7 px-2">
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {filters.length} filter{filters.length !== 1 ? 's' : ''}
            {hasActiveFilters && ' • Some applied'}
          </p>
        </div>

        {/* Action buttons - always show in header */}
        <div className="flex gap-2 mt-3">
          <Button
            onClick={onApplyFilters}
            size="sm"
            className="flex-1 h-8"
            disabled={isApplyingFilters}
          >
            {isApplyingFilters ? (
              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin mr-1" />
            ) : (
              <Check className="w-3 h-3 mr-1" />
            )}
            Apply
          </Button>
          <Button
            onClick={onClearAll}
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!hasActiveFilters || isApplyingFilters}
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Filters List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filters.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {filters.map((filter) => (
                  <SortableFilterItem
                    key={filter.id}
                    filter={filter}
                    appliedFilters={appliedFilters}
                    onFilterChange={onFilterChange}
                    onRemove={onRemove}
                    onEdit={onEditFilter}
                    isEditMode={isEditMode}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
}
