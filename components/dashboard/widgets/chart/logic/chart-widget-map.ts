import type { Region } from '@/hooks/api/useChart';
import { ChartTypes, type Chart } from '@/types/charts';
import type { ChartWidgetVariant } from './chart-widget-option';

/** One step of a dashboard map's drill-down (geojson 0 = resolve from region_id). */
export interface WidgetMapDrillLevel {
  level: number;
  name: string;
  geographic_column: string;
  geojson_id: number;
  region_id?: number;
  parent_selections: Array<{ column: string; value: string }>;
}

/** What the map helpers read from a chart (private chart, public metadata or frozen config). */
export interface WidgetChartLike {
  chart_type?: string;
  schema_name?: string;
  table_name?: string;
  extra_config?: Chart['extra_config'];
}

export interface WidgetDrillToast {
  variant: 'success' | 'info' | 'error';
  message: string;
}

export interface WidgetRegionClick {
  toasts: WidgetDrillToast[];
  nextLevel: WidgetMapDrillLevel | null;
}

export interface WidgetRegionClickContext {
  /** The chart the widget renders. */
  chart: WidgetChartLike | null | undefined;
  /**
   * MODE-DRIFT: the view's legacy checks (district/ward columns, layers) read the private-page
   * chart (`useChart`), which is null on public and report pages. The builder passes `chart`.
   */
  legacyGateChart: WidgetChartLike | null | undefined;
  regions: Region[] | undefined;
  drillDownPath: WidgetMapDrillLevel[];
  activeGeographicColumn: string | null;
  regionName: string;
}

/** Flattens every parent selection on the drill path into column → value. */
export function collectDrillFilters(drillDownPath: WidgetMapDrillLevel[]): Record<string, string> {
  const filters: Record<string, string> = {};
  if (drillDownPath.length > 0) {
    // Collect all parent selections from the drill-down path
    drillDownPath.forEach((level) => {
      level.parent_selections.forEach((selection) => {
        filters[selection.column] = selection.value;
      });
    });
  }
  return filters;
}

/**
 * Geojson and geographic column a map widget shows: the drilled region's (resolved geojson),
 * else the current layer's, else the first layer's / the saved ones. Missing values come back
 * as null — every consumer treats null and undefined alike ("none").
 */
export function resolveWidgetMapLayer(
  chart: WidgetChartLike | null | undefined,
  drillDownPath: WidgetMapDrillLevel[],
  drillGeojsonId: number | null
): { activeGeojsonId: number | null; activeGeographicColumn: string | null } {
  let activeGeojsonId = null;
  let activeGeographicColumn = null;

  if (chart?.chart_type === ChartTypes.MAP) {
    const currentLevel = drillDownPath.length;
    const currentLayer = chart.extra_config?.layers
      ? chart.extra_config.layers[currentLevel]
      : null;
    const activeDrillDownLevel =
      drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1] : null;

    if (activeDrillDownLevel) {
      // We're in a drill-down state, use the first available geojson for this region
      activeGeographicColumn = activeDrillDownLevel.geographic_column;
      activeGeojsonId = drillGeojsonId;
    } else if (currentLayer) {
      // Use current layer configuration (first layer)
      activeGeojsonId = currentLayer.geojson_id;
      activeGeographicColumn = currentLayer.geographic_column;
    } else {
      // Fallback to first layer or original configuration
      const firstLayer = chart.extra_config?.layers?.[0];
      activeGeojsonId = firstLayer?.geojson_id || chart.extra_config?.selected_geojson_id;
      activeGeographicColumn =
        firstLayer?.geographic_column || chart.extra_config?.geographic_column;
    }
  }

  return {
    activeGeojsonId: activeGeojsonId ?? null,
    activeGeographicColumn: activeGeographicColumn ?? null,
  };
}

/** The map-data-overlay request of a dashboard map widget (dashboard filters resolved server-side). */
export function buildWidgetMapOverlayPayload(
  chart: WidgetChartLike | null | undefined,
  activeGeographicColumn: string | null,
  drillFilters: Record<string, string>,
  dashboardFilters: Record<string, unknown>
) {
  const metric = chart?.extra_config?.metrics?.[0];
  return chart?.chart_type === ChartTypes.MAP && chart.extra_config && activeGeographicColumn
    ? {
        schema_name: chart.schema_name,
        table_name: chart.table_name,
        geographic_column: activeGeographicColumn,
        metric,
        value_column: chart.extra_config.aggregate_column || chart.extra_config.value_column,
        aggregate_function: chart.extra_config.aggregate_function || (metric ? undefined : 'sum'),
        filters: drillFilters, // Drill-down filters
        // All map contexts (dashboard and report, public and private) resolve dashboard
        // filters server-side.
        dashboard_filters: dashboardFilters,
        // Chart-level filters go in extra_config.filters
        extra_config: {
          filters: [...(chart.extra_config.filters || [])],
          pagination: chart.extra_config.pagination,
          sort: chart.extra_config.sort,
        },
      }
    : null;
}

const NO_FURTHER_LEVELS: WidgetDrillToast = {
  variant: 'info',
  message: 'No further drill-down levels configured',
};

function regionNotFound(regionName: string): WidgetDrillToast {
  return { variant: 'error', message: `Region "${regionName}" not found in database` };
}

function findRegion(regions: Region[] | undefined, regionName: string) {
  return regions?.find(
    (region) => region.name === regionName || region.display_name === regionName
  );
}

function nextWidgetLevel(
  ctx: WidgetRegionClickContext,
  geographicColumn: string,
  geojsonId: number,
  regionId: number | undefined
): WidgetMapDrillLevel {
  return {
    level: ctx.drillDownPath.length + 1,
    name: ctx.regionName,
    geographic_column: geographicColumn,
    geojson_id: geojsonId, // 0 = resolved dynamically from region_id
    region_id: regionId,
    parent_selections: [
      ...ctx.drillDownPath.flatMap((level) => level.parent_selections),
      { column: ctx.activeGeographicColumn || '', value: ctx.regionName },
    ],
  };
}

/** Strategy 1 — geographic_hierarchy.drill_down_levels (both widgets). */
function resolveHierarchyClick(ctx: WidgetRegionClickContext): WidgetRegionClick {
  const hierarchy = ctx.chart?.extra_config?.geographic_hierarchy;
  const currentLevel = ctx.drillDownPath.length;
  const nextLevel = hierarchy.drill_down_levels.find(
    (level: { level: number }) => level.level === currentLevel + 1
  );
  if (!nextLevel) return { toasts: [NO_FURTHER_LEVELS], nextLevel: null };

  const selectedRegion = findRegion(ctx.regions, ctx.regionName);
  if (!selectedRegion) return { toasts: [regionNotFound(ctx.regionName)], nextLevel: null };

  return {
    toasts: [
      {
        variant: 'success',
        message: `Drilling down to ${nextLevel.label.toLowerCase()} in ${ctx.regionName}`,
      },
    ],
    nextLevel: nextWidgetLevel(ctx, nextLevel.column, 0, selectedRegion.id),
  };
}

const SIMPLIFIED_LEVELS = [
  { field: 'district_column', name: 'districts' },
  { field: 'ward_column', name: 'wards' },
  { field: 'subward_column', name: 'sub-wards' },
] as const;

/**
 * Strategy 2 — legacy district / ward / subward columns (both widgets). The success toast
 * fires before the region lookup, so a missing region shows both toasts. null = no next column.
 */
function resolveSimplifiedClick(
  ctx: WidgetRegionClickContext,
  logFoundRegion: boolean
): WidgetRegionClick | null {
  const step = SIMPLIFIED_LEVELS[ctx.drillDownPath.length];
  const nextGeographicColumn = step ? ctx.chart?.extra_config?.[step.field] : null;
  if (!nextGeographicColumn) return null;

  const drilling: WidgetDrillToast = {
    variant: 'success',
    message: `Drilling down to ${step.name} in ${ctx.regionName}`,
  };
  const selectedRegion = findRegion(ctx.regions, ctx.regionName);
  if (!selectedRegion) {
    return { toasts: [drilling, regionNotFound(ctx.regionName)], nextLevel: null };
  }
  if (logFoundRegion) {
    console.log(`🔍 Found region "${ctx.regionName}" with ID: ${selectedRegion.id}`);
  }
  return {
    toasts: [drilling],
    nextLevel: nextWidgetLevel(ctx, nextGeographicColumn, 0, selectedRegion.id),
  };
}

/** Strategy 3 — legacy `layers` (view only). */
function resolveLayersClick(ctx: WidgetRegionClickContext): WidgetRegionClick {
  // Fallback to legacy layers system
  // MODE-DRIFT: gated on the private chart (null on public/report pages).
  if (!ctx.legacyGateChart?.extra_config?.layers) {
    return { toasts: [NO_FURTHER_LEVELS], nextLevel: null };
  }

  const nextLevelIndex = ctx.drillDownPath.length + 1;
  const nextLayer = ctx.chart!.extra_config!.layers[nextLevelIndex];
  if (!nextLayer) return { toasts: [NO_FURTHER_LEVELS], nextLevel: null };

  // Validate drill-down is possible for the clicked region
  let nextGeojsonId = nextLayer.geojson_id;
  let regionSupported = true;
  let validationMessage = '';

  // If this layer has specific regions configured, check if clicked region is supported
  if (nextLayer.selected_regions && nextLayer.selected_regions.length > 0) {
    const matchingRegion = nextLayer.selected_regions.find(
      (region: { region_name: string }) => region.region_name === ctx.regionName
    );
    if (!matchingRegion) {
      regionSupported = false;
      validationMessage = `Drill-down not available for "${ctx.regionName}". This region is not configured for the next level.`;
    } else if (matchingRegion.geojson_id) {
      nextGeojsonId = matchingRegion.geojson_id;
    }
  }

  // Validate that we have a valid geojson_id
  if (regionSupported && (!nextGeojsonId || nextGeojsonId === 0)) {
    regionSupported = false;
    validationMessage = `Drill-down not available for "${ctx.regionName}". Geographic data is not configured for this region.`;
  }

  if (!regionSupported) {
    return { toasts: [{ variant: 'info', message: validationMessage }], nextLevel: null };
  }

  return {
    toasts: [],
    nextLevel: nextWidgetLevel(
      ctx,
      nextLayer.geographic_column || '',
      nextGeojsonId || 0,
      nextLayer.region_id
    ),
  };
}

/**
 * What a region click on a dashboard map widget does: toasts to show (in order) and the drill
 * level to push. null = not a map (nothing happens).
 * BUILDER-DRIFT: the builder knows two drill systems and ends with "No drill-down configuration
 * found for this chart"; the view also tries the legacy `layers`, answers "No further drill-down
 * levels configured" when district/ward columns exist but the next one doesn't, and logs the
 * region it found.
 */
export function resolveWidgetRegionClick(
  ctx: WidgetRegionClickContext,
  variant: ChartWidgetVariant
): WidgetRegionClick | null {
  if (ctx.chart?.chart_type !== ChartTypes.MAP) return null;

  // Check for dynamic drill-down configuration (new system)
  const hasDynamicDrillDown =
    ctx.chart.extra_config?.geographic_hierarchy?.drill_down_levels?.length > 0;
  if (hasDynamicDrillDown) return resolveHierarchyClick(ctx);

  // Check for legacy simplified drill-down configuration
  // MODE-DRIFT: the view gates on the private chart (null on public/report pages), so a legacy
  // district/ward map there falls through to "No further drill-down levels configured".
  const gate = ctx.legacyGateChart?.extra_config;
  const hasSimplifiedDrillDown = gate?.district_column || gate?.ward_column || gate?.subward_column;
  if (hasSimplifiedDrillDown) {
    const simplified = resolveSimplifiedClick(ctx, variant === 'view');
    if (simplified) return simplified;
    // No more levels available in simplified system
    if (variant === 'view') return { toasts: [NO_FURTHER_LEVELS], nextLevel: null };
  }

  if (variant === 'builder') {
    // No drill-down configuration found
    return {
      toasts: [{ variant: 'info', message: 'No drill-down configuration found for this chart' }],
      nextLevel: null,
    };
  }
  return resolveLayersClick(ctx);
}
