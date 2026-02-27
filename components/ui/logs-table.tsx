'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { format, isValid } from 'date-fns';
import { FileText, Sparkles, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLogSummaryPoll } from '@/hooks/api/usePipelines';
import { PipelineRunDisplayStatus } from '@/constants/pipeline';

/**
 * Types for LogsTable
 */
export interface LogEntry {
  message: string;
}

export interface TaskRun {
  id: string;
  label: string;
  duration: number;
  isFailed: boolean;
  // For fetching logs
  kind?: string;
  // Optional connection name for display
  connectionName?: string;
}

export interface FlowRun {
  id: string;
  date: string; // ISO date string
  startedBy?: string;
  status:
    | PipelineRunDisplayStatus.SUCCESS
    | PipelineRunDisplayStatus.FAILED
    | PipelineRunDisplayStatus.WARNING;
  tasks: TaskRun[];
}

export interface LogsTableProps {
  /** Array of flow runs to display */
  runs: FlowRun[];
  /** Whether more data is available to load */
  hasMore?: boolean;
  /** Whether currently loading more data */
  loadingMore?: boolean;
  /** Callback to load more runs */
  onLoadMore?: () => void;
  /** Callback to fetch logs for a task */
  onFetchLogs?: (flowRunId: string, taskId: string, taskKind?: string) => Promise<string[]>;
  /** Callback to start AI summary - returns the poll task_id */
  onStartSummary?: (flowRunId: string, taskId: string) => Promise<string>;
  /** Whether AI summaries are enabled */
  enableAISummary?: boolean;
  /** Column headers - defaults to ['Date', 'Task', 'Duration', 'Action'] */
  columns?: string[];
}

/**
 * LogsTable - A reusable table component for displaying run logs
 *
 * Features:
 * - Sticky header with teal background
 * - Date column with rowspan effect (date shown once per flow run)
 * - Expandable logs for each task
 * - Optional AI summary for failed tasks
 * - Load more pagination
 *
 * Usage:
 * ```tsx
 * <LogsTable
 *   runs={flowRuns}
 *   hasMore={hasMoreRuns}
 *   loadingMore={isLoading}
 *   onLoadMore={handleLoadMore}
 *   onFetchLogs={fetchTaskLogs}
 *   enableAISummary={true}
 * />
 * ```
 */
export function LogsTable({
  runs,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onFetchLogs,
  onStartSummary,
  enableAISummary = false,
  columns = ['Date', 'Task', 'Duration', 'Action'],
}: LogsTableProps) {
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <FileText className="h-6 w-6 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">No run history</h3>
        <p className="text-sm text-gray-500">No runs have been recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="px-7 py-5">
      {/* Header */}
      <div className="grid grid-cols-12 bg-teal-700 text-white text-sm font-semibold rounded-t-xl">
        <div className="col-span-2 px-4 py-3">{columns[0]}</div>
        <div className="col-span-5 px-4 py-3">{columns[1]}</div>
        <div className="col-span-2 px-4 py-3">{columns[2]}</div>
        <div className="col-span-3 px-4 py-3 text-right">{columns[3]}</div>
      </div>

      {/* Body - Each run is a separate card with gap */}
      <div className="space-y-2 mt-2">
        {runs.map((run) => (
          <FlowRunRow
            key={run.id}
            run={run}
            onFetchLogs={onFetchLogs}
            onStartSummary={onStartSummary}
            enableAISummary={enableAISummary}
          />
        ))}
      </div>

      {/* Load More */}
      {hasMore && onLoadMore && (
        <div className="flex justify-center py-6">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="min-w-[200px]"
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
  );
}

/**
 * FlowRunRow - A single flow run with all its tasks
 */
interface FlowRunRowProps {
  run: FlowRun;
  onFetchLogs?: (flowRunId: string, taskId: string, taskKind?: string) => Promise<string[]>;
  onStartSummary?: (flowRunId: string, taskId: string) => Promise<string>;
  enableAISummary?: boolean;
}

function FlowRunRow({ run, onFetchLogs, onStartSummary, enableAISummary }: FlowRunRowProps) {
  const isFailed =
    run.status === PipelineRunDisplayStatus.FAILED ||
    run.status === PipelineRunDisplayStatus.WARNING;

  const formattedDate =
    run.date && isValid(new Date(run.date)) ? format(new Date(run.date), 'MMMM d, yyyy') : '—';

  return (
    <div
      className={cn(
        'grid grid-cols-12 rounded-lg overflow-hidden',
        isFailed ? 'bg-red-50/70 border border-red-200/60' : 'bg-white border border-gray-200/70'
      )}
    >
      {/* Date Cell - Fixed width, vertically centered */}
      <div
        className={cn(
          'col-span-2 px-4 py-4 flex flex-col justify-center border-r',
          isFailed ? 'border-red-100/50' : 'border-gray-100'
        )}
      >
        <span className="text-sm font-semibold text-gray-900">{formattedDate}</span>
        {run.startedBy && (
          <span className="text-xs text-gray-500 mt-1">
            By:{' '}
            <span
              className={cn(
                'font-medium',
                run.startedBy === 'System' ? 'text-gray-600' : 'text-amber-600'
              )}
            >
              {run.startedBy}
            </span>
          </span>
        )}
      </div>

      {/* Tasks Cell - Spans remaining columns */}
      <div className="col-span-10">
        {run.tasks.map((task, index) => (
          <TaskRunRow
            key={task.id}
            task={task}
            flowRunId={run.id}
            isLast={index === run.tasks.length - 1}
            isFailed={isFailed}
            onFetchLogs={onFetchLogs}
            onStartSummary={onStartSummary}
            enableAISummary={enableAISummary}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * TaskRunRow - A single task within a flow run
 */
interface TaskRunRowProps {
  task: TaskRun;
  flowRunId: string;
  isLast: boolean;
  isFailed: boolean;
  onFetchLogs?: (flowRunId: string, taskId: string, taskKind?: string) => Promise<string[]>;
  onStartSummary?: (flowRunId: string, taskId: string) => Promise<string>;
  enableAISummary?: boolean;
}

function TaskRunRow({
  task,
  flowRunId,
  isLast,
  isFailed,
  onFetchLogs,
  onStartSummary,
  enableAISummary,
}: TaskRunRowProps) {
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // SWR-based polling for AI summary (similar to usePipelines refreshInterval pattern)
  const [pollTaskId, setPollTaskId] = useState<string | null>(null);
  const { summary: pollSummary, isPolling, error: pollError } = useLogSummaryPoll(pollTaskId);

  const taskName = task.connectionName ? `${task.connectionName} - ${task.label}` : task.label;

  const showAISummaryButton = enableAISummary && task.isFailed && onStartSummary;

  const handleToggleLogs = useCallback(async () => {
    if (!showLogs && logs.length === 0 && onFetchLogs) {
      setLogsLoading(true);
      try {
        const fetchedLogs = await onFetchLogs(flowRunId, task.id, task.kind);
        setLogs(fetchedLogs);
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      } finally {
        setLogsLoading(false);
      }
    }
    setShowLogs(!showLogs);
    setShowSummary(false);
  }, [showLogs, logs.length, onFetchLogs, flowRunId, task.id, task.kind]);

  const handleTriggerSummary = useCallback(async () => {
    if (!onStartSummary) return;

    setShowSummary(true);
    setShowLogs(false);

    try {
      const taskId = await onStartSummary(flowRunId, task.id);
      setPollTaskId(taskId); // starts SWR polling
    } catch (error) {
      console.error('Failed to start summary:', error);
    }
  }, [onStartSummary, flowRunId, task.id]);

  const summaryText = pollError ? 'Failed to generate summary.' : pollSummary || '';

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  return (
    <div className={cn(!isLast && 'border-b', isFailed ? 'border-red-100/50' : 'border-gray-50')}>
      {/* Task Row */}
      <div className="grid grid-cols-10 items-center px-4 py-3">
        {/* Task Name - 5/10 */}
        <div className="col-span-5">
          <span className="text-sm font-medium text-gray-900">{taskName}</span>
        </div>

        {/* Duration - 2/10 */}
        <div className="col-span-2">
          <span className="text-sm text-gray-600">{formatDuration(task.duration)}</span>
        </div>

        {/* Actions - 3/10 */}
        <div className="col-span-3 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleLogs}
            disabled={logsLoading}
            className={cn(
              'h-8 px-3 text-xs font-medium uppercase tracking-wide',
              showLogs && 'bg-gray-100'
            )}
          >
            {logsLoading ? (
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
              onClick={handleTriggerSummary}
              disabled={isPolling}
              className={cn(
                'h-8 px-3 text-xs font-medium uppercase tracking-wide',
                showSummary && 'bg-gray-100'
              )}
            >
              {isPolling ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              )}
              AI Summary
            </Button>
          )}
        </div>
      </div>

      {/* Logs Panel */}
      {showLogs && (
        <div className="bg-gray-900 max-h-64 overflow-auto">
          <div className="p-4 font-mono text-[13px] text-gray-200 space-y-0.5">
            {logsLoading ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading logs...
              </div>
            ) : logs.length === 0 ? (
              <span className="text-gray-500">No logs available</span>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="break-words leading-relaxed">
                  <span className="text-gray-500 select-none">{idx + 1}. </span>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* AI Summary Panel */}
      {showSummary && (
        <div className="bg-green-50 border-t border-green-200 p-4">
          {isPolling ? (
            <div className="flex items-center gap-2 text-green-700 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating AI summary...
            </div>
          ) : (
            <div className="text-sm text-green-700">{summaryText || 'No summary available'}</div>
          )}
        </div>
      )}
    </div>
  );
}
