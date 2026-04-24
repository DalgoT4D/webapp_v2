// Shared types used across pipeline and connections features

import { LockStatus } from '@/constants/pipeline';

export interface TaskLock {
  lockedBy: string;
  lockedAt: string;
  status: LockStatus;
  flowRunId?: string;
  celeryTaskId?: string;
}

export interface QueuedRuntimeInfo {
  max_wait_time: number;
  min_wait_time: number;
  queue_no: number;
}
