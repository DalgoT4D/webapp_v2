'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { DashboardBuilderV2 } from '@/components/dashboard/dashboard-builder-v2';
import { useDashboard } from '@/hooks/api/useDashboards';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function EditDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const dashboardId = parseInt(params.id as string);

  // Ref to access dashboard builder cleanup function
  const dashboardBuilderRef = useRef<{ cleanup: () => Promise<void> } | null>(null);

  const { data: dashboard, isLoading, isError } = useDashboard(dashboardId);

  // Handle navigation back to dashboard list
  const handleBackNavigation = async () => {
    // Call cleanup function if available
    if (dashboardBuilderRef.current?.cleanup) {
      await dashboardBuilderRef.current.cleanup();
    }

    // Navigate to dashboard list
    router.push('/dashboards');
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

  return (
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

      <div className="flex-1 overflow-hidden">
        <DashboardBuilderV2
          ref={dashboardBuilderRef}
          dashboardId={dashboardId}
          initialData={dashboardData}
        />
      </div>
    </div>
  );
}
