'use client';

import type { ComponentProps } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UnifiedFiltersPanel } from '@/components/dashboard/unified-filters-panel';

type PanelProps = ComponentProps<typeof UnifiedFiltersPanel>;

interface BuilderHorizontalFiltersProps {
  initialFilters: PanelProps['initialFilters'];
  dashboardId: number;
  isCollapsed: boolean;
  onCollapseChange: (collapsed: boolean) => void;
  onAddFilter: PanelProps['onAddFilter'];
  onEditFilter: PanelProps['onEditFilter'];
  onFiltersApplied: PanelProps['onFiltersApplied'];
  onFiltersCleared: PanelProps['onFiltersCleared'];
}

/** Below 1200 px: the horizontal filter bar, or the "Show Filters (N)" button while it is collapsed. */
export function BuilderHorizontalFilters({
  initialFilters,
  dashboardId,
  isCollapsed,
  onCollapseChange,
  onAddFilter,
  onEditFilter,
  onFiltersApplied,
  onFiltersCleared,
}: BuilderHorizontalFiltersProps) {
  return (
    <>
      {!isCollapsed && (
        <UnifiedFiltersPanel
          initialFilters={initialFilters}
          dashboardId={dashboardId}
          isEditMode={true}
          layout="horizontal"
          onAddFilter={onAddFilter}
          onEditFilter={onEditFilter}
          onFiltersApplied={onFiltersApplied}
          onFiltersCleared={onFiltersCleared}
          onCollapseChange={onCollapseChange}
        />
      )}
      {/* Show Filters Button - appears when horizontal filters are collapsed */}
      {isCollapsed && initialFilters.length > 0 && (
        <div className="border-b border-gray-200 bg-white p-2">
          <div className="flex items-center justify-center">
            <Button
              onClick={() => onCollapseChange(false)}
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              data-testid="dashboard-builder-show-filters-btn"
            >
              <Filter className="w-3 h-3 mr-1" />
              Show Filters ({initialFilters.length})
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
