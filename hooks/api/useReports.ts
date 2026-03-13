import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type {
  ReportSnapshot,
  SnapshotViewData,
  DiscoveredDatetimeColumn,
  CreateSnapshotPayload,
  ShareStatus,
} from '@/types/reports';

// Re-export types for consumers
export type {
  DateColumn,
  ReportSnapshot,
  SnapshotViewData,
  FrozenChartConfig,
} from '@/types/reports';

// API Response wrapper type (matches backend ApiResponse)
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

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

// Sharing mutations

export async function updateReportSharing(
  snapshotId: number,
  data: { is_public: boolean }
): Promise<ShareStatus> {
  const response: ApiResponse<ShareStatus> = await apiPut(
    `/api/reports/${snapshotId}/share/`,
    data
  );
  return response.data;
}

export async function getReportSharingStatus(snapshotId: number): Promise<ShareStatus> {
  const response: ApiResponse<ShareStatus> = await apiGet(`/api/reports/${snapshotId}/share/`);
  return response.data;
}

// Public report hook (no auth, direct fetch — same pattern as usePublicDashboard)

export function usePublicReport(token: string) {
  const { data, error, mutate } = useSWR(
    token ? `/api/v1/public/reports/${token}/view/` : null,
    async (url: string) => {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002';
      const response = await fetch(`${backendUrl}${url}`);
      if (!response.ok) throw new Error('Report not found');
      return response.json();
    }
  );
  return {
    viewData: data as (SnapshotViewData & { org_name: string; is_valid: boolean }) | undefined,
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}
