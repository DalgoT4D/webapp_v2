'use client';

import React, { useState } from 'react';
import { FilterElement } from './filter-element';
import type { DashboardFilterConfig, AppliedFilters } from '@/types/dashboard-filters';
import { Button } from '@/components/ui/button';
import { Plus, Filter as FilterIcon, RotateCcw, Check } from 'lucide-react';
import { deleteDashboardFilter } from '@/hooks/api/useDashboards';
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
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface HorizontalFiltersBarProps {
  initialFilters: DashboardFilterConfig[];
  dashboardId: number;
  isEditMode?: boolean;
  onAddFilter?: () => void;
  onEditFilter?: (filter: DashboardFilterConfig) => void;
  onFiltersApplied?: (appliedFilters: AppliedFilters) => void;
  onFiltersCleared?: () => void;
}

// Sortable filter item component for horizontal layout
interface SortableHorizontalFilterItemProps {
  filter: DashboardFilterConfig;
  currentFilterValues: Record<string, any>;
  onFilterChange: (filterId: string, value: any) => void;
  onRemove?: (filterId: string) => void;
  onEdit?: (filter: DashboardFilterConfig) => void;
  isEditMode?: boolean;
}

function SortableHorizontalFilterItem({
  filter,
  currentFilterValues,
  onFilterChange,
  onRemove,
  onEdit,
  isEditMode = false,
}: SortableHorizontalFilterItemProps) {
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
      className={`min-w-[200px] max-w-[300px] flex-shrink-0 transition-all ${
        isDragging ? 'shadow-lg scale-105 z-50' : ''
      }`}
    >
      <FilterElement
        filter={filter}
        value={currentFilterValues[filter.id]}
        onChange={onFilterChange}
        onRemove={isEditMode ? () => onRemove?.(filter.id) : undefined}
        onEdit={isEditMode ? () => onEdit?.(filter) : undefined}
        isEditMode={isEditMode}
        showTitle={true}
        compact={true}
        dragHandleProps={isEditMode ? listeners : undefined}
      />
    </div>
  );
}

export function HorizontalFiltersBar({
  initialFilters,
  dashboardId,
  isEditMode = false,
  onAddFilter,
  onEditFilter,
  onFiltersApplied,
  onFiltersCleared,
}: HorizontalFiltersBarProps) {
  // Internal state - changes here don't affect parent component
  const [filters, setFilters] = useState<DashboardFilterConfig[]>(initialFilters);
  const [currentFilterValues, setCurrentFilterValues] = useState<Record<string, any>>({});
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);

  console.log('🔧 HorizontalFiltersBar rendering (filter changes only)');

  // Handle filter value changes (internal only - no parent re-render)
  const handleFilterChange = (filterId: string, value: any) => {
    setCurrentFilterValues((prev) => ({
      ...prev,
      [filterId]: value,
    }));
  };

  // Handle filter removal (internal state management)
  const handleRemoveFilter = async (filterId: string) => {
    try {
      await deleteDashboardFilter(dashboardId, parseInt(filterId));
      setFilters((prev) => prev.filter((filter) => filter.id !== filterId));
      setCurrentFilterValues((prev) => {
        const updated = { ...prev };
        delete updated[filterId];
        return updated;
      });
    } catch (error: any) {
      console.error('Failed to delete filter:', error.message || 'Please try again');
    }
  };

  // Handle filter reordering (internal state only)
  const handleReorderFilters = (newOrder: DashboardFilterConfig[]) => {
    setFilters(newOrder);
  };

  // Apply filters - notify parent (this will cause chart re-renders)
  const handleApplyFilters = async () => {
    setIsApplyingFilters(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API call
      onFiltersApplied?.(currentFilterValues);
      console.log('🚀 Filters applied - charts will now re-render');
    } catch (error) {
      console.error('Error applying filters:', error);
    } finally {
      setIsApplyingFilters(false);
    }
  };

  // Clear all filters
  const handleClearAllFilters = () => {
    setCurrentFilterValues({});
    onFiltersCleared?.();
    console.log('🧹 All filters cleared');
  };
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
      handleReorderFilters(newOrder);
    }
  };

  // Check if any filters have values
  const hasActiveFilters = Object.values(currentFilterValues).some(
    (value) =>
      value !== null && value !== undefined && (Array.isArray(value) ? value.length > 0 : true)
  );

  if (!filters || filters.length === 0) {
    if (isEditMode) {
      // Show placeholder in edit mode with add button
      return (
        <div className="border-b border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
              <Button onClick={onAddFilter} size="sm" variant="outline" className="h-7 px-2">
                <Plus className="w-3 h-3 mr-1" />
                Add Filter
              </Button>
            </div>
          </div>
          <div className="text-center py-8 text-gray-500">
            <FilterIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium">No filters added yet</p>
            <p className="text-xs mt-1">Click "Add Filter" to create your first filter</p>
          </div>
        </div>
      );
    }
    return null; // Don't show bar in preview mode if no filters
  }

  return (
    <div className="border-b border-gray-200 bg-white">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
            <p className="text-xs text-gray-500">
              {filters.length} filter{filters.length !== 1 ? 's' : ''}
              {hasActiveFilters && ' • Some applied'}
            </p>
            {isEditMode && (
              <Button onClick={onAddFilter} size="sm" variant="outline" className="h-7 px-2">
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleApplyFilters}
              size="sm"
              disabled={isApplyingFilters}
              className="h-8"
            >
              {isApplyingFilters ? (
                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin mr-1" />
              ) : (
                <Check className="w-3 h-3 mr-1" />
              )}
              Apply
            </Button>
            <Button
              onClick={handleClearAllFilters}
              size="sm"
              variant="outline"
              className="h-8"
              disabled={!hasActiveFilters || isApplyingFilters}
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters List */}
      <div className="px-4 pb-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={filters.map((f) => f.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex flex-wrap gap-4 items-start">
              {filters.map((filter) => (
                <SortableHorizontalFilterItem
                  key={filter.id}
                  filter={filter}
                  currentFilterValues={currentFilterValues}
                  onFilterChange={handleFilterChange}
                  onRemove={handleRemoveFilter}
                  onEdit={onEditFilter}
                  isEditMode={isEditMode}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
