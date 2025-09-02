import { useCallback } from 'react';
import useSWR from 'swr';
import { apiGet, apiPut, apiDelete } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import type {
  UserLandingPreference,
  OrgLandingSettings,
  LandingPageResolution,
} from '@/types/landing';

/**
 * Hook for managing user's personal landing page preference
 */
export function useLandingPreference() {
  const { currentOrg } = useAuthStore();

  const { data, error, mutate } = useSWR<UserLandingPreference | null>(
    currentOrg ? `/api/users/landing-preference/${currentOrg.slug}/` : null,
    async (url: string) => {
      try {
        return await apiGet(url);
      } catch (err: any) {
        console.warn('Landing preferences API not available:', err.message);
        // Return null if no preference is set (404 is expected) or API not implemented
        if (
          err.message?.includes('404') ||
          err.message?.includes('not found') ||
          err.message?.includes('non-JSON')
        ) {
          return null;
        }
        throw err;
      }
    },
    {
      onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
        // Never retry on 404 or non-JSON responses (API not implemented)
        if (
          error?.message?.includes('404') ||
          error?.message?.includes('Not Found') ||
          error?.message?.includes('non-JSON')
        ) {
          return;
        }
        // Only retry once for other errors
        if (retryCount >= 1) return;
        setTimeout(() => revalidate({ retryCount }), 3000);
      },
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const setLandingPreference = useCallback(
    async (dashboardId: number) => {
      if (!currentOrg) return;

      try {
        const result = await apiPut(`/api/users/landing-preference/${currentOrg.slug}/`, {
          dashboard_id: dashboardId,
        });

        await mutate(result);
        toast.success('Landing page updated successfully');

        return result;
      } catch (error: any) {
        console.error('Failed to set landing preference:', error);
        toast.error('Failed to update landing page');
        throw error;
      }
    },
    [currentOrg, mutate]
  );

  const clearLandingPreference = useCallback(async () => {
    if (!currentOrg) return;

    try {
      await apiDelete(`/api/users/landing-preference/${currentOrg.slug}/`);
      await mutate(null);
      toast.success('Reverted to organization default');
    } catch (error: any) {
      console.error('Failed to clear landing preference:', error);
      toast.error('Failed to clear landing page preference');
      throw error;
    }
  }, [currentOrg, mutate]);

  return {
    data,
    isLoading: !error && data === undefined,
    error,
    setLandingPreference,
    clearLandingPreference,
    mutate,
  };
}

/**
 * Hook for managing organization default dashboard (admin only)
 */
export function useOrgLandingSettings() {
  const { currentOrg, getCurrentOrgUser } = useAuthStore();
  const orgUser = getCurrentOrgUser();

  // Check if user is admin
  const isAdmin = orgUser?.permissions?.includes('admin') || orgUser?.new_role_slug === 'admin';

  const { data, error, mutate } = useSWR<OrgLandingSettings>(
    currentOrg && isAdmin ? `/api/orgs/${currentOrg.slug}/landing-settings/` : null,
    async (url: string) => {
      try {
        return await apiGet(url);
      } catch (err: any) {
        console.warn('Org landing settings API not available:', err.message);
        // Return empty settings if none exist or API not implemented
        if (err.message?.includes('404') || err.message?.includes('non-JSON')) {
          return { default_dashboard_id: null };
        }
        throw err;
      }
    },
    {
      onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
        // Never retry on 404 or non-JSON responses (API not implemented)
        if (
          error?.message?.includes('404') ||
          error?.message?.includes('Not Found') ||
          error?.message?.includes('non-JSON')
        ) {
          return;
        }
        // Only retry once for other errors
        if (retryCount >= 1) return;
        setTimeout(() => revalidate({ retryCount }), 3000);
      },
      revalidateOnFocus: false,
    }
  );

  const setOrgDefaultDashboard = useCallback(
    async (dashboardId: number | null) => {
      if (!currentOrg || !isAdmin) {
        throw new Error('Admin permissions required');
      }

      try {
        const result = await apiPut(`/api/orgs/${currentOrg.slug}/landing-settings/`, {
          default_dashboard_id: dashboardId,
        });

        await mutate(result);
        toast.success(
          dashboardId
            ? 'Organization default dashboard updated'
            : 'Organization default dashboard cleared'
        );

        return result;
      } catch (error: any) {
        console.error('Failed to set org default dashboard:', error);
        toast.error('Failed to update organization default');
        throw error;
      }
    },
    [currentOrg, isAdmin, mutate]
  );

  return {
    data,
    isLoading: !error && data === undefined,
    error,
    isAdmin,
    setOrgDefaultDashboard,
    mutate,
  };
}

/**
 * Hook that resolves which dashboard to show on landing page
 * Handles the fallback logic: user preference → org default → blank state
 */
export function useLandingPageResolution(): LandingPageResolution & { isLoading: boolean } {
  const { data: userPreference, isLoading: userLoading, error: userError } = useLandingPreference();
  const { data: orgSettings, isLoading: orgLoading, error: orgError } = useOrgLandingSettings();

  // If both APIs are failing (likely not implemented yet), show blank state immediately
  const apisUnavailable = userError && orgError;

  if (apisUnavailable) {
    return {
      dashboardId: null,
      source: 'none',
      isLoading: false,
    };
  }

  const isLoading = userLoading || orgLoading;

  if (isLoading) {
    return {
      dashboardId: null,
      source: 'none',
      isLoading: true,
    };
  }

  // Check user preference first
  if (userPreference?.dashboard_id) {
    return {
      dashboardId: userPreference.dashboard_id,
      source: 'user',
      isLoading: false,
    };
  }

  // Fall back to org default
  if (orgSettings?.default_dashboard_id) {
    return {
      dashboardId: orgSettings.default_dashboard_id,
      source: 'org',
      fallbackApplied: !!userPreference, // True if user had a preference that couldn't be used
      isLoading: false,
    };
  }

  // No dashboard available
  return {
    dashboardId: null,
    source: 'none',
    isLoading: false,
  };
}
