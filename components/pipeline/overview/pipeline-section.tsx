'use client';

import { useState, useCallback, useEffect } from 'react';
import { fetchFlowRunLogs } from '@/hooks/api/usePipelines';
import { useFlowRunLogs } from '@/hooks/api/useFlowRunLogs';
import type { DashboardPipeline, DashboardRun } from '@/types/pipeline';
import { PipelineCard } from './pipeline-card';
import { LogCard } from '@/components/pipeline/log-card';
import { toastError } from '@/lib/toast';
import { getRunDisplayStatus } from '../utils';
import { FLOW_RUN_LOGS_OFFSET_LIMIT } from '@/constants/pipeline';
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

  // State for selected run (per pipeline). Logs themselves are owned by useFlowRunLogs.
  const [selectedRun, setSelectedRun] = useState<DashboardRun | null>(null);

  const fetcher = useCallback(
    async (offset: number): Promise<string[]> => {
      if (!selectedRun) return [];
      try {
        const data = await fetchFlowRunLogs(selectedRun.id, {
          offset,
          limit: FLOW_RUN_LOGS_OFFSET_LIMIT,
        });
        if (!data?.logs?.logs) return [];
        return data.logs.logs.map((log: { message?: string } | string) =>
          typeof log === 'object' ? log?.message || '' : log
        );
      } catch (error) {
        console.error('Failed to fetch logs:', error);
        toastError.load(error, 'logs');
        return [];
      }
    },
    [selectedRun]
  );

  const {
    logs,
    isLoading: logsLoading,
    hasMore: hasMoreLogs,
    load: loadLogs,
    fetchMore: handleFetchMoreLogs,
    reset: resetLogs,
  } = useFlowRunLogs({ fetcher });

  // Fetch logs when a run is selected
  useEffect(() => {
    if (!selectedRun) {
      resetLogs();
      return;
    }
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRun]);

  const handleSelectRun = useCallback((run: DashboardRun) => {
    setSelectedRun((prev) => (prev?.id === run.id ? null : run)); // Toggle if same run
  }, []);

  const handleCloseLogs = useCallback(() => {
    setSelectedRun(null);
    resetLogs();
  }, [resetLogs]);

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
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">No runs found for this pipeline</p>
        </div>
      )}
    </div>
  );
}
