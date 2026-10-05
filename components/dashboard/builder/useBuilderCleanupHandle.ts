import { useImperativeHandle, type Ref } from 'react';
import type {
  BuilderCleanupHandle,
  useDashboardLock,
} from '@/components/dashboard/hooks/useDashboardLock';
import type { useDashboardSave } from '@/components/dashboard/builder/useDashboardSave';

type LockApi = ReturnType<typeof useDashboardLock>;

interface BuilderCleanupOptions {
  dashboardId: number | undefined;
  lockToken: LockApi['lockToken'];
  unlockDashboard: LockApi['unlockDashboard'];
  saveDashboard: ReturnType<typeof useDashboardSave>['saveDashboard'];
}

/** The edit page's handle on the builder: save pending changes, unlock, refresh caches. */
export function useBuilderCleanupHandle(
  ref: Ref<BuilderCleanupHandle>,
  { dashboardId, lockToken, unlockDashboard, saveDashboard }: BuilderCleanupOptions
) {
  // Expose cleanup function to parent component
  useImperativeHandle(
    ref,
    () => ({
      // Returns whether the pending save succeeded, so the Save-and-View path can avoid
      // reporting an update that did not happen. Navigation/unlock still proceed either
      // way — a failed save must not trap the user in the builder.
      cleanup: async (): Promise<boolean> => {
        let saved = false;
        // First save any pending changes
        if (dashboardId) {
          try {
            saved = await saveDashboard();
          } catch (error) {
            console.error('Error saving dashboard before cleanup:', error);
          }
        }

        // Then unlock the dashboard
        if (dashboardId && lockToken) {
          await unlockDashboard();
        }

        // Clear SWR cache to ensure dashboard list refreshes
        try {
          const { mutate } = await import('swr');
          mutate('/api/dashboards/'); // Refresh dashboard list
          if (dashboardId) {
            mutate(`/api/dashboards/${dashboardId}/`); // Refresh current dashboard
          }
        } catch (error) {
          console.error('Error clearing SWR cache:', error);
        }

        return saved;
      },
    }),
    [dashboardId, lockToken, saveDashboard, unlockDashboard]
  );
}
