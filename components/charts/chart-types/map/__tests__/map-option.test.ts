import {
  buildMapChartOption,
  computeResponsiveMapOptions,
  getMapLayoutSize,
  MAP_SCHEME_BASE_COLORS,
} from '../map-option';

const base = {
  mapName: 'm',
  mapData: [
    { name: 'A', value: 1 },
    { name: 'B', value: 3 },
  ],
  customizations: {},
  title: undefined as string | undefined,
  valueColumn: 'Total',
  containerSize: { width: 0, height: 0 },
  zoom: 0.8,
};

describe('map-option', () => {
  it('unmeasured container sizes like 400×300', () => {
    // 400×300 fallback: height 300 < 350 → '85%' (matches the characterization snapshot)
    expect(getMapLayoutSize({ width: 0, height: 0 })).toBe('85%');
    expect(getMapLayoutSize({ width: 240, height: 500 })).toBe('95%');
    expect(getMapLayoutSize({ width: 340, height: 500 })).toBe('90%');
    expect(getMapLayoutSize({ width: 440, height: 500 })).toBe('85%');
  });

  it('zoom is whatever the caller captured', () => {
    expect(buildMapChartOption({ ...base, zoom: 1.2 }).series[0].zoom).toBe(1.2);
  });

  it('tooltip decides small/very-small from the build-time size', () => {
    const tiny = buildMapChartOption({ ...base, containerSize: { width: 200, height: 150 } });
    expect(tiny.tooltip.textStyle.fontSize).toBe(10);
    expect(tiny.tooltip.formatter({ name: 'A region with a long name', data: { value: 1 } })).toBe(
      '<b>A region with...</b><br/>Total: 1' // substring(0, 13) + '...'
    );
  });

  it('unknown colour scheme falls back to Blues', () => {
    const option = buildMapChartOption({ ...base, customizations: { colorScheme: 'Nope' } });
    expect((option.visualMap as { inRange: { color: string[] } }).inRange.color[1]).toBe(
      MAP_SCHEME_BASE_COLORS.Blues
    );
  });

  it('responsive options hide the legend below 200×180', () => {
    expect(computeResponsiveMapOptions(190, 170, 'bottom-left').visualMapOptions).toEqual({
      show: false,
    });
  });
});
