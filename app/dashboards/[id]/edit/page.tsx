'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DashboardBuilderV2 } from '@/components/dashboard/dashboard-builder-v2';
import { useDashboard } from '@/hooks/api/useDashboards';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Lock, User, Clock, AlertTriangle, Eye, Loader2 } from 'lucide-react';

export default function EditDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const dashboardId = parseInt(params.id as string);

  // Ref to access dashboard builder cleanup function
  const dashboardBuilderRef = useRef<{ cleanup: () => Promise<void> } | null>(null);

  // Get current user info
  const getCurrentOrgUser = useAuthStore((state) => state.getCurrentOrgUser);
  const currentUser = getCurrentOrgUser();

  const { data: dashboard, isLoading, isError, mutate } = useDashboard(dashboardId);

  // Check if dashboard is locked by another user
  // Only block access if dashboard is locked AND locked by someone else
  // If locked by current user, they can continue editing
  const isLockedByOther =
    dashboard?.is_locked && dashboard?.locked_by && dashboard.locked_by !== currentUser?.email;

  // State for refresh countdown
  const [refreshCountdown, setRefreshCountdown] = useState(10);

  // State for navigation loading
  const [isNavigating, setIsNavigating] = useState(false);

  // Auto-refresh dashboard data when locked by another user (every 10 seconds)
  useEffect(() => {
    if (isLockedByOther && dashboard) {
      const refreshInterval = setInterval(() => {
        mutate(); // Refresh dashboard data
        setRefreshCountdown(10); // Reset countdown
      }, 10000); // 10 seconds

      const countdownInterval = setInterval(() => {
        setRefreshCountdown((prev) => (prev > 0 ? prev - 1 : 10));
      }, 1000); // 1 second

      return () => {
        clearInterval(refreshInterval);
        clearInterval(countdownInterval);
      };
    }
    return undefined;
  }, [isLockedByOther, dashboard, mutate]);

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
    setIsNavigating(true);

    try {
      // Call cleanup function if available (this will save changes first)
      if (dashboardBuilderRef.current?.cleanup) {
        console.log('Saving changes and cleaning up before preview mode...');
        await dashboardBuilderRef.current.cleanup();
        console.log('Cleanup completed, navigating to preview mode...');
      }

      // Navigate to preview mode
      router.push(`/dashboards/${dashboardId}`);
    } catch (error) {
      console.error('Error navigating to preview mode:', error);
      setIsNavigating(false);
    }
  };

  // Mock data for testing
  const mockDashboard = {
    id: dashboardId,
    title: 'Sales Dashboard',
    description: 'Monthly sales performance metrics',
    grid_columns: 12,
    layout_config: [
      { i: 'chart-1', x: 0, y: 0, w: 6, h: 4 },
      { i: 'text-1', x: 6, y: 0, w: 6, h: 2 },
    ],
    components: {
      'chart-1': { type: 'chart', config: { chartId: 1 } },
      'text-1': { type: 'text', config: { content: 'Welcome to the Sales Dashboard' } },
    },
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Comment out error check to show mock data
  // if (isError && !dashboard) {
  //   return (
  //     <div className="h-screen flex items-center justify-center">
  //       <div className="text-center">
  //         <p className="text-destructive mb-4">Failed to load dashboard</p>
  //         <Link href="/dashboards">
  //           <Button variant="outline">
  //             <ArrowLeft className="w-4 h-4 mr-2" />
  //             Back to Dashboards
  //           </Button>
  //         </Link>
  //       </div>
  //     </div>
  //   );
  // }

  const dashboardData = dashboard || mockDashboard;

  // Component for when dashboard is locked by another user
  const LockedDashboardView = () => (
    <div className="h-screen flex flex-col">
      <div className="border-b px-6 py-3 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBackNavigation}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboards
            </Button>
            <div>
              <h1 className="text-xl font-semibold">{dashboardData.title}</h1>
              {dashboardData.description && (
                <p className="text-sm text-gray-500">{dashboardData.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-yellow-600" />
            </div>
            <CardTitle className="text-xl">Dashboard is Currently Locked</CardTitle>
            <CardDescription>This dashboard is being edited by another user</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-2 text-yellow-800 mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">Editing in Progress</span>
              </div>
              <div className="space-y-2 text-sm text-yellow-700">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>
                    Currently edited by: <strong>{dashboard?.locked_by}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Lock duration: 2 minutes</span>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              <p>
                To edit this dashboard, please wait for the current user to finish or contact them
                directly.
              </p>
              <p className="mt-2">
                The dashboard will automatically unlock after 2 minutes of inactivity.
              </p>
            </div>

            <div className="text-center text-xs text-gray-500 mb-4">
              Auto-refreshing in {refreshCountdown} seconds...
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => mutate()}>
                Refresh Now
              </Button>
              <Button className="flex-1" onClick={handleBackNavigation}>
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // Show locked view if dashboard is locked by another user
  if (isLockedByOther) {
    return <LockedDashboardView />;
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 overflow-hidden">
        <DashboardBuilderV2
          ref={dashboardBuilderRef}
          dashboardId={dashboardId}
          initialData={dashboardData}
          dashboardLockInfo={{
            isLocked: dashboard?.is_locked || false,
            lockedBy: dashboard?.locked_by,
          }}
          onBack={handleBackNavigation}
          onPreview={handlePreviewMode}
          isNavigating={isNavigating}
        />
      </div>
    </div>
  );
}
