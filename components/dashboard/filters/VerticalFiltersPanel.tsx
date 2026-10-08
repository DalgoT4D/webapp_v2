'use client';

import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Filter as FilterIcon,
  PanelLeftClose,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DashboardFilterConfig } from '@/types/dashboard-filters';
import { SortableFilterItem } from './SortableFilterItem';
import type { FiltersPanelState } from './useFiltersPanel';

export interface FiltersPanelShellProps {
  panel: FiltersPanelState;
  isEditMode: boolean;
  onAddFilter?: () => void;
  onEditFilter?: (filter: DashboardFilterConfig) => void;
  isPublicMode: boolean;
  publicToken?: string;
  isReportMode: boolean;
}

/** The vertical filter sidebar: edit-mode empty state, collapsed rail, or the sortable list. */
export function VerticalFiltersPanel({
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
              data-testid="dashboard-filter-panel-expand-btn"
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
                <button
                  onClick={togglePanelCollapse}
                  className="p-1 hover:bg-gray-100 rounded transition-colors ml-1"
                  aria-label="Collapse filters panel"
                  data-testid="dashboard-filter-panel-collapse-btn"
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
  }

  // Vertical layout
  return (
    <div
      // See the horizontal layout's copy of this above.
      data-testid="dashboard-filters-panel"
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
            data-testid="dashboard-filter-panel-expand-btn"
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
              <div className="flex items-center gap-1">
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
                <button
                  onClick={togglePanelCollapse}
                  className="p-1 hover:bg-gray-100 rounded transition-colors ml-1"
                  aria-label="Collapse filters panel"
                  data-testid="dashboard-filter-panel-collapse-btn"
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

            <div className="flex gap-2 mt-3">
              <Button
                onClick={handleApplyFilters}
                data-testid="dashboard-filter-apply-btn"
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
                data-testid="dashboard-filter-clear-all-btn"
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
                          value={currentFilterValues[filter.id] ?? null}
                          onFilterChange={handleFilterChange}
                          onRemove={handleRemoveFilter}
                          onEdit={onEditFilter}
                          isEditMode={isEditMode}
                          layout="vertical"
                          isPublicMode={isPublicMode}
                          publicToken={publicToken}
                          isReportMode={isReportMode}
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
