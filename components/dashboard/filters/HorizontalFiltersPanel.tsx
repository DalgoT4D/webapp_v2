'use client';

import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Filter as FilterIcon,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SortableFilterItem } from './SortableFilterItem';
import type { FiltersPanelShellProps } from './VerticalFiltersPanel';

/** The horizontal filter bar: edit-mode empty state or the sortable list. */
export function HorizontalFiltersPanel({
  panel,
  isEditMode,
  onAddFilter,
  onEditFilter,
  isPublicMode,
  publicToken,
  isReportMode,
}: FiltersPanelShellProps) {
  const {
    filters,
    currentFilterValues,
    isApplyingFilters,
    isCollapsed,
    isFiltersExpanded,
    hasActiveFilters,
    sensors,
    handleFilterChange,
    handleRemoveFilter,
    handleDragEnd,
    handleApplyFilters,
    handleClearAllFilters,
    togglePanelCollapse,
    toggleFiltersExpansion,
  } = panel;

  if (!filters || filters.length === 0) {
    // Edit mode only — UnifiedFiltersPanel returns null for an empty view panel.
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
                <Button
                  onClick={onAddFilter}
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  data-testid="dashboard-filter-add-btn"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Filter
                </Button>
                <button
                  onClick={togglePanelCollapse}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  aria-label="Hide filters"
                  data-testid="dashboard-filter-panel-hide-btn"
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

  return (
    <div
      // testid read by the walkthrough's exit guard: on the saved dashboard the flow only asks
      // for Share, and applying filters is the other thing users legitimately do there (see
      // DASHBOARD_VIEW_FILTERS in insight-walkthrough-coachmark.tsx).
      data-testid="dashboard-filters-panel"
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
                    data-testid="dashboard-filter-list-toggle-btn"
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
                  <Button
                    onClick={onAddFilter}
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    data-testid="dashboard-filter-add-btn"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleApplyFilters}
                  data-testid="dashboard-filter-apply-btn"
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
                  data-testid="dashboard-filter-clear-all-btn"
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
                  data-testid="dashboard-filter-panel-hide-btn"
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
                        value={currentFilterValues[filter.id] ?? null}
                        onFilterChange={handleFilterChange}
                        onRemove={handleRemoveFilter}
                        onEdit={onEditFilter}
                        isEditMode={isEditMode}
                        layout="horizontal"
                        isPublicMode={isPublicMode}
                        publicToken={publicToken}
                        isReportMode={isReportMode}
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
