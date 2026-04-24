import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type {
  Metric,
  MetricCreate,
  MetricUpdate,
  MetricListResponse,
  MetricConsumersResponse,
} from '@/types/metrics';

interface UseMetricsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  schemaName?: string;
  tableName?: string;
}

export function useMetrics(params?: UseMetricsParams) {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.pageSize) queryParams.append('page_size', params.pageSize.toString());
  if (params?.search) queryParams.append('search', params.search);
  if (params?.schemaName) queryParams.append('schema_name', params.schemaName);
  if (params?.tableName) queryParams.append('table_name', params.tableName);

  const queryString = queryParams.toString();
  const url = queryString ? `/api/metrics/?${queryString}` : '/api/metrics/';

  const { data, error, mutate } = useSWR<MetricListResponse>(url, apiGet);

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

export function useMetric(id: number | null) {
  const { data, error, mutate } = useSWR<Metric>(id ? `/api/metrics/${id}/` : null, apiGet);

  return {
    metric: data,
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}

export async function createMetric(data: MetricCreate): Promise<Metric> {
  return apiPost('/api/metrics/', data);
}

export async function updateMetric(id: number, data: MetricUpdate): Promise<Metric> {
  return apiPut(`/api/metrics/${id}/`, data);
}

export async function deleteMetric(id: number): Promise<void> {
  return apiDelete(`/api/metrics/${id}/`);
}

export async function getMetricConsumers(id: number): Promise<MetricConsumersResponse> {
  return apiGet(`/api/metrics/${id}/consumers/`);
}
