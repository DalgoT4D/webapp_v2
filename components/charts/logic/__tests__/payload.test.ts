import { buildChartDataPayload, resolveTableDimensions } from '@/components/charts/logic/payload';
import { getApiCustomizations } from '@/lib/chart-payload-utils';
import { buildPivotDataFields } from '@/components/charts/pivot-table/utils';
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
