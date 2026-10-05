import {
  ChartTypes,
  type Chart,
  type ChartBuilderFormData,
  type ChartDimension,
  type ChartType,
} from '@/types/charts';
import { getDefaultCustomizations } from '@/components/charts/chart-types/default-customizations';
import { buildPivotExtraConfig } from '@/components/charts/chart-types/pivot-table/utils';
import { toSimplifiedMapFields } from '@/components/charts/logic/map-layers';

type SavedExtraConfig = Chart['extra_config'];

/** The edit page's config before the chart loads. PINNED-BUGS C-E7: aggregate `sum` (create uses `count`). */
export function createEmptyEditConfig(): ChartBuilderFormData {
  return {
    title: '',
    chart_type: ChartTypes.BAR,
    computation_type: 'aggregated',
    customizations: getDefaultCustomizations(ChartTypes.BAR, 'edit'),
    aggregate_function: 'sum',
  };
}

/** Saved maps without layers get one synthesized level-0 layer. */
function mapLayersOf(chart: Chart) {
  const ec = chart.extra_config;
  if (ec?.layers) return ec.layers;
  if (chart.chart_type !== ChartTypes.MAP) return undefined;
  return [
    {
      id: '0',
      level: 0,
      geographic_column: ec?.geographic_column,
      geojson_id: ec?.selected_geojson_id,
    },
  ];
}

/** Table dimensions: new `dimensions` shape, else `dimension_columns`, else the legacy single column. */
function tableDimensionsOf(ec: SavedExtraConfig): ChartDimension[] {
  if (ec?.dimensions && ec.dimensions.length > 0) {
    // any: saved dimensions are legacy strings or {column, enable_drill_down} objects
    return ec.dimensions.map((d: any) => ({
      column: d.column || d,
      enable_drill_down: d.enable_drill_down === true,
    }));
  }
  if (ec?.dimension_columns && ec.dimension_columns.length > 0) {
    return ec.dimension_columns.map((col: string) => ({ column: col, enable_drill_down: false }));
  }
  return ec?.dimension_column ? [{ column: ec.dimension_column, enable_drill_down: false }] : [];
}

function tableDimensionColumnsOf(ec: SavedExtraConfig): string[] {
  if (ec?.dimension_columns) return ec.dimension_columns;
  // any: saved dimensions are legacy strings or {column, enable_drill_down} objects
  if (ec?.dimensions) return ec.dimensions.map((d: any) => d.column || d).filter(Boolean);
  return ec?.dimension_column ? [ec.dimension_column] : [];
}

/** Map drill fields: values from layers win, then the flat saved fields. */
function mapFieldsOf(ec: SavedExtraConfig) {
  const fromLayers = ec?.layers ? toSimplifiedMapFields(ec.layers) : {};
  return {
    geographic_column: fromLayers.geographic_column || ec?.geographic_column,
    value_column: ec?.value_column,
    selected_geojson_id: fromLayers.selected_geojson_id || ec?.selected_geojson_id,
    district_column: fromLayers.district_column || ec?.district_column,
    ward_column: fromLayers.ward_column || ec?.ward_column,
    subward_column: fromLayers.subward_column || ec?.subward_column,
    drill_down_enabled: fromLayers.drill_down_enabled || ec?.drill_down_enabled,
  };
}

/** A saved chart → the builder config the edit page starts from. Moved verbatim from the edit page's load effect. */
export function toBuilderConfig(chart: Chart): ChartBuilderFormData {
  const ec = chart.extra_config;
  return {
    title: chart.title,
    chart_type: chart.chart_type as ChartType,
    computation_type: chart.computation_type as 'raw' | 'aggregated',
    schema_name: chart.schema_name,
    table_name: chart.table_name,
    x_axis_column: ec?.x_axis_column,
    y_axis_column: ec?.y_axis_column,
    dimension_column: ec?.dimension_column,
    aggregate_column: ec?.aggregate_column,
    aggregate_function: ec?.aggregate_function,
    extra_dimension_column: ec?.extra_dimension_column,
    metrics: ec?.metrics,
    time_grain: ec?.time_grain,
    ...mapFieldsOf(ec),
    country_code: ec?.country_code || 'IND',
    layers: mapLayersOf(chart),
    customizations: ec?.customizations || getDefaultCustomizations(chart.chart_type, 'edit'),
    filters: ec?.filters || [],
    pagination: ec?.pagination || { enabled: false, page_size: 50 },
    sort: ec?.sort || [],
    geographic_hierarchy: ec?.geographic_hierarchy,
    table_columns: ec?.table_columns || [],
    ...(chart.chart_type === ChartTypes.TABLE && {
      dimensions: tableDimensionsOf(ec),
      dimension_columns: tableDimensionColumnsOf(ec),
    }),
    ...(chart.chart_type === ChartTypes.PIVOT_TABLE && {
      extra_config: buildPivotExtraConfig(ec),
    }),
  };
}
