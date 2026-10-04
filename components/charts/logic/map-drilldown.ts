import type { ChartBuilderFormData } from '@/types/charts';
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
