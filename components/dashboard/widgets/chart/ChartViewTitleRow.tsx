'use client';

import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChartTitleEditor } from '@/components/dashboard/chart-title-editor';
import { CommentPopover } from '@/components/reports/comment-popover';
import { findChartCommentStateBuggyChartIdLookup } from '@/components/reports/logic/comments';
import { type ChartData, type ChartTitleConfig } from '@/lib/chart-title-utils';
import { cn } from '@/lib/utils';
import type { CommentStates } from '@/types/comments';
import type { FrozenChartConfig } from '@/types/reports';

interface ChartViewTitleRowProps {
  chartId: number;
  isFullscreen: boolean;
  titleChartData: ChartData | null | undefined;
  config: ChartTitleConfig;
  onView?: () => void;
  isPublicMode: boolean;
  frozenChartConfig?: FrozenChartConfig;
  snapshotId?: number;
  commentStates?: CommentStates;
  onCommentStateChange?: () => void;
  autoOpenCommentChartId?: string;
  canModerateComments: boolean;
}

/** The view widget's title row (hidden in fullscreen): title, report View button, chart comments. */
export function ChartViewTitleRow({
  chartId,
  isFullscreen,
  titleChartData,
  config,
  onView,
  isPublicMode,
  frozenChartConfig,
  snapshotId,
  commentStates,
  onCommentStateChange,
  autoOpenCommentChartId,
  canModerateComments,
}: ChartViewTitleRowProps) {
  return (
    <div className={cn('flex items-start gap-2 px-2 pt-2 flex-shrink-0', isFullscreen && 'hidden')}>
      <div className="flex-1 min-w-0">
        <ChartTitleEditor
          chartData={titleChartData}
          config={config}
          onTitleChange={() => {}} // Read-only in view mode
          isEditMode={false}
        />
      </div>
      {onView && !isPublicMode && frozenChartConfig && (
        <div className="flex-shrink-0 mt-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="View Chart"
            aria-label="View Chart"
            onClick={onView}
            data-testid={`dashboard-chart-view-btn-${chartId}`}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {frozenChartConfig && snapshotId && (
        <div className="flex-shrink-0 mt-0.5">
          <CommentPopover
            snapshotId={snapshotId}
            targetType="chart"
            chartId={chartId}
            state={findChartCommentStateBuggyChartIdLookup(commentStates, chartId)}
            triggerClassName="h-7 w-7 p-0"
            onStateChange={onCommentStateChange}
            autoOpen={autoOpenCommentChartId === String(chartId)}
            canModerate={canModerateComments}
          />
        </div>
      )}
    </div>
  );
}
