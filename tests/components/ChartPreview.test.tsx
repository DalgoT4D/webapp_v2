import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChartPreview from '@/components/charts/ChartPreview';

// Mock ECharts
jest.mock('echarts-for-react', () => {
  return React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      getEchartsInstance: () => ({
        getDataURL: () => 'data:image/png;base64,mockImageData',
      }),
    }));

    return <div data-testid="echarts-mock">ECharts Mock</div>;
  });
});

// Mock Recharts
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="recharts-container">{children}</div>
  ),
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  Line: () => <div data-testid="line" />,
  Pie: () => <div data-testid="pie" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  Cell: () => <div data-testid="cell" />,
}));

// Mock Nivo
jest.mock('@nivo/bar', () => ({
  ResponsiveBar: () => <div data-testid="nivo-bar">Nivo Bar Chart</div>,
}));

jest.mock('@nivo/line', () => ({
  ResponsiveLine: () => <div data-testid="nivo-line">Nivo Line Chart</div>,
}));

jest.mock('@nivo/pie', () => ({
  ResponsivePie: () => <div data-testid="nivo-pie">Nivo Pie Chart</div>,
}));

describe('ChartPreview Component', () => {
  const mockChartConfig = {
    title: { text: 'Test Chart' },
    xAxis: { type: 'category', data: ['A', 'B', 'C'] },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: [10, 20, 30] }],
  };

  const mockChartData = {
    xAxis: ['A', 'B', 'C'],
    yAxis: [10, 20, 30],
    data: [
      { name: 'A', value: 10 },
      { name: 'B', value: 20 },
      { name: 'C', value: 30 },
    ],
  };

  it('should render loading state', () => {
    render(<ChartPreview chartType="echarts" isLoading={true} />);

    expect(screen.getByText('Loading chart...')).toBeInTheDocument();
  });

  it('should render error state', () => {
    render(<ChartPreview chartType="echarts" error="Failed to load data" />);

    expect(screen.getByText('Failed to load chart data')).toBeInTheDocument();
  });

  it('should render empty state', () => {
    render(<ChartPreview chartType="echarts" />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('should render ECharts chart', () => {
    render(
      <ChartPreview chartType="echarts" chartConfig={mockChartConfig} chartData={mockChartData} />
    );

    expect(screen.getByTestId('echarts-mock')).toBeInTheDocument();
  });

  it('should render Recharts bar chart', () => {
    render(<ChartPreview chartType="recharts" chartSubType="bar" chartData={mockChartData} />);

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar')).toBeInTheDocument();
  });

  it('should render Recharts line chart', () => {
    render(<ChartPreview chartType="recharts" chartSubType="line" chartData={mockChartData} />);

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('line')).toBeInTheDocument();
  });

  it('should render Recharts pie chart', () => {
    render(<ChartPreview chartType="recharts" chartSubType="pie" chartData={mockChartData} />);

    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('pie')).toBeInTheDocument();
  });

  it('should render Nivo bar chart', () => {
    render(<ChartPreview chartType="nivo" chartSubType="bar" chartData={mockChartData} />);

    expect(screen.getByTestId('nivo-bar')).toBeInTheDocument();
  });

  it('should render Nivo line chart', () => {
    const lineData = {
      data: [
        {
          id: 'series1',
          data: mockChartData.data.map((d) => ({ x: d.name, y: d.value })),
        },
      ],
    };

    render(<ChartPreview chartType="nivo" chartSubType="line" chartData={lineData} />);

    expect(screen.getByTestId('nivo-line')).toBeInTheDocument();
  });

  it('should render Nivo pie chart', () => {
    render(<ChartPreview chartType="nivo" chartSubType="pie" chartData={mockChartData} />);

    expect(screen.getByTestId('nivo-pie')).toBeInTheDocument();
  });

  it('should handle export functionality', async () => {
    const user = userEvent.setup();
    const mockOnExport = jest.fn();

    const { container } = render(
      <ChartPreview
        chartType="echarts"
        chartConfig={mockChartConfig}
        chartData={mockChartData}
        onExport={mockOnExport}
      />
    );

    // The component should have a ref that can be accessed for export
    const chartInstance = container.querySelector('[data-testid="echarts-mock"]');
    expect(chartInstance).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(
      <ChartPreview
        chartType="echarts"
        chartConfig={mockChartConfig}
        chartData={mockChartData}
        className="custom-class"
      />
    );

    const container = screen.getByTestId('echarts-mock').parentElement;
    expect(container).toHaveClass('custom-class');
  });

  it('should handle different data formats', () => {
    // Test with raw data format
    const rawData = {
      data: [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 200 },
        { date: '2024-01-03', value: 150 },
      ],
    };

    render(<ChartPreview chartType="recharts" chartSubType="line" chartData={rawData} />);

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('should handle responsive behavior', () => {
    const { container } = render(
      <ChartPreview chartType="recharts" chartSubType="bar" chartData={mockChartData} />
    );

    const responsiveContainer = screen.getByTestId('recharts-container');
    expect(responsiveContainer).toBeInTheDocument();
  });

  it('should update when props change', async () => {
    const { rerender } = render(
      <ChartPreview chartType="echarts" chartConfig={mockChartConfig} chartData={mockChartData} />
    );

    expect(screen.getByTestId('echarts-mock')).toBeInTheDocument();

    // Change to Recharts
    rerender(<ChartPreview chartType="recharts" chartSubType="bar" chartData={mockChartData} />);

    await waitFor(() => {
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });
});
