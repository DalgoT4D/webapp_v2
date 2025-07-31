import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { api } from '@/lib/api';
import type {
  Chart,
  ChartCreate,
  ChartUpdate,
  ChartDataPayload,
  ChartDataResponse,
  DataPreviewResponse,
} from '@/types/charts';

// Fetchers
const chartsFetcher = (url: string) => api.get<Chart[]>(url);
const chartFetcher = (url: string) => api.get<Chart>(url);
const chartDataFetcher = ([url, data]: [string, ChartDataPayload]) =>
  api.post<ChartDataResponse>(url, data);
const dataPreviewFetcher = ([url, data]: [string, ChartDataPayload]) =>
  api.post<DataPreviewResponse>(url, data);

// Mutations
const createChart = (url: string, { arg }: { arg: ChartCreate }) => api.post<Chart>(url, arg);

const updateChart = (url: string, { arg }: { arg: { id: number; data: ChartUpdate } }) =>
  api.put<Chart>(`${url}${arg.id}/`, arg.data);

const deleteChart = (url: string, { arg }: { arg: number }) => api.delete(`${url}${arg}/`);

// Hooks
export function useCharts() {
  return useSWR('/api/charts/', chartsFetcher);
}

export function useChart(id: number | null) {
  return useSWR(id ? `/api/charts/${id}/` : null, chartFetcher);
}

export function useCreateChart() {
  return useSWRMutation('/api/charts/', createChart);
}

export function useUpdateChart() {
  return useSWRMutation('/api/charts/', updateChart);
}

export function useDeleteChart() {
  return useSWRMutation('/api/charts/', deleteChart);
}

export function useChartData(payload: ChartDataPayload | null) {
  return useSWR(payload ? ['/api/charts/chart-data/', payload] : null, chartDataFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 2000,
  });
}

export function useChartDataPreview(
  payload: ChartDataPayload | null,
  page: number = 1,
  pageSize: number = 50
) {
  const enrichedPayload = payload
    ? {
        ...payload,
        offset: (page - 1) * pageSize,
        limit: pageSize,
      }
    : null;

  return useSWR(
    enrichedPayload ? ['/api/charts/chart-data-preview/', enrichedPayload] : null,
    dataPreviewFetcher
  );
}

// Chart export hook
export function useChartExport() {
  return useSWRMutation(
    '/api/charts/export/',
    (url: string, { arg }: { arg: { chart_id: number; format: string } }) =>
      api.post(url, {
        ...arg,
        responseType: arg.format === 'png' ? 'blob' : 'json',
      })
  );
}

// Warehouse hooks for chart builder
export function useSchemas() {
  return useSWR<string[]>('/api/warehouse/schemas', api.get);
}

export function useTables(schema: string | null) {
  return useSWR<any[]>(schema ? `/api/warehouse/tables/${schema}` : null, api.get);
}

export function useColumns(schema: string | null, table: string | null) {
  return useSWR<any[]>(
    schema && table ? `/api/warehouse/table_columns/${schema}/${table}` : null,
    api.get
  );
}
