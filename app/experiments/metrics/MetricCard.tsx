'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkline } from './Sparkline';
import { ProgressBar } from './ProgressBar';
import { cn } from '@/lib/utils';
import type { Metric } from '../_lib/types';
import type { RagStatus } from '../_lib/types';

const RAG_BADGE_STYLES: Record<RagStatus, string> = {
  on_track: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  at_risk: 'bg-amber-50 text-amber-700 border-amber-200',
  below_target: 'bg-red-50 text-red-700 border-red-200',
};

const RAG_LABELS: Record<RagStatus, string> = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  below_target: 'Below Target',
};

const RAG_HOVER_BORDER: Record<RagStatus, string> = {
  on_track: 'hover:border-emerald-300 hover:shadow-md',
  at_risk: 'hover:border-amber-300 hover:shadow-md',
  below_target: 'hover:border-red-300 hover:shadow-md',
};

export function MetricCard({ metric }: { metric: Metric }) {
  const unit = metric.unit ? ` ${metric.unit}` : '';
  const targetStr = `vs target ${metric.target}${unit}`;

  return (
    <Link href={`/experiments/metrics/${metric.id}`}>
      <Card
        className={cn(
          'cursor-pointer transition-all border-2 hover:border-opacity-80',
          RAG_HOVER_BORDER[metric.ragStatus]
        )}
      >
        <div className="p-4 space-y-3">
          {/* Top row: category + RAG badge */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {metric.category}
            </span>
            <Badge
              variant="outline"
              className={cn('font-medium', RAG_BADGE_STYLES[metric.ragStatus])}
            >
              {RAG_LABELS[metric.ragStatus]}
            </Badge>
          </div>

          {/* Metric name */}
          <h3 className="text-base font-semibold leading-snug">{metric.name}</h3>

          {/* Value row: large value + sparkline */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xl font-bold">
              {metric.current}
              {unit}
            </span>
            <Sparkline data={metric.trend} status={metric.ragStatus} />
          </div>

          {/* Target comparison */}
          <p className="text-sm text-muted-foreground">{targetStr}</p>

          {/* Progress bar */}
          <ProgressBar metric={metric} />

          {/* Annotation (if exists) */}
          {metric.annotation && (
            <div className="bg-muted/50 rounded-md p-3 text-sm border-l-2 border-blue-400">
              <span className="font-bold">Context:</span> {metric.annotation}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
