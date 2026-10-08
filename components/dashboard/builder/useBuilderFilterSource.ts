import { useDashboard } from '@/hooks/api/useDashboards';
import { normalizeBuilderFilters } from '@/components/dashboard/logic/builder-filters';

type ApiFilterRows = Parameters<typeof normalizeBuilderFilters>[0];

/**
 * The builder's filter list. While the live dashboard loads it keeps the payload the edit page
 * passed in (no mid-lifecycle source switch); once loaded, the live filters win. Rebuilt every
 * render on purpose — see normalizeBuilderFilters.
 */
export function useBuilderFilterSource(
  dashboardId: number | undefined,
  initialData: { filters?: ApiFilterRows } | undefined
) {
  // Fetch live dashboard data to get updated filters
  const {
    data: liveDashboardData,
    isLoading: isLoadingLiveDashboard,
    isError: isErrorLiveDashboard,
  } = useDashboard(dashboardId!);

  // Log error if live dashboard fetch fails
  if (isErrorLiveDashboard) {
    console.error('Failed to fetch live dashboard data:', {
      dashboardId,
      error: isErrorLiveDashboard,
      context: 'Dashboard filter synchronization',
    });
    // TODO: Add telemetry/error reporting here if available
  }

  // Stable filter source selection: use initialData while loading to avoid mid-lifecycle switches
  // Once loaded, use live data with fallback to initial data
  const dashboardFilters = isLoadingLiveDashboard
    ? initialData?.filters // Stable: don't switch sources while loading
    : liveDashboardData?.filters || initialData?.filters; // Live data once loaded

  // Filters for the panel. Rebuilt every render on purpose (see normalizeBuilderFilters).
  return normalizeBuilderFilters(dashboardFilters);
}
