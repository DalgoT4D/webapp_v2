'use client';

import { useMemo, useEffect } from 'react';
import type { ChartBuilderFormData } from '@/types/charts';

interface RegionType {
  id: number;
  type: string;
  parent_id?: number;
}

/**
 * useRegionTypeHierarchy - Builds a hierarchical chain of region types
 *
 * Analyzes parent-child relationships between region types to build
 * a linear hierarchy chain (e.g., country -> state -> district -> ward)
 */
export function useRegionTypeHierarchy(regionTypes: RegionType[] | undefined): string[] {
  return useMemo(() => {
    if (!regionTypes || regionTypes.length === 0) return [];

    // Build parent-child relationship map
    const parentChildMap = new Map<string, string[]>();
    const childParentMap = new Map<string, string>();

    // First pass: build the relationships
    regionTypes.forEach((region) => {
      const type = region.type;
      if (!type) return;

      if (region.parent_id) {
        // Find parent region
        const parentRegion = regionTypes.find((r) => r.id === region.parent_id);
        if (parentRegion && parentRegion.type) {
          const parentType = parentRegion.type;

          // Add to parent-child map
          if (!parentChildMap.has(parentType)) {
            parentChildMap.set(parentType, []);
          }
          if (!parentChildMap.get(parentType)!.includes(type)) {
            parentChildMap.get(parentType)!.push(type);
          }

          // Add to child-parent map
          childParentMap.set(type, parentType);
        }
      }
    });

    // Find the root type (type with no parent)
    const allTypes = new Set(regionTypes.map((r) => r.type).filter(Boolean));
    const rootTypes = Array.from(allTypes).filter((type) => !childParentMap.has(type as string));

    // Build the hierarchical chain starting from root
    const buildHierarchyChain = (startType: string): string[] => {
      const chain = [startType];
      let currentType = startType;

      while (parentChildMap.has(currentType) && parentChildMap.get(currentType)!.length > 0) {
        const children = parentChildMap.get(currentType)!;
        currentType = children[0]; // Take first child
        chain.push(currentType);
      }

      return chain;
    };

    // Build hierarchy starting from the first root type
    if (rootTypes.length > 0) {
      return buildHierarchyChain(rootTypes[0] as string);
    }

    return [];
  }, [regionTypes]);
}

interface MapPreviewPayload {
  geojsonId: number;
}

interface DataOverlayPayload {
  schema_name: string;
  table_name: string;
  geographic_column: string;
  value_column: string;
  aggregate_function: string;
  selected_geojson_id: number;
  filters: Record<string, unknown>;
  chart_filters: ChartBuilderFormData['filters'];
}

/**
 * useMapAutoPreview - Auto-generates preview payloads when map configuration is complete
 *
 * Monitors form data and automatically creates geojson and data overlay payloads
 * when all required fields are configured.
 */
export function useMapAutoPreview(
  formData: ChartBuilderFormData,
  onChange: (data: Partial<ChartBuilderFormData>) => void
): void {
  useEffect(() => {
    // For count operations, aggregate_column is not required
    const needsAggregateColumn = formData.aggregate_function !== 'count';

    if (
      formData.geographic_column &&
      formData.selected_geojson_id &&
      (!needsAggregateColumn || formData.aggregate_column) &&
      formData.aggregate_function &&
      formData.schema_name &&
      formData.table_name
    ) {
      // Check if we need to update preview payloads
      const currentFiltersHash = JSON.stringify(formData.filters || []);
      const payloadFiltersHash = JSON.stringify(formData.dataOverlayPayload?.chart_filters || []);

      const hasValidPayloads =
        formData.geojsonPreviewPayload?.geojsonId === formData.selected_geojson_id &&
        formData.dataOverlayPayload?.geographic_column === formData.geographic_column &&
        formData.dataOverlayPayload?.value_column ===
          (formData.aggregate_column || formData.value_column || formData.geographic_column) &&
        formData.dataOverlayPayload?.aggregate_function === formData.aggregate_function &&
        currentFiltersHash === payloadFiltersHash;

      if (!hasValidPayloads) {
        const geojsonPayload: MapPreviewPayload = {
          geojsonId: formData.selected_geojson_id,
        };

        const dataOverlayPayload: DataOverlayPayload = {
          schema_name: formData.schema_name,
          table_name: formData.table_name,
          geographic_column: formData.geographic_column,
          value_column:
            formData.aggregate_column || formData.value_column || formData.geographic_column,
          aggregate_function: formData.aggregate_function,
          selected_geojson_id: formData.selected_geojson_id,
          filters: {},
          chart_filters: formData.filters || [],
        };

        onChange({
          geojsonPreviewPayload: geojsonPayload,
          dataOverlayPayload: dataOverlayPayload,
        });
      }
    }
  }, [
    formData.geographic_column,
    formData.selected_geojson_id,
    formData.aggregate_column,
    formData.value_column,
    formData.aggregate_function,
    formData.schema_name,
    formData.table_name,
    formData.filters,
    formData.geojsonPreviewPayload,
    formData.dataOverlayPayload,
    onChange,
  ]);
}

/**
 * useAutoSelectDefaultGeoJSON - Auto-selects default GeoJSON when geographic column is selected
 */
export function useAutoSelectDefaultGeoJSON(
  geographicColumn: string | undefined,
  geojsons: Array<{ id: number; is_default?: boolean }> | undefined,
  selectedGeojsonId: number | undefined,
  onChange: (data: Partial<ChartBuilderFormData>) => void
): void {
  useEffect(() => {
    if (geographicColumn && geojsons && !selectedGeojsonId) {
      const defaultGeojson = geojsons.find((g) => g.is_default);
      if (defaultGeojson) {
        onChange({
          selected_geojson_id: defaultGeojson.id,
        });
      }
    }
  }, [geographicColumn, geojsons, selectedGeojsonId, onChange]);
}
