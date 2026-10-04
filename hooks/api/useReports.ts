import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete, apiPublicGet } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS, REPORT_SHARE_SOURCES } from '@/constants/analytics';
import type {
  ReportSnapshot,
  SnapshotViewData,
  DiscoveredDatetimeColumn,
  CreateSnapshotPayload,
} from '@/types/reports';
import type { ApiResponse } from '@/types/api';

// Re-export types for consumers
export type {
  DateColumn,
  ReportSnapshot,
  SnapshotViewData,
  FrozenChartConfig,
} from '@/types/reports';

// Hooks

interface SnapshotFilters {
  search?: string;
  dashboard_title?: string;
  created_by?: string;
}

export function useSnapshots(filters?: SnapshotFilters) {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.dashboard_title) params.set('dashboard_title', filters.dashboard_title);
  if (filters?.created_by) params.set('created_by', filters.created_by);
  const query = params.toString();
  const { data, error, mutate } = useSWR<ApiResponse<ReportSnapshot[]>>(
    `/api/reports/${query ? `?${query}` : ''}`,
    apiGet,
    { revalidateOnFocus: true }
  );
  return { snapshots: data?.data || [], isLoading: !error && !data, isError: error, mutate };
}

export function useSnapshotView(snapshotId: number | null) {
  const { data, error, mutate } = useSWR<ApiResponse<SnapshotViewData>>(
    snapshotId ? `/api/reports/${snapshotId}/view/` : null,
    apiGet
  );
  return { viewData: data?.data, isLoading: !error && !data, isError: error, mutate };
}

// Mutations

// REPORT_CREATED is tracked by the caller (create-snapshot-dialog's GENERATE REPORT
// handler), not here — it needs the returned report_id, and the dialog is the only path in.
export async function createSnapshot(data: CreateSnapshotPayload): Promise<ReportSnapshot> {
  const response: ApiResponse<ReportSnapshot> = await apiPost('/api/reports/', data);
  return response.data;
}

export async function updateSnapshot(
  snapshotId: number,
  data: { summary?: string }
): Promise<{ summary?: string }> {
  const response: ApiResponse<{ summary?: string }> = await apiPut(
    `/api/reports/${snapshotId}/`,
    data
  );
  return response.data;
}

export async function deleteSnapshot(snapshotId: number): Promise<void> {
  await apiDelete(`/api/reports/${snapshotId}/`);
}

// Datetime column discovery for create-snapshot dialog

export function useDashboardDatetimeColumns(dashboardId: number | null) {
  const { data, error, isLoading } = useSWR<ApiResponse<DiscoveredDatetimeColumn[]>>(
    dashboardId ? `/api/reports/dashboards/${dashboardId}/datetime-columns/` : null,
    apiGet,
    { revalidateOnFocus: false }
  );
  return { columns: data?.data || [], isLoading, error };
}

// Share via email

export async function shareReportViaEmail(
  snapshotId: number,
  data: { recipient_emails: string[]; subject?: string; message?: string }
): Promise<{ recipients_count: number; message: string }> {
  const response: ApiResponse<{ recipients_count: number; message: string }> = await apiPost(
    `/api/reports/${snapshotId}/share/email/`,
    data
  );
  // recipients_count only — recipient email addresses are PII and must never be sent.
  trackEvent(ANALYTICS_EVENTS.REPORT_SHARED, {
    report_id: snapshotId,
    source: REPORT_SHARE_SOURCES.EMAIL,
    recipients_count: data.recipient_emails.length,
  });
  return response.data;
}

// Public report hook (no auth, direct fetch — same pattern as usePublicDashboard)

export function usePublicReport(token: string) {
  const { data, error, mutate } = useSWR<
    SnapshotViewData & {
      org_name: string;
      /** Stable org key for anonymous view analytics — see PublicReportView. */
      org_slug: string;
      org_logo_url?: string;
      is_valid: boolean;
    }
  >(token ? `/api/v1/public/reports/${token}/view/` : null, apiPublicGet);
  return {
    viewData: data,
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}
