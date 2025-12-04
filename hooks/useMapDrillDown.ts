import { useState, useCallback, useMemo } from 'react';
import { useRegions, useChildRegions, useRegionGeoJSONs } from '@/hooks/api/useChart';
import { toastSuccess, toastError, toastInfo } from '@/lib/toast';
import type { ChartBuilderFormData } from '@/types/charts';

export interface DrillDownLevel {
  level: number;
  name: string;
  geographic_column: string;
  parent_selections: Array<{
    column: string;
    value: string;
  }>;
  region_id: number;
}

export interface UseMapDrillDownParams {
  formData: ChartBuilderFormData;
  enabled?: boolean;
}

export interface UseMapDrillDownReturn {
  drillDownPath: DrillDownLevel[];
  states: any[] | undefined;
  districts: any[] | undefined;
  regionGeojsons: any[] | undefined;
  currentGeojsonId: number | null;
  drillDownFilters: Record<string, string>;
  handleRegionClick: (regionName: string, regionData?: any) => void;
  handleDrillUp: (targetLevel: number) => void;
  handleDrillHome: () => void;
  resetDrillDown: () => void;
}

/**
 * Hook for managing map drill-down state and navigation.
 * Handles region clicks, drill-up navigation, and filter generation.
 */
export function useMapDrillDown({
  formData,
  enabled = true,
}: UseMapDrillDownParams): UseMapDrillDownReturn {
  const [drillDownPath, setDrillDownPath] = useState<DrillDownLevel[]>([]);

  // Fetch regions for drill-down functionality
  const { data: states } = useRegions('IND', 'state');
  const { data: districts } = useChildRegions(
    drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1].region_id : null,
    drillDownPath.length > 0
  );
  const { data: regionGeojsons } = useRegionGeoJSONs(
    drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1].region_id : null
  );

  // Calculate current geojson ID based on drill-down state
  const currentGeojsonId = useMemo(() => {
    if (formData.chart_type !== 'map') return null;

    // If we're in drill-down mode and have region geojsons, use the first one
    if (drillDownPath.length > 0 && regionGeojsons && regionGeojsons.length > 0) {
      return regionGeojsons[0].id;
    }

    // Otherwise use the base geojson
    return formData.geojsonPreviewPayload?.geojsonId || null;
  }, [
    formData.chart_type,
    formData.geojsonPreviewPayload?.geojsonId,
    drillDownPath,
    regionGeojsons,
  ]);

  // Generate drill-down filters from the path
  const drillDownFilters = useMemo(() => {
    const filters: Record<string, string> = {};
    drillDownPath.forEach((level) => {
      level.parent_selections.forEach((selection) => {
        filters[selection.column] = selection.value;
      });
    });
    return filters;
  }, [drillDownPath]);

  // Handle map region click for drill-down
  const handleRegionClick = useCallback(
    (regionName: string, _regionData?: any) => {
      if (!enabled) return;

      // Check if drill-down is available - support both dynamic and legacy systems
      const hasDynamicDrillDown = formData.geographic_hierarchy?.drill_down_levels?.length > 0;
      const hasLegacyDrillDown = formData.district_column;

      if (!hasDynamicDrillDown && !hasLegacyDrillDown) {
        toastInfo.generic('Configure drill-down levels to enable region drilling');
        return;
      }

      // Determine drill-down column based on system type
      const drillDownColumn = hasDynamicDrillDown
        ? formData.geographic_hierarchy?.drill_down_levels?.[0]?.column
        : formData.district_column;

      if (!drillDownColumn) {
        return;
      }

      // Find the region that was clicked
      const clickedRegion = states?.find(
        (state: any) => state.name === regionName || state.display_name === regionName
      );

      if (clickedRegion) {
        const newDrillDownLevel: DrillDownLevel = {
          level: 1,
          name: regionName,
          geographic_column: drillDownColumn,
          parent_selections: [
            {
              column: formData.geographic_column || '',
              value: regionName,
            },
          ],
          region_id: clickedRegion.id,
        };

        setDrillDownPath([newDrillDownLevel]);
        toastSuccess.generic(`Drilling down to ${regionName} districts`);
      } else {
        toastError.api(`Region "${regionName}" not found for drill-down`);
      }
    },
    [
      enabled,
      formData.geographic_hierarchy,
      formData.district_column,
      formData.geographic_column,
      states,
    ]
  );

  // Handle drill-up navigation
  const handleDrillUp = useCallback((targetLevel: number) => {
    if (targetLevel < 0) {
      setDrillDownPath([]);
    } else {
      setDrillDownPath((prev) => prev.slice(0, targetLevel + 1));
    }
  }, []);

  // Handle drill home (reset to base level)
  const handleDrillHome = useCallback(() => {
    setDrillDownPath([]);
  }, []);

  // Reset drill-down state
  const resetDrillDown = useCallback(() => {
    setDrillDownPath([]);
  }, []);

  return {
    drillDownPath,
    states,
    districts,
    regionGeojsons,
    currentGeojsonId,
    drillDownFilters,
    handleRegionClick,
    handleDrillUp,
    handleDrillHome,
    resetDrillDown,
  };
}
