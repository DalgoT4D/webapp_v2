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
  const { data, error, mutate } = useSWR<ReportSnapshot[]>(
    `/api/reports/${query ? `?${query}` : ''}`,
    apiGet,
    { revalidateOnFocus: true }
  );
  return { snapshots: data || [], isLoading: !error && !data, isError: error, mutate };
}

export function useSnapshotView(snapshotId: number | null) {
  const { data, error, mutate } = useSWR<SnapshotViewData>(
    snapshotId ? `/api/reports/${snapshotId}/view/` : null,
    apiGet
  );
  return { viewData: data, isLoading: !error && !data, isError: error, mutate };
}

// Mutations

export async function createSnapshot(data: CreateSnapshotPayload) {
  return apiPost('/api/reports/', data);
}

export async function updateSnapshot(snapshotId: number, data: { summary?: string }) {
  return apiPut(`/api/reports/${snapshotId}/`, data);
}

export async function deleteSnapshot(snapshotId: number) {
  return apiDelete(`/api/reports/${snapshotId}/`);
}

// Datetime column discovery for create-snapshot dialog

export function useDashboardDatetimeColumns(dashboardId: number | null) {
  const { data, error, isLoading } = useSWR<DiscoveredDatetimeColumn[]>(
    dashboardId ? `/api/reports/dashboards/${dashboardId}/datetime-columns/` : null,
    apiGet,
    { revalidateOnFocus: false }
  );
  return { columns: data || [], isLoading, error };
}

// Sharing mutations

export async function updateReportSharing(
  snapshotId: number,
  data: { is_public: boolean }
): Promise<ShareStatus> {
  return apiPut(`/api/reports/${snapshotId}/share/`, data);
}

export async function getReportSharingStatus(snapshotId: number): Promise<ShareStatus> {
  return apiGet(`/api/reports/${snapshotId}/share/`);
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
