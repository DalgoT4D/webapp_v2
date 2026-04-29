'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Calendar, Download, LayoutGrid, Loader2, Pencil, User } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { useSnapshotView, updateSnapshot } from '@/hooks/api/useReports';
import { useCommentStates } from '@/hooks/api/useComments';
import { usePdfDownload } from '@/hooks/usePdfDownload';
import { DashboardNativeView } from '@/components/dashboard/dashboard-native-view';
import { ReportShareMenu } from '@/components/reports/report-share-menu';
import { CommentPopover } from '@/components/reports/comment-popover';
import { formatDateShort } from '@/components/reports/utils';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { useAuthStore } from '@/stores/authStore';

export default function SnapshotViewerPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsedId = Number(params.snapshotId);
  const isValidId = !isNaN(parsedId) && parsedId > 0;

  // Read comment deep-link params from email notifications
  const commentTarget = searchParams.get('commentTarget');
  const commentChartId = searchParams.get('chartId');

  const { viewData, isLoading, isError, mutate } = useSnapshotView(isValidId ? parsedId : null);

  const [summaryDraft, setSummaryDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [summaryTouched, setSummaryTouched] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const { hasPermission } = useUserPermissions();
  const canEdit = hasPermission('can_edit_dashboards');
  const canShare = hasPermission('can_share_dashboards');
  const currentUserEmail = useAuthStore((s) => s.getCurrentOrgUser())?.email;

  const { states: commentStates, mutate: mutateCommentStates } = useCommentStates(
    isValidId ? parsedId : null
  );
  const handleCommentStateChange = useCallback(() => {
    mutateCommentStates();
  }, [mutateCommentStates]);

  const { isExporting, download: handleDownload } = usePdfDownload({
    endpoint: `/api/reports/${parsedId}/export/pdf/`,
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
      await updateSnapshot(parsedId, { summary: summaryDraft });
      mutate();
      setSummaryTouched(false);
      setIsEditingSummary(false);
      toastSuccess.saved('Report');
    } catch (error) {
      toastError.save(error, 'report');
    } finally {
      setIsSaving(false);
    }
  }, [parsedId, summaryDraft, mutate]);

  if (!isValidId) {
    return (
      <div className="p-6">
        <p className="text-red-500">Invalid report ID.</p>
        <Button data-testid="report-go-back-btn" variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

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
      <div className="flex-shrink-0 border-b bg-background shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="sm"
              data-testid="report-back-btn"
              onClick={() => router.push('/reports')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-foreground">{report_metadata.title}</h1>
              {/* Metadata below title */}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {report_metadata.period_start
                    ? formatDateShort(report_metadata.period_start)
                    : 'All'}{' '}
                  - {formatDateShort(report_metadata.period_end)}
                </span>
                {report_metadata.created_by && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Created by: {report_metadata.created_by}
                  </span>
                )}
                {report_metadata.dashboard_title &&
                  (report_metadata.dashboard_id ? (
                    <Link
                      href={`/dashboards/${report_metadata.dashboard_id}`}
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                      data-testid="report-dashboard-link"
                    >
                      <LayoutGrid className="w-3 h-3" />
                      {report_metadata.dashboard_title}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-1">
                      <LayoutGrid className="w-3 h-3" />
                      {report_metadata.dashboard_title}
                    </span>
                  ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              data-testid="report-download-btn"
              variant="outline"
              size="sm"
              aria-label="Download report as PDF"
              onClick={handleDownload}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </Button>
            {canShare && currentUserEmail === report_metadata.created_by && (
              <ReportShareMenu snapshotId={parsedId} reportTitle={report_metadata.title} />
            )}
          </div>
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
          snapshotId={parsedId}
          commentStates={commentStates}
          onCommentStateChange={handleCommentStateChange}
          autoOpenCommentChartId={
            commentTarget === 'chart' && commentChartId ? commentChartId : undefined
          }
          beforeContent={
            <div className="border rounded-lg p-5 mb-2 bg-background relative">
              {/* Comment + Edit icons in top-right corner (edit permission required) */}
              {canEdit && (
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  <CommentPopover
                    snapshotId={parsedId}
                    targetType="summary"
                    state={commentStates?.find((s) => s.target_type === 'summary')?.state ?? 'none'}
                    triggerClassName="h-8 w-8"
                    onStateChange={handleCommentStateChange}
                    autoOpen={commentTarget === 'summary'}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    data-testid="summary-edit-btn"
                    aria-label="Edit summary"
                    onClick={() => {
                      setIsEditingSummary(true);
                      requestAnimationFrame(() => {
                        const textarea = document.querySelector(
                          '[data-testid="report-summary-textarea"]'
                        ) as HTMLTextAreaElement;
                        textarea?.focus();
                      });
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="flex items-baseline gap-2 mb-2">
                <h2 className="text-lg font-semibold">Executive Summary</h2>
                {report_metadata.last_modified_by && (
                  <span className="text-sm text-muted-foreground">
                    Last updated by {report_metadata.last_modified_by}
                  </span>
                )}
              </div>
              <Textarea
                data-testid="report-summary-textarea"
                value={summaryDraft}
                onChange={(e) => {
                  setSummaryDraft(e.target.value);
                  setSummaryTouched(true);
                }}
                readOnly={!isEditingSummary}
                placeholder="Add your notes here"
                rows={2}
                className={`resize-y border-none shadow-none p-0 focus-visible:ring-0 text-sm text-muted-foreground placeholder:text-muted-foreground ${!isEditingSummary ? 'cursor-default' : ''}`}
              />
              {canEdit && isEditingSummary && (
                <div className="flex justify-end gap-2 mt-2">
                  <Button
                    data-testid="report-cancel-edit-btn"
                    variant="ghost"
                    size="sm"
                    className="text-white hover:text-white hover:opacity-90 shadow-xs"
                    style={{ backgroundColor: 'var(--destructive)' }}
                    onClick={() => {
                      setSummaryDraft(viewData?.report_metadata.summary || '');
                      setSummaryTouched(false);
                      setIsEditingSummary(false);
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    data-testid="report-save-btn"
                    variant="ghost"
                    size="sm"
                    className="text-white hover:text-white hover:opacity-90 shadow-xs"
                    style={{ backgroundColor: 'var(--primary)' }}
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
}
