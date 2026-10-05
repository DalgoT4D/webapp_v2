'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ShareModal } from '@/components/share/ShareModal';
import { ShareViaEmailDialog } from '@/components/reports/share-via-email-dialog';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { DocsLink } from '@/components/ui/docs-link';
import { FileText, Plus } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { useSnapshots, deleteSnapshot } from '@/hooks/api/useReports';
import type { ReportSnapshot } from '@/types/reports';
import { CreateSnapshotDialog } from '@/components/reports/create-snapshot-dialog';
import { useResourcePermissions } from '@/components/access/hooks/useResourcePermissions';
import { DEFAULT_LIST_PAGE_SIZE, paginateRows, sortRows } from '@/components/list-page/list-logic';
import { useListSort } from '@/components/list-page/useListSort';
import { ListPagination } from '@/components/list-page/ListPagination';
import { ActiveFiltersSummary } from '@/components/list-page/ActiveFiltersSummary';
import {
  getReportSortValue,
  getReportTotalPages,
  type ReportSortColumn,
} from '@/components/reports/logic/report-list';
import { useReportListFilters } from '@/components/reports/list/useReportListFilters';
import { ReportListTable } from '@/components/reports/list/ReportListTable';
import { ReportListSkeleton } from '@/components/reports/list/ReportListSkeleton';

export default function ReportsPage() {
  const router = useRouter();
  const { confirm, DialogComponent: DeleteDialog } = useConfirmationDialog();
  // Reports reuse the dashboard create/delete slugs.
  const { canCreate, canDelete } = useResourcePermissions('report');

  const [shareSnapshot, setShareSnapshot] = useState<ReportSnapshot | null>(null);
  const [emailSnapshot, setEmailSnapshot] = useState<ReportSnapshot | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE);

  // PINNED-BUGS: "Reports list: the 400 ms filter debounce also fires on mount and resets to page 1" — useReportListFilters calls this on mount.
  const resetToFirstPage = useCallback(() => setCurrentPage(1), []);
  const filters = useReportListFilters(resetToFirstPage);

  // PINNED-BUGS: "Failed report list load looks like "No reports yet" (`isError` never read)"
  const { snapshots, isLoading, mutate } = useSnapshots(filters.filterParams);

  const { sortBy, sortOrder, handleSort } = useListSort<ReportSortColumn>('created_at');

  // Sort and paginate snapshots client-side
  const sortedSnapshots = useMemo(
    () => sortRows(snapshots, (snapshot) => getReportSortValue(snapshot, sortBy), sortOrder),
    [snapshots, sortBy, sortOrder]
  );
  const total = sortedSnapshots.length;
  const totalPages = getReportTotalPages(total, pageSize);
  const paginatedSnapshots = paginateRows(sortedSnapshots, currentPage, pageSize);

  const handleOpenReport = useCallback(
    (snapshotId: number) => router.push(`/reports/${snapshotId}`),
    [router]
  );

  const handleDelete = useCallback(
    async (snapshot: ReportSnapshot) => {
      const confirmed = await confirm({
        title: 'Delete report?',
        description: `This will permanently delete "${snapshot.title}". This action cannot be undone.`,
        confirmText: 'Delete',
        type: 'warning',
        testIdPrefix: 'report-delete-confirm',
      });
      if (!confirmed) return;
      try {
        await deleteSnapshot(snapshot.id);
        // Id read from the row we were handed — mutate() below drops it from local state.
        trackEvent(ANALYTICS_EVENTS.REPORT_DELETED, { report_id: snapshot.id });
        mutate();
        toastSuccess.deleted('Report');
      } catch (error) {
        toastError.delete(error, 'report');
      }
    },
    [mutate, confirm]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 border-b bg-background">
        {/* Title Section */}
        <div className="flex items-center justify-between mb-6 p-6 pb-0">
          <div>
            <DocsLink path="/reports">
              <h1 className="text-3xl font-bold">Reports</h1>
            </DocsLink>
            <p className="text-muted-foreground mt-1">Create and manage your reports</p>
          </div>
          {canCreate && (
            <CreateSnapshotDialog
              onCreated={() => mutate()}
              trigger={
                <Button data-testid="create-report-btn" variant="primary">
                  <Plus className="h-4 w-4 mr-2" /> CREATE REPORT
                </Button>
              }
            />
          )}
        </div>

        {/* Filter Summary */}
        <ActiveFiltersSummary
          count={filters.activeFilterCount}
          onClearAll={filters.clearAllFilters}
          countTestId="report-list-active-filter-count"
          clearTestId="report-list-clear-all-filters"
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-hidden px-6">
        <div className="h-full overflow-y-auto">
          {isLoading && !filters.hasAnyFilter ? (
            <ReportListSkeleton />
          ) : snapshots.length === 0 && !filters.hasAnyFilter ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground" data-testid="report-list-empty">
                No reports yet
              </p>
              {canCreate && (
                <CreateSnapshotDialog
                  onCreated={() => mutate()}
                  trigger={
                    <Button data-testid="create-first-report-btn" variant="primary">
                      <Plus className="h-4 w-4 mr-2" /> CREATE YOUR FIRST REPORT
                    </Button>
                  }
                />
              )}
            </div>
          ) : (
            <ReportListTable
              snapshots={paginatedSnapshots}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              filters={filters}
              canDelete={canDelete}
              onOpenReport={handleOpenReport}
              onShare={setShareSnapshot}
              onEmail={setEmailSnapshot}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      <ListPagination
        currentPage={currentPage}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        testIds={{
          pageSizeTrigger: 'report-list-page-size',
          pageSizeOptionPrefix: 'report-list-page-size-option',
          prev: 'report-list-page-prev',
          next: 'report-list-page-next',
          itemCount: 'report-list-item-count',
          pageCounter: 'report-list-page-counter',
        }}
      />

      <DeleteDialog />

      {shareSnapshot && (
        <ShareModal
          rtype="report"
          entityId={shareSnapshot.id}
          entityLabel={shareSnapshot.title}
          isOpen={true}
          onClose={() => setShareSnapshot(null)}
        />
      )}

      {emailSnapshot && (
        <ShareViaEmailDialog
          snapshotId={emailSnapshot.id}
          reportTitle={emailSnapshot.title}
          isOpen={true}
          onClose={() => setEmailSnapshot(null)}
        />
      )}
    </div>
  );
}
