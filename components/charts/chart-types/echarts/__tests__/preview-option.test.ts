/**
 * Characterization tests for the ECharts option that ChartPreview hands to setOption.
 *
 * Snapshots were recorded (via a since-removed render harness capturing setOption's first
 * argument) against the inline option-building logic that used to live in ChartPreview's
 * initializeChart, before it was extracted to buildChartPreviewOption; they pin the exact output (including what every formatter
 * function returns for a fixed set of sample inputs) so the extraction is behavior-preserving.
 */

import { buildChartPreviewOption, type ChartPreviewOptionParams } from '../preview-option';

type BuildOptions = ChartPreviewOptionParams;

function buildOption(config: Record<string, any>, opts: BuildOptions): Record<string, any> {
  return buildChartPreviewOption(config, opts);
}

// Sample inputs fed to every formatter function found in the option
const FORMATTER_SAMPLES: unknown[] = [
  1234.5678,
  '2024-01-15',
  { value: 1234.5678, name: '2024-01-15', percent: 12.34, seriesName: 'Sales', dataIndex: 0 },
  { value: [1, 2], name: 'Cat A', percent: 50, seriesName: 'Sales', dataIndex: 1 },
  [
    {
      value: 1234.5678,
      name: '2024-01-15',
      axisValue: '2024-01-15',
      seriesName: 'Sales',
      marker: '*',
    },
    { value: 42, name: '2024-01-15', axisValue: '2024-01-15', seriesName: 'Cost', marker: '*' },
  ],
];

/** Replace every function in the option with the outputs it produces for FORMATTER_SAMPLES. */
function probe(value: unknown): unknown {
  if (typeof value === 'function') {
    return {
      __fn: FORMATTER_SAMPLES.map((sample) => {
        try {
          return value(sample);
        } catch (e) {
          return `threw: ${(e as Error).message}`;
        }
      }),
    };
  }
  if (Array.isArray(value)) return value.map(probe);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      out[key] = probe((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Records option + presence of keys that are explicitly set to undefined (lost by snapshots). */
function characterize(config: Record<string, any>, opts: BuildOptions = {}) {
  const input = JSON.parse(JSON.stringify(config));
  const option = buildOption(input, {
    chartType: opts.chartType,
    customizations: opts.customizations
      ? JSON.parse(JSON.stringify(opts.customizations))
      : undefined,
  });
  return {
    keys: Object.keys(option).sort(),
    option: probe(option),
  };
}

const barConfig = (extra: Record<string, any> = {}) => ({
  legend: { data: ['Sales', 'Cost'] },
  tooltip: { trigger: 'axis' },
  grid: { left: '3%' },
  xAxis: { type: 'category', name: 'Month', data: ['Jan', 'Feb', 'Mar'] },
  yAxis: { type: 'value', name: 'Amount' },
  series: [
    { type: 'bar', name: 'Sales', data: [1200.5, 3400.25, 560] },
    { type: 'bar', name: 'Cost', data: [800, 1200, 300], label: { show: true, fontSize: 10 } },
  ],
  ...extra,
});

describe('ChartPreview option building (characterization)', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  describe('bar charts: legend positions and rotated labels', () => {
    it.each(['top', 'bottom', 'left', 'right'])('legend %s', (legendPosition) => {
      expect(
        characterize(barConfig(), { chartType: 'bar', customizations: { legendPosition } })
      ).toMatchSnapshot();
      expect(logSpy).not.toHaveBeenCalled();
    });

    it.each(['top', 'bottom', 'left', 'right'])(
      'legend %s with rotated x labels and all-legend display',
      (legendPosition) => {
        const config = barConfig({
          xAxis: { type: 'category', data: ['Jan', 'Feb'], axisLabel: { rotate: 45 } },
        });
        expect(
          characterize(config, {
            chartType: 'bar',
            customizations: { legendPosition, legendDisplay: 'all' },
          })
        ).toMatchSnapshot();
      }
    );

    it('rotate: 0 counts as not rotated', () => {
      const config = barConfig({ xAxis: { type: 'category', axisLabel: { rotate: 0 } } });
      expect(characterize(config, { chartType: 'bar' })).toMatchSnapshot();
    });

    it('legend hidden (show: false)', () => {
      const config = barConfig({ legend: { show: false, data: ['Sales'] } });
      expect(
        characterize(config, { chartType: 'bar', customizations: { legendPosition: 'bottom' } })
      ).toMatchSnapshot();
    });

    it('missing legend', () => {
      const { legend: _legend, ...config } = barConfig();
      expect(
        characterize(config, { chartType: 'bar', customizations: { legendPosition: 'left' } })
      ).toMatchSnapshot();
    });

    it('number formatting on axes and data labels', () => {
      expect(
        characterize(barConfig(), {
          chartType: 'bar',
          customizations: {
            yAxisNumberFormat: 'indian',
            yAxisDecimalPlaces: 1,
            xAxisDateFormat: 'dd_mm_yyyy',
            showDataLabels: true,
            numberFormat: 'international',
            decimalPlaces: 2,
          },
        })
      ).toMatchSnapshot();
    });
  });

  describe('stacked bar', () => {
    it('stacked via customizations with data labels', () => {
      expect(
        characterize(barConfig(), {
          chartType: 'bar',
          customizations: { stacked: true, showDataLabels: true },
        })
      ).toMatchSnapshot();
    });

    it('stacked via series stack property', () => {
      const config = barConfig({
        series: [
          { type: 'bar', name: 'Sales', stack: 'total', data: [10, 20], label: { show: true } },
          { type: 'bar', name: 'Cost', stack: 'total', data: [5, 15] },
        ],
      });
      expect(characterize(config, { chartType: 'bar' })).toMatchSnapshot();
    });
  });

  describe('line chart', () => {
    it('line with formatting and date axis', () => {
      const config = barConfig({
        series: [{ type: 'line', name: 'Sales', data: [1, 2, 3] }],
        xAxis: { type: 'category', data: ['2024-01-01', '2024-02-01'] },
      });
      expect(
        characterize(config, {
          chartType: 'line',
          customizations: {
            legendPosition: 'right',
            yAxisNumberFormat: 'percentage',
            xAxisDateFormat: 'yyyy_mm_dd',
            showDataLabels: true,
          },
        })
      ).toMatchSnapshot();
    });
  });

  describe('pie chart', () => {
    const pieConfig = () => ({
      legend: { data: ['A', 'B'] },
      tooltip: { trigger: 'item' },
      grid: { left: '5%' },
      xAxis: { type: 'category' },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          data: [
            { name: 'A', value: 1234.5 },
            { name: 'B', value: 99 },
          ],
        },
      ],
    });

    it.each(['top', 'bottom', 'left', 'right'])('donut with legend %s', (legendPosition) => {
      expect(
        characterize(pieConfig(), {
          chartType: 'pie',
          customizations: { legendPosition, labelFormat: 'name_value', numberFormat: 'indian' },
        })
      ).toMatchSnapshot();
      expect(logSpy.mock.calls).toMatchSnapshot();
    });

    it('pie with date labels and hidden data labels', () => {
      expect(
        characterize(pieConfig(), {
          chartType: 'pie',
          customizations: { dateFormat: 'dd_mm_yyyy', showDataLabels: false },
        })
      ).toMatchSnapshot();
    });

    it('pie detected from series[0].type (no chartType prop)', () => {
      expect(characterize(pieConfig(), {})).toMatchSnapshot();
      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it('pie with object series (detected from series.type)', () => {
      const { series, ...rest } = pieConfig();
      expect(characterize({ ...rest, series: series[0] }, {})).toMatchSnapshot();
    });
  });

  describe('number / gauge chart', () => {
    const numberConfig = () => ({
      tooltip: {},
      xAxis: { type: 'category' },
      series: [
        {
          type: 'gauge',
          data: [{ value: 1234567.891, name: 'Total' }],
          detail: { fontSize: 30 },
        },
      ],
    });

    it('number chartType with prefix/suffix', () => {
      expect(
        characterize(numberConfig(), {
          chartType: 'number',
          customizations: {
            numberFormat: 'adaptive_international',
            decimalPlaces: 1,
            numberPrefix: '$',
            numberSuffix: ' total',
          },
        })
      ).toMatchSnapshot();
      expect(logSpy.mock.calls).toMatchSnapshot();
    });

    it('gauge detected from series[0].type', () => {
      expect(characterize(numberConfig(), {})).toMatchSnapshot();
      expect(logSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('array vs object series/xAxis/yAxis', () => {
    it('array axes with names and rotation', () => {
      const config = barConfig({
        xAxis: [
          { type: 'category', name: 'Month', axisLabel: { rotate: 30 } },
          { type: 'category' },
        ],
        yAxis: [{ type: 'value', name: 'Amount', axisLabel: { color: 'red' } }, { type: 'value' }],
      });
      expect(characterize(config, { chartType: 'bar' })).toMatchSnapshot();
    });

    it('object series, no axes, no tooltip, no grid', () => {
      const config = { series: { type: 'bar', name: 'Sales', data: [1, 2], label: {} } };
      expect(characterize(config, { chartType: 'bar' })).toMatchSnapshot();
    });

    it('no series at all', () => {
      const config = { xAxis: { type: 'category' }, yAxis: { type: 'value' } };
      expect(characterize(config, { chartType: 'bar' })).toMatchSnapshot();
    });
  });

  describe('chart type resolution and customization sources', () => {
    it('chartType prop wins over series[0].type', () => {
      const config = barConfig({ series: [{ type: 'line', data: [1, 2] }] });
      expect(characterize(config, { chartType: 'bar' })).toMatchSnapshot();
    });

    it('unknown type detected from series (scatter) gets default treatment', () => {
      const config = barConfig({ series: [{ type: 'scatter', data: [[1, 2]] }] });
      expect(characterize(config, {})).toMatchSnapshot();
    });

    it('customizations from config.extra_config.customizations', () => {
      const config = barConfig({
        extra_config: {
          customizations: { legendPosition: 'bottom', stacked: true, showDataLabels: true },
        },
      });
      expect(characterize(config, { chartType: 'bar' })).toMatchSnapshot();
    });

    it('customizations from config.customizations', () => {
      const config = barConfig({ customizations: { legendPosition: 'left' } });
      expect(characterize(config, { chartType: 'bar' })).toMatchSnapshot();
    });

    it('prop customizations win over config customizations', () => {
      const config = barConfig({ customizations: { legendPosition: 'left' } });
      expect(
        characterize(config, { chartType: 'bar', customizations: { legendPosition: 'right' } })
      ).toMatchSnapshot();
    });

    it('legend position falling back to config.legend', () => {
      const config = barConfig({ legend: { data: ['Sales'], orient: 'vertical', left: 'left' } });
      expect(characterize(config, { chartType: 'bar' })).toMatchSnapshot();
    });
  });
});
