import { useState } from 'react';
import type { useRouter } from 'next/navigation';
import { deleteDashboard } from '@/hooks/api/useDashboards';
import type { Dashboard } from '@/hooks/api/useDashboards';
import type { KeyedMutator } from 'swr';
import type { useToast } from '@/components/ui/use-toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

/** The refresh spinner stays this long after the refetch resolves. */
const REFRESH_SPINNER_MS = 500;

interface DashboardViewActionsOptions {
  dashboardId: number;
  /** Read when Delete succeeds (same render's value as before). */
  dashboardTitle: string | undefined;
  router: ReturnType<typeof useRouter>;
  refresh: KeyedMutator<Dashboard>;
  toast: ReturnType<typeof useToast>['toast'];
}

/** Edit / Refresh / Delete from the view header, with their busy flags. */
export function useDashboardViewActions({
  dashboardId,
  dashboardTitle,
  router,
  refresh,
  toast,
}: DashboardViewActionsOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle edit navigation
  const handleEdit = () => {
    router.push(`/dashboards/${dashboardId}/edit`);
  };

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), REFRESH_SPINNER_MS);
  };

  // Handle dashboard deletion
  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      await deleteDashboard(dashboardId);
      trackEvent(ANALYTICS_EVENTS.DASHBOARD_DELETED, { dashboard_id: dashboardId });

      toast({
        title: 'Dashboard deleted',
        description: `"${dashboardTitle}" has been successfully deleted.`,
        variant: 'default',
      });

      // Navigate back to dashboard list
      router.push('/dashboards');
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      toast({
        title: 'Delete failed',
        description: 'Failed to delete the dashboard. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return { isRefreshing, isDeleting, handleEdit, handleRefresh, handleDelete };
}
