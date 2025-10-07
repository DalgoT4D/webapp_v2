'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDashboard } from '@/hooks/api/useDashboards';
import { DashboardNativeView } from '@/components/dashboard/dashboard-native-view';
import { IndividualDashboardView } from '@/components/dashboard/individual-dashboard-view';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Lock } from 'lucide-react';

export default function DashboardViewPage() {
  const params = useParams();
  const router = useRouter();
  const dashboardId = params.id as string;

  // Get user permissions
  const { hasPermission } = useUserPermissions();

  // Fetch dashboard to determine type
  const { data: dashboard, isLoading } = useDashboard(parseInt(dashboardId));

  // Check if user has view permissions
  if (!hasPermission('can_view_dashboards')) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            You don't have permission to view dashboards.
          </p>
          <Button variant="outline" onClick={() => router.push('/dashboards')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboards
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <div className="bg-white border-b px-6 py-4">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex-1 p-6">
          <div className="grid grid-cols-12 gap-4">
            <Skeleton className="col-span-6 h-64" />
            <Skeleton className="col-span-6 h-64" />
          </div>
        </div>
      </div>
    );
  }

  // Render appropriate view based on dashboard type
  if (dashboard?.dashboard_type === 'native') {
    return <DashboardNativeView dashboardId={parseInt(dashboardId)} />;
  } else {
    // Superset dashboard
    return <IndividualDashboardView dashboardId={dashboardId} />;
  }
}
