import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { apiPost, apiDelete, apiGet } from '@/lib/api';
import { toastSuccess, toastError } from '@/lib/toast';

interface LandingPageResponse {
  success: boolean;
  message: string;
}

interface LandingPageResolve {
  dashboard_id: number | null;
  dashboard_title: string | null;
  dashboard_type: string | null;
  source: 'personal' | 'org_default' | 'none';
}

export function useLandingPage() {
  const [isLoading, setIsLoading] = useState(false);

  // Get resolved landing page for current user
  const resolveLandingPage = useCallback(async (): Promise<LandingPageResolve | null> => {
    try {
      setIsLoading(true);
      const response = await apiGet('/api/dashboards/landing-page/resolve');
      return response;
    } catch (error) {
      console.error('Error resolving landing page:', error);
      toastError.load(error, 'landing page');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set personal landing dashboard
  const setPersonalLanding = useCallback(async (dashboardId: number): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response: LandingPageResponse = await apiPost(
        `/api/dashboards/landing-page/set-personal/${dashboardId}`
      );

      if (response.success) {
        // Revalidate user data to update landing page indicators
        await mutate('/api/v1/organizations/users/currentuserv2');

        toastSuccess.generic(response.message || 'Dashboard set as landing page');
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error setting personal landing page:', error);
      toastError.api(error?.response?.data?.detail || error, 'Failed to set landing page');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Remove personal landing dashboard
  const removePersonalLanding = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response: LandingPageResponse = await apiDelete(
        '/api/dashboards/landing-page/remove-personal'
      );

      if (response.success) {
        // Revalidate user data to update landing page indicators
        await mutate('/api/v1/organizations/users/currentuserv2');

        toastSuccess.generic(response.message || 'Personal landing page removed');
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error removing personal landing page:', error);
      toastError.api(error?.response?.data?.detail || error, 'Failed to remove landing page');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Set organization default landing dashboard (Admin only)
  const setOrgDefault = async (dashboardId: number): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response: LandingPageResponse = await apiPost(
        `/api/dashboards/landing-page/set-org-default/${dashboardId}`
      );

      if (response.success) {
        // Revalidate user data to update landing page indicators
        await mutate('/api/v1/organizations/users/currentuserv2');

        toastSuccess.generic(response.message || 'Dashboard set as organization default');
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error setting org default:', error);
      toastError.api(error?.response?.data?.detail || error, 'Failed to set organization default');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Remove organization default landing dashboard (Admin only)
  const removeOrgDefault = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response: LandingPageResponse = await apiDelete(
        '/api/dashboards/landing-page/remove-org-default'
      );

      if (response.success) {
        // Revalidate user data to update landing page indicators
        await mutate('/api/v1/organizations/users/currentuserv2');

        toastSuccess.generic(response.message || 'Organization default removed');
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error removing org default:', error);
      toastError.api(
        error?.response?.data?.detail || error,
        'Failed to remove organization default'
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    resolveLandingPage,
    setPersonalLanding,
    removePersonalLanding,
    setOrgDefault,
    removeOrgDefault,
    isLoading,
  };
}
