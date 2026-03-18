// hooks/api/useCanvasLock.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { apiPost, apiPut, apiDelete } from '@/lib/api';
import { useTransformStore } from '@/stores/transformStore';
import type { CanvasLockStatus } from '@/types/transform';

const LOCK_ENDPOINT = '/api/transform/dbt_project/canvas/lock/';
const LOCK_REFRESH_ENDPOINT = '/api/transform/dbt_project/canvas/lock/refresh/';
const DEFAULT_REFRESH_INTERVAL = 30000; // 30 seconds

interface UseCanvasLockOptions {
  /** Auto-acquire lock on mount */
  autoAcquire?: boolean;
  /** Refresh interval in ms (default: 30000) */
  refreshInterval?: number;
  /** Callback when lock is lost */
  onLockLost?: () => void;
}

interface UseCanvasLockReturn {
  /** Current lock status */
  lockStatus: CanvasLockStatus | null;
  /** Whether current user has the lock */
  hasLock: boolean;
  /** Whether canvas is locked by another user */
  isLockedByOther: boolean;
  /** Acquire lock */
  acquireLock: () => Promise<CanvasLockStatus>;
  /** Release lock */
  releaseLock: () => Promise<void>;
  /** Manually refresh lock */
  refreshLock: () => Promise<CanvasLockStatus | void>;
  /** Loading states */
  isAcquiring: boolean;
  isReleasing: boolean;
}

export function useCanvasLock(options: UseCanvasLockOptions = {}): UseCanvasLockReturn {
  const { autoAcquire = true, refreshInterval = DEFAULT_REFRESH_INTERVAL, onLockLost } = options;

  const setCanvasLockStatus = useTransformStore((s) => s.setCanvasLockStatus);
  const setViewOnlyMode = useTransformStore((s) => s.setViewOnlyMode);

  const [lockStatus, setLockStatus] = useState<CanvasLockStatus | null>(null);
  const [isAcquiring, setIsAcquiring] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasLockRef = useRef(false);

  const hasLock = lockStatus?.locked_by_current_user ?? false;
  const isLockedByOther = lockStatus?.is_locked === true && !hasLock;

  // Keep ref in sync with state for callbacks
  useEffect(() => {
    hasLockRef.current = hasLock;
  }, [hasLock]);

  const stopRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const refreshLock = useCallback(async (): Promise<CanvasLockStatus | void> => {
    try {
      const status = await apiPut<CanvasLockStatus>(LOCK_REFRESH_ENDPOINT, {});
      setLockStatus(status);
      setCanvasLockStatus(status);

      // Check if we lost the lock
      if (!status.locked_by_current_user && hasLockRef.current) {
        stopRefreshTimer();
        setViewOnlyMode(true);
        onLockLost?.();
      }

      return status;
    } catch (error) {
      console.error('Failed to refresh lock:', error);
      // If refresh fails, assume we lost the lock
      stopRefreshTimer();
      setViewOnlyMode(true);
      onLockLost?.();
    }
  }, [setCanvasLockStatus, setViewOnlyMode, onLockLost, stopRefreshTimer]);

  const startRefreshTimer = useCallback(() => {
    stopRefreshTimer();
    refreshTimerRef.current = setInterval(refreshLock, refreshInterval);
  }, [refreshLock, refreshInterval, stopRefreshTimer]);

  const acquireLock = useCallback(async (): Promise<CanvasLockStatus> => {
    setIsAcquiring(true);
    try {
      const status = await apiPost<CanvasLockStatus>(LOCK_ENDPOINT, {});
      setLockStatus(status);
      setCanvasLockStatus(status);
      setViewOnlyMode(!status.locked_by_current_user);

      // Start refresh timer if we got the lock
      if (status.locked_by_current_user) {
        startRefreshTimer();
      }

      return status;
    } catch (error) {
      console.error('Failed to acquire lock:', error);
      throw error;
    } finally {
      setIsAcquiring(false);
    }
  }, [setCanvasLockStatus, setViewOnlyMode, startRefreshTimer]);

  const releaseLock = useCallback(async (): Promise<void> => {
    stopRefreshTimer();
    setIsReleasing(true);
    try {
      await apiDelete(LOCK_ENDPOINT);
      setLockStatus(null);
      setCanvasLockStatus(null);
    } catch (error) {
      console.error('Failed to release lock:', error);
      // Still clear local state even if API fails
      setLockStatus(null);
      setCanvasLockStatus(null);
    } finally {
      setIsReleasing(false);
    }
  }, [setCanvasLockStatus, stopRefreshTimer]);

  // Auto-acquire on mount
  useEffect(() => {
    if (autoAcquire) {
      acquireLock();
    }

    // Cleanup: release lock on unmount
    return () => {
      stopRefreshTimer();
      // Fire and forget release on unmount
      apiDelete(LOCK_ENDPOINT).catch(() => {
        // Ignore errors on unmount cleanup
      });
    };
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page hidden, stop refreshing to save resources
        stopRefreshTimer();
      } else if (hasLockRef.current) {
        // Page visible again, resume refresh
        refreshLock();
        startRefreshTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshLock, startRefreshTimer, stopRefreshTimer]);

  // Handle SPA navigation — release lock when user navigates away via Next.js router
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    if (prevPathnameRef.current !== pathname && hasLockRef.current) {
      // User navigated away via SPA routing — release lock
      stopRefreshTimer();
      apiDelete(LOCK_ENDPOINT).catch(() => {});
    }
    prevPathnameRef.current = pathname;
  }, [pathname, stopRefreshTimer]);

  // Handle beforeunload and popstate — release lock on page close or browser navigation
  useEffect(() => {
    const releaseLockSync = () => {
      if (!hasLockRef.current) return;
      // Use sendBeacon with a POST to a release endpoint for reliable delivery on unload
      // Fallback: stopping refresh timer causes lock to expire server-side
      try {
        apiDelete(LOCK_ENDPOINT).catch(() => {});
      } catch {
        // Best-effort cleanup
      }
    };

    const handleBeforeUnload = () => {
      releaseLockSync();
    };

    const handlePopState = () => {
      releaseLockSync();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return {
    lockStatus,
    hasLock,
    isLockedByOther,
    acquireLock,
    releaseLock,
    refreshLock,
    isAcquiring,
    isReleasing,
  };
}
