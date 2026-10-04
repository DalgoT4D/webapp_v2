import {
  applyLegendPosition,
  extractLegendPosition,
  getLegendConfig,
  getPieSeriesPosition,
  isLegendPaginated,
} from '@/components/charts/chart-types/echarts/legend';

describe('getLegendConfig', () => {
  it('hidden legend is returned untouched', () => {
    const hidden = { show: false, top: '1%' };
    expect(getLegendConfig('bottom', hidden)).toBe(hidden);
  });

  it('places the legend and drops old position keys', () => {
    expect(getLegendConfig('bottom', { top: '1%', data: ['a'] })).toEqual({
      data: ['a'],
      show: true,
      type: 'scroll',
      orient: 'horizontal',
      bottom: '3%',
      left: 'center',
    });
    expect(getLegendConfig('right', {}, false)).toEqual({
      show: true,
      type: 'plain',
      orient: 'vertical',
      right: '3%',
      top: 'center',
    });
    expect(getLegendConfig(undefined)).toMatchObject({
      orient: 'horizontal',
      top: '3%',
      left: 'center',
    });
  });
});

describe('getPieSeriesPosition', () => {
  it('moves the pie away from the legend', () => {
    expect(getPieSeriesPosition('bottom')).toEqual({
      center: ['50%', '42%'],
      radius: ['40%', '65%'],
    });
    expect(getPieSeriesPosition('left', false)).toEqual({
      center: ['58%', '50%'],
      radius: ['0%', '60%'],
    });
    expect(getPieSeriesPosition(undefined)).toEqual({
      center: ['50%', '55%'],
      radius: ['40%', '65%'],
    });
  });
});

describe('applyLegendPosition', () => {
  it('no legend → same config', () => {
    const config = { series: [] };
    expect(applyLegendPosition(config, 'top')).toBe(config);
  });

  it('pie: donut detected from the inner radius', () => {
    const config = {
      legend: {},
      series: [{ type: 'pie', radius: ['30%', '70%'] }, { type: 'bar' }],
    };
    const out = applyLegendPosition(config, 'right', true, 'pie');
    expect(out.series[0]).toEqual({ type: 'pie', radius: ['40%', '60%'], center: ['42%', '50%'] });
    expect(out.series[1]).toEqual({ type: 'bar' });
    const flat = applyLegendPosition(
      { legend: {}, series: { type: 'pie', radius: ['0%', '70%'] } },
      'top',
      true,
      'pie'
    );
    expect(flat.series.radius).toEqual(['0%', '65%']);
  });
});

describe('extractLegendPosition / isLegendPaginated', () => {
  it('customizations first, then the config, default right', () => {
    expect(extractLegendPosition({ legendPosition: 'top' })).toBe('top');
    expect(extractLegendPosition({}, { legend: { bottom: 0 } })).toBe('bottom');
    expect(extractLegendPosition({}, { legend: { left: 'center' } })).toBe('right');
    expect(extractLegendPosition({}, { legend: { left: 10 } })).toBe('left');
    expect(extractLegendPosition()).toBe('right');
  });

  it('paginated unless legendDisplay is "all" (pinned: "all" drops legendPosition on bar/line)', () => {
    expect(isLegendPaginated({ legendDisplay: 'all' })).toBe(false);
    expect(isLegendPaginated({ legendDisplay: 'paginated' })).toBe(true);
    expect(isLegendPaginated()).toBe(true);
  });
});
