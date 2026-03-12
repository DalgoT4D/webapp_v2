'use client';

import { useEffect, useRef, useState } from 'react';
import { TaskLock } from '@/types/pipeline';
import { LockStatus } from '@/constants/pipeline';

/**
 * Hook to manage optimistic UI state for sync/run buttons
 *
 * This hook provides instant button feedback when running pipelines:
 * - tempSyncState is set to true immediately on button click
 * - The hook watches the lock lifecycle (null → running/queued → null)
 * - When polling ends and lock becomes null again, tempSyncState resets
 *
 * This creates a smooth UX where:
 * 1. User clicks Run → button immediately shows loading state
 * 2. API responds → lock status takes over from polling
 * 3. Pipeline completes → lock becomes null → button re-enables
 */
export function useSyncLock(lock: TaskLock | null | undefined) {
  const [tempSyncState, setTempSyncState] = useState(false);
  const lockLastStateRef = useRef<LockStatus | null>(null);

  useEffect(() => {
    if (lock) {
      // Track the lock status as it changes
      if (lock.status === LockStatus.RUNNING) {
        lockLastStateRef.current = LockStatus.RUNNING;
      } else if (lock.status === LockStatus.QUEUED) {
        lockLastStateRef.current = LockStatus.QUEUED;
      } else if (lock.status === LockStatus.LOCKED || lock.status === LockStatus.COMPLETE) {
        lockLastStateRef.current = LockStatus.LOCKED;
      }
    }

    // When polling ends (lock becomes null after being in a running state),
    // reset the temp sync state
    if (!lock && lockLastStateRef.current && tempSyncState) {
      setTempSyncState(false);
      lockLastStateRef.current = null;
    }
  }, [lock, tempSyncState]);

  return { tempSyncState, setTempSyncState };
}
