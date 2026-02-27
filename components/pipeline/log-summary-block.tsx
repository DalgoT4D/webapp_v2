'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LogSummary } from './log-summary-card';

interface LogSummaryBlockProps {
  logsummary: LogSummary;
  setLogsummaryLogs: (logs: string[]) => void;
}

/**
 * NameAndPatternBlock - Default display for task summaries
 */
function NameAndPatternBlock({ logsummary, setLogsummaryLogs }: LogSummaryBlockProps) {
  return (
    <>
      <div className="flex w-full justify-between items-center pl-1">
        <span className="font-medium text-lg">{logsummary.task_name}</span>
        <Button variant="default" size="sm" onClick={() => setLogsummaryLogs(logsummary.log_lines)}>
          Logs
        </Button>
      </div>
      {logsummary.pattern && (
        <p className="text-sm text-gray-600 font-light">{logsummary.pattern}</p>
      )}
    </>
  );
}

/**
 * StatRow - Reusable row for displaying a stat (passed, errors, etc.)
 */
function StatRow({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex w-full justify-between pl-1">
      <span className="text-sm font-light">{value}</span>
      <span className="text-sm font-light">{label}</span>
    </div>
  );
}

/**
 * DbtRunBlock - Display for successful dbt run tasks
 */
function DbtRunBlock({ logsummary, setLogsummaryLogs }: LogSummaryBlockProps) {
  return (
    <>
      <div className="flex w-full justify-between items-center pl-1">
        <span className="font-medium text-lg">{logsummary.task_name}</span>
        <Button variant="default" size="sm" onClick={() => setLogsummaryLogs(logsummary.log_lines)}>
          Logs
        </Button>
      </div>
      <StatRow value={logsummary.passed || 0} label="passed" />
      <StatRow value={logsummary.errors || 0} label="errors" />
      <StatRow value={logsummary.skipped || 0} label="skipped" />
      <StatRow value={logsummary.warnings || 0} label="warnings" />
    </>
  );
}

/**
 * DbtTestBlock - Display for failed dbt test tasks
 */
function DbtTestBlock({ logsummary, setLogsummaryLogs }: LogSummaryBlockProps) {
  const summary = logsummary.tests.find((test) => test.pattern === 'test-summary');

  if (!summary) {
    return null;
  }

  return (
    <>
      <div className="flex w-full justify-between items-center pl-1">
        <span className="font-medium text-lg">{logsummary.task_name}</span>
        <Button variant="default" size="sm" onClick={() => setLogsummaryLogs(logsummary.log_lines)}>
          Logs
        </Button>
      </div>
      <StatRow value={summary.passed || 0} label="passed" />
      <StatRow value={summary.errors || 0} label="errors" />
      <StatRow value={summary.skipped || 0} label="skipped" />
      <StatRow value={summary.warnings || 0} label="warnings" />
    </>
  );
}

/**
 * LogSummaryBlock - Container for individual task summaries
 * Shows different layouts based on task type and status
 */
export function LogSummaryBlock({ logsummary, setLogsummaryLogs }: LogSummaryBlockProps) {
  const isSuccess = logsummary.status === 'success';
  const isDbtRunSuccess = logsummary.task_name === 'dbt run' && isSuccess;
  const isDbtTestFailed = logsummary.task_name === 'dbt test' && logsummary.status === 'failed';

  // Check if special handling is needed
  const useSpecialHandling = isDbtRunSuccess || isDbtTestFailed;

  return (
    <div
      className={cn(
        'border-[3px] rounded-lg p-2 w-[400px] text-left',
        isSuccess ? 'border-[#00897B]' : 'border-[#C15E5E]'
      )}
    >
      {isDbtRunSuccess && (
        <DbtRunBlock logsummary={logsummary} setLogsummaryLogs={setLogsummaryLogs} />
      )}
      {isDbtTestFailed && (
        <DbtTestBlock logsummary={logsummary} setLogsummaryLogs={setLogsummaryLogs} />
      )}
      {!useSpecialHandling && (
        <NameAndPatternBlock logsummary={logsummary} setLogsummaryLogs={setLogsummaryLogs} />
      )}
    </div>
  );
}
