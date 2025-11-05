/**
 * Tests for SavedChartThumbnail component
 * Tests thumbnail preview with API data fetching and MiniChart rendering
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import SavedChartThumbnail from '../SavedChartThumbnail';
import * as api from '@/lib/api';

// Mock the API module
jest.mock('@/lib/api');
const mockedApiPost = api.apiPost as jest.MockedFunction<typeof api.apiPost>;

// Mock MiniChart component
jest.mock('../MiniChart', () => ({
  MiniChart: ({ config, chartType, className }: any) => (
    <div
      data-testid="mini-chart"
      data-chart-type={chartType}
      data-has-config={!!config}
      className={className}
    >
      Mini Chart Mock
    </div>
  ),
}));

describe('SavedChartThumbnail', () => {
  const mockChart = {
    id: 1,
    title: 'Test Chart',
    chart_type: 'bar',
    schema_name: 'test_schema',
    table: 'test_table',
    config: {
      xAxis: 'category',
      yAxis: 'value',
      chartType: 'bar',
    },
  };

  const mockChartConfig = {
    type: 'bar',
    data: [{ x: 'A', y: 10 }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state and fetch/display chart data correctly', async () => {
    // Loading state with spinner and proper styling
    mockedApiPost.mockImplementation(() => new Promise(() => {})); // Never resolves
    const { container, unmount } = render(<SavedChartThumbnail chart={mockChart} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    const loadingContainer = screen.getByText('Loading...').closest('.flex');
    expect(loadingContainer).toHaveClass('bg-muted/50', 'rounded', 'border');
    unmount();

    // Successful data fetching and rendering
    mockedApiPost.mockResolvedValueOnce({ chart_config: mockChartConfig });
    const result = render(<SavedChartThumbnail chart={mockChart} />);

    await waitFor(() => {
      expect(mockedApiPost).toHaveBeenCalledWith('/api/visualization/generate_chart/', {
        chart_type: 'bar',
        mode: 'raw',
        schema_name: 'test_schema',
        table_name: 'test_table',
        xaxis_col: 'category',
        yaxis_col: 'value',
        offset: 0,
        limit: 8,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('mini-chart')).toBeInTheDocument();
      const miniChart = screen.getByTestId('mini-chart');
      expect(miniChart).toHaveAttribute('data-has-config', 'true');
      expect(miniChart).toHaveAttribute('data-chart-type', 'bar');
    });
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();

    // Default className
    const chartContainer = result.container.querySelector('.w-full.h-full');
    expect(chartContainer).toBeInTheDocument();
  });

  it('should handle all chart types and all error scenarios', async () => {
    // Test all chart types
    const chartTypes = ['bar', 'line', 'pie', 'scatter'];
    for (const chartType of chartTypes) {
      const chart = {
        ...mockChart,
        id: Math.random(), // Unique id to avoid conflicts
        chart_type: chartType,
        config: { ...mockChart.config, chartType },
      };

      mockedApiPost.mockResolvedValueOnce({ chart_config: mockChartConfig });
      const { unmount } = render(<SavedChartThumbnail chart={chart} />);

      await waitFor(() => {
        const miniChart = screen.getByTestId('mini-chart');
        expect(miniChart).toHaveAttribute('data-chart-type', chartType);
      });
      unmount();
    }

    // API Error
    mockedApiPost.mockRejectedValueOnce(new Error('API Error'));
    let result = render(<SavedChartThumbnail chart={{ ...mockChart, id: 2 }} />);

    await waitFor(() => {
      expect(screen.getByText('No preview')).toBeInTheDocument();
      expect(screen.getByText('📊')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('mini-chart')).not.toBeInTheDocument();
    result.unmount();

    // Missing chart_config
    mockedApiPost.mockResolvedValueOnce({});
    result = render(<SavedChartThumbnail chart={{ ...mockChart, id: 3 }} />);
    await waitFor(() => {
      expect(screen.getByText('No preview')).toBeInTheDocument();
    });
    result.unmount();

    // Generic string error
    mockedApiPost.mockRejectedValueOnce('String error');
    result = render(<SavedChartThumbnail chart={{ ...mockChart, id: 4 }} />);
    await waitFor(() => {
      expect(screen.getByText('No preview')).toBeInTheDocument();
    });
  });

  it('should handle edge cases and apply custom className', async () => {
    // Empty table and schema names
    mockedApiPost.mockResolvedValueOnce({ chart_config: mockChartConfig });
    const chartWithEmpty = { ...mockChart, table: '', schema_name: '', id: 5 };
    let result = render(<SavedChartThumbnail chart={chartWithEmpty} />);

    await waitFor(() => {
      expect(mockedApiPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ table_name: '', schema_name: '' })
      );
    });
    result.unmount();

    // Custom className on success
    mockedApiPost.mockResolvedValueOnce({ chart_config: mockChartConfig });
    const { container } = render(
      <SavedChartThumbnail chart={{ ...mockChart, id: 6 }} className="custom-class" />
    );
    await waitFor(() => {
      const chartContainer = container.querySelector('.custom-class');
      expect(chartContainer).toBeInTheDocument();
    });
  });
});
