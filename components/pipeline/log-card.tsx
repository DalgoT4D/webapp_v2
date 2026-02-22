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

  // Status-based colors - header colored, body grey with matching hover
  const statusStyles = {
    success: {
      header: 'bg-[#00897B] border-[#00897B]',
      headerText: 'text-white',
      hover: 'hover:bg-[#00897B]/20',
    },
    failed: {
      header: 'bg-[#C15E5E] border-[#C15E5E]',
      headerText: 'text-white',
      hover: 'hover:bg-[#C15E5E]/20',
    },
    dbt_test_failed: {
      header: 'bg-[#df8e14] border-[#df8e14]',
      headerText: 'text-white',
      hover: 'hover:bg-[#df8e14]/20',
    },
  };

  const styles = status ? statusStyles[status] : null;

  return (
    <div
      className={cn(
        'mt-4 border rounded-lg shadow-sm overflow-hidden',
        'bg-gray-50 border-gray-200'
      )}
    >
      {/* Header - colored based on status */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3 border-b',
          styles?.header || 'bg-gray-200 border-gray-300'
        )}
      >
        <span className={cn('text-sm font-medium', styles?.headerText || 'text-gray-700')}>
          {title}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded transition-colors hover:bg-white/30"
            aria-label={expanded ? 'Collapse logs' : 'Expand logs'}
          >
            {expanded ? (
              <ChevronUp className={cn('h-4 w-4', styles ? 'text-white/80' : 'text-gray-500')} />
            ) : (
              <ChevronDown className={cn('h-4 w-4', styles ? 'text-white/80' : 'text-gray-500')} />
            )}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded transition-colors hover:bg-white/30"
              aria-label="Close logs"
            >
              <X className={cn('h-4 w-4', styles ? 'text-white/80' : 'text-gray-500')} />
            </button>
          )}
        </div>
      </div>

      {/* Content - grey body with colored hover */}
      {expanded && (
        <div className="max-h-80 overflow-y-auto bg-gray-50">
          {isLoading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No logs available</div>
          ) : (
            <div className="px-4 py-3 font-mono text-sm text-gray-600 space-y-1">
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'py-0.5 px-1 -mx-1 rounded transition-colors',
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
