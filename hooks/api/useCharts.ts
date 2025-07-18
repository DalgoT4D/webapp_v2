import useSWR from 'swr';
import { apiGet, apiPost } from '@/lib/api';

interface ChartDataPayload {
  chart_type: string;
  computation_type: string;
  schema_name: string;
  table_name: string;
  xaxis?: string;
  yaxis?: string;
  aggregate_col?: string;
  aggregate_func?: string;
  aggregate_col_alias?: string;
  dimension_col?: string;
  limit?: number;
}

export function useChartData(payload: ChartDataPayload | null) {
  return useSWR(
    payload ? ['/api/charts/generate', payload] : null,
    ([url, data]) => apiPost(url, data),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );
}

export function useCharts() {
  return useSWR('/api/charts/', apiGet);
}

export function useChart(id: number | string) {
  return useSWR(id ? `/api/charts/${id}` : null, apiGet);
}
