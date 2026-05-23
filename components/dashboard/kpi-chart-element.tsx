'use client';

import { useKPIData } from '@/hooks/api/useKPIs';
import { KPICard } from '@/components/kpis/kpi-card';
import type { KPICardData } from '@/components/kpis/kpi-card';
import type { RAGStatus } from '@/types/kpis';
import type { CommentStates, CommentIconState } from '@/types/comments';
import { CommentPopover } from '@/components/reports/comment-popover';

interface KPIChartElementProps {
  kpiId: number;
  config: any;
  isResizing?: boolean;
  snapshotId?: number;
  dashboardFilters?: Record<string, any>;
  commentStates?: CommentStates;
  onCommentStateChange?: () => void;
  autoOpenCommentChartId?: string;
}

export function KPIChartElement({
  kpiId,
  config,
  snapshotId,
  dashboardFilters,
  commentStates,
  onCommentStateChange,
  autoOpenCommentChartId,
}: KPIChartElementProps) {
  const { chartData, echartsConfig, isLoading, isError } = useKPIData(kpiId, snapshotId, {
    dashboardFilters,
  });

  const ragStatus = chartData?.rag_status as RAGStatus | null;
  const periods = chartData?.periods || [];

  const popChange = (() => {
    if (periods.length < 2) return null;
    const current = periods[periods.length - 1]?.value;
    const previous = periods[periods.length - 2]?.value;
    if (current == null || previous == null || previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
  })();

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

  return (
    <div className="h-full">
      <KPICard
        name={config?.title || 'KPI'}
        data={cardData}
        headerActions={commentButton}
        className="h-full"
        borderless
        showDownload={!snapshotId}
      />
    </div>
  );
}
