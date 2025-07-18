import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChartPreview } from '@/components/charts/ChartPreview';

// Mock next/dynamic and ECharts
jest.mock('next/dynamic', () => () => {
  const MockECharts = ({ option, style }: any) => (
    <div data-testid="echarts-mock" style={style}>
      {JSON.stringify(option)}
    </div>
  );
  return MockECharts;
});

describe('ChartPreview', () => {
  const mockChartData = {
    data: [
      { x: 'A', y: 10 },
      { x: 'B', y: 20 },
      { x: 'C', y: 15 },
    ],
  };

  it('renders loading state', () => {
    render(
      <ChartPreview
        chartType="bar"
        chartData={null}
        isLoading={true}
        error={null}
        title="Test Chart"
      />
    );

    expect(screen.getByText('Generating chart data...')).toBeInTheDocument();
  });

  it('renders error state', () => {
    const mockError = { message: 'Failed to load chart data' };

    render(
      <ChartPreview
        chartType="bar"
        chartData={null}
        isLoading={false}
        error={mockError}
        title="Test Chart"
      />
    );

    expect(screen.getByText('Failed to load chart data')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(
      <ChartPreview
        chartType="bar"
        chartData={null}
        isLoading={false}
        error={null}
        title="Test Chart"
      />
    );

    expect(screen.getByText('Configure your chart')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Select a chart type, data source, and configure your axes to see a preview here.'
      )
    ).toBeInTheDocument();
  });

  it('renders empty state when data is empty array', () => {
    render(
      <ChartPreview
        chartType="bar"
        chartData={{ data: [] }}
        isLoading={false}
        error={null}
        title="Test Chart"
      />
    );

    expect(screen.getByText('Configure your chart')).toBeInTheDocument();
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

    expect(screen.getByTestId('echarts-mock')).toBeInTheDocument();
    expect(screen.getByText('3 data points')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('displays chart metadata correctly', () => {
    render(
      <ChartPreview
        chartType="line"
        chartData={mockChartData}
        isLoading={false}
        error={null}
        title="Line Chart"
      />
    );

    expect(screen.getByText('Chart Type:')).toBeInTheDocument();
    expect(screen.getByText('line')).toBeInTheDocument();
    expect(screen.getByText('Data Points:')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('generates correct ECharts config for bar chart', () => {
    render(
      <ChartPreview
        chartType="bar"
        chartData={mockChartData}
        isLoading={false}
        error={null}
        title="Bar Chart"
      />
    );

    const echartsElement = screen.getByTestId('echarts-mock');
    const configString = echartsElement.textContent;
    const config = JSON.parse(configString || '{}');

    expect(config.title.text).toBe('Bar Chart');
    expect(config.xAxis.type).toBe('category');
    expect(config.yAxis.type).toBe('value');
    expect(config.series[0].type).toBe('bar');
    expect(config.series[0].data).toEqual([10, 20, 15]);
  });

  it('generates correct ECharts config for line chart', () => {
    render(
      <ChartPreview
        chartType="line"
        chartData={mockChartData}
        isLoading={false}
        error={null}
        title="Line Chart"
      />
    );

    const echartsElement = screen.getByTestId('echarts-mock');
    const configString = echartsElement.textContent;
    const config = JSON.parse(configString || '{}');

    expect(config.title.text).toBe('Line Chart');
    expect(config.xAxis.type).toBe('category');
    expect(config.yAxis.type).toBe('value');
    expect(config.series[0].type).toBe('line');
    expect(config.series[0].smooth).toBe(true);
    expect(config.series[0].data).toEqual([10, 20, 15]);
  });

  it('generates correct ECharts config for pie chart', () => {
    render(
      <ChartPreview
        chartType="pie"
        chartData={mockChartData}
        isLoading={false}
        error={null}
        title="Pie Chart"
      />
    );

    const echartsElement = screen.getByTestId('echarts-mock');
    const configString = echartsElement.textContent;
    const config = JSON.parse(configString || '{}');

    expect(config.title.text).toBe('Pie Chart');
    expect(config.series[0].type).toBe('pie');
    expect(config.series[0].data).toEqual([
      { name: 'A', value: 10 },
      { name: 'B', value: 20 },
      { name: 'C', value: 15 },
    ]);
  });

  it('handles different data formats', () => {
    const alternativeData = {
      data: [
        { dimension: 'Category A', value: 100 },
        { dimension: 'Category B', value: 200 },
        { dimension: 'Category C', value: 150 },
      ],
    };

    render(
      <ChartPreview
        chartType="bar"
        chartData={alternativeData}
        isLoading={false}
        error={null}
        title="Alternative Data"
      />
    );

    const echartsElement = screen.getByTestId('echarts-mock');
    const configString = echartsElement.textContent;
    const config = JSON.parse(configString || '{}');

    expect(config.xAxis.data).toEqual(['Category A', 'Category B', 'Category C']);
    expect(config.series[0].data).toEqual([100, 200, 150]);
  });

  it('formats large numbers in axis labels', () => {
    const largeNumberData = {
      data: [
        { x: 'A', y: 1000000 },
        { x: 'B', y: 2500000 },
        { x: 'C', y: 150000 },
      ],
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
    const configString = echartsElement.textContent;
    const config = JSON.parse(configString || '{}');

    // Check that formatter function exists
    expect(config.yAxis.axisLabel.formatter).toBeDefined();

    // Test the formatter function
    const formatter = config.yAxis.axisLabel.formatter;
    expect(formatter(1000000)).toBe('1.0M');
    expect(formatter(2500)).toBe('2.5K');
    expect(formatter(500)).toBe('500');
  });

  it('handles null/undefined data gracefully', () => {
    const nullData = {
      data: [
        { x: 'A', y: null },
        { x: 'B', y: undefined },
        { x: 'C', y: 15 },
      ],
    };

    render(
      <ChartPreview
        chartType="bar"
        chartData={nullData}
        isLoading={false}
        error={null}
        title="Null Data"
      />
    );

    expect(screen.getByTestId('echarts-mock')).toBeInTheDocument();
  });

  it('includes chart title in ECharts config', () => {
    render(
      <ChartPreview
        chartType="bar"
        chartData={mockChartData}
        isLoading={false}
        error={null}
        title="Custom Chart Title"
      />
    );

    const echartsElement = screen.getByTestId('echarts-mock');
    const configString = echartsElement.textContent;
    const config = JSON.parse(configString || '{}');

    expect(config.title.text).toBe('Custom Chart Title');
    expect(config.title.left).toBe('center');
  });

  it('includes toolbox features in ECharts config', () => {
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
    const configString = echartsElement.textContent;
    const config = JSON.parse(configString || '{}');

    expect(config.toolbox.feature.saveAsImage.show).toBe(true);
    expect(config.toolbox.feature.dataZoom.show).toBe(true);
    expect(config.toolbox.feature.restore.show).toBe(true);
  });

  it('handles chart type changes correctly', () => {
    const { rerender } = render(
      <ChartPreview
        chartType="bar"
        chartData={mockChartData}
        isLoading={false}
        error={null}
        title="Test Chart"
      />
    );

    // Check initial bar chart
    let echartsElement = screen.getByTestId('echarts-mock');
    let configString = echartsElement.textContent;
    let config = JSON.parse(configString || '{}');
    expect(config.series[0].type).toBe('bar');

    // Change to line chart
    rerender(
      <ChartPreview
        chartType="line"
        chartData={mockChartData}
        isLoading={false}
        error={null}
        title="Test Chart"
      />
    );

    echartsElement = screen.getByTestId('echarts-mock');
    configString = echartsElement.textContent;
    config = JSON.parse(configString || '{}');
    expect(config.series[0].type).toBe('line');
  });

  it('shows error message when chart rendering fails', () => {
    // Mock invalid data that would cause rendering to fail
    const invalidData = {
      data: 'invalid data format',
    };

    render(
      <ChartPreview
        chartType="bar"
        chartData={invalidData}
        isLoading={false}
        error={null}
        title="Test Chart"
      />
    );

    // Should show fallback message
    expect(screen.getByText('Unable to render chart')).toBeInTheDocument();
  });

  it('displays chart preview header correctly', () => {
    render(
      <ChartPreview
        chartType="bar"
        chartData={mockChartData}
        isLoading={false}
        error={null}
        title="Test Chart"
      />
    );

    expect(screen.getByText('Chart Preview')).toBeInTheDocument();
    expect(screen.getByText('3 data points')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('handles missing chart data properties', () => {
    const incompleteData = {
      data: [
        { x: 'A' }, // Missing y
        { y: 20 }, // Missing x
        { x: 'C', y: 15 }, // Complete
      ],
    };

    render(
      <ChartPreview
        chartType="bar"
        chartData={incompleteData}
        isLoading={false}
        error={null}
        title="Incomplete Data"
      />
    );

    expect(screen.getByTestId('echarts-mock')).toBeInTheDocument();
  });
});
