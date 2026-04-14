'use client';

import { memo } from 'react';
import { Clock, XCircle, Lock } from 'lucide-react';
import { TaskAltIcon, WarningAmberIcon, LoopIcon } from '@/assets/icons/status-icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SyncStatus } from '@/constants/connections';
import { LockStatus } from '@/constants/pipeline';
import { lastRunTime, trimEmail } from '@/components/pipeline/utils';
import { formatDuration } from './utils';
import { cn } from '@/lib/utils';
import type { Connection, QueuedRuntimeInfo } from '@/types/connections';

export const SyncStatusCell = memo(function SyncStatusCell({
  conn,
  syncingIds,
}: {
  conn: Connection;
  syncingIds: string[];
}) {
  // Determine the job status and color
  let jobStatus: string | null = null;
  let jobStatusColor = 'text-gray-500';

  // Check lock state first — a lock means a sync/reset is in progress
  if (conn.lock?.status === LockStatus.RUNNING) {
    jobStatus = 'running';
    jobStatusColor = 'text-green-600';
  } else if (conn.lock?.status === LockStatus.CANCELLED) {
    jobStatus = 'cancelled';
    jobStatusColor = 'text-amber-600';
  } else if (conn.lock?.status === LockStatus.LOCKED || conn.lock?.status === LockStatus.COMPLETE) {
    jobStatus = 'locked';
    jobStatusColor = 'text-gray-600';
  } else if (syncingIds.includes(conn.connectionId) || conn.lock?.status === LockStatus.QUEUED) {
    jobStatus = 'queued';
    jobStatusColor = 'text-gray-600';
  } else if (conn.lock) {
    // Lock exists but status is unrecognized or undefined — default to locked
    jobStatus = 'locked';
    jobStatusColor = 'text-gray-600';
  }

  // If no lock, check last run
  if (jobStatus === null && conn.lastRun) {
    if (conn.lastRun.status === SyncStatus.SUCCESS) {
      jobStatus = 'success';
      jobStatusColor = 'text-green-700';
    } else if (conn.lastRun.status === SyncStatus.CANCELLED) {
      jobStatus = 'cancelled';
      jobStatusColor = 'text-amber-600';
    } else {
      jobStatus = 'failed';
      jobStatusColor = 'text-red-700';
    }
  }

  if (!jobStatus) {
    return <span className="text-base text-gray-400">&mdash;</span>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {/* Time info: relative time for completed states, triggered-by for active states */}
      {['success', 'failed', 'cancelled'].includes(jobStatus) ? (
        <span className="text-base text-gray-900">{lastRunTime(conn.lastRun?.startTime)}</span>
      ) : (
        conn.lock && (
          <>
            <span className="text-sm text-gray-500">
              Triggered by: {trimEmail(conn.lock.lockedBy)}
            </span>
            <span className="text-base text-gray-900">{lastRunTime(conn.lock.lockedAt)}</span>
          </>
        )
      )}

      {/* Status icon + label */}
      <div className="flex items-center gap-1.5">
        <StatusIcon status={jobStatus} queueInfo={conn.queuedFlowRunWaitTime} />
        <span className={cn('text-base font-medium', jobStatusColor)}>{jobStatus}</span>
      </div>
    </div>
  );
});

// ============ Status Icon ============

function StatusIcon({
  status,
  queueInfo,
}: {
  status: string;
  queueInfo: QueuedRuntimeInfo | null;
}) {
  const iconClass = 'h-4 w-4';

  switch (status) {
    case 'running':
      return <LoopIcon className={cn(iconClass, 'text-green-600 animate-spin')} />;
    case 'queued':
      return <QueueTooltipIcon queueInfo={queueInfo} />;
    case 'locked':
      return <Lock className={cn(iconClass, 'text-gray-600')} />;
    case 'success':
      return <TaskAltIcon className={cn(iconClass, 'text-green-700')} />;
    case 'failed':
      return <WarningAmberIcon className={cn(iconClass, 'text-red-700')} />;
    case 'cancelled':
      return <XCircle className={cn(iconClass, 'text-amber-600')} />;
    default:
      return null;
  }
}

// ============ Queue Tooltip ============

const QueueTooltipIcon = memo(function QueueTooltipIcon({
  queueInfo,
}: {
  queueInfo: QueuedRuntimeInfo | null;
}) {
  if (
    !queueInfo ||
    queueInfo.queue_no <= 0 ||
    queueInfo.min_wait_time <= 0 ||
    queueInfo.max_wait_time <= 0
  ) {
    return <Clock className="h-4 w-4 text-gray-600" />;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="relative inline-flex items-center cursor-help">
            <Clock className="h-4 w-4 text-gray-600 animate-pulse" />
            <span
              className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--primary)' }}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <Clock className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
              Queue Information
            </div>
            <p className="text-sm">
              Position in queue: <strong>{queueInfo.queue_no}</strong>
            </p>
            <p className="text-sm">
              Estimated wait: <strong>{formatDuration(queueInfo.min_wait_time)}</strong> –{' '}
              <strong>{formatDuration(queueInfo.max_wait_time)}</strong>
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
