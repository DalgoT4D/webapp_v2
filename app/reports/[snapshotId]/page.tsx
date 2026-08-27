'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Calendar,
  Download,
  LayoutGrid,
  Loader2,
  Mail,
  Pencil,
  Share2,
  User,
} from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { useSnapshotView, updateSnapshot } from '@/hooks/api/useReports';
import { useCommentStates } from '@/hooks/api/useComments';
import { usePdfDownload } from '@/hooks/usePdfDownload';
import { DashboardNativeView } from '@/components/dashboard/dashboard-native-view';
import { ShareModal } from '@/components/ui/share-modal';
import { ShareViaEmailDialog } from '@/components/reports/share-via-email-dialog';
import { RequestEditPill } from '@/components/access/request-edit-pill';
import { CommentPopover } from '@/components/reports/comment-popover';
import { formatDateShort } from '@/components/reports/utils';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

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
  // Effective Edit on the report itself. Backend returns 'edit' for admin/super-admin
  // (auto), owner, direct/group Edit grants, and Internal-mode edit-defaults.
  // Every role in the seed today has can_edit_dashboards, so effective Edit is the
  // sole gate — same rule the dashboard/chart/KPI detail pages use.
  const hasEffectiveEdit = viewData?.access_level === 'edit';
  const canEdit = hasEffectiveEdit;
  // Share/email-PDF gate: mirrors the list view + every other resource — the
  // per-resource `access_level === 'edit'` is the source of truth. The RBAC
  // slug is deliberately NOT ANDed in, so a Member granted Edit on this
  // report still sees the buttons (their role lacks can_share_dashboards).
  const canShare = hasEffectiveEdit;
  // Moderator delete on other users' comments mirrors backend comment_service:
  // author OR get_user_access(...) == EDIT.
  const canModerateComments = hasEffectiveEdit;

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  // Fire REPORT_VIEWED once per mount when the report has successfully loaded
  const reportViewedTracked = useRef(false);
  useEffect(() => {
    if (viewData && !reportViewedTracked.current) {
      trackEvent(ANALYTICS_EVENTS.REPORT_VIEWED, { report_id: parsedId });
      reportViewedTracked.current = true;
    }
  }, [viewData]);

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

  // Sync summary draft when viewData loads or revalidates (only if user isn't editing)
  useEffect(() => {
    if (!summaryTouched) {
      setSummaryDraft(viewData?.report_metadata.summary ?? '');
    }
  }, [viewData?.report_metadata.summary, summaryTouched]);

  const handleSave = useCallback(async () => {
    const currentSummary = (viewData?.report_metadata.summary ?? '').trim();
    if (summaryDraft.trim() === currentSummary) {
      setSummaryTouched(false);
      setIsEditingSummary(false);
      return;
    }
    setIsSaving(true);
    try {
      await updateSnapshot(parsedId, { summary: summaryDraft });
      // The summary is the only mutable part of a frozen snapshot. The no-op early return
      // above means this fires on a real text change, not on opening and closing the editor.
      trackEvent(ANALYTICS_EVENTS.REPORT_SUMMARY_UPDATED, { report_id: parsedId });
      await mutate();
      setSummaryTouched(false);
      setIsEditingSummary(false);
      toastSuccess.saved('Report');
    } catch (error) {
      toastError.save(error, 'report');
    } finally {
      setIsSaving(false);
    }
  }, [parsedId, summaryDraft, mutate, viewData?.report_metadata.summary]);

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
            <RequestEditPill
              rtype="report"
              resourceId={parsedId}
              resourceAccessLevel={viewData.access_level}
            />
            <Button
              data-testid="report-download-btn"
              variant="outline"
              size="sm"
              aria-label="Download report as PDF"
              onClick={async () => {
                // Gated on the result: usePdfDownload catches its own errors and resolves
                // either way, so an ungated call counted failed exports as exports.
                const exported = await handleDownload();
                if (exported) {
                  trackEvent(ANALYTICS_EVENTS.REPORT_EXPORTED, {
                    report_id: parsedId,
                    format: 'pdf',
                  });
                }
              }}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </Button>
            {canShare && (
              <>
                <Button
                  data-testid="report-share-btn"
                  variant="outline"
                  size="sm"
                  aria-label="Share report"
                  onClick={() => setShareModalOpen(true)}
                >
                  <Share2 className="w-4 h-4" />
                </Button>
                <Button
                  data-testid="report-email-pdf-btn"
                  variant="outline"
                  size="sm"
                  aria-label="Email PDF"
                  onClick={() => setEmailDialogOpen(true)}
                >
                  <Mail className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Dashboard canvas — filter sidebar spans full height alongside summary + tabs + charts */}
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
          canModerateComments={canModerateComments}
          topRightContent={
            <div className="flex-shrink-0 px-6 pt-4 pb-2">
              <div className="border rounded-lg p-5 bg-background relative">
                {canEdit && (
                  <div className="absolute top-3 right-3 flex items-center gap-1">
                    <CommentPopover
                      snapshotId={parsedId}
                      targetType="summary"
                      state={
                        commentStates?.find((s) => s.target_type === 'summary')?.state ?? 'none'
                      }
                      triggerClassName="h-8 w-8"
                      onStateChange={handleCommentStateChange}
                      autoOpen={commentTarget === 'summary'}
                      canModerate={canModerateComments}
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
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Last updated by: {report_metadata.last_modified_by}
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
                      variant="destructive"
                      size="sm"
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
                      variant="primary"
                      size="sm"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          }
        />
      </div>

      {shareModalOpen && (
        <ShareModal
          rtype="report"
          entityId={parsedId}
          entityLabel={viewData?.report_metadata?.title ?? 'Report'}
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
        />
      )}

      <ShareViaEmailDialog
        snapshotId={parsedId}
        reportTitle={viewData?.report_metadata?.title}
        isOpen={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
      />
    </div>
  );
}
