import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { ReactNode } from 'react';
import {
  useSchemas,
  useTables,
  useColumns,
  useCharts,
  useChart,
  useChartSave,
  useChartUpdate,
  useChartDelete,
  useChartData,
  useChartDataById,
  useChartTemplates,
  useChartSuggestions,
  useChartExport,
} from '@/hooks/api/useChart';

// Mock the API functions
jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiPut: jest.fn(),
  apiDelete: jest.fn(),
}));

import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;
const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;
const mockApiPut = apiPut as jest.MockedFunction<typeof apiPut>;
const mockApiDelete = apiDelete as jest.MockedFunction<typeof apiDelete>;

// SWR wrapper for testing
const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => (
    <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>{children}</SWRConfig>
  );
};

describe('useChart hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useSchemas', () => {
    it('fetches schemas successfully', async () => {
      const mockSchemas = ['public', 'analytics', 'staging'];
      mockApiGet.mockResolvedValue(mockSchemas);

      const { result } = renderHook(() => useSchemas(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockSchemas);
        expect(result.current.error).toBeUndefined();
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockApiGet).toHaveBeenCalledWith('/api/warehouse/schemas');
    });

    it('handles schema fetch error', async () => {
      const mockError = new Error('Failed to fetch schemas');
      mockApiGet.mockRejectedValue(mockError);

      const { result } = renderHook(() => useSchemas(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
        expect(result.current.data).toBeUndefined();
      });
    });
  });

  describe('useTables', () => {
    it('fetches tables for a schema successfully', async () => {
      const mockTables = ['users', 'orders', 'products'];
      mockApiGet.mockResolvedValue(mockTables);

      const { result } = renderHook(() => useTables('public'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockTables);
        expect(result.current.error).toBeUndefined();
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockApiGet).toHaveBeenCalledWith('/api/warehouse/tables/public');
    });

    it('does not fetch when schema is null', () => {
      const { result } = renderHook(() => useTables(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeUndefined();
      expect(mockApiGet).not.toHaveBeenCalled();
    });

    it('handles table fetch error', async () => {
      const mockError = new Error('Failed to fetch tables');
      mockApiGet.mockRejectedValue(mockError);

      const { result } = renderHook(() => useTables('public'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
        expect(result.current.data).toBeUndefined();
      });
    });
  });

  describe('useColumns', () => {
    it('fetches columns for a table successfully', async () => {
      const mockColumns = [
        { name: 'id', data_type: 'integer' },
        { name: 'name', data_type: 'varchar' },
        { name: 'email', data_type: 'varchar' },
      ];
      mockApiGet.mockResolvedValue(mockColumns);

      const { result } = renderHook(() => useColumns('public', 'users'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockColumns);
        expect(result.current.error).toBeUndefined();
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockApiGet).toHaveBeenCalledWith('/api/warehouse/table_columns/public/users');
    });

    it('does not fetch when schema or table is null', () => {
      const { result: result1 } = renderHook(() => useColumns(null, 'users'), {
        wrapper: createWrapper(),
      });

      const { result: result2 } = renderHook(() => useColumns('public', null), {
        wrapper: createWrapper(),
      });

      expect(result1.current.data).toBeUndefined();
      expect(result2.current.data).toBeUndefined();
      expect(mockApiGet).not.toHaveBeenCalled();
    });

    it('handles column fetch error', async () => {
      const mockError = new Error('Failed to fetch columns');
      mockApiGet.mockRejectedValue(mockError);

      const { result } = renderHook(() => useColumns('public', 'users'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
        expect(result.current.data).toBeUndefined();
      });
    });
  });

  describe('useCharts', () => {
    it('fetches charts successfully', async () => {
      const mockCharts = [
        {
          id: 1,
          title: 'Sales Chart',
          chart_type: 'bar',
          schema_name: 'public',
          table: 'sales',
        },
        {
          id: 2,
          title: 'User Growth',
          chart_type: 'line',
          schema_name: 'analytics',
          table: 'user_metrics',
        },
      ];
      mockApiGet.mockResolvedValue(mockCharts);

      const { result } = renderHook(() => useCharts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockCharts);
        expect(result.current.error).toBeUndefined();
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockApiGet).toHaveBeenCalledWith('/api/visualization/charts');
    });

    it('handles charts fetch error', async () => {
      const mockError = new Error('Failed to fetch charts');
      mockApiGet.mockRejectedValue(mockError);

      const { result } = renderHook(() => useCharts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
        expect(result.current.data).toBeUndefined();
      });
    });
  });

  describe('useChart', () => {
    it('fetches a single chart successfully', async () => {
      const mockChart = {
        id: 1,
        title: 'Sales Chart',
        chart_type: 'bar',
        schema_name: 'public',
        table: 'sales',
      };
      mockApiGet.mockResolvedValue(mockChart);

      const { result } = renderHook(() => useChart(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockChart);
        expect(result.current.error).toBeUndefined();
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockApiGet).toHaveBeenCalledWith('/api/visualization/charts/1');
    });

    it('does not fetch when id is null', () => {
      const { result } = renderHook(() => useChart(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeUndefined();
      expect(mockApiGet).not.toHaveBeenCalled();
    });
  });

  describe('useChartSave', () => {
    it('saves a chart successfully', async () => {
      const mockResponse = { id: 1, success: true };
      mockApiPost.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChartSave(), {
        wrapper: createWrapper(),
      });

      const payload = {
        title: 'New Chart',
        description: 'A new chart',
        chart_type: 'echarts',
        schema_name: 'public',
        table: 'users',
        config: {
          chartType: 'bar',
          computation_type: 'raw' as const,
          xAxis: 'name',
          yAxis: 'count',
        },
      };

      await result.current.trigger(payload);

      expect(mockApiPost).toHaveBeenCalledWith('/api/visualization/charts', payload);
    });

    it('handles save error', async () => {
      const mockError = new Error('Failed to save chart');
      mockApiPost.mockRejectedValue(mockError);

      const { result } = renderHook(() => useChartSave(), {
        wrapper: createWrapper(),
      });

      const payload = {
        title: 'New Chart',
        description: 'A new chart',
        chart_type: 'echarts',
        schema_name: 'public',
        table: 'users',
        config: {
          chartType: 'bar',
          computation_type: 'raw' as const,
          xAxis: 'name',
          yAxis: 'count',
        },
      };

      await expect(result.current.trigger(payload)).rejects.toThrow('Failed to save chart');
    });
  });

  describe('useChartUpdate', () => {
    it('updates a chart successfully', async () => {
      const mockResponse = { id: 1, success: true };
      mockApiPut.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChartUpdate(), {
        wrapper: createWrapper(),
      });

      const payload = {
        id: 1,
        title: 'Updated Chart',
        description: 'An updated chart',
      };

      await result.current.trigger(payload);

      expect(mockApiPut).toHaveBeenCalledWith('/api/visualization/charts/1', {
        title: 'Updated Chart',
        description: 'An updated chart',
      });
    });

    it('handles update error', async () => {
      const mockError = new Error('Failed to update chart');
      mockApiPut.mockRejectedValue(mockError);

      const { result } = renderHook(() => useChartUpdate(), {
        wrapper: createWrapper(),
      });

      const payload = {
        id: 1,
        title: 'Updated Chart',
      };

      await expect(result.current.trigger(payload)).rejects.toThrow('Failed to update chart');
    });
  });

  describe('useChartDelete', () => {
    it('deletes a chart successfully', async () => {
      mockApiDelete.mockResolvedValue(undefined);

      const { result } = renderHook(() => useChartDelete(), {
        wrapper: createWrapper(),
      });

      const payload = { id: 1 };

      const response = await result.current.trigger(payload);

      expect(mockApiDelete).toHaveBeenCalledWith('/api/visualization/charts/1');
      expect(response).toEqual({ success: true });
    });

    it('handles delete error', async () => {
      const mockError = new Error('Failed to delete chart');
      mockApiDelete.mockRejectedValue(mockError);

      const { result } = renderHook(() => useChartDelete(), {
        wrapper: createWrapper(),
      });

      const payload = { id: 1 };

      await expect(result.current.trigger(payload)).rejects.toThrow('Failed to delete chart');
    });
  });

  describe('useChartData', () => {
    it('generates chart data successfully', async () => {
      const mockChartData = {
        success: true,
        data: {
          chart_config: {
            xAxis: { data: ['A', 'B', 'C'] },
            yAxis: { type: 'value' },
            series: [{ data: [1, 2, 3], type: 'bar' }],
          },
        },
        raw_data: {
          data: [
            { x: 'A', y: 1 },
            { x: 'B', y: 2 },
            { x: 'C', y: 3 },
          ],
        },
      };
      mockApiPost.mockResolvedValue(mockChartData);

      const payload = {
        chart_type: 'bar',
        computation_type: 'raw' as const,
        schema_name: 'public',
        table_name: 'users',
        xaxis: 'name',
        yaxis: 'count',
      };

      const { result } = renderHook(() => useChartData(payload), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual({
          chart_config: mockChartData.data.chart_config,
        });
        expect(result.current.error).toBeUndefined();
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockApiPost).toHaveBeenCalledWith('/api/visualization/charts/generate', payload);
    });

    it('does not fetch when payload is null', () => {
      const { result } = renderHook(() => useChartData(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeUndefined();
      expect(mockApiPost).not.toHaveBeenCalled();
    });

    it('does not fetch when enabled is false', () => {
      const payload = {
        chart_type: 'bar',
        computation_type: 'raw' as const,
        schema_name: 'public',
        table_name: 'users',
        xaxis: 'name',
        yaxis: 'count',
      };

      const { result } = renderHook(() => useChartData(payload, { enabled: false }), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeUndefined();
      expect(mockApiPost).not.toHaveBeenCalled();
    });

    it('handles chart data generation error', async () => {
      const mockError = new Error('Failed to generate chart data');
      mockApiPost.mockRejectedValue(mockError);

      const payload = {
        chart_type: 'bar',
        computation_type: 'raw' as const,
        schema_name: 'public',
        table_name: 'users',
        xaxis: 'name',
        yaxis: 'count',
      };

      const { result } = renderHook(() => useChartData(payload), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
        expect(result.current.data).toBeUndefined();
      });
    });

    it('handles missing chart_config in response', async () => {
      const mockResponse = {
        success: true,
        data: {
          // Missing chart_config
        },
        raw_data: { data: [] },
      };
      mockApiPost.mockResolvedValue(mockResponse);

      const payload = {
        chart_type: 'bar',
        computation_type: 'raw' as const,
        schema_name: 'public',
        table_name: 'users',
        xaxis: 'name',
        yaxis: 'count',
      };

      const { result } = renderHook(() => useChartData(payload), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
        expect(result.current.data).toBeUndefined();
      });
    });
  });

  describe('useChartDataById', () => {
    it('fetches chart data by ID successfully', async () => {
      const mockChartData = {
        success: true,
        data: {
          chart_config: {
            xAxis: { data: ['A', 'B', 'C'] },
            yAxis: { type: 'value' },
            series: [{ data: [1, 2, 3], type: 'bar' }],
          },
        },
      };
      mockApiPost.mockResolvedValue(mockChartData);

      const { result } = renderHook(() => useChartDataById(1, { filter: 'test' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual({
          chart_config: mockChartData.data.chart_config,
        });
        expect(result.current.error).toBeUndefined();
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockApiPost).toHaveBeenCalledWith('/api/visualization/charts/1/data', {
        filters: { filter: 'test' },
      });
    });

    it('does not fetch when chart ID is null', () => {
      const { result } = renderHook(() => useChartDataById(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.data).toBeUndefined();
      expect(mockApiPost).not.toHaveBeenCalled();
    });
  });

  describe('useChartTemplates', () => {
    it('fetches chart templates successfully', async () => {
      const mockTemplates = [
        {
          id: 'template1',
          name: 'Bar Chart Template',
          chart_type: 'bar',
          category: 'basic',
          description: 'Basic bar chart template',
          config_template: {
            data_requirements: { dimensions: 1, metrics: 1 },
            default_config: {},
          },
        },
      ];
      mockApiGet.mockResolvedValue(mockTemplates);

      const { result } = renderHook(() => useChartTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockTemplates);
        expect(result.current.error).toBeUndefined();
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockApiGet).toHaveBeenCalledWith('/api/visualization/charts/templates');
    });
  });

  describe('useChartSuggestions', () => {
    it('generates chart suggestions successfully', async () => {
      const mockSuggestions = [
        {
          chart_type: 'bar',
          confidence: 0.9,
          reasoning: 'Your data has categorical values',
          suggested_config: {
            xAxis: 'category',
            yAxis: 'value',
            aggregate_func: 'sum',
          },
        },
      ];
      mockApiPost.mockResolvedValue(mockSuggestions);

      const { result } = renderHook(() => useChartSuggestions(), {
        wrapper: createWrapper(),
      });

      const payload = {
        schema_name: 'public',
        table_name: 'users',
      };

      await result.current.trigger(payload);

      expect(mockApiPost).toHaveBeenCalledWith('/api/visualization/charts/suggest', payload);
    });
  });

  describe('useChartExport', () => {
    it('exports chart successfully', async () => {
      const mockExportData = new Blob(['chart data'], { type: 'image/png' });
      mockApiGet.mockResolvedValue(mockExportData);

      const { result } = renderHook(() => useChartExport(), {
        wrapper: createWrapper(),
      });

      const payload = {
        chart_id: 1,
        format: 'png' as const,
      };

      await result.current.trigger(payload);

      expect(mockApiGet).toHaveBeenCalledWith('/api/visualization/charts/export/1?format=png');
    });
  });
});
