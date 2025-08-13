'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardBuilderV2 } from '@/components/dashboard/dashboard-builder-v2';
import { createDashboard } from '@/hooks/api/useDashboards';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CreateDashboardPage() {
  const router = useRouter();
  const [dashboardId, setDashboardId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

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
          description: '',
          grid_columns: 12,
        });

        setDashboardId(dashboard.id);
        setDashboardData({
          title: dashboard.title,
          description: dashboard.description,
          grid_columns: dashboard.grid_columns || 12,
          layout_config: dashboard.layout_config || [],
          components: dashboard.components || {},
        });

        // Simple notification instead of toast
        console.log('Dashboard created successfully');
      } catch (error: any) {
        console.error('Failed to create dashboard:', error);
        // Redirect back to dashboard list on error
        router.push('/dashboards');
      } finally {
        setIsCreating(false);
      }
    };

    initDashboard();
  }, [mounted, isCreating, dashboardId, router]);

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
    <div className="h-screen flex flex-col">
      <div className="border-b px-6 py-3 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboards">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboards
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <DashboardBuilderV2
          dashboardId={dashboardId}
          initialData={dashboardData}
          isNewDashboard={true}
        />
      </div>
    </div>
  );
}
