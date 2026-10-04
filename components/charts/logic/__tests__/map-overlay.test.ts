import {
  applyMapDrillToOverlay,
  buildEditMapOverlayPayload,
  collectDrillFilters,
  getMapDrillColumn,
  transformMapDataOverlayPayload,
  type MapDrillLevel,
} from '@/components/charts/logic/map-overlay';
import type { ChartBuilderFormData } from '@/types/charts';

const RAW = { schema_name: 's', table_name: 't', geographic_column: 'state' };
const SUM_STUDENTS = { column: 'students', aggregation: 'sum', alias: 'SUM(students)' };

describe('transformMapDataOverlayPayload', () => {
  it('null without schema, table or geographic column', () => {
    expect(transformMapDataOverlayPayload(null)).toBeNull();
    expect(transformMapDataOverlayPayload({ ...RAW, geographic_column: '' })).toBeNull();
  });

  it('simple metric: alias is always "value" (pinned)', () => {
    expect(transformMapDataOverlayPayload({ ...RAW, metric: SUM_STUDENTS })).toEqual({
      ...RAW,
      value_column: 'students',
      metrics: [{ column: 'students', aggregation: 'sum', alias: 'value' }],
      filters: {},
      dashboard_filters: {},
      extra_config: {},
    });
  });

  it('count without a column counts the geographic column', () => {
    const payload = transformMapDataOverlayPayload({
      ...RAW,
      metric: { column: null, aggregation: 'count', alias: 'Total Count' },
    });
    expect((payload as { value_column?: string }).value_column).toBe('state');
    expect(payload!.metrics).toEqual([{ column: 'state', aggregation: 'count', alias: 'value' }]);
  });

  it('legacy fields when there is no metric; sum without a column is not runnable', () => {
    expect(
      transformMapDataOverlayPayload({ ...RAW, aggregate_function: 'avg', value_column: 'score' })!
        .metrics
    ).toEqual([{ column: 'score', aggregation: 'avg', alias: 'value' }]);
    expect(transformMapDataOverlayPayload({ ...RAW, aggregate_function: 'sum' })).toBeNull();
  });

  it('calculated metric sends the expression and no value_column', () => {
    const payload = transformMapDataOverlayPayload({
      ...RAW,
      metric: { column_expression: 'SUM(a)/SUM(b)', alias: 'Ratio' },
      filters: { district: 'X' },
    });
    expect(payload).toEqual({
      ...RAW,
      metrics: [{ column_expression: 'SUM(a)/SUM(b)', alias: 'value' }],
      filters: { district: 'X' },
      dashboard_filters: {},
      extra_config: {},
    });
  });
});

const KA: MapDrillLevel = {
  level: 1,
  name: 'Karnataka',
  geographic_column: 'district',
  parent_selections: [{ column: 'state', value: 'Karnataka' }],
  region_id: 7,
};

describe('drill helpers', () => {
  it('collectDrillFilters flattens parent selections; later levels win', () => {
    expect(collectDrillFilters([])).toEqual({});
    expect(
      collectDrillFilters([
        KA,
        {
          ...KA,
          parent_selections: [
            { column: 'state', value: 'Kerala' },
            { column: 'district', value: 'Y' },
          ],
        },
      ])
    ).toEqual({ state: 'Kerala', district: 'Y' });
  });

  it('getMapDrillColumn prefers the hierarchy over district_column', () => {
    expect(getMapDrillColumn({ district_column: 'd' })).toBe('d');
    expect(
      getMapDrillColumn({
        district_column: 'd',
        geographic_hierarchy: {
          drill_down_levels: [
            { level: 1, column: 'dist', region_type: 'district', label: 'District' },
          ],
        },
      } as ChartBuilderFormData)
    ).toBe('dist');
    expect(
      getMapDrillColumn({ geographic_hierarchy: { drill_down_levels: [] } } as ChartBuilderFormData)
    ).toBeUndefined();
  });
});

const READY_MAP: ChartBuilderFormData = {
  chart_type: 'map',
  schema_name: 's',
  table_name: 't',
  geographic_column: 'state',
  selected_geojson_id: 35,
  aggregate_column: 'students',
  aggregate_function: 'sum',
  metrics: [SUM_STUDENTS],
  filters: [],
};

describe('applyMapDrillToOverlay (create)', () => {
  // Same overlay shape READY_MAP would have produced via the (now-deleted) create preview builder.
  const base: NonNullable<ChartBuilderFormData['dataOverlayPayload']> = {
    schema_name: 's',
    table_name: 't',
    geographic_column: 'state',
    metric: SUM_STUDENTS,
    value_column: 'students',
    aggregate_function: 'sum',
    selected_geojson_id: 35,
    filters: {},
    chart_filters: [],
  };
  it('no drill → the base payload; drilled → drill column + parent filters', () => {
    expect(applyMapDrillToOverlay(null, [KA], READY_MAP)).toBeNull();
    expect(applyMapDrillToOverlay(base, [], READY_MAP)).toBe(base);
    expect(
      applyMapDrillToOverlay(base, [KA], { ...READY_MAP, district_column: 'district' })
    ).toEqual({
      ...base,
      geographic_column: 'district',
      filters: { state: 'Karnataka' },
    });
    expect(applyMapDrillToOverlay(base, [KA], READY_MAP)!.geographic_column).toBe('state');
  });
});

describe('buildEditMapOverlayPayload', () => {
  it('ignores chart filters (pinned) and sends chart_id', () => {
    expect(
      buildEditMapOverlayPayload(
        { ...READY_MAP, filters: [{ column: 'a', operator: 'equals', value: 1 }] },
        [],
        12
      )
    ).toEqual({
      schema_name: 's',
      table_name: 't',
      geographic_column: 'state',
      metric: SUM_STUDENTS,
      value_column: 'students',
      aggregate_function: 'sum',
      filters: {},
      chart_filters: [],
      chart_id: 12,
    });
  });

  it('legacy (no metric, no aggregate) defaults to sum; drilled uses the drill column', () => {
    const legacy: ChartBuilderFormData = {
      ...READY_MAP,
      metrics: undefined,
      aggregate_function: undefined,
      district_column: 'district',
    };
    const payload = buildEditMapOverlayPayload(legacy, [KA], 12)!;
    expect(payload.aggregate_function).toBe('sum');
    expect(payload.geographic_column).toBe('district');
    expect(payload.filters).toEqual({ state: 'Karnataka' });
  });

  it('null for non-map charts or without a geographic column', () => {
    expect(buildEditMapOverlayPayload({ ...READY_MAP, chart_type: 'bar' }, [], 12)).toBeNull();
    expect(
      buildEditMapOverlayPayload({ ...READY_MAP, geographic_column: undefined }, [], 12)
    ).toBeNull();
  });
});
