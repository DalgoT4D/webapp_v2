import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
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
  table: string; // Changed from table_name
  config: {
    chartType: string;
    computation_type: 'raw' | 'aggregated';
    xAxis?: string; // Changed from xaxis
    yAxis?: string; // Changed from yaxis
    dimensions?: string[];
    aggregate_col?: string;
    aggregate_func?: string;
    aggregate_col_alias?: string;
    dimension_col?: string;
  };
  is_public?: boolean;
}

export interface ChartUpdatePayload extends ChartCreatePayload {
  id: number;
}

export interface ChartDataPayload {
  chart_type: string;
  computation_type: 'raw' | 'aggregated';
  schema_name: string;
  table: string; // Changed from table_name
  xAxis?: string; // Changed from xaxis
  yAxis?: string; // Changed from yaxis
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

export interface ChartSuggestion {
  chart_type: string;
  confidence: number;
  reasoning: string;
  suggested_config: {
    xAxis?: string;
    yAxis?: string;
    aggregate_func?: string;
    dimensions?: string[];
  };
}

export interface ChartTemplate {
  id: string;
  name: string;
  description: string;
  chart_type: string;
  category: string;
  preview_image?: string;
  config_template: {
    data_requirements: {
      dimensions: number;
      metrics: number;
    };
    default_config: Record<string, any>;
  };
}

// Fetcher functions
const chartFetcher = async (url: string) => {
  try {
    const response = await apiGet(url);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Schema hooks
export function useSchemas() {
  const { data, error, isLoading } = useSWR('/api/warehouse/schemas/', chartFetcher);

  return {
    data,
    error,
    isLoading,
  };
}

// Table hooks
export function useTables(schemaName: string) {
  const { data, error, isLoading } = useSWR(
    schemaName ? `/api/warehouse/tables/?schema=${schemaName}` : null,
    chartFetcher
  );

  return {
    data,
    error,
    isLoading,
  };
}

// Column hooks
export function useColumns(schemaName: string, tableName: string) {
  const { data, error, isLoading } = useSWR(
    schemaName && tableName
      ? `/api/warehouse/columns/?schema=${schemaName}&table=${tableName}`
      : null,
    chartFetcher
  );

  return {
    data,
    error,
    isLoading,
  };
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

  const { data, error, isLoading, mutate } = useSWR(`/api/charts/${queryParams}`, chartFetcher);

  return {
    data,
    error,
    isLoading,
    mutate,
  };
}

export function useChart(chartId: number) {
  const { data, error, isLoading } = useSWR(
    chartId ? `/api/charts/${chartId}` : null,
    chartFetcher
  );

  return {
    data,
    error,
    isLoading,
  };
}

// Chart data generation
export function useChartData(payload: ChartDataPayload | null) {
  const { data, error, isLoading, mutate } = useSWR(
    payload ? ['/api/charts/generate', payload] : null,
    async ([url, payload]) => {
      try {
        const response = await apiPost(url, payload);
        return response.data;
      } catch (error) {
        throw error;
      }
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
  const { data, error, isLoading } = useSWR(
    chartId ? `/api/charts/${chartId}/data` : null,
    chartFetcher
  );

  return {
    data,
    error,
    isLoading,
  };
}

// Chart actions (mutations)
export function useChartSave() {
  return {
    save: async (payload: ChartCreatePayload) => {
      try {
        return await apiPost('/api/charts/', payload);
      } catch (error) {
        throw error;
      }
    },
  };
}

export function useChartUpdate() {
  return {
    update: async (chartId: number, payload: ChartUpdatePayload) => {
      try {
        return await apiPut(`/api/charts/${chartId}`, payload);
      } catch (error) {
        throw error;
      }
    },
  };
}

export function useChartDelete() {
  return {
    delete: async (chartId: number) => {
      try {
        return await apiDelete(`/api/charts/${chartId}`);
      } catch (error) {
        throw error;
      }
    },
  };
}

// Chart favorite toggle
export function useChartFavorite() {
  return {
    toggleFavorite: async (chartId: number) => {
      try {
        return await apiPost(`/api/charts/${chartId}/favorite`, {});
      } catch (error) {
        throw error;
      }
    },
  };
}

// Chart export
export function useChartExport() {
  return useSWRMutation(
    '/api/charts/export',
    async (url: string, { arg }: { arg: { chart_id: number; format: string } }) => {
      const { chart_id, format } = arg;
      // For now, we'll use the chart data endpoint to get data
      // In a future update, we can implement server-side export
      const response = await apiGet(`/api/charts/${chart_id}/data`);

      // Client-side export - for now, just return the data
      // The ChartExport component will handle the actual export
      return { data: response };
    }
  );
}

// Chart templates (if implemented)
export function useChartTemplates() {
  const { data, error, isLoading } = useSWR('/api/charts/templates/', chartFetcher);

  return {
    data,
    error,
    isLoading,
  };
}

// Chart suggestions (if implemented)
export function useChartSuggestions() {
  return useSWRMutation(
    '/api/charts/suggestions/',
    async (url: string, { arg }: { arg: { schema_name: string; table_name: string } }) => {
      const { schema_name, table_name } = arg;
      return apiPost('/api/visualization/charts/suggest', { schema_name, table_name });
    }
  );
}

// Cache management
export function useCacheStats() {
  const { data, error, isLoading } = useSWR('/api/charts/cache-stats', chartFetcher);

  return {
    data,
    error,
    isLoading,
  };
}

export function useCacheCleanup() {
  return {
    cleanup: async () => {
      try {
        return await apiPost('/api/charts/cleanup-cache', {});
      } catch (error) {
        throw error;
      }
    },
  };
}
