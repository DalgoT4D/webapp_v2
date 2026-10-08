import { render } from '@testing-library/react';
import { MapPreview } from '../MapPreview';

const setOption = jest.fn();
const on = jest.fn();
const instance = {
  setOption,
  on,
  dispose: jest.fn(),
  resize: jest.fn(),
  dispatchAction: jest.fn(),
};

jest.mock('echarts', () => ({
  registerMap: jest.fn(),
  init: jest.fn(() => instance),
}));

const GEOJSON = { type: 'FeatureCollection', features: [] as unknown[] };
const DATA = [
  { name: 'Karnataka', value: 10 },
  { name: 'Kerala', value: 40 },
  { name: 'Goa', value: null },
];

type MapOption = {
  tooltip: { formatter: (p: { name: string; data?: { value: number | null } }) => string };
  [key: string]: unknown;
};

function renderMap(props: Partial<React.ComponentProps<typeof MapPreview>> = {}): MapOption {
  setOption.mockClear();
  render(
    <MapPreview geojsonData={GEOJSON} mapData={DATA} valueColumn="Total <students>" {...props} />
  );
  expect(setOption).toHaveBeenCalled();
  const option = setOption.mock.calls[setOption.mock.calls.length - 1][0] as MapOption;
  // The map name is per-instance (`customMap-${Date.now()}-${Math.random()}`), so pin its shape
  // and that it is the registered name, then replace it to keep the snapshot deterministic.
  const series = option.series as Array<{ mapType: string }>;
  const registerMap = jest.requireMock('echarts').registerMap as jest.Mock;
  expect(series[0].mapType).toMatch(/^customMap-\d+-0\.\d+/);
  expect(registerMap).toHaveBeenLastCalledWith(series[0].mapType, GEOJSON);
  return { ...option, series: [{ ...series[0], mapType: '<uniqueMapName>' }] };
}

describe('MapPreview option (characterization of the pre-R6 inline builder)', () => {
  it('default customizations: visualMap legend, 85% layout (400×300 fallback), zoom 0.8, raw series data', () => {
    const { tooltip, ...rest } = renderMap();
    expect(rest).toMatchSnapshot();
    expect(typeof tooltip.formatter).toBe('function');
  });

  it('legend off: per-region opacity colours, no visualMap', () => {
    const { tooltip, ...rest } = renderMap({
      customizations: { showLegend: false, colorScheme: 'Greens' },
    });
    expect(rest).toMatchSnapshot();
  });

  it('single value: range collapses and the one region is full colour', () => {
    const { tooltip, ...rest } = renderMap({
      mapData: [{ name: 'Goa', value: 5 }],
      customizations: { showLegend: false },
    });
    expect(rest).toMatchSnapshot();
  });

  it('legend position, title, labels, unknown colour scheme falls back to Blues', () => {
    const { tooltip, ...rest } = renderMap({
      title: 'Students',
      customizations: { legendPosition: 'top-right', showLabels: true, colorScheme: 'Nope' },
    });
    expect(rest).toMatchSnapshot();
  });

  it('tooltip: escapes HTML, formats numbers, null label, build-time container size (400×300 default)', () => {
    const { tooltip } = renderMap({
      customizations: { numberFormat: 'international', decimalPlaces: 1, nullValueLabel: 'n/a' },
    });
    expect(tooltip.formatter({ name: 'A <b>', data: { value: 1234.5 } })).toMatchSnapshot();
    expect(
      tooltip.formatter({ name: 'A very long region name indeed', data: { value: 1 } })
    ).toMatchSnapshot();
    expect(tooltip.formatter({ name: 'Goa', data: { value: null } })).toMatchSnapshot();
    expect(tooltip.formatter({ name: 'Goa' })).toMatchSnapshot();
  });

  it('registers one click handler and reports series clicks', () => {
    const onRegionClick = jest.fn();
    on.mockClear();
    renderMap({ onRegionClick });
    expect(on).toHaveBeenCalledWith('click', expect.any(Function));
    const handler = on.mock.calls[0][1] as (p: unknown) => void;
    handler({ componentType: 'series', name: 'Kerala', data: { value: 40 } });
    handler({ componentType: 'title', name: 'x' });
    expect(onRegionClick).toHaveBeenCalledTimes(1);
    expect(onRegionClick).toHaveBeenCalledWith('Kerala', { value: 40 });
  });
});
