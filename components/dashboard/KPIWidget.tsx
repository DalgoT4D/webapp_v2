'use client';

// Dashboard widget that renders a KPI — spec § 5.5 (Bhumi's June blocker).
//
// Shape: value + target + RAG badge + trendline, matching the KPI card used
// on the /kpis page so dashboard-embedded KPIs and the KPIs page stay in
// visual lockstep. Widget config stores kpi_id only; the live KPI is
// re-fetched, so dashboards reflect edits to the KPI elsewhere without
// needing a republish.

import React, { useMemo } from 'react';
import { AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RAGBadge } from '@/components/kpis/RAGBadge';
import { MetricSparkline } from '@/components/kpis/MetricSparkline';
import { useKPI, useKPIsData } from '@/hooks/api/useKPIs';

function formatValue(value: number | null | undefined): string {
  if (value == null) return '—';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export interface KPIWidgetConfig {
  kpiId: number;
  // Optional manual override for the widget title. Defaults to the KPI name.
  title?: string;
}

interface KPIWidgetProps {
  config: KPIWidgetConfig;
  // View-mode only so far; edit affordances (rename, swap KPI) are minor
  // polish for Batch 10.
  className?: string;
}

export function KPIWidget({ config, className = '' }: KPIWidgetProps) {
  const kpiId = config?.kpiId ?? null;
  const { data: kpi, isLoading: kpiLoading } = useKPI(kpiId);

  // Reuse the bulk data endpoint — one KPI id is still cheap and shares
  // the SWR cache with the /kpis page.
  const kpiIds = useMemo(() => (kpiId != null ? [kpiId] : null), [kpiId]);
  const { data: dataPoints, isLoading: dataLoading } = useKPIsData(kpiIds);
  const data = dataPoints?.[0];

  const isLoading = kpiLoading || dataLoading;

  if (!kpiId) {
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground ${className}`}
      >
        No KPI selected
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`flex h-full w-full flex-col gap-2 p-4 ${className}`}>
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-10 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!kpi) {
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground ${className}`}
      >
        <AlertCircle className="h-4 w-4 mb-1 text-muted-foreground/60" />
        KPI not found
      </div>
    );
  }

  const metric = kpi.metric;
  const currentValue = data?.current_value;
  const ragStatus = data?.rag_status ?? 'grey';
  const trend = data?.trend ?? [];
  const hasError = !!data?.error;
  const hasTarget = kpi.target_value != null;
  const displayTitle = config.title || metric.name;

  return (
    <TooltipProvider>
      <div className={`flex h-full w-full flex-col gap-2 p-4 ${className}`}>
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight line-clamp-2 text-foreground">
            {displayTitle}
            <span className="ml-1 text-xs text-muted-foreground font-normal">
              {kpi.direction === 'decrease' ? '↓' : '↑'}
            </span>
          </h3>
          {data?.period_over_period_pct != null && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium shrink-0 ${
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

        {/* Value line */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tabular-nums text-foreground">
            {formatValue(currentValue)}
          </span>
          {hasTarget && (
            <span className="text-sm text-muted-foreground">/ {formatValue(kpi.target_value)}</span>
          )}
        </div>

        {/* Trendline */}
        <div className="flex-1 min-h-[40px]">
          {trend.length >= 2 ? (
            <MetricSparkline
              data={trend}
              direction={kpi.direction}
              width={320}
              height={44}
              className="w-full h-full"
            />
          ) : metric.time_column ? (
            <span className="text-xs text-muted-foreground italic">
              {hasError ? 'Could not load trend' : 'Insufficient trend data'}
            </span>
          ) : null}
        </div>

        {/* RAG badge */}
        <RAGBadge
          status={ragStatus}
          achievementPct={data?.achievement_pct}
          hasTarget={hasTarget}
          hasError={hasError}
        />
      </div>
    </TooltipProvider>
  );
}
