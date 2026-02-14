'use client';

import { useState, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Sparkles,
  Loader2,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  User,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  usePipelineHistory,
  fetchFlowRunLogs,
  triggerLogSummary,
  pollTaskStatus,
} from '@/hooks/api/usePipelines';
import { Pipeline, DeploymentRun, TaskRun, LogSummaryResult } from '@/types/pipeline';
import {
  formatDuration,
  makeReadable,
  getFlowRunStartedBy,
  delay,
  calculateDuration,
} from '@/lib/pipeline-utils';
import {
  DEFAULT_LOAD_MORE_LIMIT,
  FLOW_RUN_LOGS_OFFSET_LIMIT,
  ENABLE_LOG_SUMMARIES,
} from '@/constants/pipeline';
import { cn } from '@/lib/utils';
import { apiGet } from '@/lib/api';

interface PipelineRunHistoryProps {
  pipeline: Pipeline;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
    if (open && runs.length > 0) {
      setAllRuns(runs);
      setHasMore(runs.length >= DEFAULT_LOAD_MORE_LIMIT);
      setOffset(DEFAULT_LOAD_MORE_LIMIT);
    }
  }, [open, runs]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setAllRuns([]);
      setOffset(0);
      setHasMore(true);
    }
  }, [open]);

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
    } catch (error) {
      console.error('Failed to load more runs:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [pipeline.deploymentId, offset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[95vw] w-[95vw] h-[90vh] p-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-gray-50/50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <DialogTitle className="text-xl font-semibold text-gray-900">Run History</DialogTitle>
              <span className="text-[15px] text-gray-600">{pipeline.name}</span>
              <Badge
                variant="secondary"
                className={cn(
                  'text-[13px]',
                  pipeline.status ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                )}
              >
                {pipeline.status ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <HistorySkeleton />
          ) : allRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No run history</h3>
              <p className="text-[15px] text-gray-500">This pipeline hasn&apos;t been run yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-4 py-2 text-sm font-semibold text-gray-600 border-b">
                <div className="col-span-1"></div>
                <div className="col-span-2">Date</div>
                <div className="col-span-2">Started By</div>
                <div className="col-span-2">Duration</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-3">Tasks</div>
              </div>

              {allRuns.map((run) => (
                <RunCard key={run.id} run={run} />
              ))}

              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="w-full max-w-xs"
                  >
                    {loadingMore ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ChevronDown className="h-4 w-4 mr-2" />
                    )}
                    Load More Runs
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RunCard({ run }: { run: DeploymentRun }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const startedBy = getFlowRunStartedBy(run.startTime, run.orguser || 'System');

  const isFailed = ['FAILED', 'CRASHED'].includes(run.status);
  const isWarning = run.state_name === 'DBT_TEST_FAILED';

  const getStatusConfig = () => {
    if (isFailed) {
      return {
        icon: <XCircle className="h-4 w-4" />,
        label: 'Failed',
        className: 'bg-red-50 text-red-700 border-red-200',
        rowBg: 'bg-red-50/50',
      };
    }
    if (isWarning) {
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        label: 'Tests Failed',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
        rowBg: 'bg-amber-50/50',
      };
    }
    return {
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: 'Success',
      className: 'bg-green-50 text-green-700 border-green-200',
      rowBg: '',
    };
  };

  const statusConfig = getStatusConfig();

  return (
    <div className={cn('rounded-lg border', statusConfig.rowBg || 'bg-white')}>
      {/* Run Row */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full grid grid-cols-12 gap-4 px-4 py-3 items-center text-left hover:bg-black/5 transition-colors rounded-lg"
      >
        {/* Expand icon */}
        <div className="col-span-1">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </div>

        {/* Date */}
        <div className="col-span-2">
          <div className="text-[15px] font-medium text-gray-900">
            {format(new Date(run.startTime), 'MMM d, yyyy')}
          </div>
          <div className="text-sm text-gray-500">{format(new Date(run.startTime), 'h:mm a')}</div>
        </div>

        {/* Started by */}
        <div className="col-span-2">
          {startedBy && (
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4 text-gray-400" />
              <span
                className={cn(
                  'text-[15px]',
                  startedBy === 'System' ? 'text-gray-600' : 'text-primary font-medium'
                )}
              >
                {startedBy}
              </span>
            </div>
          )}
        </div>

        {/* Duration */}
        <div className="col-span-2">
          <div className="flex items-center gap-1.5 text-[15px] text-gray-700">
            <Clock className="h-4 w-4 text-gray-400" />
            {formatDuration(run.totalRunTime || 0)}
          </div>
        </div>

        {/* Status */}
        <div className="col-span-2">
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-medium border',
              statusConfig.className
            )}
          >
            {statusConfig.icon}
            {statusConfig.label}
          </div>
        </div>

        {/* Task count */}
        <div className="col-span-3 text-[15px] text-gray-600">
          {run.runs.length} task{run.runs.length !== 1 ? 's' : ''}
        </div>
      </button>

      {/* Expanded Task List */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="mt-3 space-y-2">
            {run.runs.map((taskRun) => (
              <TaskRunItem key={taskRun.id} taskRun={taskRun} flowRunId={run.id} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskRunItem({ taskRun, flowRunId }: { taskRun: TaskRun; flowRunId: string }) {
  const { toast } = useToast();
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [logsOffset, setLogsOffset] = useState(0);
  const [summarizedLogs, setSummarizedLogs] = useState<LogSummaryResult[]>([]);
  const [summarizing, setSummarizing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const runName = taskRun.parameters?.connection_name
    ? `${taskRun.parameters.connection_name} - ${makeReadable(taskRun.label)}`
    : makeReadable(taskRun.label);

  const duration =
    taskRun.total_run_time ||
    (taskRun.end_time && taskRun.start_time
      ? calculateDuration(taskRun.start_time, taskRun.end_time)
      : 0);

  const isFailed = taskRun.state_type === 'FAILED' || taskRun.state_name === 'DBT_TEST_FAILED';
  const showAISummary = ENABLE_LOG_SUMMARIES && isFailed;

  const fetchLogs = useCallback(async () => {
    setLogsLoaded(false);
    try {
      const pathParam = taskRun.kind === 'task-run' ? flowRunId : taskRun.id;
      const taskRunId = taskRun.kind === 'task-run' ? taskRun.id : undefined;

      const data = await fetchFlowRunLogs(
        pathParam,
        taskRunId,
        Math.max(logsOffset, 0),
        FLOW_RUN_LOGS_OFFSET_LIMIT
      );

      if (data?.logs?.logs && data.logs.logs.length >= 0) {
        const newLogs = data.logs.logs.map((log: any) => log?.message || log);
        setLogs((prev) => (logsOffset <= 0 ? newLogs : [...prev, ...newLogs]));

        const newOffset =
          data.logs.logs.length >= FLOW_RUN_LOGS_OFFSET_LIMIT
            ? logsOffset + FLOW_RUN_LOGS_OFFSET_LIMIT
            : -1;
        setLogsOffset(newOffset);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch logs',
        variant: 'destructive',
      });
    } finally {
      setLogsLoaded(true);
    }
  }, [flowRunId, taskRun.id, taskRun.kind, logsOffset, toast]);

  const pollForSummary = useCallback(
    async (taskId: string) => {
      try {
        const response = await pollTaskStatus(taskId);
        const lastMessage = response.progress[response.progress.length - 1];

        if (!['completed', 'failed'].includes(lastMessage.status)) {
          await delay(3000);
          await pollForSummary(taskId);
        } else if (lastMessage.result) {
          setSummarizedLogs(lastMessage.result);
        }
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to get summary',
          variant: 'destructive',
        });
      } finally {
        setSummarizing(false);
      }
    },
    [toast]
  );

  const handleSummarize = useCallback(async () => {
    setSummarizing(true);
    setShowSummary(true);
    setShowLogs(false);
    try {
      const response = await triggerLogSummary(flowRunId, taskRun.id);
      await delay(3000);
      await pollForSummary(response.task_id);
    } catch (error: any) {
      setSummarizing(false);
      toast({
        title: 'Error',
        description: error.message || 'Failed to start summary',
        variant: 'destructive',
      });
    }
  }, [flowRunId, taskRun.id, pollForSummary, toast]);

  const handleToggleLogs = () => {
    if (!showLogs && logs.length === 0) {
      fetchLogs();
    }
    setShowLogs(!showLogs);
    setShowSummary(false);
  };

  return (
    <div
      className={cn('rounded-md border bg-white', isFailed ? 'border-red-200' : 'border-gray-100')}
    >
      <div className={cn('px-4 py-2.5 flex items-center gap-4', isFailed && 'bg-red-50/50')}>
        {/* Task name */}
        <div className="flex-1 min-w-0">
          <span
            className={cn(
              'text-[15px] font-medium truncate block',
              isFailed ? 'text-red-700' : 'text-gray-700'
            )}
          >
            {runName}
          </span>
        </div>

        {/* Duration */}
        <span className="text-sm text-gray-500 shrink-0">{formatDuration(duration)}</span>

        {/* Status icon */}
        {isFailed ? (
          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {showAISummary && (
            <Button
              variant={showSummary ? 'default' : 'outline'}
              size="sm"
              onClick={handleSummarize}
              disabled={summarizing}
              className={cn(
                'h-8 px-3 text-[13px]',
                !showSummary && 'border-amber-300 text-amber-700 hover:bg-amber-50'
              )}
            >
              {summarizing ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              )}
              AI Summary
            </Button>
          )}

          <Button
            variant={showLogs ? 'secondary' : 'ghost'}
            size="sm"
            onClick={handleToggleLogs}
            className="h-8 px-3 text-[13px]"
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Logs
          </Button>
        </div>
      </div>

      {/* AI Summary Panel */}
      {showSummary && (
        <div className="border-t border-green-200 bg-green-50 p-4">
          {summarizing ? (
            <div className="flex items-center gap-2 text-green-700 text-[15px]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating AI summary...
            </div>
          ) : summarizedLogs.length > 0 ? (
            <div className="space-y-3">
              {summarizedLogs.map((result, index) => (
                <div key={result.prompt}>
                  <div className="font-semibold text-green-800 text-[14px] mb-1">
                    {index === 0 ? 'Summary' : result.prompt}
                  </div>
                  <div className="text-[15px] text-green-700">{result.response}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[15px] text-green-700">No summary available</div>
          )}
        </div>
      )}

      {/* Logs Panel */}
      {showLogs && (
        <div className="border-t border-gray-200 bg-gray-900 max-h-64 overflow-auto rounded-b-md">
          <div className="p-3 font-mono text-[13px] text-gray-200 space-y-0.5">
            {!logsLoaded && logs.length === 0 ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading logs...
              </div>
            ) : logs.length === 0 ? (
              <span className="text-gray-500">No logs available</span>
            ) : (
              <>
                {logs.map((log, idx) => (
                  <div key={idx} className="break-words leading-relaxed">
                    <span className="text-gray-500 select-none">{idx + 1}. </span>
                    {log}
                  </div>
                ))}
                {logsOffset > 0 && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={fetchLogs}
                    disabled={!logsLoaded}
                    className="text-blue-400 hover:text-blue-300 mt-2 h-auto p-0"
                  >
                    {logsLoaded ? 'Load more' : <Loader2 className="h-3 w-3 animate-spin" />}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16 ml-auto" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
