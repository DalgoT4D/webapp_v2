/**
 * Tests for ChartPreview component
 * Tests ECharts rendering, TableChart rendering, loading states, and error handling
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChartPreview } from '../ChartPreview';
import * as echarts from 'echarts';

// Mock echarts
jest.mock('echarts', () => ({
  init: jest.fn(),
}));

// Mock TableChart component
jest.mock('../TableChart', () => ({
  TableChart: jest.fn(({ data, config, onSort, pagination }) => (
    <div data-testid="table-chart">
      <div data-testid="table-data">{JSON.stringify(data)}</div>
      <div data-testid="table-config">{JSON.stringify(config)}</div>
      {onSort && <div data-testid="table-has-sort">sortable</div>}
      {pagination && <div data-testid="table-has-pagination">paginated</div>}
    </div>
  )),
}));

describe('ChartPreview', () => {
  let mockChart: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockChart = {
      setOption: jest.fn(),
      dispose: jest.fn(),
      resize: jest.fn(),
    };
    (echarts.init as jest.Mock).mockReturnValue(mockChart);

    // Mock window.addEventListener
    window.addEventListener = jest.fn();
    window.removeEventListener = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('should render loading state', () => {
      const { container } = render(<ChartPreview isLoading={true} />);

      expect(screen.getByText('Loading chart...')).toBeInTheDocument();
      const loader = container.querySelector('.animate-spin');
      expect(loader).toBeInTheDocument();
      expect(loader).toHaveClass('lucide-loader-circle');
    });

    it('should not render chart during loading', () => {
      const config = { series: [{ type: 'bar', data: [1, 2, 3] }] };
      render(<ChartPreview config={config} isLoading={true} />);

      expect(echarts.init).not.toHaveBeenCalled();
    });

    it('should have minimum height for loading state', () => {
      const { container } = render(<ChartPreview isLoading={true} />);
      const loadingDiv = container.querySelector('.min-h-\\[300px\\]');
      expect(loadingDiv).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should render empty space for error', () => {
      const { container } = render(<ChartPreview error="Something went wrong" />);

      expect(container.querySelector('.w-full.h-full')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('should not initialize chart when error exists', () => {
      const config = { series: [{ type: 'bar', data: [1, 2, 3] }] };
      render(<ChartPreview config={config} error="Error occurred" />);

      expect(echarts.init).not.toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    it('should show configure message when no config provided', () => {
      render(<ChartPreview />);

      expect(screen.getByText('Configure your chart to see a preview')).toBeInTheDocument();
      expect(screen.getByText('Select data source and columns to get started')).toBeInTheDocument();
    });

    it('should not show configure message during loading', () => {
      render(<ChartPreview isLoading={true} />);

      expect(screen.queryByText('Configure your chart to see a preview')).not.toBeInTheDocument();
    });

    it('should not show configure message for table charts without config', () => {
      render(<ChartPreview chartType="table" />);

      expect(screen.queryByText('Configure your chart to see a preview')).not.toBeInTheDocument();
    });
  });

  describe('Chart Initialization', () => {
    it('should initialize ECharts instance', () => {
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        xAxis: { type: 'category', data: ['A', 'B', 'C'] },
        yAxis: { type: 'value' },
      };

      const { container } = render(<ChartPreview config={config} />);

      const chartDiv = container.querySelector('.w-full.h-full');
      expect(echarts.init).toHaveBeenCalledWith(chartDiv);
    });

    it('should call setOption with modified config', () => {
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        xAxis: { type: 'category', data: ['A', 'B', 'C'] },
        yAxis: { type: 'value' },
      };

      render(<ChartPreview config={config} />);

      expect(mockChart.setOption).toHaveBeenCalled();
      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig).toHaveProperty('series');
      expect(calledConfig).toHaveProperty('xAxis');
      expect(calledConfig).toHaveProperty('yAxis');
    });

    it('should dispose existing chart before creating new one', () => {
      const config = { series: [{ type: 'bar', data: [1, 2, 3] }] };
      const { rerender } = render(<ChartPreview config={config} />);

      expect(mockChart.dispose).not.toHaveBeenCalled();

      // Update with new config
      const newConfig = { series: [{ type: 'line', data: [4, 5, 6] }] };
      rerender(<ChartPreview config={newConfig} />);

      expect(mockChart.dispose).toHaveBeenCalled();
    });

    it('should dispose chart on unmount', () => {
      const config = { series: [{ type: 'bar', data: [1, 2, 3] }] };
      const { unmount } = render(<ChartPreview config={config} />);

      unmount();

      expect(mockChart.dispose).toHaveBeenCalled();
    });

    it('should call onChartReady callback', () => {
      const onChartReady = jest.fn();
      const config = { series: [{ type: 'bar', data: [1, 2, 3] }] };

      render(<ChartPreview config={config} onChartReady={onChartReady} />);

      expect(onChartReady).toHaveBeenCalledWith(mockChart);
    });
  });

  describe('Pie Chart Handling', () => {
    it('should detect pie chart from chartType prop', () => {
      const config = {
        series: [{ type: 'pie', data: [{ name: 'A', value: 10 }] }],
      };

      render(<ChartPreview config={config} chartType="pie" />);

      expect(mockChart.setOption).toHaveBeenCalled();
      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.xAxis).toBeUndefined();
      expect(calledConfig.yAxis).toBeUndefined();
      expect(calledConfig.grid).toBeUndefined();
    });

    it('should detect pie chart from series config', () => {
      const config = {
        series: [{ type: 'pie', data: [{ name: 'A', value: 10 }] }],
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.xAxis).toBeUndefined();
      expect(calledConfig.yAxis).toBeUndefined();
    });

    it('should handle array of series for pie chart detection', () => {
      const config = {
        series: [
          { type: 'pie', data: [{ name: 'A', value: 10 }] },
          { type: 'pie', data: [{ name: 'B', value: 20 }] },
        ],
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.xAxis).toBeUndefined();
    });
  });

  describe('Number Chart Handling', () => {
    it('should detect number chart type', () => {
      const config = {
        series: [{ type: 'gauge', data: [{ value: 75 }] }],
      };

      render(<ChartPreview config={config} chartType="number" />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.xAxis).toBeUndefined();
      expect(calledConfig.yAxis).toBeUndefined();
      expect(calledConfig.grid).toBeUndefined();
    });

    it('should detect gauge chart type', () => {
      const config = {
        series: [{ type: 'gauge', data: [{ value: 75 }] }],
      };

      render(<ChartPreview config={config} chartType="gauge" />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.xAxis).toBeUndefined();
    });
  });

  describe('Axis Configuration', () => {
    it('should configure grid with proper margins', () => {
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        xAxis: { type: 'category', data: ['A', 'B', 'C'] },
        yAxis: { type: 'value' },
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.grid).toBeDefined();
      expect(calledConfig.grid.containLabel).toBe(true);
      expect(calledConfig.grid.left).toBe('10%');
      expect(calledConfig.grid.right).toBe('6%');
    });

    it('should adjust bottom margin for rotated x-axis labels', () => {
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        xAxis: {
          type: 'category',
          data: ['A', 'B', 'C'],
          axisLabel: { rotate: 45 },
        },
        yAxis: { type: 'value' },
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.grid.bottom).toBe('18%');
    });

    it('should use normal bottom margin for non-rotated labels', () => {
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        xAxis: { type: 'category', data: ['A', 'B', 'C'], axisLabel: { rotate: 0 } },
        yAxis: { type: 'value' },
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.grid.bottom).toBe('16%');
    });

    it('should adjust top margin when legend is shown', () => {
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        xAxis: { type: 'category' },
        yAxis: { type: 'value' },
        legend: { show: true },
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.grid.top).toBe('18%');
    });

    it('should use smaller top margin when no legend', () => {
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        xAxis: { type: 'category' },
        yAxis: { type: 'value' },
        legend: { show: false },
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.grid.top).toBe('10%');
    });

    it('should configure x-axis with proper styling', () => {
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        xAxis: { type: 'category', name: 'Category', data: ['A', 'B', 'C'] },
        yAxis: { type: 'value' },
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.xAxis.nameGap).toBe(80);
      expect(calledConfig.xAxis.nameTextStyle).toBeDefined();
      expect(calledConfig.xAxis.nameTextStyle.fontSize).toBe(14);
      expect(calledConfig.xAxis.axisLabel.interval).toBe(0);
      expect(calledConfig.xAxis.axisLabel.margin).toBe(15);
    });

    it('should configure y-axis with proper styling', () => {
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        xAxis: { type: 'category' },
        yAxis: { type: 'value', name: 'Value' },
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.yAxis.nameGap).toBe(100);
      expect(calledConfig.yAxis.nameTextStyle).toBeDefined();
      expect(calledConfig.yAxis.nameTextStyle.fontSize).toBe(14);
      expect(calledConfig.yAxis.axisLabel.margin).toBe(15);
    });

    it('should handle array of xAxis', () => {
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        xAxis: [
          { type: 'category', name: 'X1' },
          { type: 'category', name: 'X2' },
        ],
        yAxis: { type: 'value' },
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(Array.isArray(calledConfig.xAxis)).toBe(true);
      expect(calledConfig.xAxis[0].nameGap).toBe(80);
      expect(calledConfig.xAxis[1].nameGap).toBe(80);
    });

    it('should handle array of yAxis', () => {
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        xAxis: { type: 'category' },
        yAxis: [
          { type: 'value', name: 'Y1' },
          { type: 'value', name: 'Y2' },
        ],
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(Array.isArray(calledConfig.yAxis)).toBe(true);
      expect(calledConfig.yAxis[0].nameGap).toBe(100);
      expect(calledConfig.yAxis[1].nameGap).toBe(100);
    });
  });

  describe('Legend Configuration', () => {
    it('should configure legend with proper positioning', () => {
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        legend: { data: ['Series 1'] },
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.legend.top).toBe('5%');
      expect(calledConfig.legend.left).toBe('center');
      expect(calledConfig.legend.orient).toBe('horizontal');
    });

    it('should preserve custom legend orient', () => {
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        legend: { data: ['Series 1'], orient: 'vertical' },
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.legend.orient).toBe('vertical');
    });
  });

  describe('Series Configuration', () => {
    it('should enhance data labels for single series', () => {
      const config = {
        series: {
          type: 'bar',
          data: [1, 2, 3],
          label: { show: true, fontSize: 10 },
        },
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.series.label.fontSize).toBe(10.5);
      expect(calledConfig.series.label.fontFamily).toBe('Inter, system-ui, sans-serif');
    });

    it('should enhance data labels for array of series', () => {
      const config = {
        series: [
          { type: 'bar', data: [1, 2, 3], label: { fontSize: 12 } },
          { type: 'line', data: [4, 5, 6], label: { fontSize: 14 } },
        ],
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.series[0].label.fontSize).toBe(12.5);
      expect(calledConfig.series[1].label.fontSize).toBe(14.5);
    });

    it('should use default font size when not specified', () => {
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3], label: {} }],
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.series[0].label.fontSize).toBe(12.5);
    });
  });

  describe('Tooltip Configuration', () => {
    it('should configure tooltip with enhanced styling', () => {
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.tooltip.backgroundColor).toBe('rgba(255, 255, 255, 0.95)');
      expect(calledConfig.tooltip.borderColor).toBe('#e5e7eb');
      expect(calledConfig.tooltip.textStyle.fontSize).toBe(12);
    });

    it('should have custom tooltip formatter', () => {
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(typeof calledConfig.tooltip.formatter).toBe('function');
    });
  });

  describe('Resize Handling', () => {
    it('should add resize event listener', () => {
      const config = { series: [{ type: 'bar', data: [1, 2, 3] }] };
      render(<ChartPreview config={config} />);

      expect(window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('should remove resize event listener on unmount', () => {
      const config = { series: [{ type: 'bar', data: [1, 2, 3] }] };
      const { unmount } = render(<ChartPreview config={config} />);

      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('should call chart resize on window resize', () => {
      const config = { series: [{ type: 'bar', data: [1, 2, 3] }] };
      render(<ChartPreview config={config} />);

      // Get the resize handler
      const resizeHandler = (window.addEventListener as jest.Mock).mock.calls.find(
        (call) => call[0] === 'resize'
      )?.[1];

      // Simulate resize
      if (resizeHandler) {
        resizeHandler();
        expect(mockChart.resize).toHaveBeenCalled();
      }
    });
  });

  describe('Table Chart Rendering', () => {
    it('should render TableChart for table chartType', () => {
      const config = { columns: ['name', 'age'] };
      const tableData = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ];

      render(<ChartPreview config={config} chartType="table" tableData={tableData} />);

      expect(screen.getByTestId('table-chart')).toBeInTheDocument();
    });

    it('should pass table data to TableChart', () => {
      const tableData = [{ name: 'John' }];
      render(<ChartPreview chartType="table" tableData={tableData} />);

      expect(screen.getByTestId('table-data')).toHaveTextContent(JSON.stringify(tableData));
    });

    it('should pass config to TableChart', () => {
      const config = { columns: ['name'] };
      render(<ChartPreview chartType="table" config={config} />);

      expect(screen.getByTestId('table-config')).toHaveTextContent(JSON.stringify(config));
    });

    it('should pass onTableSort handler', () => {
      const onTableSort = jest.fn();
      render(<ChartPreview chartType="table" onTableSort={onTableSort} />);

      expect(screen.getByTestId('table-has-sort')).toBeInTheDocument();
    });

    it('should pass pagination props', () => {
      const tablePagination = {
        page: 1,
        pageSize: 10,
        total: 100,
        onPageChange: jest.fn(),
      };

      render(<ChartPreview chartType="table" tablePagination={tablePagination} />);

      expect(screen.getByTestId('table-has-pagination')).toBeInTheDocument();
    });

    it('should not initialize echarts for table charts', () => {
      render(<ChartPreview chartType="table" />);

      expect(echarts.init).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined config gracefully', () => {
      render(<ChartPreview config={undefined} />);

      expect(echarts.init).not.toHaveBeenCalled();
    });

    it('should handle null config', () => {
      render(<ChartPreview config={null as any} />);

      expect(echarts.init).not.toHaveBeenCalled();
    });

    it('should handle config without series', () => {
      const config = { xAxis: { type: 'category' } };
      render(<ChartPreview config={config} />);

      expect(echarts.init).toHaveBeenCalled();
    });

    it('should handle empty series array', () => {
      const config = { series: [] };
      render(<ChartPreview config={config} />);

      expect(mockChart.setOption).toHaveBeenCalled();
    });

    it('should not crash with missing chartRef', () => {
      const config = { series: [{ type: 'bar', data: [] }] };

      // This should not throw
      expect(() => render(<ChartPreview config={config} />)).not.toThrow();
    });
  });

  describe('Console Logging', () => {
    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      (console.log as jest.Mock).mockRestore();
      (console.error as jest.Mock).mockRestore();
    });

    it('should log debug info for pie charts', () => {
      const config = {
        series: [{ type: 'pie', data: [{ name: 'A', value: 10 }] }],
      };

      render(<ChartPreview config={config} chartType="pie" />);

      expect(console.log).toHaveBeenCalledWith(
        'ChartPreview - Final config for pie/number chart:',
        expect.any(Object)
      );
    });

    it('should log debug info for number charts', () => {
      const config = {
        series: [{ type: 'gauge', data: [{ value: 75 }] }],
      };

      render(<ChartPreview config={config} chartType="number" />);

      expect(console.log).toHaveBeenCalledWith(
        'ChartPreview - Final config for pie/number chart:',
        expect.any(Object)
      );
    });

    it('should log error when chart initialization fails', () => {
      (echarts.init as jest.Mock).mockImplementation(() => {
        throw new Error('Init failed');
      });

      const config = { series: [{ type: 'bar', data: [1, 2, 3] }] };
      render(<ChartPreview config={config} />);

      expect(console.error).toHaveBeenCalledWith('Error initializing chart:', expect.any(Error));
    });
  });
});
