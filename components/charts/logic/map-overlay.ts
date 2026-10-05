import { ChartTypes, type ChartBuilderFormData, type ChartMetric } from '@/types/charts';

// ---------------------------------------------------------------------------
// Request transform (moved verbatim from hooks/api/useChart.ts)
// ---------------------------------------------------------------------------

export interface MapDataOverlayRawPayload {
  schema_name: string;
  table_name: string;
  geographic_column: string;
  // Preferred: the actual metric (supports calculated/column_expression metrics).
  metric?: ChartMetric;
  // Legacy fields, used when `metric` isn't provided (charts saved before the metrics array existed).
  value_column?: string;
  aggregate_function?: string;
  filters?: Record<string, any>;
  dashboard_filters?: Record<string, any>;
  extra_config?: {
    filters?: any[];
    pagination?: any;
    sort?: any[];
  };
}

// Builds the overlay payload for a Simple-mode metric (aggregation + column).
// Returns null when there isn't enough information to run the aggregation.
function buildSimpleMapOverlayPayload(payload: MapDataOverlayRawPayload, metric?: ChartMetric) {
  const aggregation = metric?.aggregation || payload.aggregate_function;
  const column = metric?.column || payload.value_column;
  if (!aggregation || (!column && aggregation !== 'count')) {
    return null;
  }

  return {
    schema_name: payload.schema_name,
    table_name: payload.table_name,
    geographic_column: payload.geographic_column,
    value_column: column || payload.geographic_column,
    metrics: [
      {
        column: column || (aggregation === 'count' ? payload.geographic_column : null),
        aggregation,
        alias: 'value', // PINNED-BUGS: "map overlay sends metric alias as "value""
      },
    ],
    filters: payload.filters || {},
    dashboard_filters: payload.dashboard_filters || {},
    extra_config: payload.extra_config || {},
  };
}

// Builds the overlay payload for a Calculated-mode metric (column_expression).
function buildCalculatedMapOverlayPayload(payload: MapDataOverlayRawPayload, metric: ChartMetric) {
  return {
    schema_name: payload.schema_name,
    table_name: payload.table_name,
    geographic_column: payload.geographic_column,
    metrics: [
      {
        column_expression: metric.column_expression,
        alias: 'value',
      },
    ],
    filters: payload.filters || {},
    dashboard_filters: payload.dashboard_filters || {},
    extra_config: payload.extra_config || {},
  };
}

// Transform raw map overlay payload to match backend requirements.
// For count operations, value_column may be absent — falls back to geographic_column.
export function transformMapDataOverlayPayload(payload: MapDataOverlayRawPayload | null) {
  if (!payload || !payload.schema_name || !payload.table_name || !payload.geographic_column) {
    return null;
  }

  return payload.metric?.column_expression
    ? buildCalculatedMapOverlayPayload(payload, payload.metric)
    : buildSimpleMapOverlayPayload(payload, payload.metric);
}

// ---------------------------------------------------------------------------
// Builder map preview payloads
// ---------------------------------------------------------------------------

/** One level of the builder map drill-down path. */
export interface MapDrillLevel {
  level: number;
  name: string;
  geographic_column: string;
  parent_selections: Array<{ column: string; value: string }>;
  region_id?: number;
}

/** Every parent selection along the path as { column: value } (later levels win). */
export function collectDrillFilters(
  path: Array<Pick<MapDrillLevel, 'parent_selections'>>
): Record<string, string> {
  const filters: Record<string, string> = {};
  path.forEach((level) => {
    level.parent_selections.forEach((selection) => {
      filters[selection.column] = selection.value;
    });
  });
  return filters;
}

/** Column the builder map drills into: the hierarchy's first level, else the legacy district column. */
export function getMapDrillColumn(config: ChartBuilderFormData): string | undefined {
  const hasDynamicDrillDown = config.geographic_hierarchy?.drill_down_levels?.length > 0;
  return hasDynamicDrillDown
    ? config.geographic_hierarchy.drill_down_levels[0]?.column
    : config.district_column;
}

type CreateOverlayPayload = NonNullable<ChartBuilderFormData['dataOverlayPayload']>;

/** Create page: point the overlay at the drill level (column + parent filters). */
export function applyMapDrillToOverlay(
  base: CreateOverlayPayload | null,
  path: MapDrillLevel[],
  config: ChartBuilderFormData
): CreateOverlayPayload | null {
  if (!base) return null;
  if (path.length === 0) return base;
  return {
    ...base,
    geographic_column: getMapDrillColumn(config) || base.geographic_column,
    filters: { ...base.filters, ...collectDrillFilters(path) },
  };
}

/** Edit page overlay. PINNED-BUGS: "Edit-builder map preview ignores chart filters" (chart_filters: []). */
export function buildEditMapOverlayPayload(
  config: ChartBuilderFormData,
  path: MapDrillLevel[],
  chartId: number
) {
  if (config.chart_type !== ChartTypes.MAP || !config.schema_name || !config.table_name)
    return null;

  const drillColumn = path.length > 0 ? getMapDrillColumn(config) : undefined;
  const geographicColumn = drillColumn || config.geographic_column;
  const metric = config.metrics?.[0];
  if (!geographicColumn) return null;

  return {
    schema_name: config.schema_name,
    table_name: config.table_name,
    geographic_column: geographicColumn,
    metric,
    value_column: config.aggregate_column,
    aggregate_function: config.aggregate_function || (metric ? undefined : 'sum'),
    filters: collectDrillFilters(path),
    chart_filters: [] as unknown[],
    chart_id: chartId ? parseInt(String(chartId)) : undefined,
  };
}
