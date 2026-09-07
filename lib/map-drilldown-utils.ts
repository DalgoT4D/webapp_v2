interface RegionGeoJSONReference {
  id: number;
}

interface ResolveDrillDownGeoJSONParams {
  isDrillDownActive: boolean;
  regionId?: number | null;
  regionGeojsons?: RegionGeoJSONReference[];
  regionGeojsonsLoading: boolean;
  regionGeojsonsError?: unknown;
  fallbackGeojsonId?: number | null;
}

interface DrillDownGeoJSONResolution {
  geojsonId: number | null;
  isResolving: boolean;
}

/**
 * Resolves the boundary to render while changing map drill-down levels.
 * Dynamic drill-down entries use 0 as a placeholder until the region lookup finishes.
 */
export function resolveDrillDownGeoJSON({
  isDrillDownActive,
  regionId,
  regionGeojsons,
  regionGeojsonsLoading,
  regionGeojsonsError,
  fallbackGeojsonId,
}: ResolveDrillDownGeoJSONParams): DrillDownGeoJSONResolution {
  const validFallbackGeojsonId =
    fallbackGeojsonId && fallbackGeojsonId > 0 ? fallbackGeojsonId : null;

  if (!isDrillDownActive) {
    return {
      geojsonId: validFallbackGeojsonId,
      isResolving: false,
    };
  }

  const regionGeojsonId = regionGeojsons?.[0]?.id ?? null;
  const geojsonId = regionGeojsonId ?? validFallbackGeojsonId;
  const isWaitingForRegionLookup = regionGeojsonsLoading || regionGeojsons === undefined;

  return {
    geojsonId,
    isResolving: Boolean(
      regionId && !geojsonId && !regionGeojsonsError && isWaitingForRegionLookup
    ),
  };
}
