'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createDashboard } from '@/hooks/api/useDashboards';
import { toastSuccess, toastError } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Lock } from 'lucide-react';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

export default function CreateDashboardPage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Get user permissions — the access-denied return lives below, after all hooks,
  // to keep the hook order stable across renders (Rules of Hooks)
  const { hasPermission } = useRbac();
  const canCreateDashboard = hasPermission(PERMISSIONS.CAN_CREATE_DASHBOARDS);

  // Ensure component is mounted before running client-side code
  useEffect(() => {
    setMounted(true);
  }, []);

  // Create the dashboard once, then hand off to its edit page via the URL.
  // The URL (not local state) guards against re-creation: a refresh always
  // remounts this page from a clean slate, so if creation itself set local
  // state instead of navigating, a refresh would create another dashboard.
  useEffect(() => {
    if (!mounted || !canCreateDashboard || isCreating) return;

    const initDashboard = async () => {
      setIsCreating(true);
      try {
        const dashboard = await createDashboard({
          title: 'Untitled Dashboard',
          grid_columns: 12,
        });

        trackEvent(ANALYTICS_EVENTS.DASHBOARD_CREATED);
        toastSuccess.created('Dashboard');
        router.replace(`/dashboards/${dashboard.id}/edit?new=true`);
      } catch (error: any) {
        console.error('Failed to create dashboard:', error);
        toastError.create(error, 'dashboard');
        router.push('/dashboards');
        setIsCreating(false);
      }
    };

    initDashboard();
  }, [mounted, canCreateDashboard, isCreating, router]);

  // Check if user has create permissions (after all hooks — Rules of Hooks)
  if (!canCreateDashboard) {
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

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Creating dashboard...</p>
      </div>
    </div>
  );
}
