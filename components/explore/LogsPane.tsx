// components/explore/LogsPane.tsx
'use client';

import { Loader2 } from 'lucide-react';
import { format, isValid } from 'date-fns';
import type { TaskProgressLog } from '@/types/transform';

interface LogsPaneProps {
  /** Height of the pane for scroll calculations */
  height: number;
  /** Array of log entries to display */
  dbtRunLogs: TaskProgressLog[];
  /** Whether logs are currently being fetched */
  isLoading: boolean;
}

/**
 * LogsPane displays DBT run logs in a table format.
 * Shows loading state, empty state with "Please press run" message,
 * or a scrollable table of log entries with timestamps.
 */
export function LogsPane({ height, dbtRunLogs, isLoading }: LogsPaneProps) {
  // Loading state with no logs
  if (isLoading && dbtRunLogs.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-white"
        style={{ height }}
        data-testid="logs-loading"
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state
  if (dbtRunLogs.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground bg-white"
        style={{ height }}
        data-testid="logs-empty"
      >
        Please press run
      </div>
    );
  }

  // Format timestamp for display — returns null if timestamp is missing/invalid
  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    if (!isValid(date)) return null;
    const dateStr = format(date, 'yyyy/MM/dd');
    const timeStr = format(date, 'hh:mm:ss a').toUpperCase();
    return { dateStr, timeStr };
  };

  return (
    <div className="flex flex-col h-full bg-white" data-testid="logs-pane">
      <div className="overflow-auto" style={{ height }}>
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col style={{ width: '35%' }} />
            <col style={{ width: '65%' }} />
          </colgroup>
          {/* Header */}
          <thead className="sticky top-0 z-10" style={{ backgroundColor: '#F5FAFA' }}>
            <tr>
              <th className="text-left py-2.5 px-5 font-bold text-sm text-gray-800">Last Run</th>
              <th className="text-left py-2.5 px-5 font-bold text-sm text-gray-800">Description</th>
            </tr>
          </thead>
          {/* Body */}
          <tbody>
            {dbtRunLogs.map((log, index) => {
              const ts = formatTimestamp(log.timestamp);
              return (
                <tr
                  key={index}
                  data-testid={`log-row-${index}`}
                  className="border-b border-gray-200"
                >
                  <td className="py-2.5 px-5 text-sm font-medium text-gray-700 whitespace-nowrap">
                    {ts ? (
                      <>
                        {ts.dateStr}
                        <span className="inline-block w-8" />
                        {ts.timeStr}
                      </>
                    ) : null}
                  </td>
                  <td className="py-2.5 px-5 text-sm text-gray-700">{log.message}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Loading indicator at bottom when fetching more logs */}
      {isLoading && dbtRunLogs.length > 0 && (
        <div className="flex items-center justify-center py-2 border-t">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Loading more logs...</span>
        </div>
      )}
    </div>
  );
}
