import useSWR from 'swr';
import { apiGet, apiPut } from '@/lib/api';

interface DashboardBranding {
  dashboard_logo_url: string | null;
  dashboard_logo_width: number;
}

interface OrgPreferencesResponse {
  success: boolean;
  res: DashboardBranding & Record<string, unknown>;
}

/**
 * Hook to fetch dashboard branding settings from org preferences
 */
export function useDashboardBranding() {
  const { data, error, isLoading, mutate } = useSWR<OrgPreferencesResponse>(
    '/api/orgpreferences/',
    apiGet,
    { revalidateOnFocus: false }
  );

  return {
    branding: data?.res
      ? {
          dashboard_logo_url: data.res.dashboard_logo_url,
          dashboard_logo_width: data.res.dashboard_logo_width ?? 80,
        }
      : null,
    isLoading,
    error,
    mutate,
  };
}

/**
 * Update dashboard branding settings
 */
export async function updateDashboardBranding(data: {
  dashboard_logo_url?: string | null;
  dashboard_logo_width?: number;
}): Promise<DashboardBranding> {
  const response = await apiPut('/api/orgpreferences/dashboard-branding', data);
  return response.res;
}
