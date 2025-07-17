import useSWR from 'swr';
import { useMemo } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

// Types
export interface Column {
  name: string;
  data_type: string;
}

export interface Chart {
  id: number;
  title: string;
  description?: string;
  chart_type: string;
  schema_name: string;
  table: string;
  config: any;
  is_public: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  created_by: {
    id: number;
    user: {
      id: number;
      email: string;
      first_name: string;
      last_name: string;
    };
  };
}

export interface ChartCreatePayload {
  title: string;
  description?: string;
  chart_type: string;
  schema_name: string;
  table: string;
  config: any;
  is_public?: boolean;
}

export interface ChartUpdatePayload extends ChartCreatePayload {
  id: number;
}

export interface ChartDataPayload {
  chart_type: string;
  computation_type: 'raw' | 'aggregated';
  schema_name: string;
  table_name: string;
  xaxis?: string;
  yaxis?: string;
  dimensions?: string[];
  aggregate_col?: string;
  aggregate_func?: string;
  aggregate_col_alias?: string;
  dimension_col?: string;
  offset?: number;
  limit?: number;
}

export interface ChartDataResponse {
  success: boolean;
  data: any;
  message: string;
}

// Fetcher functions
const chartFetcher = (url: string) => apiGet(url);

// Schema hooks
export function useSchemas() {
  return useSWR('/api/warehouse/schemas/', chartFetcher);
}

// Table hooks
export function useTables(schemaName: string) {
  return useSWR(schemaName ? `/api/warehouse/tables/?schema=${schemaName}` : null, chartFetcher);
}

// Column hooks
export function useColumns(schemaName: string, tableName: string) {
  return useSWR(
    schemaName && tableName
      ? `/api/warehouse/columns/?schema=${schemaName}&table=${tableName}`
      : null,
    chartFetcher
  );
}

// Chart CRUD hooks
export function useCharts(filters?: {
  chart_type?: string;
  schema_name?: string;
  table_name?: string;
  created_by?: number;
  is_public?: boolean;
}) {
  const queryParams = useMemo(() => {
    if (!filters) return '';
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value));
      }
    });
    return params.toString() ? `?${params.toString()}` : '';
  }, [filters]);

  return useSWR(`/api/charts/${queryParams}`, chartFetcher);
}

export function useChart(chartId: number) {
  return useSWR(chartId ? `/api/charts/${chartId}` : null, chartFetcher);
}

// Chart data generation
export function useChartData(payload: ChartDataPayload | null) {
  const { data, error, isLoading, mutate } = useSWR(
    payload ? ['/api/charts/generate', payload] : null,
    async ([url, payload]) => {
      const response = await apiPost(url, payload);
      return response;
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
}

// Chart data by ID
export function useChartDataById(chartId: number) {
  return useSWR(chartId ? `/api/charts/${chartId}/data` : null, chartFetcher);
}

// Chart actions (mutations)
export function useChartSave() {
  return {
    save: async (payload: ChartCreatePayload) => {
      return apiPost('/api/charts/', payload);
    },
  };
}

export function useChartUpdate() {
  return {
    update: async (chartId: number, payload: ChartUpdatePayload) => {
      return apiPut(`/api/charts/${chartId}`, payload);
    },
  };
}

export function useChartDelete() {
  return {
    delete: async (chartId: number) => {
      return apiDelete(`/api/charts/${chartId}`);
    },
  };
}

// Chart favorite toggle
export function useChartFavorite() {
  return {
    toggleFavorite: async (chartId: number) => {
      return apiPost(`/api/charts/${chartId}/favorite`, {});
    },
  };
}

// Chart export
export function useChartExport() {
  return {
    export: async (chartId: number, format: 'png' | 'jpeg' | 'svg' | 'pdf') => {
      // This would typically call an export endpoint
      // For now, return a placeholder
      return { success: true, url: `/api/charts/${chartId}/export?format=${format}` };
    },
  };
}

// Chart templates (if implemented)
export function useChartTemplates() {
  return useSWR('/api/charts/templates/', chartFetcher);
}

// Chart suggestions (if implemented)
export function useChartSuggestions(schemaName: string, tableName: string) {
  return useSWR(
    schemaName && tableName
      ? `/api/charts/suggestions/?schema=${schemaName}&table=${tableName}`
      : null,
    chartFetcher
  );
}

// Cache management
export function useCacheStats() {
  return useSWR('/api/charts/cache-stats', chartFetcher);
}

export function useCacheCleanup() {
  return {
    cleanup: async () => {
      return apiPost('/api/charts/cleanup-cache', {});
    },
  };
}
