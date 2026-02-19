'use client';

import { useState, useCallback, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import {
  usePipelineOverview,
  fetchFlowRunLogs,
  fetchFlowRunLogSummary,
} from '@/hooks/api/usePipelines';
import type { DashboardPipeline, DashboardRun } from '@/types/pipeline';
import { PipelineBarChart } from './pipeline-bar-chart';
import { LogCard } from './log-card';
import { LogSummaryCard, type LogSummary } from './log-summary-card';
import { Checkbox } from '@/components/ui/checkbox';
import { lastRunTime } from './utils';
import { toastError } from '@/lib/toast';
import { FLOW_RUN_LOGS_OFFSET_LIMIT, ENABLE_LOG_SUMMARIES } from '@/constants/pipeline';
import CheckCircleIcon from '@/assets/icons/check-circle';
import WarningAmberIcon from '@/assets/icons/warning-amber';
import { format } from 'date-fns';

/**
 * PipelineOverview - Main component for the /pipeline page
 *
 * Features:
 * - Visual run history with bar charts
 * - Color-coded status icons (success/failure)
 * - Click bar to view logs inline below the pipeline card
 * - Scale to runtime toggle per pipeline
 * - Auto-refresh when pipeline is running
 * - Mobile responsive with scroll
 */
export function PipelineOverview() {
  const { pipelines, isLoading, isError } = usePipelineOverview();
  const [scaleByRuntime, setScaleByRuntime] = useState<Record<string, boolean>>({});

  const handleScaleChange = useCallback((deploymentName: string, checked: boolean) => {
    setScaleByRuntime((prev) => ({
      ...prev,
      [deploymentName]: checked,
    }));
  }, []);

  if (isLoading) {
    return <PipelineOverviewSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">Failed to load pipelines</h3>
        <p className="text-sm text-gray-500">Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header with pattern background */}
      <div
        className="relative min-h-[95px] rounded-2xl p-4 bg-repeat"
        style={{
          backgroundImage: `url('/images/pattern.png')`,
        }}
      >
        <div className="absolute inset-0 bg-[#003d37] opacity-[0.87] rounded-2xl" />
        <h1 className="relative z-10 text-white text-2xl font-bold mt-2 ml-2">Pipeline Overview</h1>
      </div>

      {/* Pipeline list */}
      <div className="mt-6 space-y-6 pb-8">
        {pipelines.length === 0 ? (
          <EmptyState />
        ) : (
          pipelines.map((pipeline) => (
            <PipelineSection
              key={pipeline.deploymentName}
              pipeline={pipeline}
              scaleToRuntime={scaleByRuntime[pipeline.deploymentName] ?? true}
              onScaleChange={(checked) => handleScaleChange(pipeline.deploymentName, checked)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * PipelineSection - Pipeline name header + card with run details + inline logs
 */
interface PipelineSectionProps {
  pipeline: DashboardPipeline;
  scaleToRuntime: boolean;
  onScaleChange: (checked: boolean) => void;
}

function PipelineSection({ pipeline, scaleToRuntime, onScaleChange }: PipelineSectionProps) {
  const hasRuns = pipeline.runs && pipeline.runs.length > 0;

  // State for selected run and logs (per pipeline)
  const [selectedRun, setSelectedRun] = useState<DashboardRun | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsOffset, setLogsOffset] = useState(0);
  const [hasMoreLogs, setHasMoreLogs] = useState(false);

  // State for log summaries
  const [logSummary, setLogSummary] = useState<LogSummary[]>([]);
  const [logSummaryLogs, setLogSummaryLogs] = useState<string[]>([]);

  // Fetch logs/summaries when a run is selected
  useEffect(() => {
    if (selectedRun) {
      setLogs([]);
      setLogsOffset(0);
      setLogsLoading(true);
      setHasMoreLogs(false);
      setLogSummary([]);
      setLogSummaryLogs([]);

      // If log summaries are enabled, try to fetch them first
      if (ENABLE_LOG_SUMMARIES) {
        fetchFlowRunLogSummary(selectedRun.id)
          .then((summaryData) => {
            if (summaryData && summaryData.length > 0) {
              setLogSummary(summaryData);
              setLogsLoading(false);
            } else {
              // No summaries available, fetch regular logs
              fetchRegularLogs();
            }
          })
          .catch(() => {
            // Summary fetch failed, fall back to regular logs
            fetchRegularLogs();
          });
      } else {
        fetchRegularLogs();
      }
    }

    function fetchRegularLogs() {
      fetchFlowRunLogs(selectedRun!.id, undefined, 0, FLOW_RUN_LOGS_OFFSET_LIMIT)
        .then((data) => {
          if (data?.logs?.logs) {
            const messages = data.logs.logs.map((log: { message?: string } | string) =>
              typeof log === 'object' ? log?.message || '' : log
            );
            setLogs(messages);
            setHasMoreLogs(messages.length >= FLOW_RUN_LOGS_OFFSET_LIMIT);
            setLogsOffset(FLOW_RUN_LOGS_OFFSET_LIMIT);
          }
        })
        .catch((error) => {
          console.error('Failed to fetch logs:', error);
          toastError.load(error, 'logs');
        })
        .finally(() => {
          setLogsLoading(false);
        });
    }
  }, [selectedRun]);

  const handleSelectRun = useCallback((run: DashboardRun) => {
    setSelectedRun((prev) => (prev?.id === run.id ? null : run)); // Toggle if same run
  }, []);

  const handleCloseLogs = useCallback(() => {
    setSelectedRun(null);
    setLogs([]);
    setLogsOffset(0);
    setHasMoreLogs(false);
    setLogSummary([]);
    setLogSummaryLogs([]);
  }, []);

  const handleFetchMoreLogs = useCallback(async () => {
    if (!selectedRun || logsLoading) return;

    setLogsLoading(true);
    try {
      const data = await fetchFlowRunLogs(
        selectedRun.id,
        undefined,
        logsOffset,
        FLOW_RUN_LOGS_OFFSET_LIMIT
      );
      if (data?.logs?.logs) {
        const newMessages = data.logs.logs.map((log: { message?: string } | string) =>
          typeof log === 'object' ? log?.message || '' : log
        );
        setLogs((prev) => [...prev, ...newMessages]);
        setHasMoreLogs(newMessages.length >= FLOW_RUN_LOGS_OFFSET_LIMIT);
        setLogsOffset((prev) => prev + FLOW_RUN_LOGS_OFFSET_LIMIT);
      } else {
        setHasMoreLogs(false);
      }
    } catch (error) {
      console.error('Failed to fetch more logs:', error);
      toastError.load(error, 'logs');
    } finally {
      setLogsLoading(false);
    }
  }, [selectedRun, logsOffset, logsLoading]);

  const logTitle = selectedRun
    ? `Logs - ${format(new Date(selectedRun.startTime), 'MMM d, yyyy HH:mm')}`
    : 'Logs';

  // Determine log status for coloring
  const getLogStatus = (): 'success' | 'failed' | 'dbt_test_failed' | undefined => {
    if (!selectedRun) return undefined;
    if (selectedRun.state_name === 'DBT_TEST_FAILED') return 'dbt_test_failed';
    if (selectedRun.status === 'COMPLETED') return 'success';
    return 'failed';
  };

  return (
    <div>
      {/* Pipeline name as header */}
      <h2 className="text-base font-medium text-gray-700 mb-2">{pipeline.name}</h2>

      {/* Card */}
      {hasRuns ? (
        <>
          <PipelineCard
            pipeline={pipeline}
            scaleToRuntime={scaleToRuntime}
            onScaleChange={onScaleChange}
            onSelectRun={handleSelectRun}
          />

          {/* Inline Logs (shown below the card when a run is selected) */}
          {selectedRun && (
            <>
              {logSummary.length > 0 ? (
                // Two-panel layout: summaries on left, selected logs on right
                <div className="mt-4 flex gap-4">
                  <div className="flex-1">
                    <LogSummaryCard logsummary={logSummary} setLogsummaryLogs={setLogSummaryLogs} />
                  </div>
                  <div className="flex-1">
                    {logSummaryLogs.length > 0 && (
                      <LogCard
                        logs={logSummaryLogs}
                        isLoading={false}
                        hasMore={false}
                        onClose={() => setLogSummaryLogs([])}
                        title="Task Logs"
                        status={getLogStatus()}
                      />
                    )}
                  </div>
                </div>
              ) : (
                // Single panel: regular logs
                <LogCard
                  logs={logs}
                  isLoading={logsLoading}
                  hasMore={hasMoreLogs}
                  onFetchMore={handleFetchMoreLogs}
                  onClose={handleCloseLogs}
                  title={logTitle}
                  status={getLogStatus()}
                />
              )}
            </>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">No runs found for this pipeline</p>
        </div>
      )}
    </div>
  );
}

/**
 * PipelineCard - Card with run history bar chart
 */
interface PipelineCardProps {
  pipeline: DashboardPipeline;
  scaleToRuntime: boolean;
  onScaleChange: (checked: boolean) => void;
  onSelectRun: (run: DashboardRun) => void;
}

function PipelineCard({ pipeline, scaleToRuntime, onScaleChange, onSelectRun }: PipelineCardProps) {
  const runs = pipeline.runs || [];
  const runCount = runs.length;
  const successfulRuns = runs.filter(
    (r) => r.status === 'COMPLETED' && r.state_name !== 'DBT_TEST_FAILED'
  ).length;
  // Use runs[0].startTime like webapp does - runs are sorted most recent first
  const lastRunTimeStr = runs[0]?.startTime ? lastRunTime(runs[0].startTime) : null;

  // Determine last run status
  const lastRun = runs[0];
  const isLastRunSuccess =
    lastRun?.status === 'COMPLETED' && lastRun?.state_name !== 'DBT_TEST_FAILED';
  const isLastRunWarning = lastRun?.state_name === 'DBT_TEST_FAILED';

  // Check if pipeline is currently running
  const isRunning = pipeline.lock;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      {/* Header row: status icon + last run + success stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          {/* Running state or last run status */}
          {isRunning ? (
            <>
              <Loader2 className="h-5 w-5 text-[#DAA520] animate-spin" />
              <span className="text-sm font-semibold text-gray-700">Currently running</span>
            </>
          ) : (
            <>
              {/* Status icon */}
              {isLastRunSuccess ? (
                <CheckCircleIcon size={20} />
              ) : (
                <WarningAmberIcon size={20} color={isLastRunWarning ? '#df8e14' : '#981F1F'} />
              )}

              {/* Last run time */}
              <span className="text-sm text-gray-700">
                last run performed {lastRunTimeStr || 'never'}
              </span>
            </>
          )}
        </div>

        {/* Success stats */}
        <span className="text-sm text-gray-600">
          {successfulRuns}/{runCount} successful runs
        </span>
      </div>

      {/* Bar chart (includes baseline) */}
      <div className="mb-4">
        <PipelineBarChart runs={runs} scaleToRuntime={scaleToRuntime} onSelectRun={onSelectRun} />
      </div>

      {/* Footer row: Last X runs + scale toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <span className="text-sm text-gray-700 font-medium">Last {runCount} runs</span>

        <div className="flex items-center gap-2">
          <Checkbox
            id={`scale-${pipeline.deploymentName}`}
            checked={scaleToRuntime}
            onCheckedChange={(checked) => onScaleChange(checked === true)}
          />
          <label
            htmlFor={`scale-${pipeline.deploymentName}`}
            className="text-sm text-gray-600 cursor-pointer select-none"
          >
            Scale height to runtimes
          </label>
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state when no pipelines exist
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-gray-200">
      <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <AlertCircle className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">No pipelines available</h3>
      <p className="text-sm text-gray-500 max-w-md">
        Create a pipeline in the Orchestrate section to see run history here.
      </p>
    </div>
  );
}

/**
 * Skeleton loader for the overview page
 */
function PipelineOverviewSkeleton() {
  return (
    <div className="w-full animate-pulse">
      {/* Header skeleton */}
      <div className="h-[95px] bg-gray-200 rounded-2xl" />

      {/* Pipeline sections skeleton */}
      <div className="mt-6 space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-gray-200 rounded-full" />
                  <div className="h-4 w-40 bg-gray-200 rounded" />
                </div>
                <div className="h-4 w-24 bg-gray-200 rounded" />
              </div>
              <div className="h-14 bg-gray-100 rounded mb-4" />
              <div className="flex items-center justify-between">
                <div className="h-4 w-20 bg-gray-200 rounded" />
                <div className="h-4 w-32 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
