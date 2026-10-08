import {
  buildSavedChartDataPayload,
  buildSavedMapOverlayPayload,
  resolveSavedMapSource,
} from '@/components/charts/logic/saved-chart-payload';
import type { DetailDrillLevel } from '@/components/charts/logic/map-drilldown';
import type { Chart } from '@/types/charts';

const saved = (chart_type: Chart['chart_type'], extra_config: Record<string, unknown>): Chart => ({
  id: 1,
  title: 'S',
  chart_type,
  computation_type: 'aggregated',
  schema_name: 's',
  table_name: 't',
  extra_config,
  echarts_config: {},
  created_at: '',
  updated_at: '',
});
const wire = (v: unknown) => JSON.parse(JSON.stringify(v));

describe('buildSavedChartDataPayload', () => {
  it('bar: aggregate defaults to sum and customizations are always sent', () => {
    expect(
      wire(buildSavedChartDataPayload(saved('bar', { dimension_column: 'state' }), null))
    ).toEqual({
      chart_type: 'bar',
      computation_type: 'aggregated',
      schema_name: 's',
      table_name: 't',
      dimension_col: 'state',
      aggregate_func: 'sum',
      customizations: {},
      extra_config: { filters: [] },
    });
  });

  it('map: layer geojson only when selected_geojson_id is missing; geographic column is the dimension', () => {
    const payload = wire(
      buildSavedChartDataPayload(
        saved('map', {
          geographic_column: 'state',
          value_column: 'v',
          layers: [{ geojson_id: 4 }],
        }),
        null
      )
    );
    expect(payload).toMatchObject({
      selected_geojson_id: 4,
      dimension_col: 'state',
      aggregate_col: 'v',
    });
    expect(
      buildSavedChartDataPayload(
        saved('map', { selected_geojson_id: 2, layers: [{ geojson_id: 4 }] }),
        null
      ).selected_geojson_id
    ).toBe(2);
  });

  it('table: all dimensions without drill, dimension_columns fallback', () => {
    expect(
      buildSavedChartDataPayload(
        saved('table', { dimensions: [{ column: 'a' }, { column: 'b' }] }),
        null
      ).dimensions
    ).toEqual(['a', 'b']);
    expect(
      buildSavedChartDataPayload(saved('table', { dimension_columns: ['c'] }), null).dimensions
    ).toEqual(['c']);
    expect(buildSavedChartDataPayload(saved('table', {}), null).dimensions).toEqual([]);
  });

  it('table drill: one level (clamped) plus an equals filter per applied level', () => {
    const chart = saved('table', {
      dimensions: [
        { column: 'state', enable_drill_down: true },
        { column: 'district', enable_drill_down: true },
      ],
      filters: [{ column: 'year', operator: 'equals', value: 2024 }],
    });
    const payload = buildSavedChartDataPayload(chart, {
      currentLevel: 4,
      appliedFilters: { state: 'KA' },
    });
    expect(payload.dimensions).toEqual(['district']);
    expect(payload.extra_config.filters).toEqual([
      { column: 'year', operator: 'equals', value: 2024 },
      { column: 'state', operator: 'equals', value: 'KA' },
    ]);
  });
});

describe('resolveSavedMapSource', () => {
  const chart = saved('map', {
    geographic_column: 'g',
    selected_geojson_id: 3,
    layers: [{ geojson_id: 8, geographic_column: 'state' }],
  });
  it('top level uses the first layer; drilled uses the level column and the resolved geojson', () => {
    expect(resolveSavedMapSource(chart, [], null)).toEqual({
      geojsonId: 8,
      geographicColumn: 'state',
    });
    const level: DetailDrillLevel = {
      level: 1,
      name: 'KA',
      geographic_column: 'district',
      geojson_id: 0,
      parent_selections: [],
    };
    expect(resolveSavedMapSource(chart, [level], 99)).toEqual({
      geojsonId: 99,
      geographicColumn: 'district',
    });
  });
  it('no layers falls back to the flat fields; non-map charts have no map source', () => {
    expect(
      resolveSavedMapSource(
        saved('map', { geographic_column: 'g', selected_geojson_id: 3 }),
        [],
        null
      )
    ).toEqual({
      geojsonId: 3,
      geographicColumn: 'g',
    });
    expect(resolveSavedMapSource(saved('bar', {}), [], null)).toEqual({
      geojsonId: null,
      geographicColumn: null,
    });
  });
});

describe('buildSavedMapOverlayPayload', () => {
  it('sends chart filters both as chart_filters and in extra_config', () => {
    const filters = [{ column: 'year', operator: 'equals', value: 2024 }];
    const chart = saved('map', {
      aggregate_column: 'students',
      aggregate_function: 'sum',
      filters,
      sort: [],
    });
    expect(buildSavedMapOverlayPayload(chart, 'state', { state: 'KA' })).toEqual({
      schema_name: 's',
      table_name: 't',
      geographic_column: 'state',
      metric: undefined,
      value_column: 'students',
      aggregate_function: 'sum',
      filters: { state: 'KA' },
      chart_filters: filters,
      extra_config: { filters, pagination: undefined, sort: [] },
    });
    expect(buildSavedMapOverlayPayload(chart, null, {})).toBeNull();
  });
});
