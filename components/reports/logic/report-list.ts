import type { ReportSnapshot } from '@/types/reports';
import type { SortValue } from '@/components/list-page/list-logic';

/** Rules of the /reports list: the server filters, the page sorts and paginates. */

export type ReportSortColumn = 'title' | 'dashboard_title' | 'created_by' | 'created_at';

/** What the user typed in the three column filters. */
export interface ReportFilterInputs {
  title: string;
  dashboard: string;
  createdBy: string;
}

/** Query params of GET /api/reports/ (see useSnapshots). */
export interface SnapshotFilterParams {
  search?: string;
  dashboard_title?: string;
  created_by?: string;
}

/** Debounce delay in ms before sending filter to API */
export const REPORT_FILTER_DEBOUNCE_MS = 400;

/** Only include non-empty values; no filter at all → undefined. */
export function buildSnapshotFilterParams({
  title,
  dashboard,
  createdBy,
}: ReportFilterInputs): SnapshotFilterParams | undefined {
  return title || dashboard || createdBy
    ? {
        search: title || undefined,
        dashboard_title: dashboard || undefined,
        created_by: createdBy || undefined,
      }
    : undefined;
}

export function getReportSortValue(snapshot: ReportSnapshot, column: ReportSortColumn): SortValue {
  switch (column) {
    case 'title':
      return (snapshot.title || '').toLowerCase();
    case 'dashboard_title':
      return (snapshot.dashboard_title || '').toLowerCase();
    case 'created_at':
      return new Date(snapshot.created_at || 0).getTime();
    case 'created_by':
      return (snapshot.created_by || '').toLowerCase();
  }
}

/**
 * Always at least 1. The current page is never clamped to it —
 * PINNED-BUGS: "Deleting only row on last page → "2 of 1", "11–10 of 10", no-match row".
 */
export function getReportTotalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
