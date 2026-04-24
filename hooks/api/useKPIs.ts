import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type { KPI, KPICreate, KPIUpdate, KPIListResponse } from '@/types/kpis';
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

export function useKPIData(id: number | null, snapshotId?: number) {
  // In report mode, use the report endpoint (applies frozen filters)
  // In live mode, use the KPI endpoint directly
  const url = id
    ? snapshotId
      ? `/api/reports/${snapshotId}/kpis/${id}/data/`
      : `/api/kpis/${id}/data/`
    : null;

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
