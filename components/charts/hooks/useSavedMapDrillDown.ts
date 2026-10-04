'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { Chart } from '@/types/charts';
import {
  useGeoJSONData,
  useMapDataOverlay,
  useRegionGeoJSONs,
  useRegions,
} from '@/hooks/api/useChart';
import { resolveDrillDownGeoJSON } from '@/lib/map-drilldown-utils';
import { collectDrillFilters } from '@/components/charts/logic/map-overlay';
import {
  resolveDetailRegionClick,
  type DetailDrillLevel,
  type DetailDrillToast,
} from '@/components/charts/logic/map-drilldown';
import {
  buildSavedMapOverlayPayload,
  resolveSavedMapSource,
} from '@/components/charts/logic/saved-chart-payload';

/** Shows a detail drill toast exactly as ChartDetailClient called sonner (short toasts get no options arg). */
function showDrillToast(t: DetailDrillToast, onEditChart: () => void) {
  if (!t.description) {
    toast[t.variant](t.message);
    return;
  }
  toast[t.variant](t.message, {
    description: t.description,
    position: t.position,
    ...(t.duration !== undefined && { duration: t.duration }),
    ...(t.withEditAction && { action: { label: 'Edit Chart', onClick: onEditChart } }),
  });
}

interface UseSavedMapDrillDownOptions {
  chart: Chart | undefined;
  chartId: number;
  canEditCharts: boolean;
}

/** Map drill-down on the chart detail page: path state, geojson + overlay fetching, region clicks. */
export function useSavedMapDrillDown({
  chart,
  chartId,
  canEditCharts,
}: UseSavedMapDrillDownOptions) {
  const router = useRouter();
  const [drillDownPath, setDrillDownPath] = useState<DetailDrillLevel[]>([]);

  // Fetch regions data for dynamic geojson lookup (for Indian maps)
  const { data: regions } = useRegions('IND', 'state');

  const activeLevel = drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1] : null;
  const currentRegionId = activeLevel ? activeLevel.region_id : null;
  // Fetch geojsons for the current drill-down region (e.g., Karnataka districts)
  const regionGeojsons = useRegionGeoJSONs(currentRegionId);
  const resolution = resolveDrillDownGeoJSON({
    isDrillDownActive: Boolean(activeLevel),
    regionId: currentRegionId,
    regionGeojsons: regionGeojsons.data,
    regionGeojsonsLoading: regionGeojsons.isLoading,
    regionGeojsonsError: regionGeojsons.error,
    fallbackGeojsonId: activeLevel?.geojson_id,
  });
  const { geojsonId, geographicColumn } = resolveSavedMapSource(
    chart,
    drillDownPath,
    resolution.geojsonId
  );
  const geojson = useGeoJSONData(geojsonId);

  const drillFilters = useMemo(() => collectDrillFilters(drillDownPath), [drillDownPath]);
  const overlayPayload = useMemo(
    () => buildSavedMapOverlayPayload(chart, geographicColumn, drillFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same deps as the memo it replaces
    [
      chart?.chart_type,
      chart?.schema_name,
      chart?.table_name,
      chart?.extra_config,
      geographicColumn,
      drillFilters,
    ]
  );
  const overlay = useMapDataOverlay(overlayPayload);

  const currentLevel = drillDownPath.length;
  // Stable reference — MapPreview's chart-init effect depends on onRegionClick;
  // an unstable reference here would re-trigger that effect (and the map render) every render
  const handleRegionClick = useCallback(
    (regionName: string) => {
      if (chart.chart_type !== 'map') return;
      const click = resolveDetailRegionClick({
        chart,
        regions,
        drillDownPath,
        activeGeographicColumn: geographicColumn,
        canEditCharts,
        regionName,
      });
      click.toasts.forEach((t) => showDrillToast(t, () => router.push(`/charts/${chartId}/edit`)));
      if (click.nextLevel) setDrillDownPath([...drillDownPath, click.nextLevel]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentLevel kept as in the original
    [chart, regions, drillDownPath, geographicColumn, currentLevel, chartId, canEditCharts, router]
  );

  // Not memoized before either (plain functions in the component).
  const handleDrillUp = (targetLevel: number) =>
    setDrillDownPath(targetLevel < 0 ? [] : drillDownPath.slice(0, targetLevel + 1));
  const handleDrillHome = () => setDrillDownPath([]);

  return {
    drillDownPath,
    geojsonData: geojson.data,
    geojsonLoading: resolution.isResolving || geojson.isLoading,
    geojsonError: regionGeojsons.error || geojson.error,
    mapDataOverlay: overlay.data,
    mapDataLoading: overlay.isLoading,
    mapDataError: overlay.error,
    handleRegionClick,
    handleDrillUp,
    handleDrillHome,
  };
}
