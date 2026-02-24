/**
 * Tests for ChartPreview component
 * Consolidated tests for ECharts rendering, TableChart rendering, states, and configuration
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

    window.addEventListener = jest.fn();
    window.removeEventListener = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Component States', () => {
    it.each([
      ['loading', { isLoading: true }, 'Loading chart...', true],
      ['error', { error: 'Something went wrong' }, null, false],
      ['empty', {}, 'Configure your chart to see a preview', false],
    ])('should render %s state correctly', (state, props, expectedText, shouldShowLoader) => {
      const { container } = render(<ChartPreview {...props} />);

      if (expectedText) {
        expect(screen.getByText(expectedText)).toBeInTheDocument();
      }
      if (shouldShowLoader) {
        const loader = container.querySelector('.animate-spin');
        expect(loader).toBeInTheDocument();
      }
      expect(echarts.init).not.toHaveBeenCalled();
    });

    it('should not render chart during loading', () => {
      const config = { series: [{ type: 'bar', data: [1, 2, 3] }] };
      render(<ChartPreview config={config} isLoading={true} />);

      expect(echarts.init).not.toHaveBeenCalled();
    });

    it('should not show configure message for table charts without config', () => {
      render(<ChartPreview chartType="table" />);

      expect(screen.queryByText('Configure your chart to see a preview')).not.toBeInTheDocument();
    });
  });

  describe('Chart Initialization and Lifecycle', () => {
    it('should initialize ECharts instance and call setOption', () => {
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        xAxis: { type: 'category', data: ['A', 'B', 'C'] },
        yAxis: { type: 'value' },
      };

      const { container } = render(<ChartPreview config={config} />);

      const chartDiv = container.querySelector('.w-full.h-full');
      expect(echarts.init).toHaveBeenCalledWith(chartDiv);
      expect(mockChart.setOption).toHaveBeenCalled();

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig).toHaveProperty('series');
      expect(calledConfig).toHaveProperty('xAxis');
      expect(calledConfig).toHaveProperty('yAxis');
    });

    it('should dispose and recreate chart on config change', () => {
      const config = { series: [{ type: 'bar', data: [1, 2, 3] }] };
      const { rerender } = render(<ChartPreview config={config} />);

      expect(mockChart.dispose).not.toHaveBeenCalled();

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

  describe('Chart Type Detection', () => {
    it.each([
      [
        'pie from chartType',
        'pie',
        { series: [{ type: 'pie', data: [{ name: 'A', value: 10 }] }] },
      ],
      [
        'pie from series',
        undefined,
        { series: [{ type: 'pie', data: [{ name: 'A', value: 10 }] }] },
      ],
      ['number', 'number', { series: [{ type: 'gauge', data: [{ value: 75 }] }] }],
      ['gauge', 'gauge', { series: [{ type: 'gauge', data: [{ value: 75 }] }] }],
    ])('should detect %s chart and exclude axes', (desc, chartType, config) => {
      render(<ChartPreview config={config} chartType={chartType as any} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.xAxis).toBeUndefined();
      expect(calledConfig.yAxis).toBeUndefined();
      expect(calledConfig.grid).toBeUndefined();
    });

    it('should handle array of pie series', () => {
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

  describe('Axis and Grid Configuration', () => {
    it.each([
      ['rotated x-axis labels', { xAxis: { axisLabel: { rotate: 45 } } }, '18%'],
      ['non-rotated labels', { xAxis: { axisLabel: { rotate: 0 } } }, '16%'],
    ])('should adjust bottom margin for %s', (desc, config, expectedBottom) => {
      const fullConfig = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        xAxis: { type: 'category', ...config.xAxis },
        yAxis: { type: 'value' },
      };

      render(<ChartPreview config={fullConfig} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.grid.bottom).toBe(expectedBottom);
    });

    it.each([
      // Default legend position is 'right', so top margin is '10%' regardless of legend visibility
      ['with legend (right position)', { legend: { show: true } }, '10%'],
      ['without legend', { legend: { show: false } }, '10%'],
      // With top legend position via customizations, top margin should be '18%'
    ])('should adjust top margin %s', (desc, config, expectedTop) => {
      const fullConfig = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        xAxis: { type: 'category' },
        yAxis: { type: 'value' },
        ...config,
      };

      render(<ChartPreview config={fullConfig} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.grid.top).toBe(expectedTop);
    });

    it('should configure grid with proper margins and contain labels', () => {
      // Default legend position is 'right', so right margin is '15%' to accommodate legend
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        xAxis: { type: 'category', data: ['A', 'B', 'C'] },
        yAxis: { type: 'value' },
        legend: { show: true },
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.grid).toBeDefined();
      expect(calledConfig.grid.containLabel).toBe(true);
      expect(calledConfig.grid.left).toBe('10%');
      expect(calledConfig.grid.right).toBe('15%'); // Right margin increased for right-positioned legend
    });

    it.each([
      ['xAxis', { xAxis: [{ name: 'X1' }, { name: 'X2' }] }, 'xAxis', 80],
      ['yAxis', { yAxis: [{ name: 'Y1' }, { name: 'Y2' }] }, 'yAxis', 100],
    ])('should handle array of %s', (name, config, axis, expectedGap) => {
      const fullConfig = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        xAxis: { type: 'category' },
        yAxis: { type: 'value' },
        ...config,
      };

      render(<ChartPreview config={fullConfig} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(Array.isArray(calledConfig[axis])).toBe(true);
      expect(calledConfig[axis][0].nameGap).toBe(expectedGap);
    });

    it('should configure axes with proper styling', () => {
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        xAxis: { type: 'category', name: 'Category' },
        yAxis: { type: 'value', name: 'Value' },
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.xAxis.nameGap).toBe(80);
      expect(calledConfig.xAxis.nameTextStyle.fontSize).toBe(14);
      expect(calledConfig.xAxis.axisLabel.interval).toBe(0);
      expect(calledConfig.xAxis.axisLabel.margin).toBe(15);

      expect(calledConfig.yAxis.nameGap).toBe(100);
      expect(calledConfig.yAxis.nameTextStyle.fontSize).toBe(14);
      expect(calledConfig.yAxis.axisLabel.margin).toBe(15);
    });
  });

  describe('Legend and Series Configuration', () => {
    it('should configure legend with proper positioning (default: right)', () => {
      // Default legend position is 'right', so legend should be on the right side
      const config = {
        series: [{ type: 'bar', data: [1, 2, 3] }],
        legend: { data: ['Series 1'] },
      };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      // With default 'right' position: top='center', right='3%', orient='vertical'
      expect(calledConfig.legend.top).toBe('center');
      expect(calledConfig.legend.right).toBe('3%');
      expect(calledConfig.legend.orient).toBe('vertical');
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

    it.each([
      ['single series', { type: 'bar', data: [1, 2, 3], label: { show: true, fontSize: 10 } }],
      [
        'array of series',
        [
          { type: 'bar', data: [1, 2, 3], label: { fontSize: 12 } },
          { type: 'line', data: [4, 5, 6], label: { fontSize: 14 } },
        ],
      ],
    ])('should enhance data labels for %s', (desc, series) => {
      const config = { series };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      if (Array.isArray(series)) {
        expect(calledConfig.series[0].label.fontSize).toBe(12.5);
        expect(calledConfig.series[1].label.fontSize).toBe(14.5);
      } else {
        expect(calledConfig.series.label.fontSize).toBe(10.5);
        expect(calledConfig.series.label.fontFamily).toBe('Inter, system-ui, sans-serif');
      }
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

  describe('Tooltip and Resize Handling', () => {
    it('should configure tooltip with enhanced styling', () => {
      const config = { series: [{ type: 'bar', data: [1, 2, 3] }] };

      render(<ChartPreview config={config} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.tooltip.backgroundColor).toBe('rgba(255, 255, 255, 0.95)');
      expect(calledConfig.tooltip.borderColor).toBe('#e5e7eb');
      expect(calledConfig.tooltip.textStyle.fontSize).toBe(12);
      expect(typeof calledConfig.tooltip.formatter).toBe('function');
    });

    it('should add and remove resize event listener', () => {
      const config = { series: [{ type: 'bar', data: [1, 2, 3] }] };
      const { unmount } = render(<ChartPreview config={config} />);

      expect(window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));

      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('should call chart resize on window resize', () => {
      const config = { series: [{ type: 'bar', data: [1, 2, 3] }] };
      render(<ChartPreview config={config} />);

      const resizeHandler = (window.addEventListener as jest.Mock).mock.calls.find(
        (call) => call[0] === 'resize'
      )?.[1];

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
      expect(echarts.init).not.toHaveBeenCalled();
    });

    it.each([
      ['data', { tableData: [{ name: 'John' }] }, 'table-data'],
      ['config', { config: { columns: ['name'] } }, 'table-config'],
      ['sort handler', { onTableSort: jest.fn() }, 'table-has-sort'],
      [
        'pagination',
        { tablePagination: { page: 1, pageSize: 10, total: 100, onPageChange: jest.fn() } },
        'table-has-pagination',
      ],
    ])('should pass %s to TableChart', (desc, props, testId) => {
      render(<ChartPreview chartType="table" {...props} />);

      expect(screen.getByTestId(testId)).toBeInTheDocument();
    });

    it('should merge columnFormatting from customizations into table config', () => {
      const customizations = {
        columnFormatting: {
          salary: { numberFormat: 'indian', precision: 2 },
          revenue: { numberFormat: 'international', precision: 0 },
        },
      };

      render(
        <ChartPreview
          chartType="table"
          config={{ table_columns: ['name', 'salary', 'revenue'] }}
          customizations={customizations}
        />
      );

      const configEl = screen.getByTestId('table-config');
      const passedConfig = JSON.parse(configEl.textContent || '{}');
      expect(passedConfig.column_formatting).toEqual(customizations.columnFormatting);
    });
  });

  describe('Edge Cases', () => {
    it.each([
      ['undefined config', undefined],
      ['null config', null],
      ['config without series', { xAxis: { type: 'category' } }],
      ['empty series array', { series: [] }],
    ])('should handle %s gracefully', (desc, config) => {
      expect(() => render(<ChartPreview config={config as any} />)).not.toThrow();

      if (config && (config as any).xAxis) {
        expect(echarts.init).toHaveBeenCalled();
      }
    });
  });

  describe('Number Chart Formatting', () => {
    const gaugeConfig = { series: [{ type: 'gauge', data: [{ value: 1000000 }] }] };

    it.each([
      ['indian format', { numberFormat: 'indian' }, 1000000, '10,00,000'],
      ['international format', { numberFormat: 'international' }, 1000000, '1,000,000'],
      [
        'with prefix/suffix',
        { numberFormat: 'international', numberPrefix: '$', numberSuffix: 'K' },
        1000,
        '$1,000K',
      ],
      ['with decimal places', { numberFormat: 'default', decimalPlaces: 2 }, 1234.567, '1234.57'],
    ])('should apply %s', (_, customizations, inputValue, expected) => {
      render(
        <ChartPreview config={gaugeConfig} chartType="number" customizations={customizations} />
      );
      const formatter = mockChart.setOption.mock.calls[0][0].series[0].detail.formatter;
      expect(formatter(inputValue)).toBe(expected);
    });

    it('should use default format when not specified', () => {
      render(<ChartPreview config={gaugeConfig} chartType="number" />);
      const formatter = mockChart.setOption.mock.calls[0][0].series[0].detail.formatter;
      expect(formatter(1234567)).toBe('1234567');
    });

    it.each([
      ['small (32px)', 'small', 32],
      ['medium (48px)', 'medium', 48],
      ['large (64px)', 'large', 64],
      ['default/medium (48px)', undefined, 48],
    ])('should apply %s number size', (_, numberSize, expectedFontSize) => {
      render(
        <ChartPreview
          config={gaugeConfig}
          chartType="number"
          customizations={numberSize ? { numberSize } : {}}
        />
      );
      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.series[0].detail.fontSize).toBe(expectedFontSize);
    });

    it('should call setOption with notMerge: true for clean updates', () => {
      render(<ChartPreview config={gaugeConfig} chartType="number" />);
      expect(mockChart.setOption).toHaveBeenCalledWith(expect.any(Object), { notMerge: true });
    });
  });

  describe('Pie Chart Label Configuration', () => {
    const pieConfig = { series: [{ type: 'pie', data: [{ name: 'A', value: 100 }] }] };

    it('should show labels by default (showDataLabels not set)', () => {
      render(<ChartPreview config={pieConfig} chartType="pie" />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.series[0].label.show).toBe(true);
    });

    it('should hide labels when showDataLabels is false', () => {
      render(
        <ChartPreview
          config={pieConfig}
          chartType="pie"
          customizations={{ showDataLabels: false }}
        />
      );

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.series[0].label.show).toBe(false);
    });

    it.each([
      ['outside', 'outside', 'outside'],
      ['inside', 'inside', 'inside'],
      ['default (outside)', undefined, 'outside'],
    ])('should set label position to %s', (_, position, expected) => {
      render(
        <ChartPreview
          config={pieConfig}
          chartType="pie"
          customizations={{ dataLabelPosition: position }}
        />
      );

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.series[0].label.position).toBe(expected);
    });

    it.each([
      ['percentage', 'percentage', { name: 'A', value: 100, percent: 50 }, '50%'],
      ['value', 'value', { name: 'A', value: 1000, percent: 50 }, '1,000'],
      ['name_percentage', 'name_percentage', { name: 'A', value: 100, percent: 50 }, 'A\n50%'],
      ['name_value', 'name_value', { name: 'A', value: 1000, percent: 50 }, 'A\n1,000'],
    ])('should format label as %s', (_, labelFormat, params, expected) => {
      render(<ChartPreview config={pieConfig} chartType="pie" customizations={{ labelFormat }} />);

      const formatter = mockChart.setOption.mock.calls[0][0].series[0].label.formatter;
      expect(formatter(params)).toBe(expected);
    });

    it('should apply number formatting to value labels', () => {
      render(
        <ChartPreview
          config={pieConfig}
          chartType="pie"
          customizations={{ labelFormat: 'value', numberFormat: 'indian' }}
        />
      );

      const formatter = mockChart.setOption.mock.calls[0][0].series[0].label.formatter;
      expect(formatter({ name: 'A', value: 1000000, percent: 50 })).toBe('10,00,000');
    });

    it('should not format non-number values', () => {
      render(
        <ChartPreview
          config={pieConfig}
          chartType="pie"
          customizations={{ labelFormat: 'value' }}
        />
      );

      const formatter = mockChart.setOption.mock.calls[0][0].series[0].label.formatter;
      expect(formatter({ name: 'A', value: 'text', percent: 50 })).toBe('text');
    });
  });

  describe('Line Chart Number Formatting', () => {
    const lineConfig = {
      series: [{ type: 'line', data: [100, 200, 300] }],
      yAxis: { type: 'value' },
      xAxis: { type: 'category', data: ['A', 'B', 'C'] },
    };

    it('should not apply Y-axis formatter when yAxisNumberFormat is default', () => {
      render(<ChartPreview config={lineConfig} chartType="line" customizations={{}} />);

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      // Y-axis should not have a custom formatter when format is default
      expect(calledConfig.yAxis.axisLabel.formatter).toBeUndefined();
    });

    it('should apply Y-axis formatter when yAxisNumberFormat is set', () => {
      render(
        <ChartPreview
          config={lineConfig}
          chartType="line"
          customizations={{ yAxisNumberFormat: 'indian' }}
        />
      );

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.yAxis.axisLabel.formatter).toBeDefined();
      expect(calledConfig.yAxis.axisLabel.formatter(1234567)).toBe('12,34,567');
    });

    it('should apply X-axis formatter when xAxisNumberFormat is set', () => {
      const numericXAxisConfig = {
        ...lineConfig,
        xAxis: { type: 'value', data: [1000, 2000, 3000] },
      };

      render(
        <ChartPreview
          config={numericXAxisConfig}
          chartType="line"
          customizations={{ xAxisNumberFormat: 'international' }}
        />
      );

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.xAxis.axisLabel.formatter).toBeDefined();
      expect(calledConfig.xAxis.axisLabel.formatter(1234567)).toBe('1,234,567');
    });

    it('should apply data label formatter when showDataLabels is true', () => {
      render(
        <ChartPreview
          config={lineConfig}
          chartType="line"
          customizations={{ yAxisNumberFormat: 'international', showDataLabels: true }}
        />
      );

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      const labelFormatter = calledConfig.series[0].label.formatter;
      expect(labelFormatter).toBeDefined();
      expect(labelFormatter({ value: 1234567 })).toBe('1,234,567');
    });

    it('should apply Y-axis decimal places to formatted numbers', () => {
      render(
        <ChartPreview
          config={lineConfig}
          chartType="line"
          customizations={{ yAxisNumberFormat: 'international', yAxisDecimalPlaces: 2 }}
        />
      );

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.yAxis.axisLabel.formatter(1234.5)).toBe('1,234.50');
    });

    it('should format X-axis and Y-axis independently', () => {
      const numericXAxisConfig = {
        ...lineConfig,
        xAxis: { type: 'value' },
      };

      render(
        <ChartPreview
          config={numericXAxisConfig}
          chartType="line"
          customizations={{
            yAxisNumberFormat: 'indian',
            xAxisNumberFormat: 'international',
          }}
        />
      );

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(calledConfig.yAxis.axisLabel.formatter(1234567)).toBe('12,34,567');
      expect(calledConfig.xAxis.axisLabel.formatter(1234567)).toBe('1,234,567');
    });

    it('should handle array yAxis configuration', () => {
      const multiAxisConfig = {
        ...lineConfig,
        yAxis: [{ type: 'value' }, { type: 'value' }],
      };

      render(
        <ChartPreview
          config={multiAxisConfig}
          chartType="line"
          customizations={{ yAxisNumberFormat: 'indian' }}
        />
      );

      const calledConfig = mockChart.setOption.mock.calls[0][0];
      expect(Array.isArray(calledConfig.yAxis)).toBe(true);
      expect(calledConfig.yAxis[0].axisLabel.formatter).toBeDefined();
      expect(calledConfig.yAxis[1].axisLabel.formatter).toBeDefined();
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

    it.each([
      ['pie', 'pie', { series: [{ type: 'pie', data: [{ name: 'A', value: 10 }] }] }],
      ['number', 'number', { series: [{ type: 'gauge', data: [{ value: 75 }] }] }],
    ])('should log debug info for %s charts', (name, chartType, config) => {
      render(<ChartPreview config={config} chartType={chartType as any} />);

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
