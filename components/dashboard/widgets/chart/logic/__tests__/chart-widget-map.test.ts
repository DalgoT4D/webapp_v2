import type { Region } from '@/hooks/api/useChart';
import {
  buildWidgetMapOverlayPayload,
  collectDrillFilters,
  resolveWidgetMapLayer,
  resolveWidgetRegionClick,
  type WidgetChartLike,
  type WidgetMapDrillLevel,
  type WidgetRegionClickContext,
} from '@/components/dashboard/widgets/chart/logic/chart-widget-map';

const regions = [
  { id: 5, name: 'Karnataka', display_name: 'Karnataka', type: 'state' },
] as unknown as Region[];

const hierarchyMap: WidgetChartLike = {
  chart_type: 'map',
  schema_name: 's',
  table_name: 't',
  extra_config: {
    geographic_column: 'state',
    geographic_hierarchy: {
      drill_down_levels: [{ level: 1, column: 'district', label: 'Districts' }],
    },
  },
};
const districtMap: WidgetChartLike = {
  chart_type: 'map',
  extra_config: { district_column: 'district' },
};

const ctx = (over: Partial<WidgetRegionClickContext> = {}): WidgetRegionClickContext => ({
  chart: hierarchyMap,
  legacyGateChart: hierarchyMap,
  regions,
  drillDownPath: [],
  activeGeographicColumn: 'state',
  regionName: 'Karnataka',
  ...over,
});

const stateLevel: WidgetMapDrillLevel = {
  level: 1,
  name: 'Karnataka',
  geographic_column: 'district',
  geojson_id: 0,
  region_id: 5,
  parent_selections: [{ column: 'state', value: 'Karnataka' }],
};

beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('resolveWidgetRegionClick', () => {
  it('not a map: nothing happens', () => {
    expect(resolveWidgetRegionClick(ctx({ chart: { chart_type: 'bar' } }), 'view')).toBeNull();
  });

  it.each(['builder', 'view'] as const)(
    '%s — hierarchy: drills into the found region',
    (variant) => {
      expect(resolveWidgetRegionClick(ctx(), variant)).toEqual({
        toasts: [{ variant: 'success', message: 'Drilling down to districts in Karnataka' }],
        nextLevel: stateLevel,
      });
    }
  );

  it.each(['builder', 'view'] as const)(
    '%s — hierarchy: unknown region / no next level',
    (variant) => {
      expect(resolveWidgetRegionClick(ctx({ regionName: 'Atlantis' }), variant)).toEqual({
        toasts: [{ variant: 'error', message: 'Region "Atlantis" not found in database' }],
        nextLevel: null,
      });
      expect(resolveWidgetRegionClick(ctx({ drillDownPath: [stateLevel] }), variant)).toEqual({
        toasts: [{ variant: 'info', message: 'No further drill-down levels configured' }],
        nextLevel: null,
      });
    }
  );

  it('legacy district column: success toast fires before the region lookup (both toasts on a miss)', () => {
    const c = ctx({ chart: districtMap, legacyGateChart: districtMap, regionName: 'Atlantis' });
    expect(resolveWidgetRegionClick(c, 'builder')?.toasts).toEqual([
      { variant: 'success', message: 'Drilling down to districts in Atlantis' },
      { variant: 'error', message: 'Region "Atlantis" not found in database' },
    ]);
  });

  it('legacy district column, deeper than configured: builder vs view wording (BUILDER-DRIFT)', () => {
    const deep = ctx({
      chart: districtMap,
      legacyGateChart: districtMap,
      drillDownPath: [stateLevel],
    });
    expect(resolveWidgetRegionClick(deep, 'builder')?.toasts).toEqual([
      { variant: 'info', message: 'No drill-down configuration found for this chart' },
    ]);
    expect(resolveWidgetRegionClick(deep, 'view')?.toasts).toEqual([
      { variant: 'info', message: 'No further drill-down levels configured' },
    ]);
  });

  it('view: legacy columns need the private chart (MODE-DRIFT — null on public/report pages)', () => {
    const publicCtx = ctx({ chart: districtMap, legacyGateChart: null });
    expect(resolveWidgetRegionClick(publicCtx, 'view')).toEqual({
      toasts: [{ variant: 'info', message: 'No further drill-down levels configured' }],
      nextLevel: null,
    });
  });

  it('builder with no drill configuration', () => {
    const plain: WidgetChartLike = { chart_type: 'map', extra_config: {} };
    expect(
      resolveWidgetRegionClick(ctx({ chart: plain, legacyGateChart: plain }), 'builder')?.toasts
    ).toEqual([{ variant: 'info', message: 'No drill-down configuration found for this chart' }]);
  });

  it('view legacy layers: region not in the next layer / no geojson / drill', () => {
    const layered = (selected_regions: unknown[], geojson_id?: number): WidgetChartLike => ({
      chart_type: 'map',
      extra_config: {
        layers: [
          { geographic_column: 'state' },
          { geographic_column: 'district', selected_regions, geojson_id, region_id: 9 },
        ],
      },
    });
    const notListed = layered([{ region_name: 'Goa', geojson_id: 3 }], 4);
    expect(
      resolveWidgetRegionClick(ctx({ chart: notListed, legacyGateChart: notListed }), 'view')
        ?.toasts
    ).toEqual([
      {
        variant: 'info',
        message:
          'Drill-down not available for "Karnataka". This region is not configured for the next level.',
      },
    ]);
    const noGeo = layered([]);
    expect(
      resolveWidgetRegionClick(ctx({ chart: noGeo, legacyGateChart: noGeo }), 'view')?.toasts
    ).toEqual([
      {
        variant: 'info',
        message:
          'Drill-down not available for "Karnataka". Geographic data is not configured for this region.',
      },
    ]);
    const listed = layered([{ region_name: 'Karnataka', geojson_id: 77 }], 4);
    expect(
      resolveWidgetRegionClick(ctx({ chart: listed, legacyGateChart: listed }), 'view')
    ).toEqual({
      toasts: [],
      nextLevel: { ...stateLevel, geojson_id: 77, region_id: 9 },
    });
  });

  it('parent selections accumulate along the path', () => {
    const twoLevels: WidgetChartLike = {
      chart_type: 'map',
      extra_config: {
        geographic_hierarchy: {
          drill_down_levels: [
            { level: 1, column: 'district', label: 'Districts' },
            { level: 2, column: 'block', label: 'Blocks' },
          ],
        },
      },
    };
    const click = resolveWidgetRegionClick(
      ctx({
        chart: twoLevels,
        legacyGateChart: twoLevels,
        drillDownPath: [stateLevel],
        activeGeographicColumn: 'district',
      }),
      'builder'
    );
    expect(click?.nextLevel?.parent_selections).toEqual([
      { column: 'state', value: 'Karnataka' },
      { column: 'district', value: 'Karnataka' },
    ]);
  });
});

describe('map layer and overlay payload', () => {
  it('collects drill filters; resolves the layer by drill state', () => {
    expect(collectDrillFilters([stateLevel])).toEqual({ state: 'Karnataka' });
    const layered: WidgetChartLike = {
      chart_type: 'map',
      extra_config: { layers: [{ geojson_id: 1, geographic_column: 'state' }] },
    };
    expect(resolveWidgetMapLayer(layered, [], null)).toEqual({
      activeGeojsonId: 1,
      activeGeographicColumn: 'state',
    });
    expect(resolveWidgetMapLayer(layered, [stateLevel], 42)).toEqual({
      activeGeojsonId: 42,
      activeGeographicColumn: 'district',
    });
    expect(
      resolveWidgetMapLayer(
        { chart_type: 'map', extra_config: { selected_geojson_id: 3, geographic_column: 'st' } },
        [],
        null
      )
    ).toEqual({ activeGeojsonId: 3, activeGeographicColumn: 'st' });
    expect(resolveWidgetMapLayer({ chart_type: 'bar' }, [], null)).toEqual({
      activeGeojsonId: null,
      activeGeographicColumn: null,
    });
  });

  it('overlay payload: sum by default without a metric; null without a geographic column', () => {
    const chart: WidgetChartLike = {
      chart_type: 'map',
      schema_name: 's',
      table_name: 't',
      extra_config: { aggregate_column: 'v', filters: [{ column: 'x' }] },
    };
    expect(buildWidgetMapOverlayPayload(chart, 'state', { state: 'A' }, { '5': ['B'] })).toEqual({
      schema_name: 's',
      table_name: 't',
      geographic_column: 'state',
      metric: undefined,
      value_column: 'v',
      aggregate_function: 'sum',
      filters: { state: 'A' },
      dashboard_filters: { '5': ['B'] },
      extra_config: { filters: [{ column: 'x' }], pagination: undefined, sort: undefined },
    });
    expect(buildWidgetMapOverlayPayload(chart, null, {}, {})).toBeNull();
  });
});
