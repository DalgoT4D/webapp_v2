'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FilterElement } from './filter-element';
import type { DashboardFilterConfig, AppliedFilters } from '@/types/dashboard-filters';
import { cn } from '@/lib/utils';
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
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface UnifiedFiltersPanelProps {
  initialFilters: DashboardFilterConfig[];
  dashboardId: number;
  isEditMode?: boolean;
  layout: 'vertical' | 'horizontal';
  onAddFilter?: () => void;
  onEditFilter?: (filter: DashboardFilterConfig) => void;
  onFiltersApplied?: (appliedFilters: AppliedFilters) => void;
  onFiltersCleared?: () => void;
}

// Unified sortable filter item component
interface SortableFilterItemProps {
  filter: DashboardFilterConfig;
  currentFilterValues: Record<string, any>;
  onFilterChange: (filterId: string, value: any) => void;
  onRemove?: (filterId: string) => void;
  onEdit?: (filter: DashboardFilterConfig) => void;
  isEditMode?: boolean;
  layout: 'vertical' | 'horizontal';
}

function SortableFilterItem({
  filter,
  currentFilterValues,
  onFilterChange,
  onRemove,
  onEdit,
  isEditMode = false,
  layout,
}: SortableFilterItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: filter.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (layout === 'horizontal') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'min-w-[200px] max-w-[300px] flex-shrink-0 transition-all',
          isDragging && 'shadow-lg scale-105 z-50'
        )}
      >
        <FilterElement
          filter={filter}
          value={currentFilterValues[filter.id] ?? null}
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

  // Vertical layout
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
        value={currentFilterValues[filter.id] ?? null}
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

export function UnifiedFiltersPanel({
  initialFilters,
  dashboardId,
  isEditMode = false,
  layout,
  onAddFilter,
  onEditFilter,
  onFiltersApplied,
  onFiltersCleared,
}: UnifiedFiltersPanelProps) {
  // Helper function to extract default values from filters
  const getDefaultFilterValues = useCallback((filters: DashboardFilterConfig[]) => {
    console.log('📝 ========== GET DEFAULT FILTER VALUES START ==========');
    console.log(
      '📝 Extracting default values from filters:',
      filters.map((f) => ({ id: f.id, name: f.name, type: f.filter_type }))
    );

    const defaultValues: Record<string, any> = {};

    filters.forEach((filter) => {
      console.log(
        `📝 Processing filter ${filter.id} (${filter.name}) of type ${filter.filter_type}`
      );

      // Check for default values based on filter type
      if (filter.filter_type === 'value') {
        const valueFilter = filter as any;
        console.log(`📝 Value filter ${filter.id} settings:`, valueFilter.settings);
        if (valueFilter.settings?.has_default_value && valueFilter.settings?.default_value) {
          defaultValues[String(filter.id)] = valueFilter.settings.default_value;
          console.log(
            `📝 Added default value for ${filter.id}:`,
            valueFilter.settings.default_value
          );
        } else {
          console.log(`📝 No default value for value filter ${filter.id}`);
        }
      } else if (filter.filter_type === 'numerical') {
        const numFilter = filter as any;
        console.log(`📝 Numerical filter ${filter.id} settings:`, numFilter.settings);
        if (
          numFilter.settings?.default_min !== undefined ||
          numFilter.settings?.default_max !== undefined
        ) {
          defaultValues[String(filter.id)] = {
            min: numFilter.settings.default_min,
            max: numFilter.settings.default_max,
          };
          console.log(`📝 Added default range for ${filter.id}:`, defaultValues[String(filter.id)]);
        } else {
          console.log(`📝 No default range for numerical filter ${filter.id}`);
        }
      } else if (filter.filter_type === 'datetime') {
        const dateFilter = filter as any;
        console.log(`📝 DateTime filter ${filter.id} settings:`, dateFilter.settings);
        if (dateFilter.settings?.default_start_date || dateFilter.settings?.default_end_date) {
          defaultValues[String(filter.id)] = {
            start_date: dateFilter.settings.default_start_date,
            end_date: dateFilter.settings.default_end_date,
          };
          console.log(
            `📝 Added default date range for ${filter.id}:`,
            defaultValues[String(filter.id)]
          );
        } else {
          console.log(`📝 No default date range for datetime filter ${filter.id}`);
        }
      }
    });

    console.log(
      '📝 Final default filter values extracted:',
      JSON.stringify(defaultValues, null, 2)
    );
    console.log('📝 ========== GET DEFAULT FILTER VALUES END ==========');
    return defaultValues;
  }, []);

  // Internal state - changes here don't affect parent component
  const [filters, setFilters] = useState<DashboardFilterConfig[]>(initialFilters);
  const [currentFilterValues, setCurrentFilterValues] = useState<Record<string, any>>(() =>
    getDefaultFilterValues(initialFilters)
  );
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);

  // Sync filters when initialFilters change (when filters are added/deleted externally)
  useEffect(() => {
    console.log('🔄 ========== INITIAL FILTERS SYNC START ==========');
    console.log('🔄 UnifiedFiltersPanel - initialFilters changed, syncing:', initialFilters);
    console.log('🔄 Current filters before sync:', filters);
    console.log(
      '🔄 Current filter values before sync:',
      JSON.stringify(currentFilterValues, null, 2)
    );

    setFilters(initialFilters);

    // Update filter values: keep existing values, add defaults for new filters, remove old ones
    setCurrentFilterValues((prev) => {
      console.log('🔄 setCurrentFilterValues called - prev values:', JSON.stringify(prev, null, 2));

      const newValues = { ...prev };
      const existingFilterIds = initialFilters.map((f) => String(f.id)); // Convert to strings to match object keys

      console.log('🔄 Existing filter IDs from initialFilters:', existingFilterIds);

      // Remove values for filters that no longer exist
      Object.keys(newValues).forEach((filterId) => {
        if (!existingFilterIds.includes(filterId)) {
          console.log(`🔄 Removing value for deleted filter ${filterId}`);
          delete newValues[filterId];
        } else {
          console.log(`🔄 Keeping value for existing filter ${filterId}`);
        }
      });

      // Add default values for new filters that don't have values yet
      const defaultValues = getDefaultFilterValues(initialFilters);
      console.log('🔄 Default values from initialFilters:', JSON.stringify(defaultValues, null, 2));

      Object.keys(defaultValues).forEach((filterId) => {
        const stringFilterId = String(filterId); // Ensure consistent string comparison
        if (!(stringFilterId in newValues)) {
          console.log(
            `🔄 Adding default value for new filter ${stringFilterId}:`,
            defaultValues[filterId]
          );
          newValues[stringFilterId] = defaultValues[filterId];
        } else {
          console.log(
            `🔄 Filter ${stringFilterId} already has value, keeping:`,
            newValues[stringFilterId]
          );
        }
      });

      console.log('🔄 Final new values to be set:', JSON.stringify(newValues, null, 2));
      console.log('🔄 ========== INITIAL FILTERS SYNC END ==========');

      return newValues;
    });
  }, [initialFilters, getDefaultFilterValues]);

  console.log(`🔧 UnifiedFiltersPanel (${layout}) rendering - filter changes only`);

  // Handle filter value changes (internal only - no parent re-render)
  const handleFilterChange = (filterId: string, value: any) => {
    console.log('🎛️ Filter value changed - filterId:', filterId, 'value:', value);
    setCurrentFilterValues((prev) => {
      const updated = {
        ...prev,
        [filterId]: value,
      };
      console.log('🎛️ Updated currentFilterValues:', updated);
      return updated;
    });
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
    console.log('🔧 ========== APPLY FILTERS START ==========');
    console.log(
      '🔧 All filters:',
      filters.map((f) => ({ id: f.id, name: f.name, type: f.filter_type }))
    );
    console.log(
      '🔧 Current filter values BEFORE processing:',
      JSON.stringify(currentFilterValues, null, 2)
    );
    console.log('🔧 Number of filters:', filters.length);
    console.log('🔧 Number of filter values:', Object.keys(currentFilterValues).length);
    console.log('🔧 onFiltersApplied callback exists:', !!onFiltersApplied);

    // Make sure all filters have values (use null if not set)
    const appliedFilters: Record<string, any> = {};
    filters.forEach((filter) => {
      console.log(`🔧 Processing filter ${filter.id} (${filter.name})`);
      if (filter.id in currentFilterValues) {
        const filterValue = currentFilterValues[filter.id];
        appliedFilters[filter.id] = filterValue;
        console.log(`✅ Filter ${filter.id} has value:`, filterValue);
      } else {
        // Filter has no value set, include it as null
        appliedFilters[filter.id] = null;
        console.log(`⚠️ Filter "${filter.name}" (${filter.id}) has no value set, using null`);
      }
    });

    console.log('🔧 Applied filters AFTER processing:', JSON.stringify(appliedFilters, null, 2));

    setIsApplyingFilters(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API call

      console.log(
        '🚀 About to call onFiltersApplied with:',
        JSON.stringify(appliedFilters, null, 2)
      );
      onFiltersApplied?.(appliedFilters);
      console.log('🚀 Filters applied - charts should now re-render');
      console.log('🔧 ========== APPLY FILTERS END ==========');
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
      const emptyStateClass =
        layout === 'vertical'
          ? 'w-80 border-r border-gray-200 bg-white flex-shrink-0'
          : 'border-b border-gray-200 bg-white p-4';

      return (
        <div className={emptyStateClass}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
              <Button onClick={onAddFilter} size="sm" variant="outline" className="h-7 px-2">
                <Plus className="w-3 h-3 mr-1" />
                Add{layout === 'vertical' ? '' : ' Filter'}
              </Button>
            </div>
            <div className="text-center py-8 text-gray-500">
              <FilterIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm font-medium">No filters added yet</p>
              <p className="text-xs mt-1">
                Click "Add{layout === 'vertical' ? '' : ' Filter'}" to create your first filter
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null; // Don't show in preview mode if no filters
  }

  if (layout === 'horizontal') {
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filters.map((f) => f.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex flex-wrap gap-4 items-start">
                {filters.map((filter) => (
                  <SortableFilterItem
                    key={filter.id}
                    filter={filter}
                    currentFilterValues={currentFilterValues}
                    onFilterChange={handleFilterChange}
                    onRemove={handleRemoveFilter}
                    onEdit={onEditFilter}
                    isEditMode={isEditMode}
                    layout={layout}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    );
  }

  // Vertical layout
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
            onClick={handleApplyFilters}
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
                    currentFilterValues={currentFilterValues}
                    onFilterChange={handleFilterChange}
                    onRemove={handleRemoveFilter}
                    onEdit={onEditFilter}
                    isEditMode={isEditMode}
                    layout={layout}
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
