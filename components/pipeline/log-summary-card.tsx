'use client';

import { LogSummaryBlock } from './log-summary-block';

export interface LogSummary {
  task_name: string;
  status: string;
  pattern?: string;
  log_lines: string[];
  errors?: number;
  passed?: number;
  skipped?: number;
  warnings?: number;
  tests: Array<{
    pattern: string;
    passed?: number;
    errors?: number;
    skipped?: number;
    warnings?: number;
  }>;
}

interface LogSummaryCardProps {
  logsummary: LogSummary[];
  setLogsummaryLogs: (logs: string[]) => void;
}

/**
 * LogSummaryCard - Displays AI-generated log summaries for pipeline runs
 * Shows task breakdowns with status indicators and allows drilling into specific logs
 */
export function LogSummaryCard({ logsummary, setLogsummaryLogs }: LogSummaryCardProps) {
  return (
    <div className="space-y-3">
      {logsummary.map((log) => (
        <LogSummaryBlock
          key={`${log.task_name}-${log.status}`}
          logsummary={log}
          setLogsummaryLogs={setLogsummaryLogs}
        />
      ))}
    </div>
  );
}
