import type { Chart, ChartBuilderFormData } from '@/types/charts';
import type { Region } from '@/hooks/api/useChart';
import { getMapDrillColumn, type MapDrillLevel } from '@/components/charts/logic/map-overlay';

function findRegion(regions: Region[] | undefined, regionName: string): Region | undefined {
  return regions?.find(
    (region) => region.name === regionName || region.display_name === regionName
  );
}

// ---------------------------------------------------------------------------
// Builders (create + edit): one drill level, from states to the configured drill column
// ---------------------------------------------------------------------------

export type BuilderRegionClick =
  | { kind: 'drillNotConfigured' }
  | { kind: 'noDrillColumn' }
  | { kind: 'regionNotFound' }
  | { kind: 'drill'; level: MapDrillLevel };

/** What a click on a state in the builder map preview does. */
export function resolveBuilderRegionClick(
  config: ChartBuilderFormData,
  states: Region[] | undefined,
  regionName: string
): BuilderRegionClick {
  const hasDynamicDrillDown = config.geographic_hierarchy?.drill_down_levels?.length > 0;
  if (!hasDynamicDrillDown && !config.district_column) return { kind: 'drillNotConfigured' };

  const drillColumn = getMapDrillColumn(config);
  if (!drillColumn) return { kind: 'noDrillColumn' };

  const region = findRegion(states, regionName);
  if (!region) return { kind: 'regionNotFound' };

  return {
    kind: 'drill',
    level: {
      level: 1,
      name: regionName,
      geographic_column: drillColumn,
      parent_selections: [{ column: config.geographic_column || '', value: regionName }],
      region_id: region.id,
    },
  };
}

// ---------------------------------------------------------------------------
// Detail page: three drill systems, tried in this order
// ---------------------------------------------------------------------------

/** A drill level on the detail page (geojson resolved later from region_id). */
export interface DetailDrillLevel {
  level: number;
  name: string;
  geographic_column: string;
  geojson_id: number;
  region_id?: number;
  parent_selections: Array<{ column: string; value: string }>;
}

/** A toast the detail page shows, exactly as sonner is called today. */
export interface DetailDrillToast {
  variant: 'success' | 'info' | 'error' | 'warning';
  message: string;
  description?: string;
  position?: 'top-right';
  duration?: number;
  /** Adds the "Edit Chart" action button. */
  withEditAction?: boolean;
}

export interface DetailRegionClick {
  toasts: DetailDrillToast[];
  nextLevel: DetailDrillLevel | null;
}

export interface DetailRegionClickContext {
  chart: Chart;
  regions: Region[] | undefined;
  drillDownPath: DetailDrillLevel[];
  activeGeographicColumn: string | null;
  canEditCharts: boolean;
  regionName: string;
}

function nextDetailLevel(
  ctx: DetailRegionClickContext,
  geographicColumn: string,
  geojsonId: number,
  regionId: number | undefined
): DetailDrillLevel {
  return {
    level: ctx.drillDownPath.length + 1,
    name: ctx.regionName,
    geographic_column: geographicColumn,
    geojson_id: geojsonId,
    region_id: regionId,
    parent_selections: [
      ...ctx.drillDownPath.flatMap((level) => level.parent_selections),
      { column: ctx.activeGeographicColumn || '', value: ctx.regionName },
    ],
  };
}

const NO_FURTHER_LEVELS: DetailDrillToast = {
  variant: 'info',
  message: 'No further drill-down levels configured',
};

/** Strategy 1 — geographic_hierarchy.drill_down_levels (UI-built maps). */
function resolveHierarchyClick(ctx: DetailRegionClickContext): DetailRegionClick {
  const hierarchy = ctx.chart.extra_config.geographic_hierarchy;
  const currentLevel = ctx.drillDownPath.length;
  const nextLevel = hierarchy.drill_down_levels.find((l: any) => l.level === currentLevel + 1);
  if (!nextLevel) return { toasts: [NO_FURTHER_LEVELS], nextLevel: null };

  const region = findRegion(ctx.regions, ctx.regionName);
  if (!region) {
    return {
      toasts: [{ variant: 'error', message: `Region "${ctx.regionName}" not found in database` }],
      nextLevel: null,
    };
  }
  return {
    // PINNED-BUGS: "Map drill hierarchy built in UI mislabelled … 'Drilling down to state in Rajasthan'"
    toasts: [
      {
        variant: 'success',
        message: `🗺️ Drilling down to ${nextLevel.label.toLowerCase()} in ${ctx.regionName}`,
      },
    ],
    nextLevel: nextDetailLevel(ctx, nextLevel.column, 0, region.id),
  };
}

const SIMPLIFIED_LEVELS = [
  { field: 'district_column', name: 'districts' },
  { field: 'ward_column', name: 'wards' },
  { field: 'subward_column', name: 'sub-wards' },
] as const;

/** Strategy 2 — legacy flat district/ward/subward columns. Success toast fires before the region lookup. */
function resolveSimplifiedClick(ctx: DetailRegionClickContext): DetailRegionClick {
  const step = SIMPLIFIED_LEVELS[ctx.drillDownPath.length];
  const nextColumn = step ? ctx.chart.extra_config[step.field] : null;
  if (!nextColumn) return { toasts: [NO_FURTHER_LEVELS], nextLevel: null };

  const drilling: DetailDrillToast = {
    variant: 'success',
    message: `🗺️ Drilling down to ${step.name} in ${ctx.regionName}`,
  };
  const region = findRegion(ctx.regions, ctx.regionName);
  if (!region) {
    return {
      toasts: [
        drilling,
        { variant: 'error', message: `Region "${ctx.regionName}" not found in database` },
      ],
      nextLevel: null,
    };
  }
  return { toasts: [drilling], nextLevel: nextDetailLevel(ctx, nextColumn, 0, region.id) };
}

function noLayersToast(canEditCharts: boolean): DetailDrillToast {
  return {
    variant: 'info',
    message: '🗺️ No further drill-down levels configured',
    description: canEditCharts
      ? 'Configure additional layers in edit mode to enable deeper drill-down'
      : 'This chart needs additional layers configured for deeper drill-down',
    position: 'top-right',
  };
}

/** Is the clicked region set up in the next layer? Returns its geojson when it is. */
function findConfiguredLayerRegion(nextLayer: any, regionName: string) {
  if (nextLayer.selected_regions && nextLayer.selected_regions.length > 0) {
    const match = nextLayer.selected_regions.find((r: any) => r.region_name === regionName);
    return match && match.geojson_id
      ? { isConfigured: true, geojsonId: match.geojson_id }
      : { isConfigured: false, geojsonId: nextLayer.geojson_id };
  }
  return { isConfigured: !!nextLayer.geojson_id, geojsonId: nextLayer.geojson_id };
}

/** PINNED-BUGS: 'Detail "excluded by filter" toast unreachable — checks "!=", builder writes not_equals'. */
function notConfiguredToast(ctx: DetailRegionClickContext): DetailDrillToast {
  const isFiltered = (ctx.chart.extra_config?.filters || []).some(
    (f: any) => (f.operator === 'not equals' || f.operator === '!=') && f.value === ctx.regionName
  );
  if (isFiltered) {
    return {
      variant: 'warning',
      message: `🚫 ${ctx.regionName} excluded by filter`,
      description: `This region is filtered out and not available for drill-down`,
      position: 'top-right',
      duration: 4000,
    };
  }
  return {
    variant: 'info',
    message: `🗺️ ${ctx.regionName} not configured for drill-down`,
    description: ctx.canEditCharts
      ? 'Configure this region in edit mode to enable drill-down'
      : 'This region is not configured for drill-down',
    position: 'top-right',
    duration: 4000,
    withEditAction: ctx.canEditCharts,
  };
}

/** Strategy 3 — legacy `layers` array. */
function resolveLayersClick(ctx: DetailRegionClickContext): DetailRegionClick {
  const layers = ctx.chart.extra_config?.layers;
  const nextLayer = layers?.[ctx.drillDownPath.length + 1];
  if (!layers || !nextLayer) return { toasts: [noLayersToast(ctx.canEditCharts)], nextLevel: null };

  const { isConfigured, geojsonId } = findConfiguredLayerRegion(nextLayer, ctx.regionName);
  if (!isConfigured) return { toasts: [notConfiguredToast(ctx)], nextLevel: null };

  return {
    toasts: [],
    nextLevel: nextDetailLevel(
      ctx,
      nextLayer.geographic_column || '',
      geojsonId || 0,
      nextLayer.region_id
    ),
  };
}

/** What a region click on the detail-page map does: toasts to show and the level to push (if any). */
export function resolveDetailRegionClick(ctx: DetailRegionClickContext): DetailRegionClick {
  const ec = ctx.chart.extra_config;
  if (ec?.geographic_hierarchy?.drill_down_levels?.length > 0) return resolveHierarchyClick(ctx);
  if (ec?.district_column || ec?.ward_column || ec?.subward_column)
    return resolveSimplifiedClick(ctx);
  return resolveLayersClick(ctx);
}
