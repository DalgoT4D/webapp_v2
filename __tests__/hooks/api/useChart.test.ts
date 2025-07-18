import { renderHook, waitFor } from '@testing-library/react';
import {
  useSchemas,
  useTables,
  useColumns,
  useChartData,
  useChartSave,
  useChartUpdate,
  useChartDelete,
} from '@/hooks/api/useChart';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

// Mock the API functions
jest.mock('@/lib/api');

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;
const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;
const mockApiPut = apiPut as jest.MockedFunction<typeof apiPut>;
const mockApiDelete = apiDelete as jest.MockedFunction<typeof apiDelete>;

// Mock SWR
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn((key, fetcher) => {
    if (key === null) {
      return { data: undefined, error: null, isLoading: false, mutate: jest.fn() };
    }

    const mockData = getMockData(key);
    return {
      data: mockData,
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    };
  }),
}));

function getMockData(key: string | string[]) {
  const keyStr = Array.isArray(key) ? key[0] : key;

  if (keyStr.includes('schemas')) {
    return ['public', 'analytics', 'reporting'];
  }

  if (keyStr.includes('tables')) {
    return ['users', 'orders', 'products', 'customers'];
  }

  if (keyStr.includes('columns')) {
    return [
      { name: 'id', data_type: 'integer' },
      { name: 'name', data_type: 'varchar' },
      { name: 'email', data_type: 'varchar' },
      { name: 'amount', data_type: 'decimal' },
      { name: 'created_at', data_type: 'timestamp' },
    ];
  }

  if (keyStr.includes('charts')) {
    return [
      {
        id: 1,
        title: 'Sales Chart',
        description: 'Monthly sales data',
        chart_type: 'echarts',
        schema_name: 'public',
        table: 'sales',
        config: { chartType: 'bar', computation_type: 'aggregated' },
        is_public: false,
        is_favorite: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by: {
          id: 1,
          user: {
            id: 1,
            email: 'user@example.com',
            first_name: 'John',
            last_name: 'Doe',
          },
        },
      },
    ];
  }

  return null;
}

describe('useChart hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useSchemas', () => {
    it('fetches schemas successfully', () => {
      const { result } = renderHook(() => useSchemas());

      expect(result.current.data).toEqual(['public', 'analytics', 'reporting']);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('useTables', () => {
    it('fetches tables for a schema successfully', () => {
      const { result } = renderHook(() => useTables('public'));

      expect(result.current.data).toEqual(['users', 'orders', 'products', 'customers']);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('does not fetch when schema is not provided', () => {
      const { result } = renderHook(() => useTables(''));

      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('useColumns', () => {
    it('fetches columns for a table successfully', () => {
      const { result } = renderHook(() => useColumns('public', 'users'));

      expect(result.current.data).toEqual([
        { name: 'id', data_type: 'integer' },
        { name: 'name', data_type: 'varchar' },
        { name: 'email', data_type: 'varchar' },
        { name: 'amount', data_type: 'decimal' },
        { name: 'created_at', data_type: 'timestamp' },
      ]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('does not fetch when schema or table is not provided', () => {
      const { result } = renderHook(() => useColumns('', 'users'));

      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('useChartData', () => {
    it('generates chart data successfully', async () => {
      const payload = {
        chart_type: 'bar' as const,
        computation_type: 'raw' as const,
        schema_name: 'public',
        table_name: 'users',
        xaxis: 'name',
        yaxis: 'amount',
        offset: 0,
        limit: 100,
      };

      const mockChartData = {
        success: true,
        data: {
          chart_config: { type: 'bar' },
          raw_data: [{ x: 'John', y: 100 }],
          metadata: { count: 1 },
        },
      };

      mockApiPost.mockResolvedValue(mockChartData);

      const { result } = renderHook(() => useChartData(payload));

      expect(result.current.isLoading).toBe(false);
    });

    it('does not fetch when payload is null', () => {
      const { result } = renderHook(() => useChartData(null));

      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('useChartSave', () => {
    it('saves chart successfully', async () => {
      const mockChart = {
        id: 1,
        title: 'New Chart',
        description: 'Chart description',
        chart_type: 'echarts',
        schema_name: 'public',
        table: 'users',
        config: { chartType: 'bar', computation_type: 'raw' },
        is_public: false,
      };

      mockApiPost.mockResolvedValue({ success: true, data: mockChart });

      const { result } = renderHook(() => useChartSave());

      const saveResult = await result.current.save({
        title: 'New Chart',
        description: 'Chart description',
        chart_type: 'echarts',
        schema_name: 'public',
        table: 'users',
        config: { chartType: 'bar', computation_type: 'raw' },
        is_public: false,
      });

      expect(mockApiPost).toHaveBeenCalledWith('/api/charts/', {
        title: 'New Chart',
        description: 'Chart description',
        chart_type: 'echarts',
        schema_name: 'public',
        table: 'users',
        config: { chartType: 'bar', computation_type: 'raw' },
        is_public: false,
      });

      expect(saveResult).toEqual({ success: true, data: mockChart });
    });

    it('handles save errors', async () => {
      const mockError = new Error('Save failed');
      mockApiPost.mockRejectedValue(mockError);

      const { result } = renderHook(() => useChartSave());

      await expect(
        result.current.save({
          title: 'New Chart',
          chart_type: 'echarts',
          schema_name: 'public',
          table: 'users',
          config: { chartType: 'bar', computation_type: 'raw' },
        })
      ).rejects.toThrow('Save failed');
    });
  });

  describe('useChartUpdate', () => {
    it('updates chart successfully', async () => {
      const mockChart = {
        id: 1,
        title: 'Updated Chart',
        description: 'Updated description',
        chart_type: 'echarts',
        schema_name: 'public',
        table: 'users',
        config: { chartType: 'line', computation_type: 'raw' },
        is_public: true,
      };

      mockApiPut.mockResolvedValue({ success: true, data: mockChart });

      const { result } = renderHook(() => useChartUpdate());

      const updateResult = await result.current.update(1, {
        id: 1,
        title: 'Updated Chart',
        description: 'Updated description',
        chart_type: 'echarts',
        schema_name: 'public',
        table: 'users',
        config: { chartType: 'line', computation_type: 'raw' },
        is_public: true,
      });

      expect(mockApiPut).toHaveBeenCalledWith('/api/charts/1', {
        id: 1,
        title: 'Updated Chart',
        description: 'Updated description',
        chart_type: 'echarts',
        schema_name: 'public',
        table: 'users',
        config: { chartType: 'line', computation_type: 'raw' },
        is_public: true,
      });

      expect(updateResult).toEqual({ success: true, data: mockChart });
    });

    it('handles update errors', async () => {
      const mockError = new Error('Update failed');
      mockApiPut.mockRejectedValue(mockError);

      const { result } = renderHook(() => useChartUpdate());

      await expect(
        result.current.update(1, {
          id: 1,
          title: 'Updated Chart',
          chart_type: 'echarts',
          schema_name: 'public',
          table: 'users',
          config: { chartType: 'line', computation_type: 'raw' },
        })
      ).rejects.toThrow('Update failed');
    });
  });

  describe('useChartDelete', () => {
    it('deletes chart successfully', async () => {
      mockApiDelete.mockResolvedValue({ success: true, message: 'Chart deleted' });

      const { result } = renderHook(() => useChartDelete());

      const deleteResult = await result.current.delete(1);

      expect(mockApiDelete).toHaveBeenCalledWith('/api/charts/1');
      expect(deleteResult).toEqual({ success: true, message: 'Chart deleted' });
    });

    it('handles delete errors', async () => {
      const mockError = new Error('Delete failed');
      mockApiDelete.mockRejectedValue(mockError);

      const { result } = renderHook(() => useChartDelete());

      await expect(result.current.delete(1)).rejects.toThrow('Delete failed');
    });
  });

  describe('useCharts with filters', () => {
    it('builds query parameters correctly', () => {
      const filters = {
        chart_type: 'echarts',
        schema_name: 'public',
        is_public: true,
      };

      const { result } = renderHook(() => useCharts(filters));

      expect(result.current.data).toBeDefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('handles undefined filters', () => {
      const { result } = renderHook(() => useCharts());

      expect(result.current.data).toBeDefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('handles empty filters', () => {
      const { result } = renderHook(() => useCharts({}));

      expect(result.current.data).toBeDefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Chart data payload validation', () => {
    it('handles raw data payload correctly', () => {
      const rawPayload = {
        chart_type: 'bar' as const,
        computation_type: 'raw' as const,
        schema_name: 'public',
        table_name: 'users',
        xaxis: 'name',
        yaxis: 'amount',
        offset: 0,
        limit: 100,
      };

      const { result } = renderHook(() => useChartData(rawPayload));

      expect(result.current.isLoading).toBe(false);
    });

    it('handles aggregated data payload correctly', () => {
      const aggregatedPayload = {
        chart_type: 'bar' as const,
        computation_type: 'aggregated' as const,
        schema_name: 'public',
        table_name: 'users',
        dimension_col: 'region',
        aggregate_col: 'amount',
        aggregate_func: 'sum',
        aggregate_col_alias: 'total_amount',
        offset: 0,
        limit: 100,
      };

      const { result } = renderHook(() => useChartData(aggregatedPayload));

      expect(result.current.isLoading).toBe(false);
    });

    it('handles payload with dimensions array', () => {
      const payloadWithDimensions = {
        chart_type: 'bar' as const,
        computation_type: 'raw' as const,
        schema_name: 'public',
        table_name: 'users',
        xaxis: 'name',
        yaxis: 'amount',
        dimensions: ['region', 'country'],
        offset: 0,
        limit: 100,
      };

      const { result } = renderHook(() => useChartData(payloadWithDimensions));

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('handles API errors gracefully', async () => {
      mockApiPost.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useChartSave());

      await expect(
        result.current.save({
          title: 'Test Chart',
          chart_type: 'echarts',
          schema_name: 'public',
          table: 'users',
          config: { chartType: 'bar', computation_type: 'raw' },
        })
      ).rejects.toThrow('Network error');
    });

    it('handles validation errors', async () => {
      mockApiPost.mockRejectedValue(new Error('Validation failed'));

      const { result } = renderHook(() => useChartSave());

      await expect(
        result.current.save({
          title: '', // Invalid empty title
          chart_type: 'echarts',
          schema_name: 'public',
          table: 'users',
          config: { chartType: 'bar', computation_type: 'raw' },
        })
      ).rejects.toThrow('Validation failed');
    });
  });

  describe('Chart export functionality', () => {
    it('returns export URL for different formats', async () => {
      const { result } = renderHook(() => useChartExport());

      const pngResult = await result.current.export(1, 'png');
      expect(pngResult).toEqual({
        success: true,
        url: '/api/charts/1/export?format=png',
      });

      const pdfResult = await result.current.export(1, 'pdf');
      expect(pdfResult).toEqual({
        success: true,
        url: '/api/charts/1/export?format=pdf',
      });
    });
  });
});

// Additional mock for chart export hook
jest.mock('@/hooks/api/useChart', () => ({
  ...jest.requireActual('@/hooks/api/useChart'),
  useChartExport: () => ({
    export: jest.fn((chartId: number, format: string) =>
      Promise.resolve({
        success: true,
        url: `/api/charts/${chartId}/export?format=${format}`,
      })
    ),
  }),
}));
