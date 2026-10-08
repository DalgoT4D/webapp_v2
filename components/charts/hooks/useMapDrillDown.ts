'use client';

import { useCallback, useState } from 'react';
import type { ChartBuilderFormData } from '@/types/charts';
import type { ChartBuilderKind } from '@/components/charts/logic/builder-kind';
import type { MapDrillLevel } from '@/components/charts/logic/map-overlay';
import {
  resolveBuilderRegionClick,
  type BuilderRegionClick,
} from '@/components/charts/logic/map-drilldown';
import { useChildRegions, useRegions } from '@/hooks/api/useChart';
import { toastError, toastInfo, toastSuccess } from '@/lib/toast';

// TODO: make this dynamic based on selected geojson
const MAP_COUNTRY_CODE = 'IND';

/** PINNED-BUGS: "Map region click in create builder without drill level → info toast; edit builder → nothing". */
function announceCreateRegionClick(click: BuilderRegionClick, regionName: string) {
  if (click.kind === 'drillNotConfigured') {
    toastInfo.generic('Configure drill-down levels to enable region drilling');
  } else if (click.kind === 'regionNotFound') {
    toastError.api(`Region "${regionName}" not found for drill-down`);
  } else if (click.kind === 'drill') {
    toastSuccess.generic(`✨ Drilling down to ${regionName} districts!`);
  }
}

export function useMapDrillDown(config: ChartBuilderFormData, builder: ChartBuilderKind) {
  const [drillDownPath, setDrillDownPath] = useState<MapDrillLevel[]>([]);
  const { data: states } = useRegions(MAP_COUNTRY_CODE, 'state');
  const lastRegionId =
    drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1].region_id : null;
  // Result unused today, but both pages make this request — kept for identical network traffic.
  useChildRegions(lastRegionId, drillDownPath.length > 0);

  const { geographic_hierarchy, district_column, geographic_column } = config;
  // Same dependency list as the handlers it replaces: MapPreview re-inits when this identity changes.
  const handleRegionClick = useCallback(
    (regionName: string, _regionData?: unknown) => {
      const click = resolveBuilderRegionClick(
        { geographic_hierarchy, district_column, geographic_column },
        states,
        regionName
      );
      if (click.kind === 'drill') setDrillDownPath([click.level]);
      if (builder === 'create') announceCreateRegionClick(click, regionName);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drillDownPath kept as in the original handlers
    [geographic_hierarchy, district_column, geographic_column, states, drillDownPath, builder]
  );

  const handleDrillUp = useCallback((targetLevel: number) => {
    if (targetLevel < 0) setDrillDownPath([]);
    else setDrillDownPath((prev) => prev.slice(0, targetLevel + 1));
  }, []);
  const handleDrillHome = useCallback(() => setDrillDownPath([]), []);

  return { drillDownPath, handleRegionClick, handleDrillUp, handleDrillHome };
}
