import { buildDatasetChangePatch } from '@/components/charts/logic/dataset-change';
import type { ChartBuilderFormData } from '@/types/charts';

const table: ChartBuilderFormData = {
  title: 'T',
  chart_type: 'table',
  schema_name: 's',
  table_name: 'old',
  computation_type: 'aggregated',
  dimension_column: 'state',
  dimensions: [{ column: 'state' }],
  table_columns: ['state', 'students'],
  metrics: [{ column: 'students', aggregation: 'sum' }],
  customizations: { zebraRows: false },
};

describe('buildDatasetChangePatch', () => {
  it('same dataset → no patch', () => {
    expect(buildDatasetChangePatch(table, 's', 'old', 'chart')).toBeNull();
  });

  it('chart panel: resets columns, metrics, filters, sort, pagination; keeps dimensions and table_columns (pinned)', () => {
    const patch = buildDatasetChangePatch(table, 's', 'new', 'chart')!;
    expect(patch).toEqual({
      title: 'T',
      chart_type: 'table',
      customizations: { zebraRows: false },
      schema_name: 's',
      table_name: 'new',
      x_axis_column: undefined,
      y_axis_column: undefined,
      dimension_column: undefined,
      aggregate_column: undefined,
      aggregate_function: 'count',
      extra_dimension_column: undefined,
      geographic_column: undefined,
      value_column: undefined,
      selected_geojson_id: undefined,
      metrics: [],
      filters: [],
      sort: [],
      pagination: { enabled: false, page_size: 50 },
      computation_type: 'aggregated',
      layers: undefined,
      geojsonPreviewPayload: undefined,
      dataOverlayPayload: undefined,
    });
    expect(patch).not.toHaveProperty('dimensions');
    expect(patch).not.toHaveProperty('table_columns');
  });

  it('map panel: clears the map fields and metric, aggregate sum, country IND (pinned)', () => {
    const map = {
      ...table,
      chart_type: 'map' as const,
      geographic_column: 'state',
      district_column: 'district',
    };
    const patch = buildDatasetChangePatch(map, 's2', 'old', 'map')!;
    expect(patch).toMatchObject({
      schema_name: 's2',
      table_name: 'old',
      aggregate_function: 'sum',
      metrics: [],
      filters: [],
      drill_down_enabled: false,
      country_code: 'IND',
    });
    expect(patch.geographic_column).toBeUndefined();
    expect(patch.district_column).toBeUndefined();
    expect(patch).toHaveProperty('district_column');
    expect(patch).not.toHaveProperty('sort');
    expect(patch).not.toHaveProperty('pagination');
  });

  it('missing customizations become {}', () => {
    expect(
      buildDatasetChangePatch({ ...table, customizations: undefined }, 'x', 'y', 'chart')!
        .customizations
    ).toEqual({});
  });
});
