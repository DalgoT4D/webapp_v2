'use client';

import type { DashboardFilterConfig, AppliedFilters } from '@/types/dashboard-filters';
import { useFiltersPanel } from '@/components/dashboard/filters/useFiltersPanel';
import { VerticalFiltersPanel } from '@/components/dashboard/filters/VerticalFiltersPanel';
import { HorizontalFiltersPanel } from '@/components/dashboard/filters/HorizontalFiltersPanel';

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
  isReportMode?: boolean;
}

/** The dashboard filter panel (builder, view, report, public). Vertical sidebar or horizontal bar. */
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
  isReportMode = false,
}: UnifiedFiltersPanelProps) {
  const panel = useFiltersPanel({
    initialFilters,
    dashboardId,
    isEditMode,
    isPublicMode,
    isReportMode,
    initiallyCollapsed,
    onFiltersApplied,
    onFiltersCleared,
    onCollapseChange,
  });

  if ((!panel.filters || panel.filters.length === 0) && !isEditMode) {
    return null; // Don't show in preview mode if no filters
  }

  const shellProps = {
    panel,
    isEditMode,
    onAddFilter,
    onEditFilter,
    isPublicMode,
    publicToken,
    isReportMode,
  };
  return layout === 'horizontal' ? (
    <HorizontalFiltersPanel {...shellProps} />
  ) : (
    <VerticalFiltersPanel {...shellProps} />
  );
}
