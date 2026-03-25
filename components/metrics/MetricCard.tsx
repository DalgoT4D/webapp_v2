'use client';

import { MoreHorizontal, MessageSquare, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RAGBadge } from './RAGBadge';
import { MetricSparkline } from './MetricSparkline';
import type { MetricDefinition, MetricDataPoint, MetricAnnotation } from '@/types/metrics';

interface MetricCardProps {
  metric: MetricDefinition;
  data?: MetricDataPoint;
  latestAnnotation?: MetricAnnotation | null;
  isLoading?: boolean;
  canEdit?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onAnnotate?: () => void;
}

function formatValue(value: number | null | undefined): string {
  if (value == null) return '—';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function MetricCard({
  metric,
  data,
  latestAnnotation,
  isLoading = false,
  canEdit = false,
  onEdit,
  onDelete,
  onAnnotate,
}: MetricCardProps) {
  const currentValue = data?.current_value;
  const ragStatus = data?.rag_status ?? 'grey';
  const trend = data?.trend ?? [];
  const hasError = !!data?.error;
  const hasTarget = metric.target_value != null;
  const hasAnnotation =
    latestAnnotation && (latestAnnotation.rationale || latestAnnotation.quote_text);

  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Header: name + overflow menu */}
      <div className="flex items-start justify-between gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <h3 className="text-sm font-semibold leading-tight line-clamp-2 text-foreground">
              {metric.name}
            </h3>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p>{metric.name}</p>
            <p className="text-muted-foreground text-xs mt-1">
              {metric.aggregation.toUpperCase()}({metric.column}) from {metric.schema_name}.
              {metric.table_name}
            </p>
          </TooltipContent>
        </Tooltip>

        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit metric
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAnnotate}>
                <MessageSquare className="mr-2 h-3.5 w-3.5" />
                Add note
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Value line */}
      <div className="flex items-baseline gap-1.5">
        {isLoading ? (
          <div className="h-7 w-20 animate-pulse rounded bg-muted" />
        ) : (
          <>
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {formatValue(currentValue)}
            </span>
            {hasTarget && (
              <span className="text-sm text-muted-foreground">
                / {formatValue(metric.target_value)}
              </span>
            )}
          </>
        )}
      </div>

      {/* Sparkline — full width of the card */}
      <div className="w-full">
        {isLoading ? (
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
        ) : trend.length >= 2 ? (
          <MetricSparkline data={trend} width={280} height={40} className="w-full" />
        ) : metric.time_column ? (
          <div className="h-10 flex items-center">
            <span className="text-xs text-muted-foreground italic">
              {hasError ? 'Could not load trend' : 'Insufficient trend data'}
            </span>
          </div>
        ) : (
          <div className="h-10 flex items-center">
            <span className="text-xs text-muted-foreground">No time column configured</span>
          </div>
        )}
      </div>

      {/* RAG badge */}
      <RAGBadge
        status={ragStatus}
        achievementPct={data?.achievement_pct}
        hasTarget={hasTarget}
        hasError={hasError}
      />

      {/* Error hint */}
      {hasError && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs text-red-600 cursor-help">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-1">Query error — hover for details</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-sm">
            <p className="text-xs font-mono break-all">{data?.error}</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Annotation preview */}
      {hasAnnotation ? (
        <button
          onClick={onAnnotate}
          className="flex items-start gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="line-clamp-1">
            {latestAnnotation!.quote_text
              ? `"${latestAnnotation!.quote_text}"`
              : latestAnnotation!.rationale}
          </span>
        </button>
      ) : canEdit ? (
        <button
          onClick={onAnnotate}
          className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors opacity-0 group-hover:opacity-100"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Add note
        </button>
      ) : null}
    </div>
  );
}
