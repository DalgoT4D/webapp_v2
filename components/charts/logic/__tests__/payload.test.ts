import {
  buildChartDataPayload,
  resolveTableDimensions,
  buildCreateChartPayload,
  buildEditChartPayload,
} from '@/components/charts/logic/payload';
import { getApiCustomizations } from '@/lib/chart-payload-utils';
import { buildPivotDataFields, buildPivotExtraConfig } from '@/components/charts/pivot-table/utils';
import type { ChartBuilderFormData, ChartMetric } from '@/types/charts';

/** Compare what goes over the wire (undefined keys dropped), like the E2E payload snapshots. */
const wire = (value: unknown) => JSON.parse(JSON.stringify(value));

const SUM_STUDENTS: ChartMetric = { column: 'students', aggregation: 'sum', alias: 'Students' };
const common: ChartBuilderFormData = {
  computation_type: 'aggregated',
  schema_name: 's',
  table_name: 't',
  filters: [],
  pagination: { enabled: false, page_size: 50 },
  sort: [],
  time_grain: null,
};

describe('buildChartDataPayload', () => {
  it('returns null while the chart is not ready', () => {
    expect(buildChartDataPayload({ ...common, chart_type: 'bar' }, null, 'create')).toBeNull();
  });

  it('bar: same payload from both builders', () => {
    const config: ChartBuilderFormData = {
      ...common,
      chart_type: 'bar',
      dimension_column: 'state',
      metrics: [SUM_STUDENTS],
      customizations: { orientation: 'vertical', numberFormat: 'default' },
    };
    const expected: Record<string, unknown> = {
      chart_type: 'bar',
      computation_type: 'aggregated',
      schema_name: 's',
      table_name: 't',
      dimension_col: 'state',
      metrics: [SUM_STUDENTS],
      customizations: wire(getApiCustomizations('bar', config.customizations)),
      extra_config: {
        filters: [],
        pagination: { enabled: false, page_size: 50 },
        sort: [],
        time_grain: null,
      },
    };
    expect(wire(buildChartDataPayload(config, null, 'create'))).toEqual(expected);
    expect(wire(buildChartDataPayload(config, null, 'edit'))).toEqual(expected);
  });

  it('create sends an empty metrics array, edit omits it (differs between builders)', () => {
    const config: ChartBuilderFormData = {
      ...common,
      chart_type: 'bar',
      dimension_column: 'state',
      aggregate_function: 'count',
      metrics: [],
    };
    expect(wire(buildChartDataPayload(config, null, 'create')).metrics).toEqual([]);
    expect(wire(buildChartDataPayload(config, null, 'edit'))).not.toHaveProperty('metrics');
  });

  it('table: no customizations; edit also sends table_columns (differs between builders)', () => {
    const config: ChartBuilderFormData = {
      ...common,
      chart_type: 'table',
      dimensions: [{ column: 'state' }],
      table_columns: ['state', 'students'],
      customizations: { zebra: true },
    };
    const create = wire(buildChartDataPayload(config, null, 'create'));
    const edit = wire(buildChartDataPayload(config, null, 'edit'));
    expect(create).not.toHaveProperty('customizations');
    expect(create.dimensions).toEqual(['state']);
    expect(create).not.toHaveProperty('table_columns');
    expect(create.extra_config).not.toHaveProperty('table_columns');
    expect(edit.table_columns).toEqual(['state', 'students']);
    expect(edit.extra_config.table_columns).toEqual(['state', 'students']);
  });

  it('table drill-down adds an equals filter per applied level', () => {
    const config: ChartBuilderFormData = {
      ...common,
      chart_type: 'table',
      dimensions: [
        { column: 'state', enable_drill_down: true },
        { column: 'district', enable_drill_down: true },
      ],
      filters: [{ column: 'year', operator: 'equals', value: 2024 }],
    };
    const payload = wire(
      buildChartDataPayload(config, { currentLevel: 0, appliedFilters: { state: 'KA' } }, 'create')
    );
    expect(payload.dimensions).toEqual(['district']);
    expect(payload.extra_config.filters).toEqual([
      { column: 'year', operator: 'equals', value: 2024 },
      { column: 'state', operator: 'equals', value: 'KA' },
    ]);
  });

  it('map: layer geojson wins over selected_geojson_id; geographic column becomes dimension_col', () => {
    const config: ChartBuilderFormData = {
      ...common,
      chart_type: 'map',
      geographic_column: 'state_name',
      selected_geojson_id: 1,
      layers: [{ id: '0', level: 0, geojson_id: 7 }],
      metrics: [SUM_STUDENTS],
      customizations: { colorScheme: 'Blues', decimalPlaces: 2 },
    };
    const payload = wire(buildChartDataPayload(config, null, 'edit'));
    expect(payload.selected_geojson_id).toBe(7);
    expect(payload.geographic_column).toBe('state_name');
    expect(payload.dimension_col).toBe('state_name');
    expect(payload.customizations).toEqual(
      wire(getApiCustomizations('map', config.customizations))
    );
  });

  it('pivot: top-level pivot fields, no customizations', () => {
    const config: ChartBuilderFormData = {
      ...common,
      chart_type: 'pivot_table',
      metrics: [SUM_STUDENTS],
      extra_config: { row_dimensions: ['state'], column_dimensions: ['year'] },
    };
    const payload = wire(buildChartDataPayload(config, null, 'create'));
    expect(payload).toMatchObject(wire(buildPivotDataFields(config.extra_config)));
    expect(payload).not.toHaveProperty('customizations');
  });
});

describe('resolveTableDimensions', () => {
  it('without drill-down sends every non-empty column', () => {
    expect(
      resolveTableDimensions([{ column: 'a' }, { column: '' }, { column: 'b' }], null)
    ).toEqual(['a', 'b']);
  });

  it('with drill-down sends only the current level', () => {
    const dims = [
      { column: 'state', enable_drill_down: true },
      { column: 'district', enable_drill_down: true },
      { column: 'block' },
    ];
    expect(resolveTableDimensions(dims, null)).toEqual(['state']);
    expect(resolveTableDimensions(dims, { currentLevel: 0, appliedFilters: {} })).toEqual([
      'district',
    ]);
  });

  it('clamps past the last level', () => {
    const dims = [
      { column: 'state', enable_drill_down: true },
      { column: 'district', enable_drill_down: true },
    ];
    expect(resolveTableDimensions(dims, { currentLevel: 5, appliedFilters: {} })).toEqual([
      'district',
    ]);
  });
});

describe('save payloads', () => {
  const saved: ChartBuilderFormData = { ...common, title: 'T', customizations: { a: 1 } };

  it('map (create): first layer geojson wins; geographic_hierarchy only when set', () => {
    const payload = wire(
      buildCreateChartPayload({
        ...saved,
        chart_type: 'map',
        geographic_column: 'state',
        selected_geojson_id: 1,
        layers: [{ id: '0', level: 0, geojson_id: 9 }],
        metrics: [SUM_STUDENTS],
        geographic_hierarchy: null,
      } as ChartBuilderFormData)
    );
    expect(payload).toEqual({
      title: 'T',
      chart_type: 'map',
      computation_type: 'aggregated',
      schema_name: 's',
      table_name: 't',
      extra_config: {
        geographic_column: 'state',
        selected_geojson_id: 9,
        layers: [{ id: '0', level: 0, geojson_id: 9 }],
        customizations: { a: 1 },
        filters: [],
        pagination: { enabled: false, page_size: 50 },
        sort: [],
        time_grain: null,
        metrics: [SUM_STUDENTS],
      },
    });
  });

  it('map (edit): drill columns become layers; geographic_hierarchy null is sent (differs between builders)', () => {
    const payload = wire(
      buildEditChartPayload({
        ...saved,
        chart_type: 'map',
        geographic_column: 'state',
        selected_geojson_id: 3,
        district_column: 'district',
        metrics: [SUM_STUDENTS],
        geographic_hierarchy: null,
      } as ChartBuilderFormData)
    );
    expect(payload.extra_config.layers).toEqual([
      { id: '0', level: 0, geographic_column: 'state', geojson_id: 3, selected_regions: [] },
      {
        id: '1',
        level: 1,
        geographic_column: 'district',
        selected_regions: [],
        parent_selections: [],
      },
    ]);
    expect(payload.extra_config.selected_geojson_id).toBe(3);
    expect(payload.extra_config.district_column).toBe('district');
    expect(payload.extra_config.geographic_hierarchy).toBeNull();
  });

  it('table: dimensions trimmed for the new shape, raw for dimension_columns (both builders)', () => {
    const table: ChartBuilderFormData = {
      ...saved,
      chart_type: 'table',
      dimensions: [{ column: 'a', enable_drill_down: true }, { column: ' ' }, { column: 'b' }],
      table_columns: ['a', 'b'],
    };
    for (const payload of [
      wire(buildCreateChartPayload(table)),
      wire(buildEditChartPayload(table)),
    ]) {
      expect(payload.extra_config.dimensions).toEqual([
        { column: 'a', enable_drill_down: true },
        { column: 'b', enable_drill_down: false },
      ]);
      expect(payload.extra_config.dimension_columns).toEqual(['a', ' ', 'b']);
      expect(payload.extra_config.table_columns).toEqual(['a', 'b']);
    }
  });

  it('empty metrics are omitted; pivot adds its full extra_config', () => {
    const pivot: ChartBuilderFormData = {
      ...saved,
      chart_type: 'pivot_table',
      metrics: [],
      extra_config: { row_dimensions: ['r'] },
    };
    for (const payload of [
      wire(buildCreateChartPayload(pivot)),
      wire(buildEditChartPayload(pivot)),
    ]) {
      expect(payload.extra_config).not.toHaveProperty('metrics');
      expect(payload.extra_config).toMatchObject(wire(buildPivotExtraConfig(pivot.extra_config)));
    }
  });

  it('table_columns: edit always sends it, create only for tables (differs between builders)', () => {
    const bar: ChartBuilderFormData = { ...saved, chart_type: 'bar', table_columns: ['x'] };
    expect(wire(buildCreateChartPayload(bar)).extra_config).not.toHaveProperty('table_columns');
    expect(wire(buildEditChartPayload(bar)).extra_config.table_columns).toEqual(['x']);
  });
});
