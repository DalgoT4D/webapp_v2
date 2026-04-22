import { useMemo } from 'react';
import useSWR from 'swr';
import { apiGet, apiPut } from '@/lib/api';

// localStorage key for prototype logo persistence (no backend upload yet)
const LOGO_STORAGE_KEY = 'dalgo_org_logo_url';
const LOGO_WIDTH_STORAGE_KEY = 'dalgo_org_logo_width';

export function saveLogoToLocal(url: string | null, width: number) {
  if (typeof window === 'undefined') return;
  if (url) {
    localStorage.setItem(LOGO_STORAGE_KEY, url);
    localStorage.setItem(LOGO_WIDTH_STORAGE_KEY, String(width));
  } else {
    localStorage.removeItem(LOGO_STORAGE_KEY);
    localStorage.removeItem(LOGO_WIDTH_STORAGE_KEY);
  }
}

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

interface UseDashboardBrandingOptions {
  enabled?: boolean;
  initialBranding?: OrgBranding | null;
}

/**
 * Hook to fetch org branding settings (logo + chart palette)
 */
export function useDashboardBranding(options: UseDashboardBrandingOptions = {}) {
  const { enabled = true, initialBranding } = options;
  const { data, error, isLoading, mutate } = useSWR<OrgPreferencesResponse>(
    enabled ? '/api/orgpreferences/' : null,
    apiGet,
    { revalidateOnFocus: false }
  );

  const branding = useMemo<OrgBranding | null>(() => {
    if (initialBranding !== undefined) {
      return initialBranding;
    }

    // Read local logo as fallback for prototype (when backend doesn't store uploaded files yet)
    const localLogoUrl =
      typeof window !== 'undefined' ? localStorage.getItem(LOGO_STORAGE_KEY) : null;
    const localLogoWidth =
      typeof window !== 'undefined' ? localStorage.getItem(LOGO_WIDTH_STORAGE_KEY) : null;

    if (!data?.res) {
      // No backend data yet — use localStorage only if available
      if (!localLogoUrl) return null;
      return {
        dashboard_logo_url: localLogoUrl,
        dashboard_logo_width: localLogoWidth ? parseInt(localLogoWidth) : 80,
        chart_palette_name: null,
        chart_palette_colors: null,
      };
    }
    return {
      // Prefer backend value, fall back to localStorage for logo
      dashboard_logo_url: data.res.dashboard_logo_url || localLogoUrl,
      dashboard_logo_width:
        data.res.dashboard_logo_width ?? (localLogoWidth ? parseInt(localLogoWidth) : 80),
      chart_palette_name: data.res.chart_palette_name,
      chart_palette_colors: data.res.chart_palette_colors,
    };
  }, [data, initialBranding]);

  return {
    branding,
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
