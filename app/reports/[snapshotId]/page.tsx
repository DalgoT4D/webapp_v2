'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSnapshotView } from '@/hooks/api/useReports';
import { useCommentStates } from '@/hooks/api/useComments';
import { usePdfDownload } from '@/hooks/usePdfDownload';
import { DashboardNativeView } from '@/components/dashboard/dashboard-native-view';
import type { AppliedFilters } from '@/types/dashboard-filters';
import { ShareModal } from '@/components/share/ShareModal';
import { ShareViaEmailDialog } from '@/components/reports/share-via-email-dialog';
import { findSummaryCommentState } from '@/components/reports/logic/comments';
import { parseCommentDeepLink } from '@/components/reports/logic/comment-deep-link';
import { ReportViewerHeader } from '@/components/reports/viewer/ReportViewerHeader';
import { SummaryEditor } from '@/components/reports/viewer/SummaryEditor';
import { useSummaryEditor } from '@/components/reports/viewer/useSummaryEditor';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { useResourcePermissions } from '@/components/access/hooks/useResourcePermissions';

export default function SnapshotViewerPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsedId = Number(params.snapshotId);
  const isValidId = !isNaN(parsedId) && parsedId > 0;

  // Read comment deep-link params from email notifications
  const commentDeepLink = parseCommentDeepLink(searchParams);

  const { viewData, isLoading, isError, mutate } = useSnapshotView(isValidId ? parsedId : null);

  // Mirrors DashboardNativeView's live filter state, so the export button
  // can send whatever the viewer currently has applied rather than defaults.
  const [currentFilters, setCurrentFilters] = useState<AppliedFilters>({});
  // Effective Edit on the report itself. Backend returns 'edit' for admin/super-admin
  // (auto), owner, direct/group Edit grants, and Internal-mode edit-defaults.
  // Every role in the seed today has can_edit_dashboards, so effective Edit is the
  // sole gate — same rule the dashboard/chart/KPI detail pages use.
  const { hasEditAccess: hasEffectiveEdit } = useResourcePermissions(
    'report',
    viewData?.access_level
  );
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

  const summaryEditor = useSummaryEditor({
    parsedId,
    savedSummary: viewData?.report_metadata.summary,
    mutate,
  });

  if (!isValidId) {
    return (
      <div className="p-6">
        <p className="text-red-500" data-testid="report-invalid-id">
          Invalid report ID.
        </p>
        <Button data-testid="report-go-back-btn" variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4" data-testid="report-view-skeleton">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-5 w-96" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (isError || !viewData) {
    return (
      <div className="p-6">
        <p className="text-red-500" data-testid="report-load-error">
          Failed to load report.
        </p>
        <Button data-testid="report-go-back-btn" variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  const { dashboard_data, report_metadata, frozen_chart_configs } = viewData;

  const handleDownloadClick = async () => {
    // Gated on the result: usePdfDownload catches its own errors and resolves
    // either way, so an ungated call counted failed exports as exports.
    const exported = await handleDownload({ dashboard_filters: currentFilters });
    if (exported) {
      trackEvent(ANALYTICS_EVENTS.REPORT_EXPORTED, {
        report_id: parsedId,
        format: 'pdf',
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ReportViewerHeader
        reportId={parsedId}
        reportMetadata={report_metadata}
        accessLevel={viewData.access_level}
        canShare={canShare}
        isExporting={isExporting}
        onBack={() => router.push('/reports')}
        onDownload={handleDownloadClick}
        onShare={() => setShareModalOpen(true)}
        onEmail={() => setEmailDialogOpen(true)}
      />

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
          onFiltersChange={setCurrentFilters}
          autoOpenCommentChartId={commentDeepLink.autoOpenChartId}
          canModerateComments={canModerateComments}
          topRightContent={
            <SummaryEditor
              reportId={parsedId}
              canEdit={canEdit}
              commentState={findSummaryCommentState(commentStates)}
              onCommentStateChange={handleCommentStateChange}
              autoOpenComments={commentDeepLink.autoOpenSummary}
              canModerateComments={canModerateComments}
              lastModifiedBy={report_metadata.last_modified_by}
              editor={summaryEditor}
            />
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
