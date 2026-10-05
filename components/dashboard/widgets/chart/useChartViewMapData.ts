import { useMemo } from 'react';
import useSWR from 'swr';
import { apiPublicPost } from '@/lib/api';
import { useGeoJSONData, useMapDataOverlay, useRegionGeoJSONs } from '@/hooks/api/useChart';
import { transformMapDataOverlayPayload } from '@/components/charts/logic/map-overlay';
import { resolveDrillDownGeoJSON } from '@/lib/map-drilldown-utils';
import type { FrozenChartConfig } from '@/types/reports';
import {
  buildWidgetMapOverlayPayload,
  collectDrillFilters,
  resolveWidgetMapLayer,
  type WidgetChartLike,
  type WidgetMapDrillLevel,
} from './logic/chart-widget-map';

export interface ChartViewMapDataOptions {
  chartId: number;
  isPublicMode: boolean;
  publicToken?: string;
  frozenChartConfig?: FrozenChartConfig;
  snapshotId?: number;
  dashboardFilters: Record<string, unknown>;
  isMapChart: boolean;
  effectiveChart: (WidgetChartLike & { computation_type?: string }) | undefined;
  drillDownPath: WidgetMapDrillLevel[];
  isPublicReport: boolean;
}

/** Map widget: drill-region geojsons, active geojson, overlay data — public or private endpoints. */
export function useChartViewMapData({
  chartId,
  isPublicMode,
  publicToken,
  frozenChartConfig,
  snapshotId,
  dashboardFilters,
  isMapChart,
  effectiveChart,
  drillDownPath,
  isPublicReport,
}: ChartViewMapDataOptions) {
  // Get the current drill-down region ID for dynamic geojson fetching
  const currentDrillDownRegionId =
    drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1].region_id : null;

  // Fetch geojsons for the current drill-down region - use public API for public mode
  const {
    data: privateRegionGeojsons,
    error: privateRegionGeojsonsError,
    isLoading: privateRegionGeojsonsLoading,
  } = useRegionGeoJSONs(!isPublicMode ? currentDrillDownRegionId : null);

  // Use public geojsons API for public mode
  const publicGeojsonsUrl =
    isPublicMode && publicToken && currentDrillDownRegionId
      ? `/api/v1/public/regions/${currentDrillDownRegionId}/geojsons/`
      : null;

  const {
    data: publicRegionGeojsons,
    error: publicRegionGeojsonsError,
    isLoading: publicRegionGeojsonsLoading,
  } = useSWR(publicGeojsonsUrl, async (url: string) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`);
    if (!response.ok) {
      throw new Error('Failed to fetch public geojsons');
    }
    return response.json();
  });

  const regionGeojsons = isPublicMode ? publicRegionGeojsons : privateRegionGeojsons;
  const regionGeojsonsError = isPublicMode ? publicRegionGeojsonsError : privateRegionGeojsonsError;
  const regionGeojsonsLoading = isPublicMode
    ? publicRegionGeojsonsLoading
    : privateRegionGeojsonsLoading;

  // For map charts, determine which geojson and data to fetch based on drill-down state
  const activeDrillDownLevel =
    drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1] : null;
  const drillDownGeojsonResolution = resolveDrillDownGeoJSON({
    isDrillDownActive: Boolean(activeDrillDownLevel),
    regionId: currentDrillDownRegionId,
    regionGeojsons,
    regionGeojsonsLoading,
    regionGeojsonsError,
    fallbackGeojsonId: activeDrillDownLevel?.geojson_id,
  });
  const { activeGeojsonId, activeGeographicColumn } = resolveWidgetMapLayer(
    effectiveChart,
    drillDownPath,
    drillDownGeojsonResolution.geojsonId
  );

  // Build data overlay payload for map charts based on current level
  // Include filters for drill-down selections - flatten all parent selections
  const filters = collectDrillFilters(drillDownPath);

  const mapDataOverlayPayload = useMemo(
    () =>
      buildWidgetMapOverlayPayload(
        effectiveChart,
        activeGeographicColumn,
        filters,
        dashboardFilters
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same dependency list as before (filters is new each render)
    [
      effectiveChart?.chart_type,
      effectiveChart?.schema_name,
      effectiveChart?.table_name,
      effectiveChart?.extra_config,
      activeGeographicColumn,
      filters,
      dashboardFilters,
    ]
  );

  // Fetch GeoJSON data - public vs private mode
  const publicGeojsonUrl =
    isPublicMode && publicToken && activeGeojsonId && isMapChart
      ? `/api/v1/public/geojsons/${activeGeojsonId}/`
      : null;

  const {
    data: publicGeojsonData,
    error: publicGeojsonError,
    isLoading: publicGeojsonLoading,
  } = useSWR(
    publicGeojsonUrl,
    isPublicMode && isMapChart
      ? async (url: string) => {
          const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`);
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          return response.json();
        }
      : null,
    { revalidateOnFocus: false, revalidateOnReconnect: false, refreshInterval: 0 }
  );

  // Private mode geojson data
  const {
    data: privateGeojsonData,
    error: privateGeojsonError,
    isLoading: privateGeojsonLoading,
  } = useGeoJSONData(!isPublicMode ? activeGeojsonId : null);

  // Use appropriate geojson data based on mode
  const geojsonData = isPublicMode ? publicGeojsonData : privateGeojsonData;
  const geojsonDataError = isPublicMode ? publicGeojsonError : privateGeojsonError;
  const geojsonDataLoading = isPublicMode ? publicGeojsonLoading : privateGeojsonLoading;
  const geojsonError = regionGeojsonsError || geojsonDataError;
  const geojsonLoading = drillDownGeojsonResolution.isResolving || geojsonDataLoading;

  // Fetch map data overlay - public vs private mode
  // Apply same payload transformation as useMapDataOverlay (handles count, builds metrics)
  const transformedPublicMapPayload = useMemo(
    () => (isPublicMode ? transformMapDataOverlayPayload(mapDataOverlayPayload) : null),
    [isPublicMode, mapDataOverlayPayload]
  );

  const publicMapDataUrl =
    isPublicMode && publicToken && transformedPublicMapPayload && isMapChart
      ? isPublicReport
        ? `/api/v1/public/reports/${publicToken}/charts/${chartId}/map-data/`
        : `/api/v1/public/dashboards/${publicToken}/charts/${chartId}/map-data/`
      : null;

  const {
    data: publicMapData,
    error: publicMapError,
    isLoading: publicMapLoading,
    mutate: mutatePublicMapData,
  } = useSWR(
    publicMapDataUrl ? [publicMapDataUrl, JSON.stringify(transformedPublicMapPayload)] : null,
    isPublicMode && isMapChart
      ? async (key: string | [string, string]) => {
          const url = Array.isArray(key) ? key[0] : key;
          return apiPublicPost(url, transformedPublicMapPayload);
        }
      : null,
    { revalidateOnFocus: false, revalidateOnReconnect: false, refreshInterval: 0 }
  );

  // Private mode map data — dashboards and reports resolve dashboard filters
  // differently server-side, so they route to different endpoints.
  // In report mode, only fetch once snapshotId is available — don't fall
  // back to the live-dashboard endpoint while it's still missing.
  const isMapReadyToFetch = frozenChartConfig ? !!snapshotId : true;
  const {
    data: privateMapDataOverlay,
    error: privateMapError,
    isLoading: privateMapLoading,
    mutate: mutatePrivateMapData,
  } = useMapDataOverlay(
    !isPublicMode && isMapReadyToFetch ? mapDataOverlayPayload : null,
    frozenChartConfig ? snapshotId : null,
    chartId
  );

  // Use appropriate map data based on mode
  const mapDataOverlay = isPublicMode ? publicMapData : privateMapDataOverlay;
  const mapError = isPublicMode ? publicMapError : privateMapError;
  const mapLoading = isPublicMode ? publicMapLoading : privateMapLoading;
  const mutateMapData = isPublicMode ? mutatePublicMapData : mutatePrivateMapData;

  return {
    regionGeojsonsError,
    geojsonData,
    geojsonError,
    geojsonLoading,
    mapDataOverlay,
    mapError,
    mapLoading,
    mutateMapData,
    activeGeographicColumn,
  };
}
