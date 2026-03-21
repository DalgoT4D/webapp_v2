'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Download,
  LayoutGrid,
  Loader2,
  Pencil,
  Share2,
  User,
} from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { useSnapshotView, updateSnapshot } from '@/hooks/api/useReports';
import { useCommentStates } from '@/hooks/api/useComments';
import { usePdfDownload } from '@/hooks/usePdfDownload';
import { DashboardNativeView } from '@/components/dashboard/dashboard-native-view';
import { ReportShareModal } from '@/components/reports/ReportShareModal';
import { CommentPopover } from '@/components/reports/comment-popover';
import { formatDateShort } from '@/components/reports/utils';

export default function SnapshotViewerPage() {
  const params = useParams();
  const router = useRouter();
  const snapshotId = Number(params.snapshotId);

  const { viewData, isLoading, isError, mutate } = useSnapshotView(snapshotId);

  const [summaryDraft, setSummaryDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [summaryTouched, setSummaryTouched] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const { states: commentStates, mutate: mutateCommentStates } = useCommentStates(snapshotId);
  const handleCommentStateChange = useCallback(() => {
    mutateCommentStates();
  }, [mutateCommentStates]);

  const { isExporting, download: handleDownload } = usePdfDownload({
    endpoint: `/api/reports/${snapshotId}/export/pdf/`,
    title: viewData?.report_metadata.title || 'report',
  });

  // Initialize summary draft when viewData loads (replaces state-during-render pattern)
  useEffect(() => {
    if (!summaryTouched && viewData?.report_metadata.summary) {
      setSummaryDraft(viewData.report_metadata.summary);
    }
  }, [viewData?.report_metadata.summary, summaryTouched]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSnapshot(snapshotId, { summary: summaryDraft });
      mutate();
      toastSuccess.saved('Report');
    } catch (error) {
      toastError.save(error, 'report');
    } finally {
      setIsSaving(false);
    }
  }, [snapshotId, summaryDraft, mutate]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-5 w-96" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (isError || !viewData) {
    return (
      <div className="p-6">
        <p className="text-red-500">Failed to load report.</p>
        <Button data-testid="report-go-back-btn" variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  const { dashboard_data, report_metadata, frozen_chart_configs } = viewData;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background px-6 pt-4 pb-3">
        {/* Top row: Back + Title + Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid="report-back-btn"
              onClick={() => router.push('/reports')}
              className="flex items-center gap-1 text-sm text-foreground hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="flex items-center gap-1">
              <h1 className="text-2xl font-bold">{report_metadata.title}</h1>
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              data-testid="report-download-btn"
              variant="ghost"
              size="icon"
              aria-label="Download report as PDF"
              onClick={handleDownload}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
            <Button
              data-testid="report-share-btn"
              variant="ghost"
              size="icon"
              aria-label="Share report"
              onClick={() => setShareModalOpen(true)}
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <Button data-testid="report-save-btn" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {report_metadata.period_start
              ? formatDateShort(report_metadata.period_start)
              : 'All'} - {formatDateShort(report_metadata.period_end)}
          </span>
          {report_metadata.created_by && (
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Created by: {report_metadata.created_by}
            </span>
          )}
          {report_metadata.dashboard_title && (
            <span className="flex items-center gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5" />
              {report_metadata.dashboard_title}
            </span>
          )}
        </div>
      </div>

      {/* Dashboard with executive summary inside the canvas */}
      <div className="flex-1 overflow-hidden min-h-0">
        <DashboardNativeView
          dashboardId={dashboard_data.id}
          dashboardData={dashboard_data}
          isReportMode={true}
          frozenChartConfigs={frozen_chart_configs}
          hideHeader={true}
          snapshotId={snapshotId}
          commentStates={commentStates}
          onCommentStateChange={handleCommentStateChange}
          beforeContent={
            <div className="border rounded-lg p-5 mb-2 bg-background relative">
              {/* Comment + Edit icons in top-right corner */}
              <div className="absolute top-3 right-3 flex items-center gap-1">
                <CommentPopover
                  snapshotId={snapshotId}
                  targetType="summary"
                  state={commentStates?.['summary']?.state ?? 'none'}
                  triggerClassName="h-8 w-8"
                  onStateChange={handleCommentStateChange}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  data-testid="summary-edit-btn"
                  aria-label="Edit summary"
                  onClick={() => {
                    const textarea = document.querySelector(
                      '[data-testid="report-summary-textarea"]'
                    ) as HTMLTextAreaElement;
                    textarea?.focus();
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>

              <h2 className="text-lg font-semibold mb-2">Executive Summary</h2>
              <Textarea
                data-testid="report-summary-textarea"
                value={summaryDraft}
                onChange={(e) => {
                  setSummaryDraft(e.target.value);
                  setSummaryTouched(true);
                }}
                placeholder="Add your notes here"
                rows={2}
                className="resize-y border-none shadow-none p-0 focus-visible:ring-0 text-sm text-muted-foreground placeholder:text-muted-foreground"
              />
            </div>
          }
        />
      </div>

      <ReportShareModal
        snapshotId={snapshotId}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
    </div>
  );
}
