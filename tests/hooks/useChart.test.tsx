import { renderHook, waitFor } from '@testing-library/react';
import {
  useSchemas,
  useChartData,
  useChartSave,
  ChartDataPayload,
  ChartCreatePayload,
} from '@/hooks/api/useChart';
import { apiGet, apiPost } from '@/lib/api';

// Mock API functions
jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}));

describe('useChart hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useSchemas', () => {
    it('fetches schemas successfully', async () => {
      const mockSchemas = ['public', 'analytics'];
      (apiGet as jest.Mock).mockResolvedValue({ data: mockSchemas });

      const { result } = renderHook(() => useSchemas());

      await waitFor(() => {
        expect(result.current.data).toEqual(mockSchemas);
        expect(result.current.error).toBeNull();
      });
    });

    it('handles schema fetch error', async () => {
      const mockError = new Error('Failed to fetch schemas');
      (apiGet as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useSchemas());

      await waitFor(() => {
        expect(result.current.error).toEqual(mockError);
        expect(result.current.data).toBeUndefined();
      });
    });
  });

  describe('useChartData', () => {
    const mockPayload: ChartDataPayload = {
      chart_type: 'bar',
      computation_type: 'raw',
      schema_name: 'public',
      table_name: 'users',
      xaxis: 'name',
      yaxis: 'value',
    };

    const mockChartData = {
      chart_config: {
        series: [
          {
            data: [1, 2, 3],
            type: 'bar',
          },
        ],
        xAxis: {
          data: ['A', 'B', 'C'],
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

    it('generates chart data successfully', async () => {
      (apiPost as jest.Mock).mockResolvedValue({ data: mockChartData });

      const { result } = renderHook(() => useChartData(mockPayload));

      await waitFor(() => {
        expect(result.current.data).toEqual(mockChartData);
        expect(result.current.error).toBeUndefined();
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('handles chart data generation error', async () => {
      const mockError = new Error('Failed to generate chart data');
      (apiPost as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useChartData(mockPayload));

      await waitFor(() => {
        expect(result.current.error).toEqual(mockError);
        expect(result.current.data).toBeUndefined();
      });
    });
  });

  describe('useChartSave', () => {
    const mockChart: ChartCreatePayload = {
      title: 'Test Chart',
      description: 'Test Description',
      chart_type: 'echarts',
      schema_name: 'public',
      table: 'users',
      config: {
        chartType: 'bar',
        computation_type: 'raw',
        xAxis: 'name',
        yAxis: 'value',
      },
      is_public: false,
    };

    it('saves chart successfully', async () => {
      const mockResponse = {
        data: {
          id: 1,
          ...mockChart,
        },
      };

      (apiPost as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChartSave());

      const response = await result.current.save(mockChart);
      expect(response).toEqual(mockResponse);
    });

    it('handles chart save error', async () => {
      const mockError = new Error('Failed to save chart');
      (apiPost as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useChartSave());

      await expect(result.current.save(mockChart)).rejects.toThrow('Failed to save chart');
    });
  });
});
