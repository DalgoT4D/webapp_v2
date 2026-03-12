'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FilterElement } from './filter-element';
import type { DashboardFilterConfig, AppliedFilters } from '@/types/dashboard-filters';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Filter as FilterIcon,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  X,
} from 'lucide-react';
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
  onCollapseChange?: (isCollapsed: boolean) => void;
  isPublicMode?: boolean;
  publicToken?: string;
  initiallyCollapsed?: boolean;
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
  isPublicMode?: boolean;
  publicToken?: string;
}

function SortableFilterItem({
  filter,
  currentFilterValues,
  onFilterChange,
  onRemove,
  onEdit,
  isEditMode = false,
  layout,
  isPublicMode = false,
  publicToken,
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
          'min-w-[250px] max-w-[400px] flex-shrink-0 transition-all',
          isDragging && 'shadow-lg scale-105 z-50'
        )}
      >
        <FilterElement
          filter={filter}
          value={currentFilterValues[filter.id] ?? null}
          onChange={onFilterChange}
          onRemove={isEditMode ? () => onRemove?.(filter.id) : undefined}
          onEdit={isEditMode ? () => onEdit?.(filter) : undefined}
          isPublicMode={isPublicMode}
          publicToken={publicToken}
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
        isPublicMode={isPublicMode}
        publicToken={publicToken}
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
  onCollapseChange,
  isPublicMode = false,
  publicToken,
  initiallyCollapsed = false,
}: UnifiedFiltersPanelProps) {
  // Helper function to extract default values from filters
  const getDefaultFilterValues = useCallback((filters: DashboardFilterConfig[]) => {
    const defaultValues: Record<string, any> = {};

    filters.forEach((filter) => {
      // Check for default values based on filter type
      if (filter.filter_type === 'value') {
        const valueFilter = filter as any;
        if (valueFilter.settings?.has_default_value && valueFilter.settings?.default_value) {
          defaultValues[String(filter.id)] = valueFilter.settings.default_value;
        }
      } else if (filter.filter_type === 'numerical') {
        const numFilter = filter as any;
        if (
          numFilter.settings?.default_min !== undefined ||
          numFilter.settings?.default_max !== undefined
        ) {
          defaultValues[String(filter.id)] = {
            min: numFilter.settings.default_min,
            max: numFilter.settings.default_max,
          };
        }
      } else if (filter.filter_type === 'datetime') {
        const dateFilter = filter as any;
        if (dateFilter.settings?.default_start_date || dateFilter.settings?.default_end_date) {
          defaultValues[String(filter.id)] = {
            start_date: dateFilter.settings.default_start_date,
            end_date: dateFilter.settings.default_end_date,
          };
        }
      }
    });

    return defaultValues;
  }, []);

  // Internal state - changes here don't affect parent component
  const [filters, setFilters] = useState<DashboardFilterConfig[]>(initialFilters);
  const [currentFilterValues, setCurrentFilterValues] = useState<Record<string, any>>(() =>
    getDefaultFilterValues(initialFilters)
  );
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(initiallyCollapsed); // For collapsing entire panel
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(true); // For showing/hiding filter list
  const [locallyDeletedFilterIds, setLocallyDeletedFilterIds] = useState<Set<string>>(new Set()); // Track deleted filters

  // Sync filters when initialFilters change (when filters are added/deleted externally)
  useEffect(() => {
    try {
      // Validate initialFilters before setting
      const validFilters = (initialFilters || []).filter(
        (filter) =>
          filter && filter.id && filter.schema_name && filter.table_name && filter.column_name
      );

      if (validFilters.length !== initialFilters.length) {
        console.warn('Some filters were invalid and skipped', {
          total: initialFilters.length,
          valid: validFilters.length,
        });
      }

      // Filter out locally deleted filters to prevent them from reappearing
      const filtersToShow = validFilters.filter(
        (filter) => !locallyDeletedFilterIds.has(String(filter.id))
      );

      setFilters(filtersToShow);

      // Update filter values: keep existing values, add defaults for new filters, remove old ones
      setCurrentFilterValues((prev) => {
        const newValues = { ...prev };
        const existingFilterIds = filtersToShow.map((f) => String(f.id)); // Convert to strings to match object keys

        // Remove values for filters that no longer exist
        Object.keys(newValues).forEach((filterId) => {
          if (!existingFilterIds.includes(filterId)) {
            delete newValues[filterId];
          }
        });

        // Add default values for new filters that don't have values yet
        try {
          const defaultValues = getDefaultFilterValues(filtersToShow);

          Object.keys(defaultValues).forEach((filterId) => {
            const stringFilterId = String(filterId); // Ensure consistent string comparison
            if (!(stringFilterId in newValues)) {
              newValues[stringFilterId] = defaultValues[filterId];
            }
          });
        } catch (error) {
          console.error('Error getting default filter values:', error);
        }

        return newValues;
      });
    } catch (error) {
      console.error('Error syncing filters:', error);
      setFilters([]); // Fallback to empty filters on error
      setCurrentFilterValues({});
    }
  }, [initialFilters, getDefaultFilterValues, locallyDeletedFilterIds]);

  // Handle filter value changes (internal only - no parent re-render)
  const handleFilterChange = (filterId: string, value: any) => {
    setCurrentFilterValues((prev) => {
      const updated = {
        ...prev,
        [filterId]: value,
      };
      return updated;
    });
  };

  // Handle filter removal (internal state management)
  const handleRemoveFilter = async (filterId: string) => {
    try {
      await deleteDashboardFilter(dashboardId, parseInt(filterId));

      // Track this filter as locally deleted to prevent it from reappearing
      setLocallyDeletedFilterIds((prev) => new Set(prev).add(String(filterId)));

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
    // Make sure all filters have values (use null if not set)
    const appliedFilters: Record<string, any> = {};
    filters.forEach((filter) => {
      if (filter.id in currentFilterValues) {
        const filterValue = currentFilterValues[filter.id];
        appliedFilters[filter.id] = filterValue;
      } else {
        // Filter has no value set, include it as null
        appliedFilters[filter.id] = null;
      }
    });

    setIsApplyingFilters(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API call
      onFiltersApplied?.(appliedFilters);
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

  // Toggle panel collapse state (hides entire panel)
  const togglePanelCollapse = () => {
    const newCollapseState = !isCollapsed;
    setIsCollapsed(newCollapseState);
    onCollapseChange?.(newCollapseState);
  };

  // Toggle filter list expansion (shows/hides filter list)
  const toggleFiltersExpansion = () => {
    setIsFiltersExpanded(!isFiltersExpanded);
  };

  // For vertical layout, we maintain vertical behavior but change container positioning on mobile
  // For horizontal layout, we keep horizontal behavior
  const effectiveLayout = layout;

  if (!filters || filters.length === 0) {
    if (isEditMode) {
      if (layout === 'vertical') {
        return (
          <div
            className={cn(
              'border-b-2 md:border-b-0 md:border-r border-gray-300 bg-white flex-shrink-0 shadow-sm md:shadow-none transition-all duration-300',
              isCollapsed ? 'w-full md:w-12' : 'w-full md:w-96'
            )}
          >
            {isCollapsed ? (
              // Collapsed panel - minimal view
              <div className="p-2 flex flex-col items-center gap-2">
                <button
                  onClick={togglePanelCollapse}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                  aria-label="Expand filters panel"
                  title="Expand filters panel"
                >
                  <PanelLeftClose className="w-4 h-4 text-gray-500 rotate-180" />
                </button>
                {hasActiveFilters && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full" title="Filters applied" />
                )}
              </div>
            ) : (
              // Expanded panel
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button onClick={onAddFilter} size="sm" variant="outline" className="h-7 px-2">
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                    <button
                      onClick={togglePanelCollapse}
                      className="p-1 hover:bg-gray-100 rounded transition-colors ml-1"
                      aria-label="Collapse filters panel"
                      title="Collapse filters panel"
                    >
                      <PanelLeftClose className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
                <div className="text-center py-8 text-gray-500">
                  <FilterIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm font-medium">No filters added yet</p>
                  <p className="text-xs mt-1">Click "Add" to create your first filter</p>
                </div>
              </div>
            )}
          </div>
        );
      } else {
        // Horizontal layout empty state
        return (
          <div
            className={cn(
              'border-b border-gray-200 bg-white transition-all duration-300',
              isCollapsed && 'h-0 overflow-hidden'
            )}
          >
            {!isCollapsed && (
              <div className="px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={onAddFilter} size="sm" variant="outline" className="h-7 px-2">
                      <Plus className="w-3 h-3 mr-1" />
                      Add Filter
                    </Button>
                    <button
                      onClick={togglePanelCollapse}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      aria-label="Hide filters"
                      title="Hide filters"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
                <div className="text-center py-8 text-gray-500 mt-4">
                  <FilterIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm font-medium">No filters added yet</p>
                  <p className="text-xs mt-1">Click "Add Filter" to create your first filter</p>
                </div>
              </div>
            )}
          </div>
        );
      }
    }
    return null; // Don't show in preview mode if no filters
  }

  if (layout === 'horizontal') {
    return (
      <div
        className={cn(
          'border-b border-gray-200 bg-white transition-all duration-300',
          isCollapsed && 'h-0 overflow-hidden'
        )}
      >
        {!isCollapsed && (
          <>
            {/* Header */}
            <div className="px-4 pt-4 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
                    <button
                      onClick={toggleFiltersExpansion}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      aria-label={isFiltersExpanded ? 'Hide filter list' : 'Show filter list'}
                      title={isFiltersExpanded ? 'Hide filter list' : 'Show filter list'}
                    >
                      {isFiltersExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                    {hasActiveFilters && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full" title="Filters applied" />
                    )}
                  </div>
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
                <div className="flex items-center gap-2">
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
                  <button
                    onClick={togglePanelCollapse}
                    className="p-1 hover:bg-gray-100 rounded transition-colors ml-1"
                    aria-label="Hide filters"
                    title="Hide filters"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            </div>

            {/* Filters List - Collapsible */}
            {isFiltersExpanded && (
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
                          isPublicMode={isPublicMode}
                          publicToken={publicToken}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Vertical layout
  return (
    <div
      className={cn(
        'border-b-2 md:border-b-0 md:border-r border-gray-300 bg-white flex-shrink-0 flex flex-col overflow-hidden shadow-sm md:shadow-none transition-all duration-300',
        isCollapsed ? 'w-full md:w-12' : 'w-full md:w-96'
      )}
    >
      {isCollapsed ? (
        // Collapsed panel - minimal view
        <div className="p-2 flex flex-col items-center gap-2">
          <button
            onClick={togglePanelCollapse}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            aria-label="Expand filters panel"
            title="Expand filters panel"
          >
            <PanelLeftClose className="w-4 h-4 text-gray-500 rotate-180" />
          </button>
          {hasActiveFilters && (
            <div className="w-2 h-2 bg-blue-500 rounded-full" title="Filters applied" />
          )}
        </div>
      ) : (
        // Expanded panel
        <>
          {/* Header */}
          <div className="p-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
                <button
                  onClick={toggleFiltersExpansion}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  aria-label={isFiltersExpanded ? 'Hide filter list' : 'Show filter list'}
                  title={isFiltersExpanded ? 'Hide filter list' : 'Show filter list'}
                >
                  {isFiltersExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                {hasActiveFilters && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full" title="Filters applied" />
                )}
              </div>
              <div className="flex items-center gap-1">
                {isEditMode && (
                  <Button onClick={onAddFilter} size="sm" variant="outline" className="h-7 px-2">
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                )}
                <button
                  onClick={togglePanelCollapse}
                  className="p-1 hover:bg-gray-100 rounded transition-colors ml-1"
                  aria-label="Collapse filters panel"
                  title="Collapse filters panel"
                >
                  <PanelLeftClose className="w-4 h-4 text-gray-500" />
                </button>
              </div>
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

          {/* Filters List - Collapsible */}
          {isFiltersExpanded && (
            <div className="flex-1 overflow-y-auto md:overflow-y-auto">
              <div className="p-4 pb-6 md:pb-4">
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
                          layout={effectiveLayout}
                          isPublicMode={isPublicMode}
                          publicToken={publicToken}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                {/* Mobile section separator */}
                <div className="block md:hidden mt-4 pt-4 border-t border-gray-200">
                  <div className="text-center text-xs text-gray-500 font-medium">
                    Dashboard Content
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
