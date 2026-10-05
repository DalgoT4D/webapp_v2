import { useDashboard } from '@/hooks/api/useDashboards';

interface DashboardViewSourceOptions {
  dashboardId: number;
  isPublicMode: boolean;
  isReportMode: boolean;
  /** Pre-fetched dashboard payload (public / report pages). Verbatim prop type — see Task 13 row 12. */
  dashboardData?: any;
}

/** The dashboard a view renders: the pre-fetched payload on public/report pages, else the API (SWR). */
export function useDashboardViewSource({
  dashboardId,
  isPublicMode,
  isReportMode,
  dashboardData,
}: DashboardViewSourceOptions) {
  // Fetch dashboard data (skip API call if we have pre-fetched data for public mode)
  const {
    data: dashboardFromApi,
    isLoading: apiIsLoading,
    isError: apiIsError,
    mutate,
  } = useDashboard((isPublicMode || isReportMode) && dashboardData ? null : dashboardId);

  // Use pre-fetched data for public/report mode, otherwise use API data
  const dashboard =
    (isPublicMode || isReportMode) && dashboardData ? dashboardData : dashboardFromApi;

  // Override loading and error states when we have pre-fetched data
  const isLoading = (isPublicMode || isReportMode) && dashboardData ? false : apiIsLoading;
  const isError = (isPublicMode || isReportMode) && dashboardData ? false : apiIsError;

  return { dashboard, isLoading, isError, mutate };
}
