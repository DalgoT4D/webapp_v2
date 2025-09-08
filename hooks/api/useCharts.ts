import useSWR from 'swr';
import { apiGet } from '@/lib/api';

export interface Chart {
  id: number;
  title: string;
  description?: string;
  chart_type: string;
  computation_type: string;
  schema_name: string;
  table_name: string;
  extra_config: any;
  render_config?: any;
  created_at: string;
  updated_at: string;
}

export interface ChartListResponse {
  data: Chart[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface UseChartsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  chartType?: string;
}

export function useCharts(params?: UseChartsParams) {
  // Build query parameters
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.pageSize) queryParams.append('page_size', params.pageSize.toString());
  if (params?.search) queryParams.append('search', params.search);
  if (params?.chartType && params.chartType !== 'all')
    queryParams.append('chart_type', params.chartType);

  const queryString = queryParams.toString();
  const url = queryString ? `/api/charts/?${queryString}` : '/api/charts/';

  const { data, error, mutate } = useSWR<ChartListResponse>(url, async (url: string) => {
    try {
      const response = await apiGet(url);
      return response;
    } catch (err) {
      console.error('Error fetching charts:', err);
      throw err;
    }
  });

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

export function useChart(id: number) {
  const { data, error, mutate } = useSWR<Chart>(id ? `/api/charts/${id}/` : null, apiGet, {
    // Don't retry on 404 errors
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      // Never retry on 404
      if (error?.message?.includes('404') || error?.message?.includes('not found')) {
        return;
      }
      // Only retry up to 3 times for other errors
      if (retryCount >= 3) return;

      // Retry after 1 second
      setTimeout(() => revalidate({ retryCount }), 1000);
    },
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  return {
    data: data,
    isLoading: !error && !data,
    isError: error,
    error: error,
    mutate,
  };
}

export function useChartData(id: number) {
  const { data, error, mutate } = useSWR(id ? `/api/charts/${id}/data/` : null, async (url) => {
    try {
      return await apiGet(url);
    } catch (err: any) {
      // If data endpoint doesn't exist, return null instead of throwing
      console.warn(`Chart data endpoint failed for chart ${id}:`, err.message);
      return null;
    }
  });

  return {
    data: data,
    isLoading: !error && !data && id !== null,
    isError: error,
    mutate,
  };
}

export interface ChartDashboard {
  id: number;
  title: string;
  dashboard_type: string;
}

export function useChartDashboards(chartId: number) {
  const { data, error, mutate } = useSWR<ChartDashboard[]>(
    chartId ? `/api/charts/${chartId}/dashboards/` : null,
    apiGet,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    data: data || [],
    isLoading: !error && !data && !!chartId,
    isError: error,
    mutate,
  };
}
