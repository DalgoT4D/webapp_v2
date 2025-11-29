'use client';

import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';

interface DrillDownLevel {
  level: number;
  name: string;
  geographic_column: string;
  geojson_id: number;
  region_id?: number;
  parent_selections: Array<{
    column: string;
    value: string;
  }>;
}

interface SelectedRegion {
  region_id: number;
  region_name: string;
  geojson_id?: number;
}

interface Region {
  id: number;
  name: string;
  display_name?: string;
}

interface ChartExtraConfig {
  layers?: Array<{
    geojson_id?: number;
    geographic_column?: string;
    region_id?: number;
    selected_regions?: SelectedRegion[];
  }>;
  geographic_hierarchy?: {
    drill_down_levels?: Array<{
      level: number;
      label: string;
      column: string;
    }>;
  };
  geographic_column?: string;
  selected_geojson_id?: number;
  district_column?: string;
  ward_column?: string;
  subward_column?: string;
  filters?: Array<{
    column: string;
    operator: string;
    value: string;
  }>;
}

interface UseMapDrillDownProps {
  chartType: string | undefined;
  extraConfig: ChartExtraConfig | undefined;
  regions: Region[] | undefined;
  regionGeojsons: Array<{ id: number }> | undefined;
  hasEditPermission: boolean;
  chartId: number;
}

interface UseMapDrillDownReturn {
  drillDownPath: DrillDownLevel[];
  currentLevel: number;
  activeGeojsonId: number | null;
  activeGeographicColumn: string | null;
  filters: Record<string, string>;
  handleRegionClick: (regionName: string, regionData: unknown) => void;
  handleDrillUp: (targetLevel: number) => void;
  handleDrillHome: () => void;
}

// Helper to find a region by name
function findRegion(regions: Region[] | undefined, regionName: string): Region | undefined {
  return regions?.find(
    (region) => region.name === regionName || region.display_name === regionName
  );
}

// Helper to create a new drill-down level
function createDrillDownLevel(
  level: number,
  regionName: string,
  geographicColumn: string,
  regionId: number | undefined,
  drillDownPath: DrillDownLevel[],
  activeGeographicColumn: string | null
): DrillDownLevel {
  return {
    level,
    name: regionName,
    geographic_column: geographicColumn,
    geojson_id: 0,
    region_id: regionId,
    parent_selections: [
      ...drillDownPath.flatMap((l) => l.parent_selections),
      { column: activeGeographicColumn || '', value: regionName },
    ],
  };
}

/**
 * useMapDrillDown - Manages map drill-down state and navigation
 */
export function useMapDrillDown({
  chartType,
  extraConfig,
  regions,
  regionGeojsons,
  hasEditPermission,
  chartId,
}: UseMapDrillDownProps): UseMapDrillDownReturn {
  const [drillDownPath, setDrillDownPath] = useState<DrillDownLevel[]>([]);

  const currentLevel = drillDownPath.length;
  const currentLayer =
    chartType === 'map' && extraConfig?.layers ? extraConfig.layers[currentLevel] : null;

  // Determine active geojson and geographic column
  const { activeGeojsonId, activeGeographicColumn } = useMemo(() => {
    if (chartType !== 'map') {
      return { activeGeojsonId: null, activeGeographicColumn: null };
    }

    if (drillDownPath.length > 0) {
      const lastDrillDown = drillDownPath[drillDownPath.length - 1];
      const geojsonId = regionGeojsons?.[0]?.id ?? lastDrillDown.geojson_id;
      return {
        activeGeojsonId: geojsonId,
        activeGeographicColumn: lastDrillDown.geographic_column,
      };
    }

    if (currentLayer) {
      return {
        activeGeojsonId: currentLayer.geojson_id || null,
        activeGeographicColumn: currentLayer.geographic_column || null,
      };
    }

    const firstLayer = extraConfig?.layers?.[0];
    return {
      activeGeojsonId: firstLayer?.geojson_id || extraConfig?.selected_geojson_id || null,
      activeGeographicColumn:
        firstLayer?.geographic_column || extraConfig?.geographic_column || null,
    };
  }, [chartType, drillDownPath, regionGeojsons, currentLayer, extraConfig]);

  // Build filters from drill-down selections
  const filters = useMemo(() => {
    const filterObj: Record<string, string> = {};
    drillDownPath.forEach((level) => {
      level.parent_selections.forEach((selection) => {
        filterObj[selection.column] = selection.value;
      });
    });
    return filterObj;
  }, [drillDownPath]);

  // Handle region click for drill-down
  const handleRegionClick = useCallback(
    (regionName: string) => {
      if (chartType !== 'map') return;

      // Try dynamic drill-down (new system)
      const dynamicLevels = extraConfig?.geographic_hierarchy?.drill_down_levels;
      if (dynamicLevels?.length) {
        const nextLevel = dynamicLevels.find((l) => l.level === currentLevel + 1);
        if (nextLevel) {
          const region = findRegion(regions, regionName);
          if (!region) {
            toast.error(`Region "${regionName}" not found in database`);
            return;
          }
          toast.success(`Drilling down to ${nextLevel.label.toLowerCase()} in ${regionName}`);
          const newLevel = createDrillDownLevel(
            currentLevel + 1,
            regionName,
            nextLevel.column,
            region.id,
            drillDownPath,
            activeGeographicColumn
          );
          setDrillDownPath([...drillDownPath, newLevel]);
          return;
        }
        toast.info('No further drill-down levels configured');
        return;
      }

      // Try simplified drill-down (district/ward/subward)
      const simplifiedColumns = [
        { level: 0, column: extraConfig?.district_column, name: 'districts' },
        { level: 1, column: extraConfig?.ward_column, name: 'wards' },
        { level: 2, column: extraConfig?.subward_column, name: 'sub-wards' },
      ];
      const simplified = simplifiedColumns.find((c) => c.level === currentLevel && c.column);
      if (simplified?.column) {
        const region = findRegion(regions, regionName);
        if (!region) {
          toast.error(`Region "${regionName}" not found in database`);
          return;
        }
        toast.success(`Drilling down to ${simplified.name} in ${regionName}`);
        const newLevel = createDrillDownLevel(
          currentLevel + 1,
          regionName,
          simplified.column,
          region.id,
          drillDownPath,
          activeGeographicColumn
        );
        setDrillDownPath([...drillDownPath, newLevel]);
        return;
      }

      // Try legacy layers system
      const layers = extraConfig?.layers;
      if (!layers) {
        showNoDrillDownToast(hasEditPermission);
        return;
      }

      const nextLayer = layers[currentLevel + 1];
      if (!nextLayer) {
        showNoDrillDownToast(hasEditPermission);
        return;
      }

      // Check if region is configured
      let nextGeojsonId = nextLayer.geojson_id;
      let isConfigured = !!nextLayer.geojson_id;

      if (nextLayer.selected_regions?.length) {
        const match = nextLayer.selected_regions.find((r) => r.region_name === regionName);
        if (match?.geojson_id) {
          nextGeojsonId = match.geojson_id;
          isConfigured = true;
        } else {
          isConfigured = false;
        }
      }

      if (!isConfigured) {
        showUnconfiguredRegionToast(regionName, extraConfig?.filters, hasEditPermission, chartId);
        return;
      }

      const newLevel: DrillDownLevel = {
        level: currentLevel + 1,
        name: regionName,
        geographic_column: nextLayer.geographic_column || '',
        geojson_id: nextGeojsonId || 0,
        region_id: nextLayer.region_id,
        parent_selections: [
          ...drillDownPath.flatMap((l) => l.parent_selections),
          { column: activeGeographicColumn || '', value: regionName },
        ],
      };
      setDrillDownPath([...drillDownPath, newLevel]);
    },
    [
      chartType,
      extraConfig,
      currentLevel,
      drillDownPath,
      regions,
      activeGeographicColumn,
      hasEditPermission,
      chartId,
    ]
  );

  const handleDrillUp = useCallback((targetLevel: number) => {
    setDrillDownPath((prev) => (targetLevel < 0 ? [] : prev.slice(0, targetLevel + 1)));
  }, []);

  const handleDrillHome = useCallback(() => {
    setDrillDownPath([]);
  }, []);

  return {
    drillDownPath,
    currentLevel,
    activeGeojsonId,
    activeGeographicColumn,
    filters,
    handleRegionClick,
    handleDrillUp,
    handleDrillHome,
  };
}

// Helper functions for toast messages
function showNoDrillDownToast(hasEditPermission: boolean) {
  toast.info('No further drill-down levels configured', {
    description: hasEditPermission
      ? 'Configure additional layers in edit mode to enable deeper drill-down'
      : 'This chart needs additional layers configured for deeper drill-down',
    position: 'top-right',
  });
}

function showUnconfiguredRegionToast(
  regionName: string,
  filters: ChartExtraConfig['filters'],
  hasEditPermission: boolean,
  chartId: number
) {
  const isFiltered = filters?.some(
    (f) => (f.operator === 'not equals' || f.operator === '!=') && f.value === regionName
  );

  if (isFiltered) {
    toast.warning(`${regionName} excluded by filter`, {
      description: 'This region is filtered out and not available for drill-down',
      position: 'top-right',
      duration: 4000,
    });
  } else {
    toast.info(`${regionName} not configured for drill-down`, {
      description: hasEditPermission
        ? 'Configure this region in edit mode to enable drill-down'
        : 'This region is not configured for drill-down',
      position: 'top-right',
      duration: 4000,
      ...(hasEditPermission && {
        action: {
          label: 'Edit Chart',
          onClick: () => (window.location.href = `/charts/${chartId}/edit`),
        },
      }),
    });
  }
}
