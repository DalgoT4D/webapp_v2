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

interface UseChartsParams {
  search?: string;
}

export function useCharts(params?: UseChartsParams) {
  const { data, error, mutate } = useSWR<Chart[]>('/api/charts/', async (url: string) => {
    try {
      const response = await apiGet(url);
      return response;
    } catch (err) {
      console.error('Error fetching charts:', err);
      throw err;
    }
  });

  // Filter charts based on search
  const filteredCharts =
    data && params?.search
      ? data.filter(
          (chart) =>
            chart.title.toLowerCase().includes(params.search!.toLowerCase()) ||
            chart.chart_type.toLowerCase().includes(params.search!.toLowerCase()) ||
            chart.schema_name.toLowerCase().includes(params.search!.toLowerCase()) ||
            chart.table_name.toLowerCase().includes(params.search!.toLowerCase())
        )
      : data;

  return {
    data: filteredCharts,
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}

export function useChart(id: number) {
  const { data, error, mutate } = useSWR<Chart>(id ? `/api/charts/${id}/` : null, apiGet);

  return {
    data: data,
    isLoading: !error && !data,
    isError: error,
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
