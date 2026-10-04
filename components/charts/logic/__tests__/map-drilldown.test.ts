import { resolveBuilderRegionClick } from '@/components/charts/logic/map-drilldown';
import type { ChartBuilderFormData } from '@/types/charts';

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
