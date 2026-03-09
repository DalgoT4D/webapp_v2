'use client';

import { Loader2 } from 'lucide-react';
import type { DashboardPipeline, DashboardRun } from '@/types/pipeline';
import { PipelineBarChart } from './pipeline-bar-chart';
import { Checkbox } from '@/components/ui/checkbox';
import { lastRunTime } from './utils';
import CheckCircleIcon from '@/assets/icons/check-circle';
import WarningAmberIcon from '@/assets/icons/warning-amber';
import {
  FlowRunStatus,
  FlowRunStateName,
  STATUS_COLOR_DBT_TEST_FAILED,
  STATUS_COLOR_FAILED_DARK,
  STATUS_COLOR_RUNNING,
} from '@/constants/pipeline';

interface PipelineCardProps {
  pipeline: DashboardPipeline;
  scaleToRuntime: boolean;
  onScaleChange: (checked: boolean) => void;
  onSelectRun: (run: DashboardRun) => void;
  selectedRunId?: string | null;
}

/**
 * PipelineCard - Card with run history bar chart
 */
export function PipelineCard({
  pipeline,
  scaleToRuntime,
  onScaleChange,
  onSelectRun,
  selectedRunId,
}: PipelineCardProps) {
  const runs = pipeline.runs || [];
  const runCount = runs.length;
  const successfulRuns = runs.filter(
    (r) => r.status === FlowRunStatus.COMPLETED && r.state_name !== FlowRunStateName.DBT_TEST_FAILED
  ).length;
  // Use runs[0].startTime like webapp does - runs are sorted most recent first
  const lastRunTimeStr = runs[0]?.startTime ? lastRunTime(runs[0].startTime) : null;

  // Determine last run status
  const lastRun = runs[0];
  const isLastRunSuccess =
    lastRun?.status === FlowRunStatus.COMPLETED &&
    lastRun?.state_name !== FlowRunStateName.DBT_TEST_FAILED;
  const isLastRunWarning = lastRun?.state_name === FlowRunStateName.DBT_TEST_FAILED;

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
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: STATUS_COLOR_RUNNING }} />
              <span className="text-sm font-semibold text-gray-700">Currently running</span>
            </>
          ) : (
            <>
              {/* Status icon */}
              {isLastRunSuccess ? (
                <CheckCircleIcon size={20} />
              ) : (
                <WarningAmberIcon
                  size={20}
                  color={isLastRunWarning ? STATUS_COLOR_DBT_TEST_FAILED : STATUS_COLOR_FAILED_DARK}
                />
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
        <PipelineBarChart
          runs={runs}
          scaleToRuntime={scaleToRuntime}
          onSelectRun={onSelectRun}
          selectedRunId={selectedRunId}
        />
      </div>

      {/* Footer row: Last X runs + scale toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <span className="text-sm text-gray-700 font-medium">Last {runCount} runs</span>

        <div className="flex items-center gap-2">
          <Checkbox
            id={`scale-${pipeline.deploymentName}`}
            data-testid={`scale-toggle-${pipeline.deploymentName}`}
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
