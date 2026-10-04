import type {
  ChartBuilderFormData,
  ChartDataPayload,
  ChartDimension,
  ChartFilter,
} from '@/types/charts';
import { ChartTypes } from '@/types/charts';
import { getApiCustomizations } from '@/lib/chart-payload-utils';
import { buildPivotDataFields } from '@/components/charts/pivot-table/utils';
import type { ChartBuilderKind } from '@/components/charts/chart-types/default-customizations';
import { isChartReady } from '@/components/charts/logic/validation';

/** Where a table chart's drill-down currently is (null = top level, not drilled). */
export interface TableDrillDownState {
  currentLevel: number; // 0 = first dimension, 1 = second dimension, etc.
  appliedFilters: Record<string, string>; // { dimension_column: value }
}

/** Which dimension columns a table request groups by, given the drill-down state. */
export function resolveTableDimensions(
  dimensions: ChartDimension[],
  tableDrillDown: TableDrillDownState | null
): string[] {
  const isDrillDownEnabled = dimensions.some((dim) => dim.enable_drill_down === true);
  if (!isDrillDownEnabled) return dimensions.map((d) => d.column).filter(Boolean);

  const drillDownColumns = dimensions
    .filter((dim) => dim.enable_drill_down)
    .map((d) => d.column)
    .filter(Boolean);
  if (!tableDrillDown) return [drillDownColumns[0]];

  const nextIndex = Math.min(tableDrillDown.currentLevel + 1, drillDownColumns.length - 1);
  return [drillDownColumns[nextIndex]];
}

/** PINNED-BUGS: create sends `metrics` whenever the array exists (even empty); edit only when non-empty. */
function metricsField(config: ChartBuilderFormData, builder: ChartBuilderKind) {
  if (builder === 'create') return config.metrics ? { metrics: config.metrics } : {};
  return config.metrics && config.metrics.length > 0 ? { metrics: config.metrics } : {};
}

function tableDimensionsField(
  config: ChartBuilderFormData,
  tableDrillDown: TableDrillDownState | null,
  builder: ChartBuilderKind
) {
  if (
    config.chart_type !== ChartTypes.TABLE ||
    !config.dimensions ||
    config.dimensions.length === 0
  ) {
    return {};
  }
  return {
    dimensions: resolveTableDimensions(config.dimensions, tableDrillDown),
    // PINNED-BUGS: only the edit page sends table_columns here
    ...(builder === 'edit' && { table_columns: config.table_columns }),
  };
}

/** Map fields. Must be spread AFTER dimension_col/aggregate_col: for maps they override them. */
function mapFields(config: ChartBuilderFormData) {
  const isMap = config.chart_type === ChartTypes.MAP;
  return {
    ...(config.geographic_column && { geographic_column: config.geographic_column }),
    ...(config.value_column && { value_column: config.value_column }),
    ...(config.selected_geojson_id && { selected_geojson_id: config.selected_geojson_id }),
    ...(isMap &&
      config.layers?.[0]?.geojson_id && { selected_geojson_id: config.layers[0].geojson_id }),
    ...(isMap && {
      ...(config.geographic_column && { dimension_col: config.geographic_column }),
      ...((config.aggregate_column || config.value_column) && {
        aggregate_col: config.aggregate_column || config.value_column,
      }),
    }),
  };
}

function tableDrillDownFilters(
  config: ChartBuilderFormData,
  tableDrillDown: TableDrillDownState | null
): ChartFilter[] {
  if (config.chart_type !== ChartTypes.TABLE || !tableDrillDown?.appliedFilters) return [];
  return Object.entries(tableDrillDown.appliedFilters).map(([column, value]) => ({
    column,
    operator: 'equals' as const,
    value,
  }));
}

/** Request body for /api/charts/chart-data/ and the data preview, or null while not ready. */
export function buildChartDataPayload(
  config: ChartBuilderFormData,
  tableDrillDown: TableDrillDownState | null,
  builder: ChartBuilderKind
): ChartDataPayload | null {
  if (!isChartReady(config, builder)) return null;

  const sendsCustomizations =
    config.chart_type !== ChartTypes.TABLE && config.chart_type !== ChartTypes.PIVOT_TABLE;

  return {
    chart_type: config.chart_type!,
    computation_type: config.computation_type!,
    schema_name: config.schema_name!,
    table_name: config.table_name!,
    ...(config.x_axis_column && { x_axis: config.x_axis_column }),
    ...(config.y_axis_column && { y_axis: config.y_axis_column }),
    ...(config.dimension_column && { dimension_col: config.dimension_column }),
    ...(config.aggregate_column && { aggregate_col: config.aggregate_column }),
    ...(config.aggregate_function && { aggregate_func: config.aggregate_function }),
    ...(config.extra_dimension_column && { extra_dimension: config.extra_dimension_column }),
    ...metricsField(config, builder),
    // The /chart-data/ pipeline reads pivot fields off the payload root (not extra_config).
    ...(config.chart_type === ChartTypes.PIVOT_TABLE && buildPivotDataFields(config.extra_config)),
    ...tableDimensionsField(config, tableDrillDown, builder),
    ...mapFields(config),
    // Number formatting is frontend-only — excluded from the API payload.
    ...(sendsCustomizations && {
      customizations: getApiCustomizations(config.chart_type, config.customizations),
    }),
    extra_config: {
      filters: [...(config.filters || []), ...tableDrillDownFilters(config, tableDrillDown)],
      pagination: config.pagination,
      sort: config.sort,
      time_grain: config.time_grain,
      ...(builder === 'edit' && { table_columns: config.table_columns }), // PINNED-BUGS: edit only
    },
  };
}
