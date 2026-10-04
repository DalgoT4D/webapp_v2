import { getDefaultCustomizations } from '@/components/charts/chart-types/default-customizations';

describe('getDefaultCustomizations', () => {
  it('bar: create has no legend settings, edit adds paginated legend at top (differs between builders)', () => {
    expect(getDefaultCustomizations('bar', 'create')).toEqual({
      orientation: 'vertical',
      showDataLabels: false,
      dataLabelPosition: 'top',
      stacked: false,
      showTooltip: true,
      showLegend: true,
      xAxisTitle: '',
      yAxisTitle: '',
      xAxisLabelRotation: '45',
      yAxisLabelRotation: 'horizontal',
    });
    expect(getDefaultCustomizations('bar', 'edit')).toEqual({
      ...getDefaultCustomizations('bar', 'create'),
      legendDisplay: 'paginated',
      legendPosition: 'top',
    });
  });

  it('pie: create puts the legend right, edit puts it top (differs between builders)', () => {
    expect(getDefaultCustomizations('pie', 'create')).toEqual({
      chartStyle: 'donut',
      labelFormat: 'percentage',
      showDataLabels: true,
      dataLabelPosition: 'outside',
      showTooltip: true,
      showLegend: true,
      legendPosition: 'right',
    });
    expect(getDefaultCustomizations('pie', 'edit')).toEqual({
      chartStyle: 'donut',
      labelFormat: 'percentage',
      showDataLabels: true,
      dataLabelPosition: 'outside',
      showTooltip: true,
      showLegend: true,
      legendDisplay: 'paginated',
      legendPosition: 'top',
    });
  });

  it('line: edit adds paginated legend at top', () => {
    const create = getDefaultCustomizations('line', 'create');
    expect(create).toEqual({
      lineStyle: 'smooth',
      showDataPoints: true,
      showTooltip: true,
      showLegend: true,
      showDataLabels: false,
      dataLabelPosition: 'top',
      xAxisTitle: '',
      yAxisTitle: '',
      xAxisLabelRotation: 'horizontal',
      yAxisLabelRotation: 'horizontal',
    });
    expect(getDefaultCustomizations('line', 'edit')).toEqual({
      ...create,
      legendDisplay: 'paginated',
      legendPosition: 'top',
    });
  });

  it('number: decimalPlaces 0 in both builders (pinned: ratios render as integers)', () => {
    const expected = {
      numberSize: 'medium',
      subtitle: '',
      numberFormat: 'default',
      decimalPlaces: 0,
      numberPrefix: '',
      numberSuffix: '',
    };
    expect(getDefaultCustomizations('number', 'create')).toEqual(expected);
    expect(getDefaultCustomizations('number', 'edit')).toEqual(expected);
  });

  it('map: edit adds showLabels false', () => {
    const create = {
      colorScheme: 'Blues',
      showTooltip: true,
      showLegend: true,
      nullValueLabel: 'No Data',
      title: '',
    };
    expect(getDefaultCustomizations('map', 'create')).toEqual(create);
    expect(getDefaultCustomizations('map', 'edit')).toEqual({ ...create, showLabels: false });
  });

  it('pivot, table and unknown types', () => {
    expect(getDefaultCustomizations('pivot_table', 'create')).toEqual({
      numberFormat: 'default',
      decimalPlaces: 0,
    });
    expect(getDefaultCustomizations('pivot_table', 'edit')).toEqual({
      numberFormat: 'default',
      decimalPlaces: 0,
    });
    expect(getDefaultCustomizations('table', 'create')).toEqual({});
    expect(getDefaultCustomizations('table', 'edit')).toEqual({});
    expect(getDefaultCustomizations('sankey', 'edit')).toEqual({});
  });

  it('returns a fresh object each call (callers mutate it)', () => {
    const first = getDefaultCustomizations('bar', 'create');
    first.orientation = 'horizontal';
    expect(getDefaultCustomizations('bar', 'create').orientation).toBe('vertical');
  });
});
