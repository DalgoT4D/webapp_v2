'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, CircleCheck, CircleX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import type { ToolActivity } from '@/types/chat-with-data';

function StatusIcon({ status }: { status: ToolActivity['status'] }) {
  if (status === 'running') {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  }
  if (status === 'error') {
    return <CircleX className="h-3.5 w-3.5 text-destructive" />;
  }
  return <CircleCheck className="h-3.5 w-3.5 text-primary" />;
}

/**
 * What the agent is doing while a turn runs — plain-language chips for Priya,
 * with the generated SQL behind a "view SQL" toggle for the data-savvy.
 */
export function ToolProgress({ tools }: { tools: ToolActivity[] }) {
  const [openSql, setOpenSql] = useState<Record<number, boolean>>({});

  if (!tools.length) return null;

  const toggleSql = (index: number) => {
    setOpenSql((current) => {
      const next = { ...current, [index]: !current[index] };
      if (next[index]) {
        trackEvent(ANALYTICS_EVENTS.CHAT_SQL_VIEWED);
      }
      return next;
    });
  };

  return (
    <div className="mt-1 flex flex-col gap-1" data-testid="chat-tool-progress">
      {tools.map((activity, index) => (
        // activities append-only within a turn, so index is a stable key
        // eslint-disable-next-line react/no-array-index-key
        <div key={`tool-${index}`}>
          <div
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
              activity.status === 'running' ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            <StatusIcon status={activity.status} />
            <span>{activity.label}</span>
            {activity.sql && (
              <button
                type="button"
                data-testid={`view-sql-toggle-${index}`}
                onClick={() => toggleSql(index)}
                className="ml-1 inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
              >
                {openSql[index] ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                view SQL
              </button>
            )}
          </div>
          {activity.sql && openSql[index] && (
            <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-2 text-xs">
              {activity.sql}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
