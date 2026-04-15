'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Clock, Loader2, ChevronDown, FileText, Sparkles } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { FullScreenModal } from '@/components/ui/full-screen-modal';
import { Button } from '@/components/ui/button';
import {
  useSyncHistory,
  fetchSyncLogs,
  fetchFlowRunLogs,
  extractFlowRunLogMessages,
  triggerLogSummary,
} from '@/hooks/api/useConnections';
import { apiGet } from '@/lib/api';
import { toastError } from '@/lib/toast';
import {
  SYNC_HISTORY_PAGE_SIZE,
  LOG_SUMMARY_POLL_INTERVAL_MS,
  SyncStatus,
  TaskStatus,
  JobType,
  CONNECTION_API,
} from '@/constants/connections';
import { ENABLE_LOG_SUMMARIES, LockStatus } from '@/constants/pipeline';
import { PipelineRunDisplayStatus } from '@/constants/pipeline';
import { formatDuration, formatBytes, getStatusInfo } from './utils';
import { trimEmail, lastRunTime } from '@/components/pipeline/utils';
import { cn } from '@/lib/utils';
import { LogCard } from '@/components/pipeline/log-card';
import type { ConnectionSyncJob, TaskLock } from '@/types/connections';

// Type for the reset_config field on sync jobs
interface ResetStreamEntry {
  name: string;
}

interface ResetConfig {
  streamsToReset: ResetStreamEntry[];
}

// Type for log summary response
interface LogSummaryResult {
  prompt: string;
  response: string;
}

interface ConnectionSyncHistoryProps {
  connectionId: string;
  connectionName: string;
  lock: TaskLock | null;
  onClose: () => void;
}

// Map connection sync status to pipeline display status for LogCard coloring
function mapStatusToDisplayStatus(status: string): PipelineRunDisplayStatus {
  switch (status) {
    case SyncStatus.FAILED:
      return PipelineRunDisplayStatus.FAILED;
    case SyncStatus.CANCELLED:
      return PipelineRunDisplayStatus.WARNING;
    default:
      return PipelineRunDisplayStatus.SUCCESS;
  }
}

export function ConnectionSyncHistory({
  connectionId,
  connectionName,
  lock,
  onClose,
}: ConnectionSyncHistoryProps) {
  const [offset, setOffset] = useState(0);
  const [allSyncJobs, setAllSyncJobs] = useState<ConnectionSyncJob[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const { syncJobs, totalSyncs, isLoading } = useSyncHistory(connectionId, 0);
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);
  const [jobLogs, setJobLogs] = useState<Record<number, string[]>>({});
  const [loadingLogs, setLoadingLogs] = useState<number | null>(null);

  // AI log summary state (per job)
  const [summaryLoading, setSummaryLoading] = useState<number | null>(null);
  const [summaryResults, setSummaryResults] = useState<Record<number, LogSummaryResult>>({});
  const summaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live log polling for running jobs
  const liveLogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize with first page from SWR
  useEffect(() => {
    if (syncJobs.length > 0 && allSyncJobs.length === 0) {
      setAllSyncJobs(syncJobs);
      setHasMore(syncJobs.length < totalSyncs);
      setOffset(SYNC_HISTORY_PAGE_SIZE);
    }
  }, [syncJobs, totalSyncs, allSyncJobs.length]);

  // Load more handler - appends new items
  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const result = await apiGet(
        `${CONNECTION_API.CONNECTIONS}/${connectionId}/sync/history?limit=${SYNC_HISTORY_PAGE_SIZE}&offset=${offset}`
      );

      const moreJobs: ConnectionSyncJob[] = result?.history || [];
      const total: number = result?.totalSyncs || 0;

      if (moreJobs.length > 0) {
        setAllSyncJobs((prev) => [...prev, ...moreJobs]);
        setOffset((prev) => prev + SYNC_HISTORY_PAGE_SIZE);
      }
      if (offset + SYNC_HISTORY_PAGE_SIZE >= total || moreJobs.length < SYNC_HISTORY_PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (error) {
      toastError.load(error, 'sync history');
    } finally {
      setLoadingMore(false);
    }
  }, [connectionId, offset]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current);
      if (liveLogTimerRef.current) clearTimeout(liveLogTimerRef.current);
    };
  }, []);

  // Live log polling: when a running job is expanded, poll logs and status
  useEffect(() => {
    if (liveLogTimerRef.current) {
      clearTimeout(liveLogTimerRef.current);
      liveLogTimerRef.current = null;
    }

    if (expandedJobId === null) return undefined;

    const expandedJob = allSyncJobs.find((j) => j.job_id === expandedJobId);
    if (!expandedJob || expandedJob.status !== TaskStatus.RUNNING) return undefined;

    const pollRunningJob = async () => {
      try {
        const statusResult = (await apiGet(`/api/airbyte/jobs/${expandedJob.job_id}/status`)) as {
          status: string;
        };

        const logResult = await fetchSyncLogs(expandedJob.job_id, expandedJob.last_attempt_no);
        setJobLogs((prev) => ({
          ...prev,
          [expandedJob.job_id]: logResult || [],
        }));

        if (statusResult.status === TaskStatus.RUNNING) {
          liveLogTimerRef.current = setTimeout(pollRunningJob, LOG_SUMMARY_POLL_INTERVAL_MS);
        }
      } catch {
        // Silently stop polling on error
      }
    };

    liveLogTimerRef.current = setTimeout(pollRunningJob, LOG_SUMMARY_POLL_INTERVAL_MS);

    return () => {
      if (liveLogTimerRef.current) {
        clearTimeout(liveLogTimerRef.current);
        liveLogTimerRef.current = null;
      }
    };
  }, [expandedJobId, allSyncJobs]);

  const handleToggleLogs = useCallback(
    async (jobId: number, attemptNumber: number) => {
      if (expandedJobId === jobId) {
        setExpandedJobId(null);
        return;
      }

      setExpandedJobId(jobId);

      if (!jobLogs[jobId]) {
        // First check if the job already has logs from the history API
        const job = allSyncJobs.find((j) => j.job_id === jobId);
        if (job?.logs && job.logs.length > 0) {
          setJobLogs((prev) => ({ ...prev, [jobId]: job.logs }));
          return;
        }

        // Otherwise fetch logs from the dedicated endpoint
        setLoadingLogs(jobId);
        try {
          const result = await fetchSyncLogs(jobId, attemptNumber);
          setJobLogs((prev) => ({
            ...prev,
            [jobId]: result || [],
          }));
        } catch {
          setJobLogs((prev) => ({
            ...prev,
            [jobId]: ['Failed to load logs'],
          }));
        } finally {
          setLoadingLogs(null);
        }
      }
    },
    [expandedJobId, jobLogs, allSyncJobs]
  );

  const handleTriggerLogSummary = useCallback(
    async (job: ConnectionSyncJob) => {
      setSummaryLoading(job.job_id);

      try {
        const { task_id } = await triggerLogSummary(connectionId, job.job_id, job.last_attempt_no);

        const pollTask = async () => {
          try {
            const taskResult = (await apiGet(`/api/tasks/stp/${task_id}`)) as {
              status: string;
              result: LogSummaryResult;
            };

            if (taskResult.status === TaskStatus.COMPLETED) {
              setSummaryResults((prev) => ({
                ...prev,
                [job.job_id]: taskResult.result,
              }));
              setSummaryLoading(null);
            } else if (taskResult.status === TaskStatus.FAILED) {
              toastError.api(null, 'Log summary generation failed. Please try again.');
              setSummaryLoading(null);
            } else {
              summaryTimerRef.current = setTimeout(pollTask, LOG_SUMMARY_POLL_INTERVAL_MS);
            }
          } catch (error) {
            toastError.api(error, 'Failed to fetch log summary status.');
            setSummaryLoading(null);
          }
        };

        summaryTimerRef.current = setTimeout(pollTask, LOG_SUMMARY_POLL_INTERVAL_MS);
      } catch (error) {
        toastError.api(error, 'Failed to trigger log summary.');
        setSummaryLoading(null);
      }
    },
    [connectionId]
  );

  const subtitle = (
    <div className="flex items-center gap-2">
      <span className="font-medium">{connectionName}</span>
    </div>
  );

  return (
    <FullScreenModal
      open
      onOpenChange={(isOpen) => !isOpen && onClose()}
      title="Connection History"
      subtitle={subtitle}
    >
      {isLoading && allSyncJobs.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : allSyncJobs.length === 0 && !lock ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Clock className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No sync history</h3>
          <p className="text-sm text-gray-500">This connection hasn&apos;t been synced yet.</p>
        </div>
      ) : (
        <div className="px-7 py-5">
          {/* Teal header bar matching orchestrate page */}
          <div className="grid grid-cols-12 bg-teal-700 text-white text-sm font-semibold rounded-t-xl">
            <div className="col-span-2 px-4 py-3">Date</div>
            <div className="col-span-3 px-4 py-3">Type</div>
            <div className="col-span-1 px-4 py-3 text-right">Records</div>
            <div className="col-span-1 px-4 py-3 text-right">Data</div>
            <div className="col-span-2 px-4 py-3 text-right">Duration</div>
            <div className="col-span-3 px-4 py-3 text-right">Action</div>
          </div>

          {/* Job rows - card style with gaps */}
          <div className="space-y-2 mt-2">
            {lock && <RunningJobRow lock={lock} />}
            {allSyncJobs.map((job) => (
              <SyncJobRow
                key={job.job_id}
                job={job}
                isExpanded={expandedJobId === job.job_id}
                isLoadingLogs={loadingLogs === job.job_id}
                logs={jobLogs[job.job_id] || []}
                summaryLoading={summaryLoading === job.job_id}
                summaryResult={summaryResults[job.job_id]}
                onToggleLogs={handleToggleLogs}
                onTriggerSummary={handleTriggerLogSummary}
              />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center py-6">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
                className="min-w-[200px]"
                data-testid="load-more-history"
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ChevronDown className="h-4 w-4 mr-2" />
                )}
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </FullScreenModal>
  );
}

/**
 * SyncJobRow - A single sync job rendered as a card, matching orchestrate style
 */
interface SyncJobRowProps {
  job: ConnectionSyncJob;
  isExpanded: boolean;
  isLoadingLogs: boolean;
  logs: string[];
  summaryLoading: boolean;
  summaryResult?: LogSummaryResult;
  onToggleLogs: (jobId: number, attemptNumber: number) => void;
  onTriggerSummary: (job: ConnectionSyncJob) => void;
}

function SyncJobRow({
  job,
  isExpanded,
  isLoadingLogs,
  logs,
  summaryLoading,
  summaryResult,
  onToggleLogs,
  onTriggerSummary,
}: SyncJobRowProps) {
  const isFailed = job.status === SyncStatus.FAILED;
  const isCancelled = job.status === SyncStatus.CANCELLED;
  const isReset = job.job_type === JobType.RESET_CONNECTION;
  const resetConfig = job.reset_config as ResetConfig | null;
  const resetStreamNames = resetConfig?.streamsToReset?.map((s) => s.name) || [];
  const status = getStatusInfo(job.status);
  const displayStatus = mapStatusToDisplayStatus(job.status);

  const formattedDate =
    job.created_at && isValid(new Date(job.created_at))
      ? format(new Date(job.created_at), 'MMMM d, yyyy')
      : '—';

  const formattedTime =
    job.created_at && isValid(new Date(job.created_at))
      ? format(new Date(job.created_at), 'HH:mm:ss')
      : '';

  const showAISummaryButton = ENABLE_LOG_SUMMARIES && isFailed && !summaryResult;

  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden',
        isFailed
          ? 'bg-red-50/70 border border-red-200/60'
          : isCancelled
            ? 'bg-yellow-50/50 border border-yellow-200/60'
            : 'bg-white border border-gray-200/70'
      )}
      data-testid={`sync-job-${job.job_id}`}
    >
      {/* Main row content */}
      <div className="grid grid-cols-12 items-center px-4 py-3">
        {/* Date */}
        <div className="col-span-2">
          <span className="text-sm font-semibold text-gray-900">{formattedDate}</span>
          {formattedTime && <p className="text-xs text-gray-500 mt-0.5">{formattedTime}</p>}
        </div>

        {/* Type */}
        <div className="col-span-3">
          <span className="text-sm font-medium text-gray-900">
            {isReset ? 'Reset/Clear' : 'Sync'}
          </span>
          {isReset && resetStreamNames.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5" data-testid={`reset-streams-${job.job_id}`}>
              {resetStreamNames.join(', ')}
            </p>
          )}
        </div>

        {/* Records */}
        <div className="col-span-1 text-right">
          <span className="text-sm text-gray-600 font-mono">
            {job.records_committed.toLocaleString()}
          </span>
        </div>

        {/* Data */}
        <div className="col-span-1 text-right">
          <span className="text-sm text-gray-600">{formatBytes(job.bytes_committed)}</span>
        </div>

        {/* Duration */}
        <div className="col-span-2 text-right">
          <span className="text-sm text-gray-600">{formatDuration(job.duration_seconds)}</span>
        </div>

        {/* Action: Status + Logs button */}
        <div className="col-span-3 flex items-center justify-end gap-3">
          <span className={cn('text-sm font-medium', status.className)}>{status.label}</span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleLogs(job.job_id, job.last_attempt_no)}
            disabled={isLoadingLogs}
            className={cn(
              'h-8 px-3 text-xs font-medium uppercase tracking-wide',
              isExpanded && 'bg-gray-100'
            )}
            data-testid={`logs-btn-${job.job_id}`}
          >
            {isLoadingLogs ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5 mr-1.5" />
            )}
            Logs
          </Button>

          {showAISummaryButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onTriggerSummary(job);
              }}
              disabled={summaryLoading}
              className={cn('h-8 px-3 text-xs font-medium uppercase tracking-wide')}
              data-testid={`log-summary-btn-${job.job_id}`}
            >
              {summaryLoading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              )}
              AI Summary
            </Button>
          )}
        </div>
      </div>

      {/* Logs panel using LogCard - matches orchestrate style */}
      {isExpanded && (
        <LogCard
          logs={logs}
          isLoading={isLoadingLogs}
          status={displayStatus}
          showHeader={false}
          className="rounded-none border-x-0 border-b-0 shadow-none"
        />
      )}

      {/* AI Summary panel - matches orchestrate style */}
      {summaryResult && (
        <div className="bg-gray-50 border-t border-gray-200 p-4">
          <div className="text-sm text-gray-700">
            <p className="text-xs font-semibold text-primary mb-1">AI Summary</p>
            <p className="whitespace-pre-wrap">{summaryResult.response}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * RunningJobRow - Synthetic row shown at the top of history when connection has an active lock.
 * Displays lock info (triggered by, time) and a Logs button that polls Prefect flow run logs.
 */
function RunningJobRow({ lock }: { lock: TaskLock }) {
  const [expanded, setExpanded] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  // Poll Prefect flow run logs when expanded
  useEffect(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }

    if (!expanded || !lock.flowRunId) return undefined;

    const pollLogs = async () => {
      try {
        const result = await fetchFlowRunLogs(lock.flowRunId!);
        setLogs(extractFlowRunLogMessages(result));
        pollRef.current = setTimeout(pollLogs, LOG_SUMMARY_POLL_INTERVAL_MS);
      } catch {
        // Stop polling on error
      }
    };

    // Fetch immediately, then poll
    setLoadingLogs(true);
    fetchFlowRunLogs(lock.flowRunId)
      .then((result) => {
        setLogs(extractFlowRunLogMessages(result));
        pollRef.current = setTimeout(pollLogs, LOG_SUMMARY_POLL_INTERVAL_MS);
      })
      .catch(() => {
        setLogs(['Failed to load logs']);
      })
      .finally(() => setLoadingLogs(false));

    return () => {
      if (pollRef.current) {
        clearTimeout(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [expanded, lock.flowRunId]);

  const statusLabel =
    lock.status === LockStatus.RUNNING
      ? 'Running'
      : lock.status === LockStatus.QUEUED
        ? 'Queued'
        : 'Syncing';

  return (
    <div
      className="rounded-lg overflow-hidden bg-blue-50/50 border border-blue-200/60"
      data-testid="running-sync-row"
    >
      <div className="grid grid-cols-12 items-center px-4 py-3">
        {/* Date */}
        <div className="col-span-2">
          <span className="text-sm font-semibold text-gray-900">{lastRunTime(lock.lockedAt)}</span>
          <p className="text-xs text-gray-500 mt-0.5">by {trimEmail(lock.lockedBy)}</p>
        </div>

        {/* Type */}
        <div className="col-span-3">
          <span className="text-sm font-medium text-gray-900">Sync</span>
        </div>

        {/* Records */}
        <div className="col-span-1 text-right">
          <span className="text-sm text-gray-400">—</span>
        </div>

        {/* Data */}
        <div className="col-span-1 text-right">
          <span className="text-sm text-gray-400">—</span>
        </div>

        {/* Duration */}
        <div className="col-span-2 text-right">
          <span className="text-sm text-gray-400">—</span>
        </div>

        {/* Action */}
        <div className="col-span-3 flex items-center justify-end gap-3">
          <span className="text-sm font-medium text-blue-600 flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {statusLabel}
          </span>

          {lock.flowRunId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded((prev) => !prev)}
              disabled={loadingLogs}
              className={cn(
                'h-8 px-3 text-xs font-medium uppercase tracking-wide',
                expanded && 'bg-gray-100'
              )}
              data-testid="running-sync-logs-btn"
            >
              {loadingLogs ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5 mr-1.5" />
              )}
              Logs
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <LogCard
          logs={logs}
          isLoading={loadingLogs}
          status={PipelineRunDisplayStatus.RUNNING}
          showHeader={false}
          className="rounded-none border-x-0 border-b-0 shadow-none"
        />
      )}
    </div>
  );
}
