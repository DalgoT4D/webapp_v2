import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { apiPost, apiDelete, apiGet } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Get resolved landing page for current user
  const resolveLandingPage = useCallback(async (): Promise<LandingPageResolve | null> => {
    try {
      setIsLoading(true);
      const response = await apiGet('/api/dashboards/landing-page/resolve');
      return response;
    } catch (error) {
      console.error('Error resolving landing page:', error);
      toast({
        title: 'Error',
        description: 'Failed to resolve landing page',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Set personal landing dashboard
  const setPersonalLanding = useCallback(
    async (dashboardId: number): Promise<boolean> => {
      try {
        setIsLoading(true);
        const response: LandingPageResponse = await apiPost(
          `/api/dashboards/landing-page/set-personal/${dashboardId}`
        );

        if (response.success) {
          // Revalidate user data to update landing page info
          await mutate('/api/v1/organizations/users/currentuserv2');

          toast({
            title: 'Success',
            description: response.message || 'Dashboard set as landing page',
          });
          return true;
        }
        return false;
      } catch (error: any) {
        console.error('Error setting personal landing page:', error);
        toast({
          title: 'Error',
          description: error?.response?.data?.detail || 'Failed to set landing page',
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  // Remove personal landing dashboard
  const removePersonalLanding = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response: LandingPageResponse = await apiDelete(
        '/api/dashboards/landing-page/remove-personal'
      );

      if (response.success) {
        // Revalidate user data to update landing page info
        await mutate('/api/v1/organizations/users/currentuserv2');

        toast({
          title: 'Success',
          description: response.message || 'Personal landing page removed',
        });
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error removing personal landing page:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.detail || 'Failed to remove landing page',
        variant: 'destructive',
      });
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
        // Revalidate user data to update org default info
        await mutate('/api/v1/organizations/users/currentuserv2');

        toast({
          title: 'Success',
          description: response.message || 'Dashboard set as organization default',
        });
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error setting org default:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.detail || 'Failed to set organization default',
        variant: 'destructive',
      });
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
        // Revalidate user data to update org default info
        await mutate('/api/v1/organizations/users/currentuserv2');

        toast({
          title: 'Success',
          description: response.message || 'Organization default removed',
        });
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error removing org default:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.detail || 'Failed to remove organization default',
        variant: 'destructive',
      });
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
