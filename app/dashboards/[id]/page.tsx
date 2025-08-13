'use client';

import { useParams } from 'next/navigation';
import { useDashboard } from '@/hooks/api/useDashboards';
import { DashboardNativeView } from '@/components/dashboard/dashboard-native-view';
import { IndividualDashboardView } from '@/components/dashboard/individual-dashboard-view';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardViewPage() {
  const params = useParams();
  const dashboardId = params.id as string;

  // Fetch dashboard to determine type
  const { data: dashboard, isLoading } = useDashboard(parseInt(dashboardId));

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
