'use client';

import { cn } from '@/lib/utils';
import type { GroupSummary } from '@/components/ingest/redesign/utils';

interface SourceRollupProps {
  summary: GroupSummary;
}

interface Chip {
  key: string;
  count: number;
  label: string;
  dotClass: string;
  textClass: string;
}

/**
 * Compact health summary for a source group's connections, e.g.
 * "3 connections · ● 2 succeeded · ● 1 failed". Only non-zero states show.
 */
export function SourceRollup({ summary }: SourceRollupProps) {
  const chips: Chip[] = [
    {
      key: 'succeeded',
      count: summary.succeeded,
      label: 'succeeded',
      dotClass: 'bg-green-600',
      textClass: 'text-green-700',
    },
    {
      key: 'failed',
      count: summary.failed,
      label: 'failed',
      dotClass: 'bg-red-600',
      textClass: 'text-red-700',
    },
    {
      key: 'running',
      count: summary.running,
      label: 'in progress',
      dotClass: 'bg-amber-500',
      textClass: 'text-amber-600',
    },
  ].filter((chip) => chip.count > 0);

  return (
    <div
      className="flex items-center gap-x-2 gap-y-1 flex-wrap text-sm text-muted-foreground"
      data-testid="source-rollup"
    >
      <span className="font-medium">
        {summary.total} {summary.total === 1 ? 'connection' : 'connections'}
      </span>
      {chips.map((chip) => (
        <span key={chip.key} className="flex items-center gap-1.5">
          <span aria-hidden className="text-muted-foreground/40">
            ·
          </span>
          <span className={cn('h-2 w-2 rounded-full flex-shrink-0', chip.dotClass)} />
          <span className={chip.textClass}>
            {chip.count} {chip.label}
          </span>
        </span>
      ))}
    </div>
  );
}
