import type { Chart, ChartDataPayload } from '@/types/charts';
import { buildPivotDataFields } from '@/components/charts/chart-types/pivot-table/utils';
import type { TableDrillDownState } from '@/components/charts/logic/payload';
import {
  getDrillDownColumns,
  isTableDrillDownEnabled,
} from '@/components/charts/logic/table-drilldown';
import type { DetailDrillLevel } from '@/components/charts/logic/map-drilldown';

/** Detail page table dimensions: every column when drill is off (dimension_columns fallback), else one level. */
function savedTableDimensions(chart: Chart, tableDrillDown: TableDrillDownState | null): string[] {
  const ec = chart.extra_config;
  if (!isTableDrillDownEnabled(ec?.dimensions)) {
    if (ec?.dimensions && ec.dimensions.length > 0) {
      return ec.dimensions.map((d: any) => d.column).filter(Boolean);
    }
    if (ec?.dimension_columns && ec.dimension_columns.length > 0) return ec.dimension_columns;
    return [];
  }
  const drillColumns = getDrillDownColumns(ec.dimensions);
  if (!tableDrillDown) return [drillColumns[0]];
  return [drillColumns[Math.min(tableDrillDown.currentLevel + 1, drillColumns.length - 1)]];
}

function savedTableDrillFilters(chart: Chart, tableDrillDown: TableDrillDownState | null) {
  if (chart.chart_type !== 'table' || !tableDrillDown?.appliedFilters) return [];
  return Object.entries(tableDrillDown.appliedFilters).map(([column, value]) => ({
    column,
    operator: 'equals',
    value,
  }));
}

/**
 * /chart-data/ body for a saved chart on the detail page. Moved verbatim from ChartDetailClient.
 * Differs from the builders' payload on purpose (aggregate_func defaults to 'sum', customizations always sent).
 */
export function buildSavedChartDataPayload(
  chart: Chart,
  tableDrillDown: TableDrillDownState | null
): ChartDataPayload {
  const ec = chart.extra_config;
  return {
    chart_type: chart.chart_type,
    computation_type: chart.computation_type,
    schema_name: chart.schema_name,
    table_name: chart.table_name,
    x_axis: ec?.x_axis_column,
    y_axis: ec?.y_axis_column,
    dimension_col: ec?.dimension_column,
    aggregate_col: ec?.aggregate_column,
    aggregate_func: ec?.aggregate_function || 'sum',
    extra_dimension: ec?.extra_dimension_column,
    geographic_column: ec?.geographic_column,
    value_column: ec?.value_column,
    selected_geojson_id:
      ec?.selected_geojson_id ||
      (chart.chart_type === 'map' && ec?.layers?.[0]?.geojson_id
        ? ec.layers[0].geojson_id
        : undefined),
    ...(chart.chart_type === 'map' && {
      dimension_col: ec?.geographic_column,
      aggregate_col: ec?.aggregate_column || ec?.value_column,
    }),
    ...(chart.chart_type === 'pivot_table' && buildPivotDataFields(ec)),
    ...(chart.chart_type === 'table' && {
      dimensions: savedTableDimensions(chart, tableDrillDown),
      table_columns: ec?.table_columns,
    }),
    customizations: ec?.customizations || {},
    metrics: ec?.metrics,
    extra_config: {
      filters: [...(ec?.filters || []), ...savedTableDrillFilters(chart, tableDrillDown)],
      pagination: ec?.pagination,
      sort: ec?.sort,
      time_grain: ec?.time_grain,
      table_columns: ec?.table_columns,
    },
  } as ChartDataPayload;
}

/** Which geojson + geographic column the detail map shows at the current drill level. */
export function resolveSavedMapSource(
  chart: Chart | undefined,
  drillDownPath: DetailDrillLevel[],
  drillGeojsonId: number | null
): { geojsonId: number | null; geographicColumn: string | null } {
  if (chart?.chart_type !== 'map') return { geojsonId: null, geographicColumn: null };
  const activeLevel = drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1] : null;
  if (activeLevel)
    return { geojsonId: drillGeojsonId, geographicColumn: activeLevel.geographic_column };

  const ec = chart.extra_config;
  const currentLayer = ec?.layers ? ec.layers[drillDownPath.length] : null;
  if (currentLayer) {
    return { geojsonId: currentLayer.geojson_id, geographicColumn: currentLayer.geographic_column };
  }
  const firstLayer = ec?.layers?.[0];
  return {
    geojsonId: firstLayer?.geojson_id || ec?.selected_geojson_id,
    geographicColumn: firstLayer?.geographic_column || ec?.geographic_column,
  };
}

/** Detail map overlay request (chart filters included, unlike the edit builder's). */
export function buildSavedMapOverlayPayload(
  chart: Chart | undefined,
  geographicColumn: string | null,
  drillFilters: Record<string, string>
) {
  const ec = chart?.extra_config;
  const metric = ec?.metrics?.[0];
  if (chart?.chart_type !== 'map' || !ec || !geographicColumn) return null;
  return {
    schema_name: chart.schema_name,
    table_name: chart.table_name,
    geographic_column: geographicColumn,
    metric,
    value_column: ec.aggregate_column || ec.value_column,
    aggregate_function: ec.aggregate_function || (metric ? undefined : 'sum'),
    filters: drillFilters,
    chart_filters: ec.filters || [],
    extra_config: {
      filters: ec.filters || [],
      pagination: ec.pagination,
      sort: ec.sort,
    },
  };
}
