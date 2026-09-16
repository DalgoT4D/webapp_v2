'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { SqlBlock } from './SqlBlock';
import type { ToolActivity } from '@/types/chat-with-data';

/**
 * The agent's visible reasoning: while a turn runs the steps stream in under a
 * left rail; once the answer lands they collapse behind a "Thought process"
 * toggle, with any generated SQL in QUERY blocks — per the Dalgo 2.0 design.
 */
export function ToolProgress({
  tools,
  streaming = false,
}: {
  tools: ToolActivity[];
  streaming?: boolean;
}) {
  const [openWhileIdle, setOpenWhileIdle] = useState(false);

  if (!tools.length) return null;

  // streaming turns always show their steps; finished turns collapse
  const open = streaming || openWhileIdle;
  const Chevron = open ? ChevronUp : ChevronDown;
  const sqlSteps = tools.filter((activity) => activity.sql);

  const toggle = () => {
    setOpenWhileIdle((current) => {
      if (!current && sqlSteps.length) trackEvent(ANALYTICS_EVENTS.CHAT_SQL_VIEWED);
      return !current;
    });
  };

  return (
    <div data-testid="chat-tool-progress">
      <button
        type="button"
        data-testid="chat-reasoning-toggle"
        onClick={toggle}
        disabled={streaming}
        className="flex items-center gap-1 text-sm text-[#7A7A8C]"
      >
        {streaming ? <Loader2 className="size-4 animate-spin" /> : <Chevron className="size-4" />}
        {streaming ? 'Thinking…' : 'Thought process'}
      </button>

      {open && (
        <div className="ml-[7px] mt-1.5 flex gap-4 border-l-2 border-[#E8ECEF] pl-4">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-1">
              {tools.map((activity, index) => (
                // activities append-only within a turn, so index is a stable key
                // eslint-disable-next-line react/no-array-index-key
                <p key={`step-${index}`} className="text-xs text-[#7A7A8C]">
                  {activity.label}
                </p>
              ))}
            </div>
            {sqlSteps.map((activity, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={`query-${index}`} className="flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold tracking-[0.6px] text-[#A3A3B0]">QUERY</p>
                <SqlBlock sql={activity.sql as string} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
