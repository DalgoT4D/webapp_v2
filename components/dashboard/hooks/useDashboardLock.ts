'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  acquireDashboardLock,
  refreshDashboardLock,
  releaseDashboardLock,
} from '@/hooks/api/useDashboards';

/** Half of the backend's 2-minute lock lifetime. */
export const LOCK_REFRESH_INTERVAL_MS = 60000;

/** What the edit page needs from the builder ref: save, unlock, refresh caches. */
export interface BuilderCleanupHandle {
  cleanup: () => Promise<boolean>;
}

/**
 * The builder's edit lock: take it on mount, refresh it every 60 s, and the builder's own
 * page-leave listeners. Moved verbatim from dashboard-builder-v2.tsx, including closures that
 * capture the first render: the mount/unmount cleanups see lockToken === null, so unmounting the
 * builder never sends DELETE itself. Back / View release through the returned unlockDashboard
 * (via the builder's cleanup ref); the edit page releases through useLockReleaseOnLeave.
 */
export function useDashboardLock(dashboardId: number | undefined) {
  const [lockToken, setLockToken] = useState<string | null>(null);
  const [lockRefreshInterval, setLockRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const lockRequestInFlightRef = useRef(false);
  const hasDashboardLockRef = useRef(false);

  // Refs to store current values for event handlers without causing re-renders
  const lockStateRef = useRef({ dashboardId, lockToken, lockRefreshInterval });

  // Update refs when values change
  useEffect(() => {
    lockStateRef.current = { dashboardId, lockToken, lockRefreshInterval };
  }, [dashboardId, lockToken, lockRefreshInterval]);

  // Lock dashboard for editing with auto-refresh setup
  const lockDashboard = async () => {
    if (!dashboardId || lockRequestInFlightRef.current || hasDashboardLockRef.current) return;

    lockRequestInFlightRef.current = true;

    // Clear any existing interval first
    if (lockRefreshInterval) {
      clearInterval(lockRefreshInterval);
      setLockRefreshInterval(null);
    }

    try {
      const response = await acquireDashboardLock(dashboardId);
      hasDashboardLockRef.current = true;
      setLockToken(response.lock_token);

      // Set up auto-refresh every 60 seconds (half of 2-minute lock duration)
      const interval = setInterval(async () => {
        try {
          await refreshDashboardLock(dashboardId!);
        } catch (error) {
          console.error('Failed to refresh lock:', error);
          // If refresh fails, clear interval and update UI
          clearInterval(interval);
          setLockRefreshInterval(null);
          setLockToken(null);
        }
      }, LOCK_REFRESH_INTERVAL_MS);

      setLockRefreshInterval(interval);
    } catch (error: unknown) {
      const lockError = error as { status?: number; message?: string };
      console.error('Failed to lock dashboard:', lockError.message);

      // If dashboard is locked by another user (423 error), redirect to dashboard list
      if (lockError.status === 423 || lockError.message?.includes('locked by')) {
        alert(`This dashboard is currently being edited by another user: ${lockError.message}`);
        // Redirect back to dashboard list
        if (typeof window !== 'undefined') {
          window.location.href = '/dashboards';
        }
        return;
      }

      // For other errors, just log them
      console.error('Lock acquisition failed:', lockError.message || 'Unknown error');
    } finally {
      lockRequestInFlightRef.current = false;
    }
  };

  // Unlock dashboard with cleanup
  const unlockDashboard = async () => {
    if (!dashboardId) return;

    try {
      // Clear refresh interval first
      if (lockRefreshInterval) {
        clearInterval(lockRefreshInterval);
        setLockRefreshInterval(null);
      }

      // Only make API call if we have a lock token
      if (lockToken) {
        await releaseDashboardLock(dashboardId);
      }

      setLockToken(null);
      hasDashboardLockRef.current = false;
    } catch (error) {
      console.error('Failed to unlock dashboard:', error);
    }
  };

  // Initial lock acquisition - only run once when dashboard changes
  useEffect(() => {
    if (dashboardId) {
      lockDashboard();
    }

    // Cleanup only on dashboard change or unmount
    return () => {
      if (dashboardId) {
        unlockDashboard();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first-render closures are part of today's behavior
  }, [dashboardId]);

  // Set up cleanup event listeners once (use refs to access latest values)
  useEffect(() => {
    // Handle page unload/navigation
    // PINNED-BUGS: "Browser unload unlock beacon posts to relative URL on Next server → locks leak until expiry"
    const handleBeforeUnload = () => {
      // Use current values from ref
      const { dashboardId: currentDashboardId, lockToken: currentLockToken } = lockStateRef.current;
      if (currentDashboardId && currentLockToken) {
        navigator.sendBeacon(
          `/api/dashboards/${currentDashboardId}/lock/`,
          JSON.stringify({ method: 'DELETE' })
        );
      }
    };

    // Handle visibility change (tab switching, minimizing)
    // PINNED-BUGS: "Hiding the tab releases the lock, sends a stray unlock to the Next server, and never re-acquires on return"
    const handleVisibilityChange = () => {
      // Only unlock if user switches away, not when returning
      if (document.hidden) {
        const { dashboardId: currentDashboardId, lockToken: currentLockToken } =
          lockStateRef.current;
        if (currentDashboardId && currentLockToken) {
          // Use fetch with keepalive for more reliable cleanup
          fetch(`/api/dashboards/${currentDashboardId}/lock/`, {
            method: 'DELETE',
            keepalive: true,
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
              'x-dalgo-org': localStorage.getItem('selectedOrg') || '',
            },
          }).catch(console.error);
        }
      }
    };

    // Add event listeners only once
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // No dependencies - set up once

  // Cleanup interval when component unmounts or lock changes
  useEffect(() => {
    return () => {
      if (lockRefreshInterval) {
        clearInterval(lockRefreshInterval);
      }
    };
  }, [lockRefreshInterval]);

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      // Clean up on component unmount
      if (lockRefreshInterval) {
        clearInterval(lockRefreshInterval);
      }
      if (dashboardId && lockToken) {
        // Note: This won't work reliably on page refresh, but handles component unmount
        unlockDashboard();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first-render closures are part of today's behavior
  }, []); // Empty dependencies - cleanup on unmount only

  return { lockToken, unlockDashboard };
}

/**
 * The edit page's own page-leave listeners. They run where the page runs — also while the
 * "Dashboard is Currently Locked" notice shows (no builder mounted) — and only for users with
 * edit access. Registration order is unchanged: the builder's listeners (child) register
 * before these (parent). Moved verbatim from app/dashboards/[id]/edit/page.tsx.
 */
export function useLockReleaseOnLeave(
  dashboardId: number,
  canEditDashboard: boolean,
  builderRef: RefObject<BuilderCleanupHandle | null>
) {
  // Clean up on route change or component unmount
  useEffect(() => {
    // No lock was taken for users without edit permission — never fire the
    // unlock/cleanup calls for them
    if (!canEditDashboard) return undefined;

    // Direct API call to unlock dashboard - bypasses the full cleanup chain
    const emergencyUnlock = async () => {
      try {
        await releaseDashboardLock(dashboardId);
      } catch (error) {
        console.error(`Failed to unlock dashboard ${dashboardId}:`, error);
      }
    };

    // Function to handle cleanup synchronously for critical scenarios
    const handleSyncCleanup = () => {
      // First try emergency unlock (direct API call)
      emergencyUnlock();

      // Then also try the full cleanup chain as backup
      if (builderRef.current?.cleanup) {
        // Fire and forget - don't wait for async completion during sync cleanup
        builderRef.current.cleanup().catch((error) => {
          console.error('Error during dashboard cleanup:', error);
        });
      }
    };

    // Handle browser navigation (back/forward buttons, direct navigation)
    const handleBeforeUnload = () => {
      handleSyncCleanup();
    };

    // Handle popstate for browser back/forward
    const handlePopState = () => {
      handleSyncCleanup();
    };

    // Handle page visibility change (when tab becomes hidden/inactive)
    // PINNED-BUGS: "Hiding the tab releases the lock, sends a stray unlock to the Next server, and never re-acquires on return"
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleSyncCleanup();
      }
    };

    // Intercept link clicks to dashboard-related routes
    const handleLinkClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement;

      if (link && link.href) {
        const url = new URL(link.href, window.location.origin);
        // Check if navigating away from current edit page
        if (url.pathname !== window.location.pathname) {
          handleSyncCleanup();
        }
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('click', handleLinkClick, true); // Use capture phase

    // Cleanup function that runs when component unmounts
    // This is for Next.js router navigation
    return () => {
      // Use sync cleanup during unmount to avoid race conditions
      handleSyncCleanup();

      // Clean up event listeners
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleLinkClick, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same dependency list as the page effect it replaces
  }, [dashboardId, canEditDashboard]);
}
