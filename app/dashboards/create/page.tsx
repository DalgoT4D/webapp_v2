'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardBuilderV2 } from '@/components/dashboard/dashboard-builder-v2';
import { createDashboard } from '@/hooks/api/useDashboards';
import { toastSuccess, toastError } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CreateDashboardPage() {
  const router = useRouter();
  const [dashboardId, setDashboardId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Ref to access dashboard builder cleanup function
  const dashboardBuilderRef = useRef<{ cleanup: () => Promise<void> } | null>(null);

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
