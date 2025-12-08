/**
 * Tests for ChartThumbnailPreview component
 * Tests lazy-loading thumbnail preview with intersection observer and API data
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChartThumbnailPreview } from '../ChartThumbnailPreview';
import * as useIntersectionObserverModule from '@/hooks/useIntersectionObserver';
import * as useChartsModule from '@/hooks/api/useCharts';

// Mock hooks
jest.mock('@/hooks/useIntersectionObserver');
jest.mock('@/hooks/api/useCharts');

// Mock MiniChart
jest.mock('../MiniChart', () => ({
  MiniChart: ({ config, className, showTitle }: any) => (
    <div
      data-testid="mini-chart"
      data-has-config={!!config}
      data-show-title={showTitle}
      className={className}
    >
      Mini Chart
    </div>
  ),
}));

// Mock icon component
const MockIcon = ({ className, style }: any) => (
  <div data-testid="mock-icon" className={className} style={style}>
    Icon
  </div>
);

describe('ChartThumbnailPreview', () => {
  const defaultProps = {
    chartId: 1,
    iconComponent: MockIcon,
    typeColors: {
      color: '#3b82f6',
      bgColor: '#eff6ff',
    },
  };

  const mockUseIntersectionObserver =
    useIntersectionObserverModule.useIntersectionObserver as jest.Mock;
  const mockUseChart = useChartsModule.useChart as jest.Mock;
  const mockUseChartData = useChartsModule.useChartData as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockUseIntersectionObserver.mockReturnValue({
      targetRef: { current: null },
      isIntersecting: false,
    });

    mockUseChart.mockReturnValue({
      data: null,
      error: null,
      isLoading: false,
    });

    mockUseChartData.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    });
  });

  it('should render icons and handle lazy loading with intersection observer', () => {
    // Map and table charts - show icon without loading
    const { rerender, container } = render(
      <ChartThumbnailPreview {...defaultProps} chart={{ id: 1, chart_type: 'map' }} />
    );
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
    expect(mockUseChartData).toHaveBeenCalledWith(0);
    rerender(<ChartThumbnailPreview {...defaultProps} chart={{ id: 1, chart_type: 'table' }} />);
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
    expect(mockUseChartData).toHaveBeenCalledWith(0);

    // Icon styling and colors
    const chart = { id: 1, chart_type: 'map' };
    rerender(<ChartThumbnailPreview {...defaultProps} chart={chart} />);
    const icon = screen.getByTestId('mock-icon');
    expect(icon).toHaveStyle({ color: '#3b82f6' });
    const iconContainer = container.querySelector('[style*="background-color"]');
    expect(iconContainer).toHaveStyle({ backgroundColor: '#eff6ff' });

    // Lazy loading - not intersecting
    const barChart = { id: 1, chart_type: 'bar' };
    rerender(<ChartThumbnailPreview {...defaultProps} chart={barChart} />);
    expect(mockUseChartData).toHaveBeenCalledWith(0);

    // Lazy loading - intersecting
    mockUseIntersectionObserver.mockReturnValue({
      targetRef: { current: null },
      isIntersecting: true,
    });
    rerender(<ChartThumbnailPreview {...defaultProps} chart={barChart} />);
    expect(mockUseIntersectionObserver).toHaveBeenCalled();

    // Intersection observer options
    rerender(<ChartThumbnailPreview {...defaultProps} />);
    expect(mockUseIntersectionObserver).toHaveBeenCalledWith({
      threshold: 0.1,
      rootMargin: '200px',
      triggerOnce: true,
    });

    // All chart types
    ['bar', 'line', 'pie'].forEach((type) => {
      const { unmount } = render(
        <ChartThumbnailPreview {...defaultProps} chart={{ id: 1, chart_type: type }} />
      );
      expect(mockUseIntersectionObserver).toHaveBeenCalled();
      unmount();
    });
  });

  it('should handle loading state and render MiniChart with data', () => {
    mockUseIntersectionObserver.mockReturnValue({
      targetRef: { current: null },
      isIntersecting: true,
    });

    // Loading indicators
    mockUseChartData.mockReturnValue({ data: null, isLoading: true, isError: false });
    const chart = { id: 1, chart_type: 'bar' };
    const { container, rerender } = render(
      <ChartThumbnailPreview {...defaultProps} chart={chart} />
    );
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    const pulsingBg = container.querySelector('.animate-pulse');
    expect(pulsingBg).toBeInTheDocument();

    // MiniChart with data
    const mockChartData = {
      echarts_config: {
        type: 'bar',
        series: [{ data: [1, 2, 3] }],
        animation: true,
        tooltip: { show: true },
        legend: { show: true },
        dataZoom: [],
        brush: {},
      },
    };
    mockUseChartData.mockReturnValue({ data: mockChartData, isLoading: false, isError: false });
    rerender(<ChartThumbnailPreview {...defaultProps} chart={chart} />);
    expect(screen.getByTestId('mini-chart')).toBeInTheDocument();
    const miniChart = screen.getByTestId('mini-chart');
    expect(miniChart).toHaveAttribute('data-show-title', 'false');
    const icon = screen.getByTestId('mock-icon');
    expect(icon).toHaveClass('w-5', 'h-5');
  });

  it('should handle errors and edge cases correctly', () => {
    mockUseIntersectionObserver.mockReturnValue({
      targetRef: { current: null },
      isIntersecting: true,
    });

    // Chart data error
    mockUseChartData.mockReturnValue({ data: null, isLoading: false, isError: true });
    const chart = { id: 1, chart_type: 'bar' };
    const { rerender } = render(<ChartThumbnailPreview {...defaultProps} chart={chart} />);
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();

    // Chart metadata error
    mockUseChartData.mockReturnValue({ data: null, isLoading: false, isError: false });
    mockUseChart.mockReturnValue({
      data: null,
      error: new Error('Failed to fetch'),
      isLoading: false,
    });
    rerender(<ChartThumbnailPreview {...defaultProps} />);
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();

    // Missing chart prop
    mockUseChart.mockReturnValue({ data: null, error: null, isLoading: false });
    rerender(<ChartThumbnailPreview {...defaultProps} />);
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
    expect(mockUseChart).toHaveBeenCalled();

    // Chart without chart_type
    rerender(<ChartThumbnailPreview {...defaultProps} chart={{ id: 1 }} />);
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();

    // Null echarts_config
    mockUseChartData.mockReturnValue({
      data: { echarts_config: null },
      isLoading: false,
      isError: false,
    });
    rerender(<ChartThumbnailPreview {...defaultProps} chart={{ id: 1, chart_type: 'bar' }} />);
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();

    // Empty chartData
    mockUseChartData.mockReturnValue({ data: {}, isLoading: false, isError: false });
    rerender(<ChartThumbnailPreview {...defaultProps} chart={{ id: 1, chart_type: 'bar' }} />);
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();

    // Chart metadata fallback
    const barChart = { id: 1, chart_type: 'bar' };
    rerender(<ChartThumbnailPreview {...defaultProps} chart={barChart} />);
    expect(mockUseChart).toHaveBeenCalledWith(0);
  });

  it('should apply custom styling and layout', () => {
    const chart = { id: 1, chart_type: 'map' };
    const { container } = render(
      <ChartThumbnailPreview {...defaultProps} chart={chart} className="custom-class" />
    );

    expect(container.querySelector('.custom-class')).toBeInTheDocument();
    expect(container.querySelector('.h-40')).toBeInTheDocument();
    expect(container.querySelector('.bg-gradient-to-br')).toBeInTheDocument();
    expect(container.querySelector('.group-hover\\:from-gray-100')).toBeInTheDocument();
  });
});
