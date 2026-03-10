'use client';

import { useState, useCallback, useEffect } from 'react';
import { fetchFlowRunLogs, fetchFlowRunLogSummary } from '@/hooks/api/usePipelines';
import type { DashboardPipeline, DashboardRun, LogSummary } from '@/types/pipeline';
import { PipelineCard } from './pipeline-card';
import { LogCard } from './log-card';
import { LogSummaryCard } from './log-summary-card';
import { toastError } from '@/lib/toast';
import { getRunDisplayStatus } from '../utils';
import { FLOW_RUN_LOGS_OFFSET_LIMIT, ENABLE_LOG_SUMMARIES } from '@/constants/pipeline';
import { format } from 'date-fns';

interface PipelineSectionProps {
  pipeline: DashboardPipeline;
  scaleToRuntime: boolean;
  onScaleChange: (checked: boolean) => void;
}

/**
 * PipelineSection - Pipeline name header + card with run details + inline logs
 */
export function PipelineSection({ pipeline, scaleToRuntime, onScaleChange }: PipelineSectionProps) {
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

  const logStatus = getRunDisplayStatus(selectedRun);

  return (
    <div data-testid={`pipeline-section-${pipeline.deploymentName}`}>
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
            selectedRunId={selectedRun?.id}
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
                        status={logStatus}
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
                  status={logStatus}
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
