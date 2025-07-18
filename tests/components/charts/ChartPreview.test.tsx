import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChartPreview } from '@/components/charts/ChartPreview';

// Mock ECharts
jest.mock('echarts-for-react', () => {
  return function MockECharts(props: any) {
    return (
      <div data-testid="echarts-mock" style={props.style}>
        {JSON.stringify(props.option)}
      </div>
    );
  };
});

interface ChartData {
  success: boolean;
  data: {
    chart_config: {
      title?: { text: string };
      xAxis: { type: string; data: string[] };
      yAxis: { type: string };
      series: Array<{
        data: number[];
        type: string;
      }>;
    };
    raw_data: {
      data: Array<{
        x: string;
        y: number;
      }>;
    };
  };
}

describe('ChartPreview', () => {
  const mockChartData: ChartData = {
    success: true,
    data: {
      chart_config: {
        title: { text: 'Test Chart' },
        xAxis: { type: 'category', data: ['A', 'B', 'C'] },
        yAxis: { type: 'value' },
        series: [{ data: [10, 20, 15], type: 'bar' }],
      },
      raw_data: {
        data: [
          { x: 'A', y: 10 },
          { x: 'B', y: 20 },
          { x: 'C', y: 15 },
        ],
      },
    },
  };

  it('renders loading state', () => {
    render(
      <ChartPreview
        chartType="bar"
        chartData={null}
        isLoading={true}
        error={null}
        title="Loading Chart"
      />
    );

    expect(screen.getByText(/loading chart/i)).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(
      <ChartPreview
        chartType="bar"
        chartData={null}
        isLoading={false}
        error="Failed to load chart"
        title="Error Chart"
      />
    );

    expect(screen.getByText(/failed to load chart/i)).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(
      <ChartPreview
        chartType="bar"
        chartData={null}
        isLoading={false}
        error={null}
        title="Empty Chart"
      />
    );

    expect(screen.getByText(/no chart data available/i)).toBeInTheDocument();
  });

  it('renders chart with data', () => {
    render(
      <ChartPreview
        chartType="bar"
        chartData={mockChartData}
        isLoading={false}
        error={null}
        title="Test Chart"
      />
    );

    const echartsElement = screen.getByTestId('echarts-mock');
    const config = JSON.parse(echartsElement.textContent || '{}');

    expect(config.title.text).toBe('Test Chart');
    expect(config.xAxis.data).toEqual(['A', 'B', 'C']);
    expect(config.series[0].data).toEqual([10, 20, 15]);
  });

  it('handles different chart types', () => {
    const types = ['bar', 'line', 'pie'] as const;

    types.forEach((type) => {
      render(
        <ChartPreview
          chartType={type}
          chartData={mockChartData}
          isLoading={false}
          error={null}
          title={`${type} Chart`}
        />
      );

      const echartsElement = screen.getByTestId('echarts-mock');
      const config = JSON.parse(echartsElement.textContent || '{}');
      expect(config.series[0].type).toBe(type);
    });
  });

  it('formats large numbers in axis labels', () => {
    const largeNumberData: ChartData = {
      success: true,
      data: {
        chart_config: {
          title: { text: 'Large Numbers' },
          xAxis: { type: 'category', data: ['A'] },
          yAxis: { type: 'value' },
          series: [{ data: [1000000], type: 'bar' }],
        },
        raw_data: {
          data: [{ x: 'A', y: 1000000 }],
        },
      },
    };

    render(
      <ChartPreview
        chartType="bar"
        chartData={largeNumberData}
        isLoading={false}
        error={null}
        title="Large Numbers"
      />
    );

    const echartsElement = screen.getByTestId('echarts-mock');
    const config = JSON.parse(echartsElement.textContent || '{}');

    expect(config.yAxis.axisLabel.formatter).toBeDefined();
    const formatter = config.yAxis.axisLabel.formatter;
    expect(formatter(1000000)).toBe('1M');
    expect(formatter(1500000)).toBe('1.5M');
  });

  it('shows error message when chart rendering fails', () => {
    const invalidData = {
      success: true,
      data: {
        chart_config: {
          // Invalid config that would cause rendering error
          series: null as any,
        },
      },
    };

    render(
      <ChartPreview
        chartType="bar"
        chartData={invalidData}
        isLoading={false}
        error={null}
        title="Invalid Chart"
      />
    );

    expect(screen.getByText(/error rendering chart/i)).toBeInTheDocument();
  });
});
