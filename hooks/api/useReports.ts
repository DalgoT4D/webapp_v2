import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

export interface DateColumn {
  schema_name: string;
  table_name: string;
  column_name: string;
}

export interface ReportSnapshot {
  id: number;
  title: string;
  dashboard_title?: string;
  date_column?: DateColumn;
  period_start?: string; // Optional (no lower bound)
  period_end: string;
  status: 'generated' | 'viewed' | 'archived';
  summary?: string;
  created_by?: string;
  created_at: string;
}

export interface FrozenChartConfig {
  id: number;
  title: string;
  description?: string;
  chart_type: string;
  schema_name: string;
  table_name: string;
  extra_config: Record<string, any>;
}

export interface SnapshotViewData {
  dashboard_data: any;
  report_metadata: {
    snapshot_id: number;
    title: string;
    date_column?: DateColumn;
    period_start?: string;
    period_end: string;
    summary?: string;
    status: string;
    created_at: string;
    created_by?: string;
    dashboard_title: string;
  };
  frozen_chart_configs: Record<string, FrozenChartConfig>;
}

// Hooks

export function useSnapshots(search?: string) {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  const { data, error, mutate } = useSWR<ReportSnapshot[]>(`/api/reports/${params}`, apiGet, {
    revalidateOnFocus: true,
  });
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

export async function createSnapshot(data: {
  title: string;
  dashboard_id: number;
  date_column: DateColumn;
  period_start?: string | null; // Optional (no lower bound)
  period_end: string;
}) {
  return apiPost('/api/reports/', data);
}

export async function updateSnapshot(snapshotId: number, data: { summary?: string }) {
  return apiPut(`/api/reports/${snapshotId}/`, data);
}

export async function deleteSnapshot(snapshotId: number) {
  return apiDelete(`/api/reports/${snapshotId}/`);
}
