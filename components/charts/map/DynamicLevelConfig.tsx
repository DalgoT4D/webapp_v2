'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronRight, Navigation, CheckCircle, Loader2, Download } from 'lucide-react';
import {
  useColumns,
  useAvailableRegionTypes,
  useRegions,
  useRegionGeoJSONs,
} from '@/hooks/api/useChart';
import type { ChartBuilderFormData } from '@/types/charts';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/lib/config';
import { downloadRegionNames } from '@/lib/csvUtils';

interface DynamicLevelConfigProps {
  formData: ChartBuilderFormData;
  onChange: (data: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

export function DynamicLevelConfig({
  formData,
  onChange,
  disabled = false,
}: DynamicLevelConfigProps) {
  const { toast } = useToast();
  const [downloadingStates, setDownloadingStates] = useState(false);
  const [downloadingDistricts, setDownloadingDistricts] = useState(false);

  // Fetch available columns
  const { data: columns = [] } = useColumns(formData.schema_name || '', formData.table_name || '');

  // Fetch available region types from backend
  const { data: regionTypes = [], isLoading: regionTypesLoading } = useAvailableRegionTypes('IND');

  // Get regions and GeoJSONs for automatic preview (copied from CountryLevelConfig)
  const countryCode = formData.country_code || 'IND';
  const { data: regions } = useRegions(countryCode, undefined);
  const countryRegionId = regions?.find((r: any) => r.type === 'country')?.id || 1;
  const { data: geojsons } = useRegionGeoJSONs(countryRegionId);

  // Handle state column selection (copy logic from CountryLevelConfig)
  const handleGeographicColumnChange = (column: string) => {
    onChange({
      geographic_column: column,
      selected_geojson_id: undefined,
      district_column: undefined,
      ward_column: undefined,
      subward_column: undefined,
      geographic_hierarchy: undefined, // Reset hierarchy when base column changes
    });
  };

  // Handle CSV download
  const handleDownloadRegionNames = async (regionType: 'state' | 'district') => {
    const countryCode = formData.country_code || 'IND';
    const setLoading = regionType === 'state' ? setDownloadingStates : setDownloadingDistricts;

    try {
      setLoading(true);

      await downloadRegionNames(API_BASE_URL, countryCode, regionType, {
        onSuccess: (message) => {
          toast({
            title: 'Download complete',
            description: message,
          });
        },
      });
    } catch (error) {
      console.error(`Error downloading ${regionType}s:`, error);
      toast({
        title: 'Download failed',
        description: `Failed to download ${regionType} names. Please try again.`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Get available columns (all types, exclude already used columns)
  const getAvailableColumns = (excludeColumns: string[]) => {
    return columns.filter((col: any) => {
      const columnName = col.column_name || col.name;
      return columnName && !excludeColumns.includes(columnName);
    });
  };

  // Build actual hierarchical chain by analyzing parent-child relationships
  const getRegionTypeHierarchy = () => {
    if (!regionTypes || regionTypes.length === 0) return [];

    // Build parent-child relationship map
    const parentChildMap = new Map<string, string[]>();
    const childParentMap = new Map<string, string>();

    // First pass: build the relationships
    regionTypes.forEach((region: any) => {
      const type = region.type;
      if (!type) return;

      if (region.parent_id) {
        // Find parent region
        const parentRegion = regionTypes.find((r: any) => r.id === region.parent_id);
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
    const allTypes = new Set(regionTypes.map((r: any) => r.type).filter(Boolean));
    const rootTypes = Array.from(allTypes).filter((type) => !childParentMap.has(type as string));

    // Build the hierarchical chain starting from root
    const buildHierarchyChain = (startType: string): string[] => {
      const chain = [startType];
      let currentType = startType;

      while (parentChildMap.has(currentType) && parentChildMap.get(currentType)!.length > 0) {
        // Get the first child type (assuming linear hierarchy for now)
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
  };

  const regionHierarchy = getRegionTypeHierarchy();

  // Get current drill-down levels
  const currentLevels = formData.geographic_hierarchy?.drill_down_levels || [];
  const usedColumns = [
    formData.geographic_column,
    // Don't exclude columns that are already configured in drill-down levels
    // Just exclude the base geographic column
  ];

  const updateLevel = (levelIndex: number, column: string) => {
    // levelIndex corresponds to drill-down levels, so we need to add 1 to get the correct hierarchy position
    const regionType = regionHierarchy[levelIndex + 1];

    if (!regionType) {
      return;
    }

    // Create base hierarchy using the actual first level from the hierarchy
    const baseRegionType = regionHierarchy[0] || 'region';
    const baseHierarchy = {
      country_code: 'IND',
      base_level: {
        level: 0,
        column: formData.geographic_column || '',
        region_type: baseRegionType,
        label: baseRegionType.charAt(0).toUpperCase() + baseRegionType.slice(1),
      },
      drill_down_levels: [...currentLevels],
    };

    if (column === '') {
      // Remove this level and all subsequent levels
      baseHierarchy.drill_down_levels = baseHierarchy.drill_down_levels.slice(0, levelIndex);
    } else {
      // Ensure we have enough levels
      while (baseHierarchy.drill_down_levels.length <= levelIndex) {
        baseHierarchy.drill_down_levels.push({
          level: baseHierarchy.drill_down_levels.length + 1,
          column: '',
          region_type: '',
          label: '',
        });
      }

      // Update the specific level
      baseHierarchy.drill_down_levels[levelIndex] = {
        level: levelIndex + 1,
        column: column,
        region_type: regionType,
        label: regionType.charAt(0).toUpperCase() + regionType.slice(1),
      };

      // Trim empty levels at the end
      while (
        baseHierarchy.drill_down_levels.length > 0 &&
        !baseHierarchy.drill_down_levels[baseHierarchy.drill_down_levels.length - 1].column
      ) {
        baseHierarchy.drill_down_levels.pop();
      }
    }

    const updateData = {
      geographic_hierarchy: baseHierarchy,
      // Legacy support
      district_column: baseHierarchy.drill_down_levels[0]?.column || undefined,
    };

    onChange(updateData);
  };

  // Auto-select default GeoJSON when geographic column is selected (copied from CountryLevelConfig)
  useEffect(() => {
    if (formData.geographic_column && geojsons && !formData.selected_geojson_id) {
      const defaultGeojson = geojsons.find((g: any) => g.is_default);
      if (defaultGeojson) {
        onChange({
          selected_geojson_id: defaultGeojson.id,
        });
      }
    }
  }, [formData.geographic_column, geojsons, formData.selected_geojson_id, onChange]);

  // Auto-generate preview when all required fields are configured (copied from CountryLevelConfig)
  useEffect(() => {
    // For count operations, aggregate_column is not required (same pattern as bar charts)
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
        const geojsonPayload = {
          geojsonId: formData.selected_geojson_id,
        };

        const dataOverlayPayload = {
          schema_name: formData.schema_name,
          table_name: formData.table_name,
          geographic_column: formData.geographic_column,
          // For count operations without a column, fall back to geographic_column
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
    formData.aggregate_function,
    formData.schema_name,
    formData.table_name,
    JSON.stringify(formData.filters || []),
    JSON.stringify(formData.geojsonPreviewPayload || {}),
    JSON.stringify(formData.dataOverlayPayload || {}),
  ]);

  const shouldShowLevel = (levelIndex: number) => {
    // Show first level always (next level after geographic column)
    if (levelIndex === 0) return true;

    // Show subsequent levels only if previous level is configured
    return currentLevels[levelIndex - 1]?.column;
  };

  if (regionTypesLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Geographic Levels...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="bg-gray-50 p-4 rounded-lg border space-y-4">
      {/* Country Selection */}
      <div>
        <Label className="text-sm font-medium">Country</Label>
        <p className="text-xs text-gray-600 mb-2">Select the country for your map</p>
        <Select value="IND" disabled>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="India" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="IND">India</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* State Column Selection */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <Label className="text-sm font-medium">State Column</Label>
            <p className="text-xs text-gray-600 mt-1">Column containing state/region names</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDownloadRegionNames('state')}
                disabled={disabled || downloadingStates}
                className="h-8 px-3 text-xs gap-1.5"
              >
                {downloadingStates ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    Download States
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              Download the exact state names used in the map. Your data must match these names
              exactly to display correctly on the visualization.
            </TooltipContent>
          </Tooltip>
        </div>
        <Select
          value={formData.geographic_column || ''}
          onValueChange={handleGeographicColumnChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select state column" />
          </SelectTrigger>
          <SelectContent>
            {columns.map((col: any) => {
              const columnName = col.column_name || col.name;
              return (
                <SelectItem key={columnName} value={columnName}>
                  <span className="truncate" title={`${columnName} (${col.data_type})`}>
                    {columnName} ({col.data_type})
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* District Column Selection */}
      {formData.geographic_column && regionHierarchy.length > 1 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <Label className="text-sm font-medium">District Column (Optional)</Label>
              <p className="text-xs text-gray-600 mt-1">
                Enable drill-down from states to districts
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadRegionNames('district')}
                  disabled={disabled || downloadingDistricts}
                  className="h-8 px-3 text-xs gap-1.5"
                >
                  {downloadingDistricts ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      Download Districts
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                Download all district names grouped by state. Ensure your data uses these exact
                names for accurate map visualization and drill-down functionality.
              </TooltipContent>
            </Tooltip>
          </div>
          <Select
            value={currentLevels[0]?.column || ''}
            onValueChange={(value) => {
              updateLevel(0, value === '__none__' ? '' : value);
            }}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select column for districts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No drill-down</SelectItem>
              {getAvailableColumns(usedColumns).map((col: any) => {
                const columnName = col.column_name || col.name;
                return (
                  <SelectItem key={columnName} value={columnName}>
                    <span className="truncate" title={columnName}>
                      {columnName}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
