import { createEmptyEditConfig, toBuilderConfig } from '@/components/charts/logic/saved-chart';
import type { Chart } from '@/types/charts';

const saved = (chart_type: Chart['chart_type'], extra_config: Record<string, unknown>): Chart => ({
  id: 1,
  title: 'Saved',
  chart_type,
  computation_type: 'aggregated',
  schema_name: 's',
  table_name: 't',
  extra_config,
  echarts_config: {},
  created_at: '',
  updated_at: '',
});

describe('createEmptyEditConfig', () => {
  it('starts as a bar with SUM and edit legend defaults (pinned C-E7)', () => {
    expect(createEmptyEditConfig()).toEqual({
      title: '',
      chart_type: 'bar',
      computation_type: 'aggregated',
      aggregate_function: 'sum',
      customizations: {
        orientation: 'vertical',
        showDataLabels: false,
        dataLabelPosition: 'top',
        stacked: false,
        showTooltip: true,
        showLegend: true,
        xAxisTitle: '',
        yAxisTitle: '',
        xAxisLabelRotation: '45',
        yAxisLabelRotation: 'horizontal',
        legendDisplay: 'paginated',
        legendPosition: 'top',
      },
    });
  });
});

describe('toBuilderConfig', () => {
  it('bar: copies fields and fills list defaults', () => {
    const config = toBuilderConfig(
      saved('bar', {
        dimension_column: 'state',
        aggregate_function: 'count',
        customizations: { a: 1 },
      })
    );
    expect(config).toMatchObject({
      title: 'Saved',
      chart_type: 'bar',
      dimension_column: 'state',
      aggregate_function: 'count',
      customizations: { a: 1 },
      filters: [],
      pagination: { enabled: false, page_size: 50 },
      sort: [],
      table_columns: [],
      country_code: 'IND',
    });
    expect(config.layers).toBeUndefined();
    expect(config).not.toHaveProperty('dimensions');
    expect(config).not.toHaveProperty('extra_config');
  });

  it('missing customizations use the edit defaults for the saved type', () => {
    expect(toBuilderConfig(saved('map', {})).customizations).toEqual({
      colorScheme: 'Blues',
      showTooltip: true,
      showLegend: true,
      nullValueLabel: 'No Data',
      title: '',
      showLabels: false,
    });
  });

  it('map without layers gets one synthesized level-0 layer', () => {
    const config = toBuilderConfig(
      saved('map', { geographic_column: 'state', selected_geojson_id: 35 })
    );
    expect(config.layers).toEqual([
      { id: '0', level: 0, geographic_column: 'state', geojson_id: 35 },
    ]);
    expect(config.geographic_column).toBe('state');
    expect(config.selected_geojson_id).toBe(35);
    expect(config.drill_down_enabled).toBeUndefined();
  });

  it('map with an empty layers array keeps it (no synthesized layer)', () => {
    const config = toBuilderConfig(saved('map', { layers: [], geographic_column: 'state' }));
    expect(config.layers).toEqual([]);
    expect(config.geographic_column).toBe('state');
  });

  it('map with layers: layer values win over the flat fields', () => {
    const config = toBuilderConfig(
      saved('map', {
        geographic_column: 'old_state',
        selected_geojson_id: 1,
        layers: [
          { level: 0, geographic_column: 'state', geojson_id: 9 },
          { level: 1, geographic_column: 'district' },
        ],
      })
    );
    expect(config).toMatchObject({
      geographic_column: 'state',
      selected_geojson_id: 9,
      district_column: 'district',
      drill_down_enabled: true,
    });
  });

  it('table: dimensions from dimension_columns when the new shape is missing', () => {
    const config = toBuilderConfig(saved('table', { dimension_columns: ['state', 'district'] }));
    expect(config.dimensions).toEqual([
      { column: 'state', enable_drill_down: false },
      { column: 'district', enable_drill_down: false },
    ]);
    expect(config.dimension_columns).toEqual(['state', 'district']);
  });

  it('table: legacy single dimension_column; string dimensions are accepted', () => {
    expect(toBuilderConfig(saved('table', { dimension_column: 'state' })).dimensions).toEqual([
      { column: 'state', enable_drill_down: false },
    ]);
    const fromStrings = toBuilderConfig(saved('table', { dimensions: ['state'] }));
    expect(fromStrings.dimensions).toEqual([{ column: 'state', enable_drill_down: false }]);
    expect(fromStrings.dimension_columns).toEqual(['state']);
  });

  it('pivot: extra_config gets the normalized pivot fields with default labels', () => {
    expect(
      toBuilderConfig(saved('pivot_table', { row_dimensions: ['state'] })).extra_config
    ).toEqual({
      row_dimensions: ['state'],
      column_dimensions: [],
      show_row_subtotals: false,
      show_column_subtotals: false,
      show_row_grand_total: false,
      show_column_grand_total: false,
      row_subtotal_label: 'Subtotal',
      column_subtotal_label: 'Subtotal',
      row_grand_total_label: 'Grand Total',
      column_grand_total_label: 'Grand Total',
    });
  });
});
