import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ChartPreview } from '../ChartPreview';
import ReactECharts from 'echarts-for-react';

// Mock ReactECharts
jest.mock('echarts-for-react', () => {
  return jest.fn(({ option, style, ref }) => (
    <div data-testid="echarts-mock" style={style} ref={ref}>
      {JSON.stringify(option)}
    </div>
  ));
});

describe('ChartPreview Component', () => {
  const mockChartData = {
    option: {
      title: { text: 'Test Chart' },
      xAxis: { data: ['Jan', 'Feb', 'Mar'] },
      yAxis: { type: 'value' },
      series: [{ data: [100, 200, 150], type: 'bar' }],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering States', () => {
    it('should render empty state when no data provided', () => {
      render(<ChartPreview />);

      expect(screen.getByText('Configure your chart')).toBeInTheDocument();
      expect(screen.getByText(/select data source and chart type/i)).toBeInTheDocument();
    });

    it('should render loading state', () => {
      render(<ChartPreview isLoading={true} />);

      expect(screen.getByText('Loading chart...')).toBeInTheDocument();
      expect(screen.queryByTestId('echarts-mock')).not.toBeInTheDocument();
    });

    it('should render error state', () => {
      render(<ChartPreview error="Failed to load data" />);

      expect(screen.getByText('Chart configuration needs a small adjustment')).toBeInTheDocument();
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });

    it('should render chart with correct configuration', () => {
      render(<ChartPreview chartData={mockChartData} chartType="bar" />);

      const echartsElement = screen.getByTestId('echarts-mock');
      const renderedOption = JSON.parse(echartsElement.textContent!);

      expect(renderedOption.title.text).toBe('Test Chart');
      expect(renderedOption.series[0].type).toBe('bar');
      expect(renderedOption.series[0].data).toEqual([100, 200, 150]);
    });
  });

  describe('Chart Type Specific Configurations', () => {
    it('should render bar chart configuration', () => {
      const barData = {
        option: {
          xAxis: { type: 'category', data: ['A', 'B', 'C'] },
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data: [10, 20, 30] }],
        },
      };

      render(<ChartPreview chartData={barData} chartType="bar" />);

      const option = JSON.parse(screen.getByTestId('echarts-mock').textContent!);
      expect(option.xAxis.type).toBe('category');
      expect(option.series[0].type).toBe('bar');
    });

    it('should render line chart configuration', () => {
      const lineData = {
        option: {
          xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed'] },
          yAxis: { type: 'value' },
          series: [{ type: 'line', data: [120, 200, 150], smooth: true }],
        },
      };

      render(<ChartPreview chartData={lineData} chartType="line" />);

      const option = JSON.parse(screen.getByTestId('echarts-mock').textContent!);
      expect(option.series[0].type).toBe('line');
      expect(option.series[0].smooth).toBe(true);
    });

    it('should render pie chart configuration', () => {
      const pieData = {
        option: {
          series: [
            {
              type: 'pie',
              data: [
                { value: 100, name: 'Category A' },
                { value: 200, name: 'Category B' },
                { value: 150, name: 'Category C' },
              ],
            },
          ],
        },
      };

      render(<ChartPreview chartData={pieData} chartType="pie" />);

      const option = JSON.parse(screen.getByTestId('echarts-mock').textContent!);
      expect(option.series[0].type).toBe('pie');
      expect(option.series[0].data).toHaveLength(3);
      expect(option.series[0].data[0].name).toBe('Category A');
    });

    it('should render scatter plot configuration', () => {
      const scatterData = {
        option: {
          xAxis: { type: 'value' },
          yAxis: { type: 'value' },
          series: [
            {
              type: 'scatter',
              data: [
                [10, 20],
                [30, 40],
                [50, 60],
              ],
            },
          ],
        },
      };

      render(<ChartPreview chartData={scatterData} chartType="scatter" />);

      const option = JSON.parse(screen.getByTestId('echarts-mock').textContent!);
      expect(option.series[0].type).toBe('scatter');
      expect(option.xAxis.type).toBe('value');
      expect(option.yAxis.type).toBe('value');
    });

    it('should render area chart configuration', () => {
      const areaData = {
        option: {
          xAxis: { type: 'category', data: ['Q1', 'Q2', 'Q3', 'Q4'] },
          yAxis: { type: 'value' },
          series: [
            {
              type: 'line',
              areaStyle: {},
              data: [100, 200, 300, 250],
            },
          ],
        },
      };

      render(<ChartPreview chartData={areaData} chartType="area" />);

      const option = JSON.parse(screen.getByTestId('echarts-mock').textContent!);
      expect(option.series[0].type).toBe('line');
      expect(option.series[0].areaStyle).toBeDefined();
    });

    it('should render funnel chart configuration', () => {
      const funnelData = {
        option: {
          series: [
            {
              type: 'funnel',
              data: [
                { value: 100, name: 'Visitors' },
                { value: 80, name: 'Leads' },
                { value: 60, name: 'Qualified' },
                { value: 40, name: 'Customers' },
              ],
            },
          ],
        },
      };

      render(<ChartPreview chartData={funnelData} chartType="funnel" />);

      const option = JSON.parse(screen.getByTestId('echarts-mock').textContent!);
      expect(option.series[0].type).toBe('funnel');
      expect(option.series[0].data).toHaveLength(4);
    });

    it('should render gauge chart configuration', () => {
      const gaugeData = {
        option: {
          series: [
            {
              type: 'gauge',
              data: [{ value: 75, name: 'Performance' }],
              max: 100,
            },
          ],
        },
      };

      render(<ChartPreview chartData={gaugeData} chartType="gauge" />);

      const option = JSON.parse(screen.getByTestId('echarts-mock').textContent!);
      expect(option.series[0].type).toBe('gauge');
      expect(option.series[0].data[0].value).toBe(75);
      expect(option.series[0].max).toBe(100);
    });

    it('should render number chart configuration', () => {
      const numberData = {
        option: {
          series: [
            {
              type: 'gauge',
              startAngle: 90,
              endAngle: -270,
              pointer: { show: false },
              data: [{ value: 12345 }],
            },
          ],
        },
      };

      render(<ChartPreview chartData={numberData} chartType="number" />);

      const option = JSON.parse(screen.getByTestId('echarts-mock').textContent!);
      expect(option.series[0].pointer.show).toBe(false);
      expect(option.series[0].data[0].value).toBe(12345);
    });

    it('should render radar chart configuration', () => {
      const radarData = {
        option: {
          radar: {
            indicator: [
              { name: 'Sales', max: 100 },
              { name: 'Marketing', max: 100 },
              { name: 'Development', max: 100 },
              { name: 'Support', max: 100 },
            ],
          },
          series: [
            {
              type: 'radar',
              data: [{ value: [80, 90, 70, 85] }],
            },
          ],
        },
      };

      render(<ChartPreview chartData={radarData} chartType="radar" />);

      const option = JSON.parse(screen.getByTestId('echarts-mock').textContent!);
      expect(option.series[0].type).toBe('radar');
      expect(option.radar.indicator).toHaveLength(4);
    });
  });

  describe('Chart Enhancements', () => {
    it('should apply default chart enhancements', () => {
      const basicData = {
        option: {
          series: [{ type: 'bar', data: [1, 2, 3] }],
        },
      };

      render(<ChartPreview chartData={basicData} chartType="bar" />);

      const option = JSON.parse(screen.getByTestId('echarts-mock').textContent!);

      // Should have default tooltip
      expect(option.tooltip).toBeDefined();
      expect(option.tooltip.trigger).toBe('item');

      // Should have toolbox
      expect(option.toolbox).toBeDefined();
      expect(option.toolbox.feature.saveAsImage).toBeDefined();
    });

    it('should merge user config with defaults', () => {
      const dataWithUserConfig = {
        option: {
          title: { text: 'Custom Title' },
          tooltip: { trigger: 'axis' },
          series: [{ type: 'line', data: [1, 2, 3] }],
        },
      };

      render(<ChartPreview chartData={dataWithUserConfig} chartType="line" />);

      const option = JSON.parse(screen.getByTestId('echarts-mock').textContent!);

      // User config should be preserved
      expect(option.title.text).toBe('Custom Title');
      expect(option.tooltip.trigger).toBe('axis');

      // Defaults should still be added
      expect(option.toolbox).toBeDefined();
    });
  });

  describe('Responsive Behavior', () => {
    it('should render with responsive height', () => {
      render(<ChartPreview chartData={mockChartData} chartType="bar" />);

      const echartsElement = screen.getByTestId('echarts-mock');
      expect(echartsElement.style.height).toBe('400px');
      expect(echartsElement.style.width).toBe('100%');
    });

    it('should forward ref correctly', () => {
      const ref = React.createRef<any>();
      render(<ChartPreview chartData={mockChartData} chartType="bar" ref={ref} />);

      expect(ref.current).toBeDefined();
    });
  });

  describe('Sample Data Handling', () => {
    it('should handle sample data configuration', () => {
      const sampleData = {
        option: {
          xAxis: { data: ['Sample 1', 'Sample 2', 'Sample 3'] },
          yAxis: { type: 'value' },
          series: [
            {
              type: 'bar',
              data: [10, 20, 30],
              label: { show: true },
            },
          ],
        },
      };

      render(
        <ChartPreview chartData={sampleData} chartType="bar" config={{ useSampleData: true }} />
      );

      const option = JSON.parse(screen.getByTestId('echarts-mock').textContent!);
      expect(option.xAxis.data[0]).toBe('Sample 1');
      expect(option.series[0].label.show).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed chart data gracefully', () => {
      const malformedData = {
        option: null,
      };

      render(<ChartPreview chartData={malformedData as any} chartType="bar" />);

      // Should render empty state instead of crashing
      expect(screen.getByText('Configure your chart')).toBeInTheDocument();
    });

    it('should handle missing series data', () => {
      const incompleteData = {
        option: {
          xAxis: { data: ['A', 'B', 'C'] },
          yAxis: { type: 'value' },
          // Missing series
        },
      };

      render(<ChartPreview chartData={incompleteData} chartType="bar" />);

      const option = JSON.parse(screen.getByTestId('echarts-mock').textContent!);
      expect(option.series).toEqual([]);
    });
  });

  describe('Performance', () => {
    it('should memoize chart options', () => {
      const { rerender } = render(<ChartPreview chartData={mockChartData} chartType="bar" />);

      const firstRender = screen.getByTestId('echarts-mock').textContent;

      // Re-render with same props
      rerender(<ChartPreview chartData={mockChartData} chartType="bar" />);

      const secondRender = screen.getByTestId('echarts-mock').textContent;

      // Options should be identical (memoized)
      expect(firstRender).toBe(secondRender);
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate ARIA attributes', () => {
      render(<ChartPreview chartData={mockChartData} chartType="bar" />);

      const chartContainer = screen.getByTestId('echarts-mock').parentElement;
      expect(chartContainer).toHaveAttribute('role', 'img');
      expect(chartContainer).toHaveAttribute('aria-label', expect.stringContaining('chart'));
    });

    it('should announce loading state to screen readers', () => {
      render(<ChartPreview isLoading={true} />);

      const loadingElement = screen.getByText('Loading chart...');
      expect(loadingElement).toHaveAttribute('role', 'status');
      expect(loadingElement).toHaveAttribute('aria-live', 'polite');
    });

    it('should announce error state to screen readers', () => {
      render(<ChartPreview error="Connection failed" />);

      const errorElement = screen.getByText('Chart configuration needs a small adjustment');
      const container = errorElement.closest('[role="alert"]');
      expect(container).toBeInTheDocument();
    });
  });
});
