import { useMemo } from 'react';
import type { ChartBuilderFormData, ChartFilter } from '../types/charts';

interface SelectedRegion {
  region_id: number;
  region_name: string;
  geojson_id?: number;
  geojson_name?: string;
}

// Extended Layer interface to include runtime properties used by the components
interface ExtendedLayer {
  id: string;
  level: number;
  name?: string;
  geojson_id?: number;
  geographic_column?: string;
  selected_regions?: SelectedRegion[];
}

// Extend ChartBuilderFormData to include runtime layer properties
interface ExtendedChartBuilderFormData extends ChartBuilderFormData {
  layers?: ExtendedLayer[];
}

/**
 * Hook to handle cascading filters for multi-layer drill-down maps
 * Aggregates filters from all parent layers and applies them to available regions
 */
export function useCascadingFilters(
  currentLayerIndex: number,
  formData: ExtendedChartBuilderFormData,
  availableRegions?: any[]
) {
  // Aggregate all filters that should cascade down to this layer
  const aggregatedFilters = useMemo(() => {
    console.log('🔍 [useCascadingFilters] Debug Info:', {
      currentLayerIndex,
      formDataFilters: formData.filters,
      hasFilters: !!(formData.filters && formData.filters.length > 0),
      layers: formData.layers?.map((l) => ({ id: l.id, geographic_column: l.geographic_column })),
    });

    if (!formData.filters || currentLayerIndex === 0) {
      return formData.filters || [];
    }

    const currentLayer = formData.layers?.[currentLayerIndex];
    if (!currentLayer?.geographic_column) {
      return formData.filters || [];
    }

    // Include all global filters that apply to this layer's data
    const applicableFilters = (formData.filters || []).filter((filter: ChartFilter) => {
      // Filter applies if it targets any column in our data source
      // This is a conservative approach - include all filters by default
      return true;
    });

    console.log('✅ [useCascadingFilters] Applicable Filters:', applicableFilters);
    return applicableFilters;
  }, [formData.filters, currentLayerIndex, formData.layers]);

  // Filter available regions based on aggregated filters
  const filteredRegions = useMemo(() => {
    console.log('🔍 [useCascadingFilters] Filtering Regions:', {
      availableRegionsCount: availableRegions?.length || 0,
      availableRegionNames: availableRegions?.map((r) => r.display_name || r.name) || [],
      aggregatedFiltersCount: aggregatedFilters.length,
      aggregatedFilters: aggregatedFilters,
    });

    if (!availableRegions || !aggregatedFilters.length) {
      console.log('✅ [useCascadingFilters] No filtering needed, returning all regions');
      return availableRegions || [];
    }

    const currentLayer = formData.layers?.[currentLayerIndex];
    if (!currentLayer?.geographic_column) {
      console.log('✅ [useCascadingFilters] No geographic column, returning all regions');
      return availableRegions || [];
    }

    // Apply filters to available regions
    // For maps, we need to filter regions based on their names matching filter values
    const filtered = availableRegions.filter((region) => {
      const regionName = region.display_name || region.name;

      return aggregatedFilters.every((filter) => {
        console.log('🔍 [useCascadingFilters] Checking filter:', {
          regionName,
          filterColumn: filter.column,
          filterOperator: filter.operator,
          filterValue: filter.value,
          exactMatch: regionName === filter.value,
        });

        // For map layers, we filter based on the region name directly
        // regardless of which column the filter was originally applied to
        // This is because when you filter "state_name != Maharashtra",
        // you want to exclude "Maharashtra" region from child layers

        let result = true;
        switch (filter.operator) {
          case 'equals':
            result = regionName === filter.value;
            break;

          case 'not_equals':
            result = regionName !== filter.value;
            break;

          case 'contains':
          case 'like':
            result = regionName.toLowerCase().includes(String(filter.value).toLowerCase());
            break;

          case 'not_contains':
            result = !regionName.toLowerCase().includes(String(filter.value).toLowerCase());
            break;

          case 'in':
            const values = Array.isArray(filter.value) ? filter.value : [filter.value];
            result = values.includes(regionName);
            break;

          case 'not_in':
            const notInValues = Array.isArray(filter.value) ? filter.value : [filter.value];
            result = !notInValues.includes(regionName);
            break;

          case 'greater_than':
            result = Number(regionName) > Number(filter.value);
            break;

          case 'less_than':
            result = Number(regionName) < Number(filter.value);
            break;

          case 'greater_than_equal':
            result = Number(regionName) >= Number(filter.value);
            break;

          case 'less_than_equal':
            result = Number(regionName) <= Number(filter.value);
            break;

          case 'like_case_insensitive':
            result = regionName.toLowerCase().includes(String(filter.value).toLowerCase());
            break;

          case 'is_null':
            result = regionName == null || regionName === '';
            break;

          case 'is_not_null':
            result = regionName != null && regionName !== '';
            break;

          default:
            console.warn(`Unknown filter operator: ${filter.operator}`);
            result = true; // Default to including the region
        }

        console.log('🎯 [useCascadingFilters] Filter result:', {
          regionName,
          operator: filter.operator,
          value: filter.value,
          included: result,
        });

        return result;
      });
    });

    console.log('✅ [useCascadingFilters] Final filtered regions:', {
      originalCount: availableRegions.length,
      filteredCount: filtered.length,
      filteredNames: filtered.map((r) => r.display_name || r.name),
    });

    return filtered;
  }, [availableRegions, aggregatedFilters, currentLayerIndex, formData.layers]);

  // Get invalid selections that should be removed
  const invalidSelections = useMemo(() => {
    const currentLayer = formData.layers?.[currentLayerIndex];
    if (!currentLayer?.selected_regions || !availableRegions) {
      return [];
    }

    const validRegionIds = new Set(filteredRegions.map((r) => r.id));

    return currentLayer.selected_regions.filter(
      (selectedRegion) => !validRegionIds.has(selectedRegion.region_id)
    );
  }, [currentLayerIndex, formData.layers, availableRegions, filteredRegions]);

  return {
    aggregatedFilters,
    filteredRegions,
    invalidSelections,
    hasFiltersApplied: aggregatedFilters.length > 0,
    filteredCount: availableRegions ? availableRegions.length - filteredRegions.length : 0,
  };
}
