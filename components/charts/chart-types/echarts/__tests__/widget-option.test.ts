import { buildChartWidgetOption } from '@/components/charts/chart-types/echarts/widget-option';

const lineConfig = () => ({
  title: { text: 'T' },
  legend: { show: true },
  xAxis: { name: 'Month', axisLabel: { rotate: 45 } },
  yAxis: { type: 'value' },
  series: [{ type: 'line', label: { fontSize: 10 } }, { type: 'line' }],
  tooltip: { trigger: 'axis' },
});

const build = (
  variant: 'builder' | 'view',
  baseConfig: Record<string, unknown> = lineConfig(),
  chartType = 'line'
) =>
  buildChartWidgetOption({
    baseConfig,
    chartType,
    customizations: {},
    containerSize: { width: 800, height: 400 },
    variant,
  });

describe('buildChartWidgetOption', () => {
  it('builder: HTML title, label and axis styling, default palette, tooltip box', () => {
    const option = build('builder');
    expect(option.title).toEqual({ text: 'T', show: false });
    expect('animation' in option).toBe(false);
    expect(option.series[0].label).toMatchObject({
      fontSize: 10.5,
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: 'normal',
    });
    expect(option.series[1].label.fontSize).toBe(12.5);
    expect(option.xAxis).toMatchObject({
      nameGap: 80,
      axisLabel: { rotate: 45, interval: 0, margin: 15, overflow: 'truncate', width: 100 },
    });
    expect(option.yAxis).toMatchObject({ nameGap: 15, axisLabel: { margin: 15 } });
    expect(option.color).toEqual([
      '#3b82f6',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#ec4899',
      '#14b8a6',
      '#f97316',
    ]);
    expect(option.grid.containLabel).toBe(true);
    expect(option.tooltip).toMatchObject({
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
    });
    expect(typeof option.tooltip.formatter).toBe('function');
  });

  it('view = builder + a 500ms cubicOut animation and the Inter textStyle (BUILDER-DRIFT)', () => {
    const view = build('view');
    const { animation, animationDuration, animationEasing, textStyle, ...rest } = view;
    expect({ animation, animationDuration, animationEasing, textStyle }).toEqual({
      animation: true,
      animationDuration: 500,
      animationEasing: 'cubicOut',
      textStyle: { fontFamily: 'Inter, system-ui, sans-serif' },
    });
    expect(JSON.stringify(rest)).toBe(JSON.stringify(build('builder')));
  });

  it('pie and number: no grid and no axes', () => {
    const pie = build('builder', lineConfig(), 'pie');
    expect(pie.grid).toBeUndefined();
    expect(pie.xAxis).toBeUndefined();
    expect(pie.yAxis).toBeUndefined();
  });

  it("keeps the chart's own colours; styles object-form series and axes", () => {
    const option = build('builder', {
      color: ['#000000'],
      xAxis: { axisLabel: {} },
      series: { type: 'line', label: { fontSize: 8 } },
    });
    expect(option.color).toEqual(['#000000']);
    expect(option.series.label.fontSize).toBe(8.5);
    expect(option.xAxis.nameGap).toBe(15);
    expect(option.xAxis.axisLabel.width).toBeUndefined();
  });

  it('no series and no axes stay undefined', () => {
    const option = build('builder', {});
    expect(option.series).toBeUndefined();
    expect(option.xAxis).toBeUndefined();
    expect(option.yAxis).toBeUndefined();
  });
});
