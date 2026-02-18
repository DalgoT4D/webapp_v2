'use client';

import { useState, useCallback, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { FullScreenModal } from '@/components/ui/full-screen-modal';
import { LogsTable, type FlowRun, type TaskRun } from '@/components/ui/logs-table';
import { toastError } from '@/lib/toast';
import { usePipelineHistory, fetchFlowRunLogs, triggerLogSummary } from '@/hooks/api/usePipelines';
import type { Pipeline, DeploymentRun } from '@/types/pipeline';
import { makeReadable, getFlowRunStartedBy, calculateDuration } from './utils';
import {
  DEFAULT_LOAD_MORE_LIMIT,
  FLOW_RUN_LOGS_OFFSET_LIMIT,
  ENABLE_LOG_SUMMARIES,
} from '@/constants/pipeline';
import { apiGet } from '@/lib/api';

interface PipelineRunHistoryProps {
  pipeline: Pipeline;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * PipelineRunHistory - Displays the run history for a pipeline
 *
 * Uses:
 * - FullScreenModal for the modal container
 * - LogsTable for the table display
 *
 * Transforms pipeline run data to the LogsTable format
 */
export function PipelineRunHistory({ pipeline, open, onOpenChange }: PipelineRunHistoryProps) {
  const [offset, setOffset] = useState(0);
  const [allRuns, setAllRuns] = useState<DeploymentRun[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const { runs, isLoading } = usePipelineHistory(
    open ? pipeline.deploymentId : null,
    0,
    DEFAULT_LOAD_MORE_LIMIT
  );

  // Initialize runs when dialog opens
  useEffect(() => {
    if (open && runs.length > 0 && allRuns.length === 0) {
      setAllRuns(runs);
      setHasMore(runs.length >= DEFAULT_LOAD_MORE_LIMIT);
      setOffset(DEFAULT_LOAD_MORE_LIMIT);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, runs]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setAllRuns([]);
      setOffset(0);
      setHasMore(true);
    }
  }, [open]);

  // Load more runs
  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const moreRuns = await apiGet(
        `/api/prefect/v1/flows/${pipeline.deploymentId}/flow_runs/history?limit=${DEFAULT_LOAD_MORE_LIMIT}&offset=${offset}`
      );

      if (moreRuns && moreRuns.length > 0) {
        setAllRuns((prev) => [...prev, ...moreRuns]);
        setOffset((prev) => prev + DEFAULT_LOAD_MORE_LIMIT);
      }
      if (!moreRuns || moreRuns.length < DEFAULT_LOAD_MORE_LIMIT) {
        setHasMore(false);
      }
    } catch (error: any) {
      console.error('Failed to load more runs:', error);
      toastError.load(error, 'runs');
    } finally {
      setLoadingMore(false);
    }
  }, [pipeline.deploymentId, offset]);

  // Fetch logs for a task
  const handleFetchLogs = useCallback(
    async (flowRunId: string, taskId: string, taskKind?: string): Promise<string[]> => {
      try {
        const pathParam = taskKind === 'task-run' ? flowRunId : taskId;
        const taskRunId = taskKind === 'task-run' ? taskId : undefined;

        const data = await fetchFlowRunLogs(pathParam, taskRunId, 0, FLOW_RUN_LOGS_OFFSET_LIMIT);

        if (data?.logs?.logs) {
          return data.logs.logs.map((log: any) => log?.message || log);
        }
        return [];
      } catch (error: any) {
        toastError.load(error, 'logs');
        return [];
      }
    },
    []
  );

  // Start AI summary - returns task_id, polling is handled by SWR hook in LogsTable
  const handleStartSummary = useCallback(
    async (flowRunId: string, taskId: string): Promise<string> => {
      try {
        const response = await triggerLogSummary(flowRunId, taskId);
        return response.task_id;
      } catch (error: any) {
        toastError.api(error, 'Failed to generate summary');
        throw error;
      }
    },
    []
  );

  // Transform DeploymentRun[] to FlowRun[] for LogsTable
  const transformedRuns: FlowRun[] = allRuns.map((run) => {
    const isFailed = ['FAILED', 'CRASHED'].includes(run.status);
    const isWarning = run.state_name === 'DBT_TEST_FAILED';

    const tasks: TaskRun[] = run.runs.map((taskRun) => ({
      id: taskRun.id,
      label: makeReadable(taskRun.label),
      duration:
        taskRun.total_run_time ||
        (taskRun.end_time && taskRun.start_time
          ? calculateDuration(taskRun.start_time, taskRun.end_time)
          : 0),
      isFailed: taskRun.state_type === 'FAILED' || taskRun.state_name === 'DBT_TEST_FAILED',
      kind: taskRun.kind,
      connectionName: taskRun.parameters?.connection_name,
    }));

    return {
      id: run.id,
      date: run.startTime,
      startedBy: getFlowRunStartedBy(run.startTime, run.orguser || 'System'),
      status: isFailed ? 'failed' : isWarning ? 'warning' : 'success',
      tasks,
    };
  });

  // Subtitle for the modal
  const subtitle = (
    <div className="flex items-center gap-2">
      <span className="font-medium" data-testid="history-pipeline-name">
        {pipeline.name}
      </span>
      <span className="text-gray-400">|</span>
      <span
        className={pipeline.status ? 'text-green-600' : 'text-gray-500'}
        data-testid="history-pipeline-status"
      >
        {pipeline.status ? 'Active' : 'Inactive'}
      </span>
    </div>
  );

  return (
    <FullScreenModal
      open={open}
      onOpenChange={onOpenChange}
      title="Logs History"
      subtitle={subtitle}
    >
      {isLoading ? (
        <LogsTableSkeleton />
      ) : allRuns.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 text-center"
          data-testid="no-history"
        >
          <Clock className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No run history</h3>
          <p className="text-sm text-gray-500">This pipeline hasn&apos;t been run yet.</p>
        </div>
      ) : (
        <LogsTable
          runs={transformedRuns}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          onFetchLogs={handleFetchLogs}
          onStartSummary={handleStartSummary}
          enableAISummary={ENABLE_LOG_SUMMARIES}
        />
      )}
    </FullScreenModal>
  );
}

/**
 * Skeleton loader for the logs table
 */
function LogsTableSkeleton() {
  return (
    <div className="px-7 py-5">
      {/* Header skeleton */}
      <div className="h-10 bg-teal-700 rounded-t-xl" />

      {/* Row skeletons with gaps */}
      <div className="space-y-2 mt-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border border-gray-200/70 rounded-lg p-4">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-2">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-16 bg-gray-200 rounded animate-pulse mt-2" />
              </div>
              <div className="col-span-10 space-y-3">
                {[1, 2].map((j) => (
                  <div key={j} className="flex items-center gap-4">
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 w-12 bg-gray-200 rounded animate-pulse ml-auto" />
                    <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
