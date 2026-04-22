'use client';

import {
  MoreHorizontal,
  Pencil,
  Trash2,
  AlertCircle,
  ChevronRight,
  Eye,
  Plus,
  TrendingUp,
  TrendingDown,
  Bell,
} from 'lucide-react';
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
import type { KPI, KPIDataPoint } from '@/types/kpis';

interface KPICardProps {
  kpi: KPI;
  data?: KPIDataPoint;
  hasEntries?: boolean;
  // Number of alerts linked to this KPI. When > 0 the card shows a small
  // bell-marker (Batch 7 linked-alerts indicator, spec § 5.2).
  linkedAlertCount?: number;
  isLoading?: boolean;
  canEdit?: boolean;
  canCreateAlert?: boolean;
  canViewAlerts?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onCreateAlert?: () => void;
  onViewAlerts?: () => void;
  onDelete?: () => void;
}

function formatValue(value: number | null | undefined): string {
  if (value == null) return '—';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function KPICard({
  kpi,
  data,
  hasEntries = false,
  linkedAlertCount = 0,
  isLoading = false,
  canEdit = false,
  canCreateAlert = false,
  canViewAlerts = false,
  onClick,
  onEdit,
  onCreateAlert,
  onViewAlerts,
  onDelete,
}: KPICardProps) {
  const currentValue = data?.current_value;
  const ragStatus = data?.rag_status ?? 'grey';
  const trend = data?.trend ?? [];
  const hasError = !!data?.error;
  const hasTarget = kpi.target_value != null;
  const showActions = canEdit || canCreateAlert || canViewAlerts || Boolean(onDelete);
  const metric = kpi.metric;

  // Compact summary of the underlying Metric for the tooltip.
  const sourceSummary =
    metric.creation_mode === 'sql'
      ? `Calculated SQL on ${metric.schema_name}.${metric.table_name}`
      : `${metric.simple_formula || metric.simple_terms.map((t) => t.id).join(' ')} from ${metric.schema_name}.${metric.table_name}`;

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-foreground/20 cursor-pointer"
    >
      {/* Header: name + overflow menu */}
      <div className="flex items-start justify-between gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <h3 className="text-sm font-semibold leading-tight line-clamp-2 text-foreground">
              {metric.name}
              <span className="ml-1 text-xs text-muted-foreground font-normal">
                {kpi.direction === 'decrease' ? '↓' : '↑'}
              </span>
            </h3>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p>{metric.name}</p>
            <p className="text-muted-foreground text-xs mt-1">{sourceSummary}</p>
          </TooltipContent>
        </Tooltip>

        {showActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit ? (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.();
                  }}
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit KPI
                </DropdownMenuItem>
              ) : null}
              {canCreateAlert ? (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateAlert?.();
                  }}
                >
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Create alert
                </DropdownMenuItem>
              ) : null}
              {canViewAlerts ? (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewAlerts?.();
                  }}
                >
                  <Eye className="mr-2 h-3.5 w-3.5" />
                  View alerts
                </DropdownMenuItem>
              ) : null}
              {onDelete ? (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.();
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Value line */}
      <div className="flex items-baseline justify-between gap-3">
        {isLoading ? (
          <div className="h-7 w-20 animate-pulse rounded bg-muted" />
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {formatValue(currentValue)}
            </span>
            {hasTarget && (
              <span className="text-sm text-muted-foreground">
                / {formatValue(kpi.target_value)}
              </span>
            )}
          </div>
        )}
        {/* Period-over-period delta (spec § 7). Green when moving in the KPI's
            favoured direction, red otherwise. */}
        {!isLoading && data?.period_over_period_pct != null && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                  data.period_over_period_pct >= 0 === (kpi.direction === 'increase')
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                {data.period_over_period_pct >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {data.period_over_period_pct >= 0 ? '+' : ''}
                {data.period_over_period_pct}%
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">vs. previous period</p>
              {data.period_over_period_delta != null && (
                <p className="text-xs text-muted-foreground">
                  Δ {data.period_over_period_delta >= 0 ? '+' : ''}
                  {formatValue(data.period_over_period_delta)}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Sparkline — full width of the card */}
      <div className="w-full">
        {isLoading ? (
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
        ) : trend.length >= 2 ? (
          <MetricSparkline
            data={trend}
            direction={kpi.direction}
            width={280}
            height={40}
            className="w-full"
          />
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

      {/* Freshness label: when did the underlying data last update? */}
      {!isLoading && data?.last_pipeline_update && (
        <p className="text-[11px] text-muted-foreground/80">
          Data updated{' '}
          {(() => {
            const diffMs = Date.now() - new Date(data.last_pipeline_update).getTime();
            const mins = Math.floor(diffMs / 60000);
            if (mins < 1) return 'just now';
            if (mins < 60) return `${mins}m ago`;
            const hrs = Math.floor(mins / 60);
            if (hrs < 24) return `${hrs}h ago`;
            const days = Math.floor(hrs / 24);
            return `${days}d ago`;
          })()}
        </p>
      )}

      {/* Click affordance + status markers in bottom right */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors">
        {linkedAlertCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                <Bell className="h-2.5 w-2.5" />
                {linkedAlertCount}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">
                {linkedAlertCount} alert{linkedAlertCount === 1 ? '' : 's'} linked
              </p>
            </TooltipContent>
          </Tooltip>
        )}
        {hasEntries && (
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" title="Has entries" />
        )}
        <ChevronRight className="h-4 w-4" />
      </div>
    </div>
  );
}
