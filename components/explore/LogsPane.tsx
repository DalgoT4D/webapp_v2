// components/explore/LogsPane.tsx
'use client';

import { Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
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
  const TABLE_HEADER_HEIGHT = 50;
  const contentHeight = Math.max(200, height - TABLE_HEADER_HEIGHT);

  // Loading state with no logs
  if (isLoading && dbtRunLogs.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-white"
        style={{ height: contentHeight }}
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
        style={{ height: contentHeight }}
        data-testid="logs-empty"
      >
        Please press run
      </div>
    );
  }

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const dateStr = format(date, 'yyyy/MM/dd');
      const timeStr = format(date, 'hh:mm:ss a');
      return `${dateStr}    ${timeStr}`;
    } catch {
      return timestamp;
    }
  };

  // Render table with logs
  return (
    <div className="flex flex-col h-full bg-white" data-testid="logs-pane">
      <div className="overflow-auto" style={{ height: contentHeight }}>
        <Table>
          <TableHeader className="sticky top-0 bg-muted/50 z-10">
            <TableRow>
              <TableHead className="min-w-[200px] font-bold text-gray-700">Last Run</TableHead>
              <TableHead className="font-bold text-gray-700">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dbtRunLogs.map((log, index) => (
              <TableRow
                key={index}
                data-testid={`log-row-${index}`}
                className="hover:bg-gray-50/50"
              >
                <TableCell className="font-medium text-sm text-gray-600 whitespace-nowrap">
                  {formatTimestamp(log.timestamp)}
                </TableCell>
                <TableCell className="text-sm text-gray-700">{log.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Show loading indicator at bottom when fetching more logs */}
      {isLoading && dbtRunLogs.length > 0 && (
        <div className="flex items-center justify-center py-2 border-t">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Loading more logs...</span>
        </div>
      )}
    </div>
  );
}
