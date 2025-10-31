'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardBuilderV2 } from '@/components/dashboard/dashboard-builder-v2';
import { createDashboard } from '@/hooks/api/useDashboards';
import { toastSuccess, toastError } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Lock } from 'lucide-react';
import Link from 'next/link';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { apiDelete } from '@/lib/api';

export default function CreateDashboardPage() {
  const router = useRouter();
  const [dashboardId, setDashboardId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Get user permissions
  const { hasPermission } = useUserPermissions();

  // Ref to access dashboard builder cleanup function
  const dashboardBuilderRef = useRef<{ cleanup: () => Promise<void> } | null>(null);

  // Check if user has create permissions
  if (!hasPermission('can_create_dashboards')) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            You don't have permission to create dashboards.
          </p>
          <Button variant="outline" onClick={() => router.push('/dashboards')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboards
          </Button>
        </div>
      </div>
    );
  }

  // Ensure component is mounted before running client-side code
  useEffect(() => {
    setMounted(true);
  }, []);

  // Create dashboard immediately after mount
  useEffect(() => {
    if (!mounted) return;

    const initDashboard = async () => {
      if (isCreating || dashboardId) return;

      setIsCreating(true);
      try {
        const dashboard = await createDashboard({
          title: 'Untitled Dashboard',
          grid_columns: 12,
        });

        setDashboardId(dashboard.id);
        setDashboardData({
          title: dashboard.title,
          grid_columns: dashboard.grid_columns || 12,
          layout_config: dashboard.layout_config || [],
          components: dashboard.components || {},
        });

        toastSuccess.created('Dashboard');
      } catch (error: any) {
        console.error('Failed to create dashboard:', error);
        toastError.create(error, 'dashboard');
        // Redirect back to dashboard list on error
        router.push('/dashboards');
      } finally {
        setIsCreating(false);
      }
    };

    initDashboard();
  }, [mounted, isCreating, dashboardId, router]);

  // Direct API call to unlock dashboard - bypasses the full cleanup chain
  const emergencyUnlock = async () => {
    if (dashboardId) {
      try {
        await apiDelete(`/api/dashboards/${dashboardId}/lock/`);
      } catch (error) {
        console.error(`Failed to unlock dashboard ${dashboardId}:`, error);
      }
    }
  };

  // Clean up on route change or component unmount
  useEffect(() => {
    // Function to handle cleanup synchronously for critical scenarios
    const handleSyncCleanup = () => {
      // First try emergency unlock (direct API call)
      emergencyUnlock();

      // Then also try the full cleanup chain as backup
      if (dashboardBuilderRef.current?.cleanup) {
        // Fire and forget - don't wait for async completion during sync cleanup
        dashboardBuilderRef.current.cleanup().catch((error) => {
          console.error('Error during dashboard cleanup:', error);
        });
      }
    };

    // Function to handle cleanup asynchronously for normal scenarios
    const handleAsyncCleanup = async () => {
      if (dashboardBuilderRef.current?.cleanup) {
        try {
          await dashboardBuilderRef.current.cleanup();
        } catch (error) {
          console.error('Error during dashboard cleanup:', error);
        }
      }
    };

    // Handle browser navigation (back/forward buttons, direct navigation)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      handleSyncCleanup();
    };

    // Handle popstate for browser back/forward
    const handlePopState = () => {
      handleSyncCleanup();
    };

    // Handle page visibility change (when tab becomes hidden/inactive)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleSyncCleanup();
      }
    };

    // Intercept link clicks to dashboard-related routes
    const handleLinkClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement;

      if (link && link.href) {
        const url = new URL(link.href, window.location.origin);
        // Check if navigating away from current create page
        if (url.pathname !== window.location.pathname) {
          handleSyncCleanup();
        }
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('click', handleLinkClick, true); // Use capture phase

    // Cleanup function that runs when component unmounts
    // This is for Next.js router navigation
    return () => {
      // Use sync cleanup during unmount to avoid race conditions
      handleSyncCleanup();

      // Clean up event listeners
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, [dashboardId]);

  // Handle navigation back to dashboard list
  const handleBackNavigation = async () => {
    // Call cleanup function if available
    if (dashboardBuilderRef.current?.cleanup) {
      await dashboardBuilderRef.current.cleanup();
    }

    // Navigate to dashboard list
    router.push('/dashboards');
  };

  // Handle navigation to preview mode
  const handlePreviewMode = async () => {
    if (!dashboardId) return;

    setIsNavigating(true);

    try {
      // Call cleanup function if available (this will save changes first)
      if (dashboardBuilderRef.current?.cleanup) {
        await dashboardBuilderRef.current.cleanup();
      }

      // Navigate to preview mode
      router.push(`/dashboards/${dashboardId}`);
    } catch (error) {
      console.error('Error navigating to preview mode:', error);
      setIsNavigating(false);
    }
  };

  // Show loading state during SSR and while creating
  if (!mounted || isCreating) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Creating dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboardId || !dashboardData) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardBuilderV2
      ref={dashboardBuilderRef}
      dashboardId={dashboardId}
      initialData={dashboardData}
      isNewDashboard={true}
      onBack={handleBackNavigation}
      onPreview={handlePreviewMode}
      isNavigating={isNavigating}
    />
  );
}
