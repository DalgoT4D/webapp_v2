'use client';

import { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { useKPIData } from '@/hooks/api/useKPIs';
import { RAG_COLORS } from '@/types/kpis';
import type { RAGStatus } from '@/types/kpis';
import type { CommentStates, CommentIconState } from '@/types/comments';
import { CommentPopover } from '@/components/reports/comment-popover';

interface KPIChartElementProps {
  kpiId: number;
  config: any;
  isResizing?: boolean;
  snapshotId?: number;
  commentStates?: CommentStates;
  onCommentStateChange?: () => void;
  autoOpenCommentChartId?: string;
}

function formatValue(v: number | null | undefined): string {
  if (v === null || v === undefined) return '\u2014';
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function KPIChartElement({
  kpiId,
  config,
  isResizing,
  snapshotId,
  commentStates,
  onCommentStateChange,
  autoOpenCommentChartId,
}: KPIChartElementProps) {
  const { chartData, echartsConfig, isLoading, isError } = useKPIData(kpiId, snapshotId);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const ragStatus = chartData?.rag_status as RAGStatus | null;
  const ragInfo = ragStatus ? RAG_COLORS[ragStatus] : null;
  const currentValue = chartData?.current_value;
  const targetValue = chartData?.target_value;
  const hasTrend = chartData?.periods && chartData.periods.length > 0;

  useEffect(() => {
    if (!chartRef.current || !echartsConfig || Object.keys(echartsConfig).length === 0) return;

    if (chartInstance.current) {
      chartInstance.current.dispose();
    }
    chartInstance.current = echarts.init(chartRef.current);
    chartInstance.current.setOption(echartsConfig);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [echartsConfig]);

  useEffect(() => {
    if (!isResizing) {
      setTimeout(() => chartInstance.current?.resize(), 100);
    }
  }, [isResizing]);

  if (isError) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-sm text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          Failed to load KPI
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col p-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <h3 className="text-sm font-semibold text-gray-900 truncate flex-1">
          {config?.title || 'KPI'}
        </h3>
        {ragInfo && (
          <Badge
            variant="outline"
            className={`${ragInfo.bg} ${ragInfo.text} border-0 text-xs shrink-0`}
          >
            {ragInfo.label}
          </Badge>
        )}
        {snapshotId && (
          <CommentPopover
            snapshotId={snapshotId}
            targetType="kpi"
            chartId={kpiId}
            state={
              (commentStates?.find((s) => s.target_id === kpiId)?.state as CommentIconState) ??
              'none'
            }
            triggerClassName="h-7 w-7 p-0"
            onStateChange={onCommentStateChange}
            autoOpen={autoOpenCommentChartId === String(kpiId)}
          />
        )}
      </div>

      {/* Value / Target — only when trend data exists */}
      {hasTrend && (
        <div className="mb-1 shrink-0">
          {isLoading ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <>
              <span className="text-xl font-bold text-gray-900">{formatValue(currentValue)}</span>
              {targetValue !== null && targetValue !== undefined && (
                <span className="text-sm text-muted-foreground ml-1">
                  / {formatValue(targetValue)}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : echartsConfig && Object.keys(echartsConfig).length > 0 ? (
          <div ref={chartRef} className="h-full w-full" />
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            No data
          </div>
        )}
      </div>
    </div>
  );
}
