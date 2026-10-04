import {
  resolveBuilderRegionClick,
  resolveDetailRegionClick,
  type DetailDrillLevel,
  type DetailRegionClickContext,
} from '@/components/charts/logic/map-drilldown';
import type { Chart, ChartBuilderFormData } from '@/types/charts';

const STATES = [
  { id: 7, name: 'Karnataka', display_name: 'Karnataka', type: 'state' },
  { id: 8, name: 'TN', display_name: 'Tamil Nadu', type: 'state' },
] as never[];

const HIERARCHY = {
  drill_down_levels: [
    { level: 1, column: 'district_name', region_type: 'district', label: 'District' },
  ],
};

describe('resolveBuilderRegionClick', () => {
  const map: ChartBuilderFormData = { chart_type: 'map', geographic_column: 'state' };

  it('no drill configured', () => {
    expect(resolveBuilderRegionClick(map, STATES, 'Karnataka')).toEqual({
      kind: 'drillNotConfigured',
    });
  });

  it('legacy district column drills one level', () => {
    expect(
      resolveBuilderRegionClick({ ...map, district_column: 'district' }, STATES, 'Karnataka')
    ).toEqual({
      kind: 'drill',
      level: {
        level: 1,
        name: 'Karnataka',
        geographic_column: 'district',
        parent_selections: [{ column: 'state', value: 'Karnataka' }],
        region_id: 7,
      },
    });
  });

  it('hierarchy column wins; region matched by display name', () => {
    const click = resolveBuilderRegionClick(
      {
        ...map,
        district_column: 'district',
        geographic_hierarchy: HIERARCHY,
      } as ChartBuilderFormData,
      STATES,
      'Tamil Nadu'
    );
    expect(click).toMatchObject({
      kind: 'drill',
      level: { geographic_column: 'district_name', region_id: 8 },
    });
  });

  it('a hierarchy level without a column, or an unknown region', () => {
    const blank = { drill_down_levels: [{ level: 1, column: '', region_type: '', label: '' }] };
    expect(
      resolveBuilderRegionClick(
        { ...map, geographic_hierarchy: blank } as ChartBuilderFormData,
        STATES,
        'Karnataka'
      )
    ).toEqual({
      kind: 'noDrillColumn',
    });
    expect(resolveBuilderRegionClick({ ...map, district_column: 'd' }, STATES, 'Goa')).toEqual({
      kind: 'regionNotFound',
    });
    expect(resolveBuilderRegionClick({ ...map, district_column: 'd' }, undefined, 'Goa')).toEqual({
      kind: 'regionNotFound',
    });
  });

  it('missing geographic column sends an empty parent column', () => {
    const click = resolveBuilderRegionClick(
      { chart_type: 'map', district_column: 'd' },
      STATES,
      'Karnataka'
    );
    expect(click).toMatchObject({
      level: { parent_selections: [{ column: '', value: 'Karnataka' }] },
    });
  });
});

const savedMap = (extra_config: Record<string, unknown>): Chart => ({
  id: 3,
  title: 'Map',
  chart_type: 'map',
  computation_type: 'aggregated',
  schema_name: 's',
  table_name: 't',
  extra_config,
  echarts_config: {},
  created_at: '',
  updated_at: '',
});

function ctx(
  chart: Chart,
  overrides: Partial<DetailRegionClickContext> = {}
): DetailRegionClickContext {
  return {
    chart,
    regions: STATES,
    drillDownPath: [],
    activeGeographicColumn: 'state',
    canEditCharts: true,
    regionName: 'Karnataka',
    ...overrides,
  };
}

describe('resolveDetailRegionClick — hierarchy strategy', () => {
  it('drills with the lower-cased level label in the toast', () => {
    expect(resolveDetailRegionClick(ctx(savedMap({ geographic_hierarchy: HIERARCHY })))).toEqual({
      toasts: [{ variant: 'success', message: '🗺️ Drilling down to district in Karnataka' }],
      nextLevel: {
        level: 1,
        name: 'Karnataka',
        geographic_column: 'district_name',
        geojson_id: 0,
        region_id: 7,
        parent_selections: [{ column: 'state', value: 'Karnataka' }],
      },
    });
  });

  it('no next level / unknown region', () => {
    const level1: DetailDrillLevel = {
      level: 1,
      name: 'Karnataka',
      geographic_column: 'district_name',
      geojson_id: 0,
      region_id: 7,
      parent_selections: [{ column: 'state', value: 'Karnataka' }],
    };
    expect(
      resolveDetailRegionClick(
        ctx(savedMap({ geographic_hierarchy: HIERARCHY }), { drillDownPath: [level1] })
      )
    ).toEqual({
      toasts: [{ variant: 'info', message: 'No further drill-down levels configured' }],
      nextLevel: null,
    });
    expect(
      resolveDetailRegionClick(
        ctx(savedMap({ geographic_hierarchy: HIERARCHY }), { regionName: 'Goa' })
      )
    ).toEqual({
      toasts: [{ variant: 'error', message: 'Region "Goa" not found in database' }],
      nextLevel: null,
    });
  });
});

describe('resolveDetailRegionClick — simplified columns strategy', () => {
  it('level 0 drills into districts; parent selections accumulate', () => {
    const click = resolveDetailRegionClick(
      ctx(savedMap({ district_column: 'district', ward_column: 'ward' }))
    );
    expect(click.toasts).toEqual([
      { variant: 'success', message: '🗺️ Drilling down to districts in Karnataka' },
    ]);
    expect(click.nextLevel).toMatchObject({
      level: 1,
      geographic_column: 'district',
      region_id: 7,
    });
  });

  it('success toast fires before the failed region lookup (both shown)', () => {
    expect(
      resolveDetailRegionClick(
        ctx(savedMap({ district_column: 'district' }), { regionName: 'Goa' })
      )
    ).toEqual({
      toasts: [
        { variant: 'success', message: '🗺️ Drilling down to districts in Goa' },
        { variant: 'error', message: 'Region "Goa" not found in database' },
      ],
      nextLevel: null,
    });
  });

  it('a gap in the columns stops the drill', () => {
    expect(resolveDetailRegionClick(ctx(savedMap({ ward_column: 'ward' })))).toEqual({
      toasts: [{ variant: 'info', message: 'No further drill-down levels configured' }],
      nextLevel: null,
    });
  });
});

describe('resolveDetailRegionClick — legacy layers strategy', () => {
  it('no layers: info toast, wording depends on edit permission', () => {
    expect(resolveDetailRegionClick(ctx(savedMap({}), { canEditCharts: false })).toasts).toEqual([
      {
        variant: 'info',
        message: '🗺️ No further drill-down levels configured',
        description: 'This chart needs additional layers configured for deeper drill-down',
        position: 'top-right',
      },
    ]);
  });

  it('single-select next layer drills with its geojson', () => {
    const chart = savedMap({
      layers: [{ geojson_id: 1 }, { geojson_id: 5, geographic_column: 'district', region_id: 9 }],
    });
    expect(resolveDetailRegionClick(ctx(chart))).toEqual({
      toasts: [],
      nextLevel: {
        level: 1,
        name: 'Karnataka',
        geographic_column: 'district',
        geojson_id: 5,
        region_id: 9,
        parent_selections: [{ column: 'state', value: 'Karnataka' }],
      },
    });
  });

  it('multi-select layer uses the matching region geojson; others are "not configured"', () => {
    const chart = savedMap({
      layers: [
        {},
        {
          geographic_column: 'district',
          selected_regions: [{ region_id: 7, region_name: 'Karnataka', geojson_id: 11 }],
        },
      ],
    });
    expect(resolveDetailRegionClick(ctx(chart)).nextLevel).toMatchObject({ geojson_id: 11 });
    expect(resolveDetailRegionClick(ctx(chart, { regionName: 'Kerala' }))).toEqual({
      toasts: [
        {
          variant: 'info',
          message: '🗺️ Kerala not configured for drill-down',
          description: 'Configure this region in edit mode to enable drill-down',
          position: 'top-right',
          duration: 4000,
          withEditAction: true,
        },
      ],
      nextLevel: null,
    });
  });

  it('"excluded by filter" only for != / "not equals" (pinned: builder writes not_equals)', () => {
    const layers = [
      {},
      { geographic_column: 'district', selected_regions: [{ region_id: 1, region_name: 'X' }] },
    ];
    const excluded = savedMap({
      layers,
      filters: [{ column: 'state', operator: '!=', value: 'Kerala' }],
    });
    expect(
      resolveDetailRegionClick(ctx(excluded, { regionName: 'Kerala' })).toasts[0]
    ).toMatchObject({
      variant: 'warning',
      message: '🚫 Kerala excluded by filter',
    });
    const builderFilter = savedMap({
      layers,
      filters: [{ column: 'state', operator: 'not_equals', value: 'Kerala' }],
    });
    expect(
      resolveDetailRegionClick(ctx(builderFilter, { regionName: 'Kerala' })).toasts[0]
    ).toMatchObject({
      variant: 'info',
    });
  });
});
