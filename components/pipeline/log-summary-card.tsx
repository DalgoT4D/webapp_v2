'use client';

import { LogSummaryBlock } from './log-summary-block';
import { LogSummary } from '@/types/pipeline';

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
