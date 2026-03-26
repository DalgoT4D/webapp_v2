import useSWR from 'swr';
import { apiGet, apiPut } from '@/lib/api';

export interface OrgBranding {
  dashboard_logo_url: string | null;
  dashboard_logo_width: number;
  chart_palette_name: string | null;
  chart_palette_colors: string[] | null;
}

interface OrgPreferencesResponse {
  success: boolean;
  res: OrgBranding & Record<string, unknown>;
}

/**
 * Hook to fetch org branding settings (logo + chart palette)
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
          chart_palette_name: data.res.chart_palette_name,
          chart_palette_colors: data.res.chart_palette_colors,
        }
      : null,
    isLoading,
    error,
    mutate,
  };
}

/**
 * Update org branding settings (logo + palette)
 */
export async function updateDashboardBranding(data: {
  dashboard_logo_url?: string | null;
  dashboard_logo_width?: number;
  chart_palette_name?: string | null;
  chart_palette_colors?: string[] | null;
}): Promise<OrgBranding> {
  const response = await apiPut('/api/orgpreferences/dashboard-branding', data);
  return response.res;
}
