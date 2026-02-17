'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LogCardProps {
  /** Log messages to display */
  logs: string[];
  /** Whether logs are loading */
  isLoading?: boolean;
  /** Whether there are more logs to fetch */
  hasMore?: boolean;
  /** Callback to fetch more logs */
  onFetchMore?: () => void;
  /** Callback to close the card */
  onClose?: () => void;
  /** Title to show in header */
  title?: string;
  /** Run status for background coloring */
  status?: 'success' | 'failed' | 'dbt_test_failed';
}

/**
 * LogCard - Simple collapsible card for displaying log messages
 * Similar to webapp v1's LogCard component
 */
export function LogCard({
  logs,
  isLoading = false,
  hasMore = false,
  onFetchMore,
  onClose,
  title = 'Logs',
  status,
}: LogCardProps) {
  const [expanded, setExpanded] = useState(true);

  const handleFetchMore = useCallback(() => {
    onFetchMore?.();
  }, [onFetchMore]);

  // Status-based colors
  const statusStyles = {
    success: {
      container: 'bg-green-50 border-green-200',
      header: 'bg-green-100 border-green-200',
      hover: 'hover:bg-green-100',
    },
    failed: {
      container: 'bg-red-50 border-red-200',
      header: 'bg-red-100 border-red-200',
      hover: 'hover:bg-red-100',
    },
    dbt_test_failed: {
      container: 'bg-amber-50 border-amber-200',
      header: 'bg-amber-100 border-amber-200',
      hover: 'hover:bg-amber-100',
    },
  };

  const styles = status ? statusStyles[status] : null;

  return (
    <div
      className={cn(
        'mt-4 border rounded-lg shadow-sm overflow-hidden',
        styles?.container || 'bg-gray-100 border-gray-200'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3 border-b',
          styles?.header || 'bg-gray-200 border-gray-300'
        )}
      >
        <span className="text-sm font-medium text-gray-700">{title}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className={cn(
              'p-1 rounded transition-colors',
              styles ? 'hover:bg-white/50' : 'hover:bg-gray-300'
            )}
            aria-label={expanded ? 'Collapse logs' : 'Expand logs'}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className={cn(
                'p-1 rounded transition-colors',
                styles ? 'hover:bg-white/50' : 'hover:bg-gray-300'
              )}
              aria-label="Close logs"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="max-h-80 overflow-y-auto">
          {isLoading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No logs available</div>
          ) : (
            <div className="px-4 py-3 font-mono text-sm text-gray-700 space-y-1">
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'py-0.5 transition-colors',
                    'break-words whitespace-pre-wrap',
                    styles?.hover || 'hover:bg-gray-200'
                  )}
                >
                  <span className="text-gray-400 select-none mr-2">-</span>
                  {log}
                </div>
              ))}

              {/* Fetch more button */}
              {hasMore && onFetchMore && (
                <div className="pt-3 pb-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleFetchMore}
                    disabled={isLoading}
                    className="text-xs text-teal-600 hover:text-teal-700 hover:bg-gray-200"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Loading...
                      </>
                    ) : (
                      'Fetch more'
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
