'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import useSWR from 'swr';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const {
    isAuthenticated,
    currentOrg,
    orgUsers,
    isOrgSwitching,
    setOrgSwitching,
    setOrgUsers,
    setSelectedOrg,
    setAuthenticated,
    initialize,
  } = useAuthStore();

  const [isInitialized, setIsInitialized] = useState(false);
  const [hasRedirected, setHasRedirected] = useState(false);

  // Always try to fetch user data to check authentication status
  const { data: orgUsersData, error: orgError } = useSWR('/api/currentuserv2');

  useEffect(() => {
    // Initialize auth store on mount
    initialize();
    setIsInitialized(true);
  }, [initialize]);

  // Handle authentication and org data loading
  useEffect(() => {
    if (orgUsersData && orgUsersData.length > 0) {
      // Successfully got user data, so we're authenticated
      setAuthenticated(true);
      setOrgUsers(orgUsersData);

      // Auto-select organization if none selected
      if (!currentOrg) {
        const storedOrgSlug = localStorage.getItem('selectedOrg');

        if (storedOrgSlug) {
          // Verify stored org exists
          const orgExists = orgUsersData.some((ou: any) => ou.org.slug === storedOrgSlug);
          if (orgExists) {
            setSelectedOrg(storedOrgSlug);
          } else {
            // Stored org doesn't exist, select first one
            setSelectedOrg(orgUsersData[0].org.slug);
          }
        } else {
          // No stored org, select first one
          setSelectedOrg(orgUsersData[0].org.slug);
        }
      }
    } else if (orgError) {
      // Clear authentication state if there's an error fetching user data
      setAuthenticated(false);
    }
  }, [orgUsersData, orgError, currentOrg, setOrgUsers, setSelectedOrg, setAuthenticated]);

  // Redirect to login if not authenticated (with debounce)
  useEffect(() => {
    if (isInitialized && !isAuthenticated && !hasRedirected) {
      setHasRedirected(true);
      router.push('/login');
    }
  }, [isInitialized, isAuthenticated, router, hasRedirected]);

  // Show org switching loader
  if (isOrgSwitching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium">Switching organization...</p>
          <p className="text-sm text-muted-foreground mt-2">Loading data for your new workspace</p>
        </div>
      </div>
    );
  }

  // Show loading during initial setup
  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show loading while fetching org data
  if (isAuthenticated && orgUsers.length === 0 && !orgError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium">Setting up your workspace...</p>
        </div>
      </div>
    );
  }

  // Handle errors in fetching org data
  if (orgError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black">
        <div className="text-center">
          <p className="text-lg font-medium text-red-600">Failed to load workspace data</p>
          <p className="text-sm text-muted-foreground mt-2">
            Please refresh the page or contact support
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // Don't render children until fully authenticated and org is selected
  if (!isAuthenticated || !currentOrg) {
    return null;
  }

  return <>{children}</>;
}
