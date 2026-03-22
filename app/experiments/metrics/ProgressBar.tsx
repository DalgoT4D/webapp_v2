'use client';

import type { Metric } from '../_lib/types';
import type { RagStatus } from '../_lib/types';
import { cn } from '@/lib/utils';

const RAG_BAR_COLORS = {
  on_track: 'bg-emerald-500',
  at_risk: 'bg-amber-500',
  below_target: 'bg-red-500',
};

/**
 * Progress bar from baseline to target.
 * For higher-is-better: baseline (left) -> target (right), fill shows progress.
 * For lower-is-better: baseline (left) -> target (right), fill shows how far down from baseline toward target.
 */
export function ProgressBar({ metric }: { metric: Metric }) {
  const { baseline, target, current, direction, ragStatus } = metric;
  const colorClass = RAG_BAR_COLORS[ragStatus];

  const displayBaseline = baseline;
  const displayTarget = target;

  // Progress as 0-100 for fill width
  let progressPercent: number;
  if (direction === 'higher-is-better') {
    const range = displayTarget - displayBaseline;
    const progress = range !== 0 ? (current - displayBaseline) / range : 0;
    progressPercent = Math.min(100, Math.max(0, progress * 100));
  } else {
    // lower-is-better: "progress" = how far we've gone from baseline down toward target
    const range = displayBaseline - displayTarget;
    const progress = range !== 0 ? (displayBaseline - current) / range : 0;
    progressPercent = Math.min(100, Math.max(0, progress * 100));
  }

  const unit = metric.unit ? ` ${metric.unit}` : '';
  const baselineStr = `${displayBaseline}${unit}`;
  const targetStr = `${displayTarget}${unit}`;

  return (
    <div className="space-y-1">
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', colorClass)}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Baseline: {baselineStr}</span>
        <span>Target: {targetStr}</span>
      </div>
    </div>
  );
}
