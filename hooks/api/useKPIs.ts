import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type {
  KPI,
  KPICreate,
  KPIUpdate,
  KPIListResponse,
  AnnotationEntry,
  AnnotationEntryCreate,
  AnnotationEntryUpdate,
} from '@/types/kpis';
import type { ChartDataResponse } from '@/types/charts';

interface UseKPIsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  programTag?: string;
  metricType?: string;
}

export function useKPIs(params?: UseKPIsParams) {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.pageSize) queryParams.append('page_size', params.pageSize.toString());
  if (params?.search) queryParams.append('search', params.search);
  if (params?.programTag) queryParams.append('program_tag', params.programTag);
  if (params?.metricType) queryParams.append('metric_type', params.metricType);

  const queryString = queryParams.toString();
  const url = queryString ? `/api/kpis/?${queryString}` : '/api/kpis/';

  const { data, error, mutate } = useSWR<KPIListResponse>(url, apiGet);

  return {
    data: data?.data || [],
    total: data?.total || 0,
    page: data?.page || 1,
    pageSize: data?.page_size || 10,
    totalPages: data?.total_pages || 1,
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}

export function useKPI(id: number | null) {
  const { data, error, mutate } = useSWR<KPI>(id ? `/api/kpis/${id}/` : null, apiGet);

  return {
    kpi: data,
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}

export function useKPIData(
  id: number | null,
  snapshotId?: number,
  options?: {
    timeGrain?: string;
    dateFrom?: string;
    dateTo?: string;
    dashboardFilters?: Record<string, any>;
  }
) {
  let url: string | null = null;
  if (id) {
    if (snapshotId) {
      const params = new URLSearchParams();
      if (options?.dashboardFilters && Object.keys(options.dashboardFilters).length > 0) {
        params.append('dashboard_filters', JSON.stringify(options.dashboardFilters));
      }
      const qs = params.toString();
      url = `/api/reports/${snapshotId}/kpis/${id}/data/${qs ? `?${qs}` : ''}`;
    } else {
      const params = new URLSearchParams();
      if (options?.timeGrain) params.append('time_grain', options.timeGrain);
      if (options?.dateFrom) params.append('date_from', options.dateFrom);
      if (options?.dateTo) params.append('date_to', options.dateTo);
      if (options?.dashboardFilters && Object.keys(options.dashboardFilters).length > 0) {
        params.append('dashboard_filters', JSON.stringify(options.dashboardFilters));
      }
      const qs = params.toString();
      url = `/api/kpis/${id}/data/${qs ? `?${qs}` : ''}`;
    }
  }

  const { data, error } = useSWR<ChartDataResponse>(url, apiGet);

  return {
    chartData: data?.data,
    echartsConfig: data?.echarts_config,
    isLoading: !error && !data,
    isError: error,
  };
}

export async function createKPI(data: KPICreate): Promise<KPI> {
  return apiPost('/api/kpis/', data);
}

export async function updateKPI(id: number, data: KPIUpdate): Promise<KPI> {
  return apiPut(`/api/kpis/${id}/`, data);
}

export async function deleteKPI(id: number): Promise<void> {
  return apiDelete(`/api/kpis/${id}/`);
}

interface KPIDashboard {
  id: number;
  title: string;
  dashboard_type: string;
}

export function useKPIDashboards(kpiId: number | null) {
  const { data, error } = useSWR<KPIDashboard[]>(
    kpiId ? `/api/kpis/${kpiId}/dashboards/` : null,
    apiGet,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );
  return {
    data: data || [],
    isLoading: !error && !data && !!kpiId,
    isError: error,
  };
}

// ── Annotations ───────────────────────────────────────────────────────

export function useAnnotations(kpiId: number | null) {
  const { data, error, mutate } = useSWR<AnnotationEntry[]>(
    kpiId ? `/api/kpis/${kpiId}/notes/` : null,
    apiGet
  );

  return {
    annotations: data || [],
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}

export async function createAnnotation(
  kpiId: number,
  data: AnnotationEntryCreate
): Promise<AnnotationEntry> {
  return apiPost(`/api/kpis/${kpiId}/notes/`, data);
}

export async function updateAnnotation(
  kpiId: number,
  entryId: number,
  data: AnnotationEntryUpdate
): Promise<AnnotationEntry> {
  return apiPut(`/api/kpis/${kpiId}/notes/${entryId}/`, data);
}

export async function deleteAnnotation(kpiId: number, entryId: number): Promise<void> {
  return apiDelete(`/api/kpis/${kpiId}/notes/${entryId}/`);
}
