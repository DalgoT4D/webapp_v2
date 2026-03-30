# useCanvasLock Hook Specification

## Overview

Hook for managing canvas lock state - acquiring, refreshing, and releasing locks for multi-user editing protection.

**v1 Source:** Canvas.tsx lock functions

**v2 Target:** `webapp_v2/src/hooks/api/useCanvasLock.ts`

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `transform/dbt_project/canvas/lock/` | POST | Acquire lock |
| `transform/dbt_project/canvas/lock/refresh/` | PUT | Refresh lock (30s interval) |
| `transform/dbt_project/canvas/lock/` | DELETE | Release lock |

---

## Response Types

```typescript
interface CanvasLockStatus {
  locked_by: string | null;
  locked_at: string | null;
  is_locked: boolean;
  locked_by_current_user: boolean;
  lock_id: string | null;
}
```

---

## Hook Interface

```typescript
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
  refreshLock: () => Promise<void>;
  /** Loading states */
  isAcquiring: boolean;
  isReleasing: boolean;
}
```

---

## Implementation

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiPost, apiPut, apiDelete } from '@/lib/api';
import { useTransformStore } from '@/stores/transformStore';
import type { CanvasLockStatus } from '@/types/transform.types';

const DEFAULT_REFRESH_INTERVAL = 30000; // 30 seconds

export function useCanvasLock(options: UseCanvasLockOptions = {}): UseCanvasLockReturn {
  const {
    autoAcquire = true,
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
    onLockLost,
  } = options;

  const setCanvasLockStatus = useTransformStore((s) => s.setCanvasLockStatus);
  const setViewOnlyMode = useTransformStore((s) => s.setViewOnlyMode);

  const [lockStatus, setLockStatus] = useState<CanvasLockStatus | null>(null);
  const [isAcquiring, setIsAcquiring] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const hasLock = lockStatus?.locked_by_current_user ?? false;
  const isLockedByOther = lockStatus?.is_locked === true && !hasLock;

  const acquireLock = useCallback(async () => {
    setIsAcquiring(true);
    try {
      const status = await apiPost<CanvasLockStatus>(
        'transform/dbt_project/canvas/lock/',
        {}
      );
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
  }, [setCanvasLockStatus, setViewOnlyMode]);

  const refreshLock = useCallback(async () => {
    try {
      const status = await apiPut<CanvasLockStatus>(
        'transform/dbt_project/canvas/lock/refresh/',
        {}
      );
      setLockStatus(status);
      setCanvasLockStatus(status);

      // Check if we lost the lock
      if (!status.locked_by_current_user && hasLock) {
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
      throw error;
    }
  }, [hasLock, setCanvasLockStatus, setViewOnlyMode, onLockLost]);

  const releaseLock = useCallback(async () => {
    stopRefreshTimer();
    setIsReleasing(true);
    try {
      await apiDelete('transform/dbt_project/canvas/lock/');
      setLockStatus(null);
      setCanvasLockStatus(null);
    } catch (error) {
      console.error('Failed to release lock:', error);
      // Still clear local state even if API fails
      setLockStatus(null);
      setCanvasLockStatus(null);
      throw error;
    } finally {
      setIsReleasing(false);
    }
  }, [setCanvasLockStatus]);

  const startRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }
    refreshTimerRef.current = setInterval(refreshLock, refreshInterval);
  }, [refreshLock, refreshInterval]);

  const stopRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // Auto-acquire on mount
  useEffect(() => {
    if (autoAcquire) {
      acquireLock();
    }

    // Cleanup: release lock on unmount
    return () => {
      stopRefreshTimer();
      // Fire and forget release on unmount
      apiDelete('transform/dbt_project/canvas/lock/').catch(() => {});
    };
  }, [autoAcquire]);

  // Handle page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page hidden, stop refreshing
        stopRefreshTimer();
      } else if (hasLock) {
        // Page visible again, resume refresh
        refreshLock();
        startRefreshTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasLock, refreshLock, startRefreshTimer, stopRefreshTimer]);

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
```

---

## Usage

```typescript
function Canvas() {
  const {
    lockStatus,
    hasLock,
    isLockedByOther,
    isAcquiring,
  } = useCanvasLock({
    autoAcquire: true,
    onLockLost: () => {
      toast.warning('Canvas lock was taken by another user');
    },
  });

  // Show lock status in header
  return (
    <CanvasHeader
      isLocked={isLockedByOther}
      lockedBy={lockStatus?.locked_by}
      canEdit={hasLock}
    />
  );
}
```

---

## v1 Behavior Reference

From v1 Canvas.tsx:
- Lock acquired on canvas mount
- Refresh every 30 seconds
- Release on unmount
- View-only mode when locked by others
- Lock status displayed in header

---

## Edge Cases

1. **Lock already taken**: Show view-only mode, display who has lock
2. **Lock refresh fails**: Assume lost, switch to view-only
3. **Network disconnect**: Stop refresh timer, attempt reconnect
4. **Tab/page hidden**: Pause refresh to save resources
5. **Concurrent acquire attempts**: Backend handles, return current status

---

## Implementation Checklist

- [ ] Create hook file at `hooks/api/useCanvasLock.ts`
- [ ] Add visibility change handling
- [ ] Add beforeunload handler for lock release
- [ ] Add toast notifications for lock lost
- [ ] Test lock acquisition flow
- [ ] Test refresh timer
- [ ] Test lock release on unmount
