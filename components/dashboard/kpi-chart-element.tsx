'use client';

import { Eye } from 'lucide-react';
import { KPICard } from '@/components/kpis/kpi-card';
import { Button } from '@/components/ui/button';
import type { KPICardData } from '@/components/kpis/kpi-card';
import type { RAGStatus } from '@/types/kpis';
import type { CommentStates, CommentIconState } from '@/types/comments';
import { CommentPopover } from '@/components/reports/comment-popover';
import { computePopChanges } from '@/lib/formatters';
import { useKPIData } from '@/hooks/api/useKPIs';
import { KPI_EXPORT_SOURCES } from '@/constants/analytics';

interface KPIChartElementProps {
  kpiId: number;
  config: any;
  isResizing?: boolean;
  snapshotId?: number;
  dashboardFilters?: Record<string, any>;
  publicToken?: string;
  isPublicMode?: boolean;
  isReportMode?: boolean;
  commentStates?: CommentStates;
  onCommentStateChange?: () => void;
  autoOpenCommentChartId?: string;
  onView?: () => void;
}

export function KPIChartElement({
  kpiId,
  config,
  snapshotId,
  dashboardFilters,
  publicToken,
  isPublicMode,
  isReportMode,
  commentStates,
  onCommentStateChange,
  autoOpenCommentChartId,
  onView,
}: KPIChartElementProps) {
  const { chartData, echartsConfig, isError, isLoading } = useKPIData(kpiId || null, snapshotId, {
    dashboardFilters,
    publicToken,
    isPublicMode,
    isReportMode,
  });

  const ragStatus = chartData?.rag_status as RAGStatus | null;
  const periods = chartData?.periods || [];

  const lastTwo = periods
    .slice(-2)
    .map((p: { period: string; period_date: string | null; value: number | null }) => p.value);
  const popChange = computePopChanges(lastTwo)[1] ?? null;

  if (isError) {
    return (
      <div className="h-full flex items-center justify-center p-4 text-sm text-muted-foreground">
        Failed to load KPI
      </div>
    );
  }

  const cardData: KPICardData = {
    currentValue: chartData?.current_value,
    targetValue: chartData?.target_value,
    ragStatus,
    popChange,
    direction: chartData?.direction || 'increase',
    timeGrain: chartData?.time_grain || 'monthly',
    echartsConfig: echartsConfig || null,
    dataLastDate: chartData?.data_last_date,
    updatedAt: config?.updated_at || new Date().toISOString(),
    isLoading,
    periods,
    customizations: chartData?.customizations ?? undefined,
  };

  const commentButton = snapshotId ? (
    <CommentPopover
      snapshotId={snapshotId}
      targetType="kpi"
      chartId={kpiId}
      state={
        (commentStates?.find((s) => s.target_id === kpiId)?.state as CommentIconState) ?? 'none'
      }
      triggerClassName="h-7 w-7 p-0"
      onStateChange={onCommentStateChange}
      autoOpen={autoOpenCommentChartId === String(kpiId)}
    />
  ) : null;

  const viewButton =
    onView && !isPublicMode ? (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        title="View KPI"
        aria-label="View KPI"
        onClick={onView}
      >
        <Eye className="h-3.5 w-3.5" />
      </Button>
    ) : null;

  return (
    <div className="h-full">
      <KPICard
        name={config?.title || 'KPI'}
        data={cardData}
        headerActions={
          (snapshotId && viewButton) || commentButton ? (
            <div className="flex items-center gap-1">
              {snapshotId && viewButton}
              {commentButton}
            </div>
          ) : null
        }
        toolbarActions={!snapshotId ? viewButton : null}
        className="h-full"
        borderless
        kpiId={kpiId}
        exportSource={KPI_EXPORT_SOURCES.DASHBOARD}
        showDownload={!snapshotId}
        showFullscreen={!snapshotId}
      />
    </div>
  );
}
