import { toMapLayers, toSimplifiedMapFields } from '@/components/charts/logic/map-layers';

describe('toSimplifiedMapFields', () => {
  it('returns an empty object for no layers', () => {
    expect(toSimplifiedMapFields(undefined)).toEqual({});
    expect(toSimplifiedMapFields([])).toEqual({});
  });

  it('reads level 0 as the geographic column and deeper levels as district/ward/subward', () => {
    expect(
      toSimplifiedMapFields([
        { level: 0, geographic_column: 'state', geojson_id: 3 },
        { level: 1, geographic_column: 'district' },
        { level: 3, geographic_column: 'subward' },
      ])
    ).toEqual({
      geographic_column: 'state',
      selected_geojson_id: 3,
      district_column: 'district',
      subward_column: 'subward',
      drill_down_enabled: true,
    });
  });

  it('a single layer means drill-down is off', () => {
    expect(
      toSimplifiedMapFields([{ level: 0, geographic_column: 'state', geojson_id: 3 }])
    ).toEqual({
      geographic_column: 'state',
      selected_geojson_id: 3,
      drill_down_enabled: false,
    });
  });
});

describe('toMapLayers', () => {
  it('returns undefined when nothing is configured', () => {
    expect(toMapLayers({})).toBeUndefined();
  });

  it('builds level 0 from the geographic column and one layer per non-blank drill column', () => {
    expect(
      toMapLayers({
        geographic_column: 'state',
        selected_geojson_id: 3,
        district_column: 'district',
        ward_column: '   ',
      })
    ).toEqual([
      { id: '0', level: 0, geographic_column: 'state', geojson_id: 3, selected_regions: [] },
      {
        id: '1',
        level: 1,
        geographic_column: 'district',
        selected_regions: [],
        parent_selections: [],
      },
    ]);
  });

  it('without a geographic column the first drill column becomes level 0 (as today)', () => {
    expect(toMapLayers({ district_column: 'district' })).toEqual([
      {
        id: '0',
        level: 0,
        geographic_column: 'district',
        selected_regions: [],
        parent_selections: [],
      },
    ]);
  });
});
