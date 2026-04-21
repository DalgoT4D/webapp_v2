'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PipelineRunDisplayStatus } from '@/constants/pipeline';

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
  status?: PipelineRunDisplayStatus;
  /** Optional className for the wrapper */
  className?: string;
  /** Whether to show the colored header (default: true). When false, status color applies to body background instead */
  showHeader?: boolean;
}

// Status-based colors for header and body variants
const STATUS_STYLES: Record<
  string,
  { header: string; headerText: string; hover: string; bodyBg: string }
> = {
  [PipelineRunDisplayStatus.SUCCESS]: {
    header: 'bg-primary border-primary',
    headerText: 'text-white',
    hover: 'hover:bg-primary/20',
    bodyBg: 'bg-primary/5',
  },
  [PipelineRunDisplayStatus.FAILED]: {
    header: 'bg-failed border-failed',
    headerText: 'text-white',
    hover: 'hover:bg-failed/20',
    bodyBg: 'bg-failed/5',
  },
  [PipelineRunDisplayStatus.WARNING]: {
    header: 'bg-warning border-warning',
    headerText: 'text-white',
    hover: 'hover:bg-warning/20',
    bodyBg: 'bg-warning/5',
  },
};

/**
 * LogCard - Shared collapsible card for displaying log messages
 * Used in both pipeline overview and orchestrate run history
 *
 * Two modes:
 * - showHeader=true (default): Colored header bar + neutral body (pipeline overview)
 * - showHeader=false: No header, light status-tinted body background (orchestrate table)
 */
export function LogCard({
  logs,
  isLoading = false,
  hasMore = false,
  onFetchMore,
  onClose,
  title = 'Logs',
  status,
  className,
  showHeader = true,
}: LogCardProps) {
  const [expanded, setExpanded] = useState(true);

  const styles = status ? STATUS_STYLES[status] : null;

  return (
    <div
      className={cn(
        'border rounded-lg shadow-sm overflow-hidden',
        'bg-muted border-border',
        className ?? 'mt-4'
      )}
    >
      {/* Header - colored based on status (only when showHeader is true) */}
      {showHeader && (
        <div
          className={cn(
            'flex items-center justify-between px-4 py-3 border-b',
            styles?.header || 'bg-gray-200 border-border'
          )}
        >
          <span className={cn('text-sm font-medium', styles?.headerText || 'text-foreground')}>
            {title}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded transition-colors hover:bg-card/30"
              aria-label={expanded ? 'Collapse logs' : 'Expand logs'}
              data-testid="log-card-toggle-btn"
            >
              {expanded ? (
                <ChevronUp
                  className={cn('h-4 w-4', styles ? 'text-white/80' : 'text-muted-foreground')}
                />
              ) : (
                <ChevronDown
                  className={cn('h-4 w-4', styles ? 'text-white/80' : 'text-muted-foreground')}
                />
              )}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded transition-colors hover:bg-card/30"
                aria-label="Close logs"
                data-testid="log-card-close-btn"
              >
                <X className={cn('h-4 w-4', styles ? 'text-white/80' : 'text-muted-foreground')} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content - body background depends on mode */}
      {expanded && (
        <div
          className={cn(
            'max-h-80 overflow-y-auto',
            !showHeader && styles ? styles.bodyBg : 'bg-muted'
          )}
        >
          {isLoading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-muted-foreground">Loading logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No logs available</div>
          ) : (
            <div className="px-4 py-3 font-mono text-sm text-muted-foreground space-y-1">
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
                    onClick={onFetchMore}
                    disabled={isLoading}
                    data-testid="log-card-fetch-more-btn"
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
