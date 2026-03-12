import { Suspense } from 'react';
import { DashboardNativeView } from '@/components/dashboard/dashboard-native-view';

interface PublicDashboardPageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicDashboardPage({ params }: PublicDashboardPageProps) {
  const { token } = await params;

  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading dashboard...</p>
            </div>
          </div>
        }
      >
        <DashboardNativeView
          dashboardId={0} // Not used in public mode
          isPublicMode={true}
          publicToken={token}
        />
      </Suspense>
    </div>
  );
}
