'use client';

import { useEffect, useMemo } from 'react';
import { ChartTypes, type ChartBuilderFormData } from '@/types/charts';
import type { ChartBuilderKind } from '@/components/charts/logic/builder-kind';
import {
  applyMapDrillToOverlay,
  buildEditMapOverlayPayload,
  type MapDrillLevel,
} from '@/components/charts/logic/map-overlay';
import type { ChartConfigPatch } from '@/components/charts/logic/type-switch';
import { resolveDrillDownGeoJSON } from '@/lib/map-drilldown-utils';
import { useGeoJSONData, useMapDataOverlay, useRegionGeoJSONs } from '@/hooks/api/useChart';

/**
 * Create page only: writes geojsonPreviewPayload/dataOverlayPayload into the config (moved verbatim
 * from the page). It is NOT derived: DynamicLevelConfig writes the same two fields with its own
 * staleness rules (no `metric`), and when a metric and the legacy aggregate fields disagree (e.g.
 * bar → map with a sum metric keeps aggregate_function 'count') the one-render handover between
 * the two effects issues /map-data-overlay/ requests that E2E-observable request counts depend on.
 * BUILDER-DRIFT: edit builds its overlay from the config on every render (buildEditMapOverlayPayload).
 */
function useCreateMapPreviewPayloads(
  formData: ChartBuilderFormData,
  patchConfig: ((patch: ChartConfigPatch) => void) | undefined
) {
  useEffect(() => {
    if (!patchConfig) return;
    const metric = formData.metrics?.[0];
    const hasValidMetric = metric
      ? !!(metric.column_expression || metric.aggregation)
      : !!(formData.aggregate_column && formData.aggregate_function);

    if (
      formData.chart_type === 'map' &&
      formData.geographic_column &&
      formData.selected_geojson_id &&
      hasValidMetric &&
      formData.schema_name &&
      formData.table_name
    ) {
      // Check if payloads need updating
      const needsUpdate =
        !formData.geojsonPreviewPayload ||
        !formData.dataOverlayPayload ||
        formData.geojsonPreviewPayload.geojsonId !== formData.selected_geojson_id ||
        formData.dataOverlayPayload.geographic_column !== formData.geographic_column ||
        JSON.stringify(formData.dataOverlayPayload.metric || {}) !== JSON.stringify(metric || {});

      if (needsUpdate) {
        const geojsonPayload = {
          geojsonId: formData.selected_geojson_id,
        };

        const dataOverlayPayload = {
          schema_name: formData.schema_name,
          table_name: formData.table_name,
          geographic_column: formData.geographic_column,
          metric,
          value_column:
            formData.aggregate_column || formData.value_column || formData.geographic_column,
          aggregate_function: formData.aggregate_function,
          selected_geojson_id: formData.selected_geojson_id,
          filters: {},
          chart_filters: formData.filters || [],
        };

        patchConfig({ geojsonPreviewPayload: geojsonPayload, dataOverlayPayload });
      }
    } else if (formData.chart_type === 'map' && !hasValidMetric && formData.dataOverlayPayload) {
      // Metric removed/invalid — clear the stale payload so the map stops showing old data.
      patchConfig({ dataOverlayPayload: undefined });
    }
  }, [
    formData.chart_type,
    formData.geographic_column,
    formData.selected_geojson_id,
    formData.aggregate_column,
    formData.aggregate_function,
    formData.value_column,
    formData.schema_name,
    formData.table_name,
    formData.filters,
    // ✅ FIX: Include geographic_hierarchy to regenerate payloads when drill-down config changes
    JSON.stringify(formData.geographic_hierarchy || {}),
    // Stringify payloads to prevent infinite loops
    JSON.stringify(formData.geojsonPreviewPayload || {}),
    JSON.stringify(formData.dataOverlayPayload || {}),
    JSON.stringify(formData.metrics?.[0] || {}),
  ]);
}

export function useBuilderMapPreview({
  config,
  builder,
  drillDownPath,
  chartId,
  patchConfig,
}: {
  config: ChartBuilderFormData;
  builder: ChartBuilderKind;
  drillDownPath: MapDrillLevel[];
  chartId?: number;
  /** Create only: where the map preview payloads are written. */
  patchConfig?: (patch: ChartConfigPatch) => void;
}) {
  useCreateMapPreviewPayloads(config, builder === 'create' ? patchConfig : undefined);
  const isMap = config.chart_type === ChartTypes.MAP;
  const isDrilled = drillDownPath.length > 0;
  const regionId = isDrilled ? drillDownPath[drillDownPath.length - 1].region_id : null;
  const regionGeojsons = useRegionGeoJSONs(regionId);

  // BUILDER-DRIFT: create reads the outline id from its preview payload, edit from the config.
  const topLevelGeojsonId =
    builder === 'create' ? config.geojsonPreviewPayload?.geojsonId : config.selected_geojson_id;
  const resolution = useMemo(
    () =>
      resolveDrillDownGeoJSON({
        isDrillDownActive: isDrilled,
        regionId,
        regionGeojsons: regionGeojsons.data,
        regionGeojsonsLoading: regionGeojsons.isLoading,
        regionGeojsonsError: regionGeojsons.error,
        fallbackGeojsonId: isDrilled ? null : topLevelGeojsonId,
      }),
    [
      isDrilled,
      regionId,
      regionGeojsons.data,
      regionGeojsons.isLoading,
      regionGeojsons.error,
      topLevelGeojsonId,
    ]
  );
  const geojson = useGeoJSONData(isMap ? resolution.geojsonId : null);

  const overlayPayload = useMemo(
    () =>
      builder === 'create'
        ? applyMapDrillToOverlay(
            isMap ? (config.dataOverlayPayload ?? null) : null,
            drillDownPath,
            config
          )
        : buildEditMapOverlayPayload(config, drillDownPath, chartId ?? 0),
    [builder, isMap, drillDownPath, config, chartId]
  );
  const overlay = useMapDataOverlay(overlayPayload);

  return {
    geojsonData: geojson.data,
    geojsonLoading: resolution.isResolving || geojson.isLoading,
    geojsonError: regionGeojsons.error || geojson.error,
    mapDataOverlay: overlay.data,
    mapDataLoading: overlay.isLoading,
    mapDataError: overlay.error,
  };
}
