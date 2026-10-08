import type { ChartBuilderFormData } from '@/types/charts';
import type { ChartConfigPatch } from '@/components/charts/logic/type-switch';

/** Which data-config panel the dataset picker sits in. The two reset different fields (pinned). */
export type DataConfigPanel = 'chart' | 'map';

/** ChartDataConfiguration: clears every column choice; keeps dimensions/table_columns (PINNED-BUGS: "Dataset change on a table …"). */
function chartPanelReset(): ChartConfigPatch {
  return {
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
  };
}

/** MapDataConfiguration: clears the map fields and the metric (PINNED-BUGS: "Dataset change on a map …"). */
function mapPanelReset(): ChartConfigPatch {
  return {
    geographic_column: undefined,
    value_column: undefined,
    aggregate_function: 'sum',
    selected_geojson_id: undefined,
    metrics: [],
    filters: [],
    computation_type: 'aggregated',
    district_column: undefined,
    ward_column: undefined,
    subward_column: undefined,
    drill_down_enabled: false,
    geojsonPreviewPayload: undefined,
    dataOverlayPayload: undefined,
    country_code: 'IND',
  };
}

/** Patch for picking another dataset, or null when the same dataset is picked again. */
export function buildDatasetChangePatch(
  config: ChartBuilderFormData,
  schemaName: string,
  tableName: string,
  panel: DataConfigPanel
): ChartConfigPatch | null {
  if (config.schema_name === schemaName && config.table_name === tableName) return null;
  return {
    title: config.title,
    chart_type: config.chart_type,
    customizations: config.customizations || {},
    schema_name: schemaName,
    table_name: tableName,
    ...(panel === 'map' ? mapPanelReset() : chartPanelReset()),
  };
}
