'use client';

import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ReportSnapshot } from '@/types/reports';
import { SortableColumnHeader } from '@/components/list-page/SortableColumnHeader';
import { ColumnFilterPopover } from '@/components/list-page/ColumnFilterPopover';
import type { SortOrder } from '@/components/list-page/list-logic';
import type { ReportSortColumn } from '@/components/reports/logic/report-list';
import type { ReportListFilters } from './useReportListFilters';
import { ReportListRow } from './ReportListRow';

/** Columns in the table (for the no-match row's colSpan). */
const REPORT_TABLE_COLUMN_COUNT = 5;

interface ReportListTableProps {
  /** The current page's rows. */
  snapshots: ReportSnapshot[];
  sortBy: ReportSortColumn;
  sortOrder: SortOrder;
  onSort: (column: ReportSortColumn) => void;
  filters: ReportListFilters;
  canDelete: boolean;
  onOpenReport: (snapshotId: number) => void;
  onShare: (snapshot: ReportSnapshot) => void;
  onEmail: (snapshot: ReportSnapshot) => void;
  onDelete: (snapshot: ReportSnapshot) => void;
}

/** The reports table: sortable/filterable header, rows, or "No reports match the current filters". */
export function ReportListTable({
  snapshots,
  sortBy,
  sortOrder,
  onSort,
  filters,
  canDelete,
  onOpenReport,
  onShare,
  onEmail,
  onDelete,
}: ReportListTableProps) {
  const sort = { sortBy, sortOrder, onSort };
  return (
    <div className="py-6">
      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              {/* Title column with sort + filter */}
              <TableHead className="w-[25%]">
                <div className="flex items-center gap-2">
                  <SortableColumnHeader
                    {...sort}
                    label="Title"
                    column="title"
                    testId="report-list-sort-title"
                    isLeftAligned
                  />
                  <ColumnFilterPopover
                    isOpen={filters.openFilters.title}
                    onOpenChange={(open) => filters.setFilterOpen('title', open)}
                    isActive={filters.activeFilters.title}
                    triggerTestId="report-filter-title-trigger"
                    title="Filter by Title"
                    onClear={() => filters.setTitleFilter('')}
                    clearTestId="report-filter-title-clear"
                    contentClassName="w-72"
                  >
                    <Input
                      data-testid="report-filter-title"
                      placeholder="Search report titles..."
                      value={filters.titleFilter}
                      onChange={(e) => filters.setTitleFilter(e.target.value)}
                      className="h-8"
                    />
                  </ColumnFilterPopover>
                </div>
              </TableHead>

              {/* Dashboard Used column with sort + filter */}
              <TableHead className="w-[30%]">
                <div className="flex items-center gap-2">
                  <SortableColumnHeader
                    {...sort}
                    label="Dashboard Used"
                    column="dashboard_title"
                    testId="report-list-sort-dashboard"
                    isLeftAligned
                  />
                  <ColumnFilterPopover
                    isOpen={filters.openFilters.dashboard}
                    onOpenChange={(open) => filters.setFilterOpen('dashboard', open)}
                    isActive={filters.activeFilters.dashboard}
                    triggerTestId="report-filter-dashboard-trigger"
                    title="Filter by Dashboard"
                    onClear={() => filters.setDashboardFilter('')}
                    clearTestId="report-filter-dashboard-clear"
                    contentClassName="w-72"
                  >
                    <Input
                      data-testid="report-filter-dashboard"
                      placeholder="Search dashboard names..."
                      value={filters.dashboardFilter}
                      onChange={(e) => filters.setDashboardFilter(e.target.value)}
                      className="h-8"
                    />
                  </ColumnFilterPopover>
                </div>
              </TableHead>

              {/* Created by column with sort + filter */}
              <TableHead className="w-[20%]">
                <div className="flex items-center gap-2">
                  <SortableColumnHeader
                    {...sort}
                    label="Created by"
                    column="created_by"
                    testId="report-list-sort-created-by"
                    isLeftAligned
                  />
                  <ColumnFilterPopover
                    isOpen={filters.openFilters.createdBy}
                    onOpenChange={(open) => filters.setFilterOpen('createdBy', open)}
                    isActive={filters.activeFilters.createdBy}
                    triggerTestId="report-filter-creator-trigger"
                    title="Filter by Creator"
                    onClear={() => filters.setCreatedByFilter('')}
                    clearTestId="report-filter-creator-clear"
                    contentClassName="w-72"
                  >
                    <Input
                      data-testid="report-filter-creator"
                      placeholder="Search by email..."
                      value={filters.createdByFilter}
                      onChange={(e) => filters.setCreatedByFilter(e.target.value)}
                      className="h-8"
                    />
                  </ColumnFilterPopover>
                </div>
              </TableHead>

              {/* Created on column with sort (LIST-DRIFT: no wrapper div, no filter, no justify-start) */}
              <TableHead className="w-[15%]">
                <SortableColumnHeader
                  {...sort}
                  label="Created on"
                  column="created_at"
                  testId="report-list-sort-created-on"
                />
              </TableHead>

              <TableHead className="w-[10%] font-medium text-base">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snapshots.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={REPORT_TABLE_COLUMN_COUNT}
                  className="px-6 py-8 text-center text-sm text-muted-foreground"
                  data-testid="report-list-no-match"
                >
                  No reports match the current filters
                </TableCell>
              </TableRow>
            ) : (
              snapshots.map((snapshot) => (
                <ReportListRow
                  key={snapshot.id}
                  snapshot={snapshot}
                  canDelete={canDelete}
                  onOpenReport={onOpenReport}
                  onShare={onShare}
                  onEmail={onEmail}
                  onDelete={onDelete}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
