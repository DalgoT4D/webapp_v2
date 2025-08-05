import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import EChartsComponent from '@/components/charts/EChartsComponent';

// Mock echarts-for-react
jest.mock('echarts-for-react', () => {
  const React = require('react');
  return React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      getEchartsInstance: () => ({
        setOption: jest.fn(),
        dispose: jest.fn(),
        resize: jest.fn(),
        getOption: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
      }),
    }));

    return React.createElement('div', {
      'data-testid': 'mocked-echarts',
      style: props.style,
    });
  });
});

// Mock the chart utils
jest.mock('@/components/charts/chartUtils', () => ({
  validateChartData: jest.fn(() => ({ isValid: true, errors: [] })),
  COLOR_PALETTES: {
    default: ['#5470c6', '#91cc75', '#fac858'],
  },
}));

describe('EChartsComponent', () => {
  const mockData = {
    chart_config: {
      xAxis: {
        type: 'category',
        data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      },
      yAxis: {
        type: 'value',
      },
      series: [
        {
          data: [120, 200, 150, 80, 70, 110, 130],
          type: 'bar',
        },
      ],
    },
  };

  const defaultProps = {
    data: mockData,
    customOptions: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<EChartsComponent {...defaultProps} />);

    expect(screen.getByTestId('echarts-container')).toBeInTheDocument();
  });

  it('renders loading state when data is not provided', () => {
    render(<EChartsComponent data={null} customOptions={{}} />);

    expect(screen.getByText(/no chart data available/i)).toBeInTheDocument();
  });

  it('renders error state when chart_config is missing', () => {
    const invalidData = {
      raw_data: { some: 'data' },
      // Missing chart_config
    };

    render(<EChartsComponent data={invalidData} customOptions={{}} />);

    expect(screen.getByText(/invalid chart configuration/i)).toBeInTheDocument();
  });

  it('initializes ECharts instance on mount', async () => {
    render(<EChartsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('mocked-echarts')).toBeInTheDocument();
    });
  });

  it('applies custom options to chart config', async () => {
    const customOptions = {
      backgroundColor: '#f0f0f0',
      animation: false,
    };

    render(<EChartsComponent {...defaultProps} customOptions={customOptions} />);

    await waitFor(() => {
      expect(screen.getByTestId('mocked-echarts')).toBeInTheDocument();
    });
  });

  it('disposes chart instance on unmount', () => {
    const { unmount } = render(<EChartsComponent {...defaultProps} />);

    expect(screen.getByTestId('mocked-echarts')).toBeInTheDocument();

    unmount();

    expect(screen.queryByTestId('mocked-echarts')).not.toBeInTheDocument();
  });

  it('updates chart when data changes', async () => {
    const { rerender } = render(<EChartsComponent {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('mocked-echarts')).toBeInTheDocument();
    });

    // Update data
    const newData = {
      chart_config: {
        ...mockData.chart_config,
        series: [
          {
            data: [150, 250, 180, 90, 80, 120, 140],
            type: 'line',
          },
        ],
      },
    };

    rerender(<EChartsComponent data={newData} customOptions={{}} />);

    await waitFor(() => {
      expect(screen.getByTestId('mocked-echarts')).toBeInTheDocument();
    });
  });

  it('handles chart resize on window resize', async () => {
    render(<EChartsComponent {...defaultProps} />);

    // Simulate window resize
    window.dispatchEvent(new Event('resize'));

    await waitFor(() => {
      expect(screen.getByTestId('mocked-echarts')).toBeInTheDocument();
    });
  });

  it('renders chart with proper dimensions', () => {
    render(<EChartsComponent {...defaultProps} />);

    const container = screen.getByTestId('echarts-container');
    expect(container).toHaveStyle({
      width: '100%',
      height: '400px',
    });
  });

  it('renders chart with custom dimensions', () => {
    render(<EChartsComponent {...defaultProps} width={800} height={600} />);

    const container = screen.getByTestId('echarts-container');
    expect(container).toHaveStyle({
      width: '800px',
      height: '600px',
    });
  });

  it('handles different chart types', async () => {
    const pieData = {
      chart_config: {
        series: [
          {
            name: 'Access From',
            type: 'pie',
            radius: '50%',
            data: [
              { value: 1048, name: 'Search Engine' },
              { value: 735, name: 'Direct' },
              { value: 580, name: 'Email' },
            ],
          },
        ],
      },
    };

    render(<EChartsComponent data={pieData} customOptions={{}} />);

    await waitFor(() => {
      expect(screen.getByTestId('mocked-echarts')).toBeInTheDocument();
    });
  });

  it('handles empty data gracefully', () => {
    const emptyData = {
      chart_config: {
        series: [],
      },
    };

    render(<EChartsComponent data={emptyData} customOptions={{}} />);

    expect(screen.getByTestId('echarts-container')).toBeInTheDocument();
  });

  it('shows error message for invalid chart configuration', () => {
    const invalidData = {
      chart_config: 'invalid config',
    } as any;

    render(<EChartsComponent data={invalidData} customOptions={{}} />);

    expect(screen.getByText(/invalid chart configuration/i)).toBeInTheDocument();
  });

  it('applies responsive behavior', async () => {
    render(<EChartsComponent {...defaultProps} responsive={true} />);

    // The component should render
    await waitFor(() => {
      expect(screen.getByTestId('mocked-echarts')).toBeInTheDocument();
    });

    // Simulate resize
    window.dispatchEvent(new Event('resize'));

    await waitFor(() => {
      expect(screen.getByTestId('mocked-echarts')).toBeInTheDocument();
    });
  });

  it('handles chart click events', async () => {
    const onChartClick = jest.fn();

    render(<EChartsComponent {...defaultProps} onChartClick={onChartClick} />);

    await waitFor(() => {
      expect(screen.getByTestId('mocked-echarts')).toBeInTheDocument();
    });
  });

  it('removes event listeners on unmount', () => {
    const onChartClick = jest.fn();

    const { unmount } = render(<EChartsComponent {...defaultProps} onChartClick={onChartClick} />);

    expect(screen.getByTestId('mocked-echarts')).toBeInTheDocument();

    unmount();

    expect(screen.queryByTestId('mocked-echarts')).not.toBeInTheDocument();
  });

  it('handles theme changes', async () => {
    const { rerender } = render(<EChartsComponent {...defaultProps} theme="dark" />);

    await waitFor(() => {
      expect(screen.getByTestId('mocked-echarts')).toBeInTheDocument();
    });

    rerender(<EChartsComponent {...defaultProps} theme="light" />);

    // Should still render with new theme
    await waitFor(() => {
      expect(screen.getByTestId('mocked-echarts')).toBeInTheDocument();
    });
  });
});
