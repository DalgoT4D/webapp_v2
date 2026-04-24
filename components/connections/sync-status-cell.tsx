'use client';

import { memo } from 'react';
import { Clock, XCircle, Lock } from 'lucide-react';
import { TaskAltIcon, WarningAmberIcon, LoopIcon } from '@/assets/icons/status-icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SyncStatus, SYNC_STATUS_CONFIG, SYNC_STATUS_DEFAULT } from '@/constants/connections';
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
  // Determine the job status key by checking lock state first, then last run
  let statusKey: string | null = null;

  if (conn.lock?.status === LockStatus.RUNNING) {
    statusKey = SyncStatus.RUNNING;
  } else if (conn.lock?.status === LockStatus.CANCELLED) {
    statusKey = SyncStatus.CANCELLED;
  } else if (conn.lock?.status === LockStatus.LOCKED || conn.lock?.status === LockStatus.COMPLETE) {
    statusKey = SyncStatus.LOCKED;
  } else if (syncingIds.includes(conn.connectionId) || conn.lock?.status === LockStatus.QUEUED) {
    statusKey = SyncStatus.QUEUED;
  } else if (conn.lock) {
    statusKey = SyncStatus.LOCKED;
  }

  // If no lock, check last run
  if (statusKey === null && conn.lastRun) {
    statusKey =
      conn.lastRun.status === SyncStatus.SUCCESS
        ? SyncStatus.SUCCESS
        : conn.lastRun.status === SyncStatus.CANCELLED
          ? SyncStatus.CANCELLED
          : SyncStatus.FAILED;
  }

  const { label: jobStatus, colorClass: jobStatusColor } = statusKey
    ? (SYNC_STATUS_CONFIG[statusKey] ?? SYNC_STATUS_DEFAULT)
    : SYNC_STATUS_DEFAULT;

  if (!statusKey) {
    return <span className="text-base text-gray-400">&mdash;</span>;
  }

  const isCompletedState = [SyncStatus.SUCCESS, SyncStatus.FAILED, SyncStatus.CANCELLED].includes(
    statusKey as SyncStatus
  );

  return (
    <div className="flex flex-col items-start gap-1">
      {/* Time info: relative time for completed states, triggered-by for active states */}
      {isCompletedState ? (
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
        <StatusIcon status={statusKey} queueInfo={conn.queuedFlowRunWaitTime} />
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
  const colorClass = SYNC_STATUS_CONFIG[status]?.colorClass ?? SYNC_STATUS_DEFAULT.colorClass;

  switch (status) {
    case SyncStatus.RUNNING:
      return <LoopIcon className={cn(iconClass, colorClass, 'animate-spin')} />;
    case SyncStatus.QUEUED:
      return <QueueTooltipIcon queueInfo={queueInfo} />;
    case SyncStatus.LOCKED:
      return <Lock className={cn(iconClass, colorClass)} />;
    case SyncStatus.SUCCESS:
      return <TaskAltIcon className={cn(iconClass, colorClass)} />;
    case SyncStatus.FAILED:
      return <WarningAmberIcon className={cn(iconClass, colorClass)} />;
    case SyncStatus.CANCELLED:
      return <XCircle className={cn(iconClass, colorClass)} />;
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
