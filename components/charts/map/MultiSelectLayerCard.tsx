'use client';

import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, ChevronDown, ChevronUp, Trash2, Filter } from 'lucide-react';
import { useChildRegions, useRegionGeoJSONs, useRegionHierarchy } from '@/hooks/api/useChart';
import { ColumnTypeIcon } from '@/lib/columnTypeIcons';
import { Combobox, highlightText } from '@/components/ui/combobox';
import { useCascadingFilters } from '../../../hooks/useCascadingFilters';
import type { ChartBuilderFormData } from '@/types/charts';

// Region data type
interface Region {
  id: number;
  name: string;
  display_name?: string;
  type?: string;
  parent_id?: number;
}

// GeoJSON data type
interface GeoJSON {
  id: number;
  name: string;
  is_default?: boolean;
}

// Column data type - API may return either name or column_name
interface TableColumn {
  name?: string;
  column_name?: string;
  data_type: string;
}

// Payload types for onView callback
interface ViewPayloads {
  geojsonPayload: {
    geojsonId: number;
  };
  dataOverlayPayload: {
    schema_name: string;
    table_name: string;
    geographic_column: string;
    value_column: string;
    aggregate_function: string;
    selected_geojson_id: number;
    filters: Record<string, any>;
    chart_filters: any[];
  };
  selectedRegion: SelectedRegion;
}

interface SelectedRegion {
  region_id: number;
  region_name: string;
  geojson_id?: number;
  geojson_name?: string;
}

interface Layer {
  id: string;
  level: number;
  geographic_column?: string;
  region_id?: number;
  selected_regions?: SelectedRegion[];
}

interface MultiSelectLayerCardProps {
  layer: Layer;
  index: number;
  formData: ChartBuilderFormData;
  onUpdate: (updates: Partial<Layer>) => void;
  onView: (regionId: number, payloads?: ViewPayloads) => void;
  onRemove: () => void;
  columns: TableColumn[];
}

export function MultiSelectLayerCard({
  layer,
  index,
  formData,
  onUpdate,
  onView,
  onRemove,
  columns,
}: MultiSelectLayerCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Fetch region hierarchy for dynamic titles
  const countryCode = formData.country_code || 'IND';
  const { data: regionHierarchy } = useRegionHierarchy(countryCode);

  // Filter out columns that are already used in previous layers
  const getAvailableColumns = () => {
    if (!columns) return [];

    const usedColumns = new Set<string>();

    // Add columns used in previous layers
    const layers = formData.layers || [];
    for (let i = 0; i < index; i++) {
      const previousLayer = layers[i];
      if (previousLayer?.geographic_column) {
        usedColumns.add(previousLayer.geographic_column);
      }
    }

    // Filter out used columns
    return columns.filter((column) => {
      const columnName = column.name || column.column_name;
      return !usedColumns.has(columnName);
    });
  };

  const availableColumns = getAvailableColumns();

  // Memoize column items for Combobox to prevent unnecessary re-renders
  const columnItems = React.useMemo(
    () =>
      availableColumns.map((column) => {
        const columnName = column.name || column.column_name;
        return { value: columnName, label: columnName, data_type: column.data_type };
      }),
    [availableColumns]
  );

  // Get the parent region ID for fetching child regions
  const parentLayer = (formData.layers || [])[index - 1];
  let parentRegionId = null;

  if (index === 1 && parentLayer?.geographic_column && !parentLayer?.region_id) {
    // Layer 2: parent is country level, show states
    parentRegionId = 1; // India country ID
  } else if (parentLayer?.region_id) {
    // Layer 3+: parent has specific region selected
    parentRegionId = parentLayer.region_id;
  }

  // Fetch available regions (states, districts, etc.)
  const { data: availableRegions } = useChildRegions(parentRegionId, !!parentRegionId);

  // Apply cascading filters to available regions
  const { filteredRegions, invalidSelections, hasFiltersApplied, filteredCount } =
    useCascadingFilters(index, formData, availableRegions);

  const layerTitle = getLayerTitle(index, regionHierarchy);
  const selectedRegions = layer.selected_regions || [];

  // Auto-cleanup invalid selections when filters change
  useEffect(() => {
    if (invalidSelections.length > 0) {
      const validSelections = selectedRegions.filter(
        (selection) =>
          !invalidSelections.some((invalid) => invalid.region_id === selection.region_id)
      );

      if (validSelections.length !== selectedRegions.length) {
        onUpdate({
          selected_regions: validSelections,
        });
      }
    }
  }, [invalidSelections, selectedRegions, onUpdate]);

  // Handle region selection (checkbox)
  const handleRegionToggle = (region: Region, checked: boolean) => {
    let newSelectedRegions: SelectedRegion[];

    if (checked) {
      // Add region to selection
      newSelectedRegions = [
        ...selectedRegions,
        {
          region_id: region.id,
          region_name: region.display_name,
        },
      ];
    } else {
      // Remove region from selection
      newSelectedRegions = selectedRegions.filter((r) => r.region_id !== region.id);
    }

    onUpdate({
      selected_regions: newSelectedRegions,
    });
  };

  // Handle GeoJSON selection for a specific region
  const handleGeoJSONSelect = (regionId: number, geojsonId: number, geojsonName: string) => {
    const newSelectedRegions = selectedRegions.map((region) =>
      region.region_id === regionId
        ? { ...region, geojson_id: geojsonId, geojson_name: geojsonName }
        : region
    );

    onUpdate({
      selected_regions: newSelectedRegions,
    });
  };

  // Handle view button click for a specific region
  const handleViewRegion = (regionId: number) => {
    const region = selectedRegions.find((r) => r.region_id === regionId);
    if (!layer.geographic_column || !region?.geojson_id) return;

    // Build separate payloads for this specific region
    const geojsonPayload = {
      geojsonId: region.geojson_id,
    };

    const dataOverlayPayload = {
      schema_name: formData.schema_name,
      table_name: formData.table_name,
      geographic_column: layer.geographic_column,
      value_column:
        formData.aggregate_column || formData.value_column || formData.geographic_column,
      aggregate_function: formData.aggregate_function || 'sum',
      selected_geojson_id: region.geojson_id!,
      filters: {},
      chart_filters: formData.filters || [],
    };

    // Pass the payloads to parent for preview
    onView(regionId, {
      geojsonPayload,
      dataOverlayPayload,
      selectedRegion: region,
    });
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="secondary">Layer {index + 1}</Badge>
            <CardTitle className="text-base">{layerTitle}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{selectedRegions.length} selected</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
              title="Remove layer"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Geographic Column Selection */}
          <div>
            <Label>Geographic Column</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Select the column that contains {layerTitle.toLowerCase()} names from your data
            </p>
            <Combobox
              items={columnItems}
              value={layer.geographic_column || ''}
              onValueChange={(value) =>
                onUpdate({
                  geographic_column: value,
                  selected_regions: [], // Reset selections when column changes
                })
              }
              searchPlaceholder="Search columns..."
              placeholder={`Select ${layerTitle.toLowerCase()} column`}
              renderItem={(item, _isSelected, searchQuery) => (
                <div className="flex items-center gap-2 min-w-0">
                  <ColumnTypeIcon dataType={item.data_type} className="w-4 h-4" />
                  <span className="truncate">{highlightText(item.label, searchQuery)}</span>
                </div>
              )}
            />
          </div>

          {/* Multi-Region Selection */}
          {layer.geographic_column && (
            <div>
              <Label>Select {layerTitle}s</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Choose multiple {layerTitle.toLowerCase()}s to visualize. Each will have its own
                map.
              </p>

              {/* Filter status indicator */}
              {hasFiltersApplied && filteredCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 p-2 rounded-md mb-3">
                  <Filter className="h-4 w-4" />
                  <span>
                    {filteredCount} {layerTitle.toLowerCase()}
                    {filteredCount === 1 ? '' : 's'} filtered out
                  </span>
                </div>
              )}

              <div className="space-y-3 max-h-60 overflow-y-auto">
                {filteredRegions?.map((region: Region) => (
                  <RegionSelectionItem
                    key={region.id}
                    region={region}
                    isSelected={selectedRegions.some((r) => r.region_id === region.id)}
                    selectedRegion={selectedRegions.find((r) => r.region_id === region.id)}
                    onToggle={handleRegionToggle}
                    onGeoJSONSelect={handleGeoJSONSelect}
                    onView={handleViewRegion}
                    canView={!!layer.geographic_column}
                  />
                ))}

                {filteredRegions?.length === 0 && availableRegions?.length > 0 && (
                  <div className="text-sm text-gray-500 italic text-center py-4">
                    All {layerTitle.toLowerCase()}s filtered out by current filters
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status Display */}
          {selectedRegions.length > 0 && (
            <div className="pt-4 border-t">
              <Label className="text-sm font-medium mb-2 block">Selected Regions:</Label>
              <div className="flex flex-wrap gap-2">
                {selectedRegions.map((region) => (
                  <Badge
                    key={region.region_id}
                    variant={region.geojson_id ? 'default' : 'outline'}
                    className="text-xs"
                  >
                    {region.region_name}
                    {region.geojson_name && ` (${region.geojson_name})`}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Individual region selection component
function RegionSelectionItem({
  region,
  isSelected,
  selectedRegion,
  onToggle,
  onGeoJSONSelect,
  onView,
  canView,
}: {
  region: Region;
  isSelected: boolean;
  selectedRegion?: SelectedRegion;
  onToggle: (region: Region, checked: boolean) => void;
  onGeoJSONSelect: (regionId: number, geojsonId: number, geojsonName: string) => void;
  onView: (regionId: number) => void;
  canView: boolean;
}) {
  // Fetch GeoJSONs for this specific region
  const { data: geojsons } = useRegionGeoJSONs(isSelected ? region.id : null);

  // Auto-select default GeoJSON when region is selected and geojsons are available
  useEffect(() => {
    if (isSelected && geojsons && !selectedRegion?.geojson_id) {
      const defaultGeojson = geojsons.find((g: GeoJSON) => g.is_default);
      if (defaultGeojson) {
        onGeoJSONSelect(region.id, defaultGeojson.id, defaultGeojson.name);
      }
    }
  }, [isSelected, geojsons, selectedRegion?.geojson_id, region.id, onGeoJSONSelect]);

  const canViewRegion = canView && isSelected && selectedRegion?.geojson_id;

  return (
    <div className="border rounded-lg p-3 space-y-3">
      {/* Region Checkbox */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Checkbox
            id={`region-${region.id}`}
            checked={isSelected}
            onCheckedChange={(checked) => onToggle(region, !!checked)}
          />
          <Label htmlFor={`region-${region.id}`} className="text-sm font-medium cursor-pointer">
            {region.display_name}
          </Label>
        </div>

        {canViewRegion && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onView(region.id)}
            className="flex items-center gap-1 text-green-600 hover:text-green-700"
          >
            <Eye className="h-4 w-4" />
            View
          </Button>
        )}
      </div>
    </div>
  );
}

function getLayerTitle(index: number, regionHierarchy?: Region[]): string {
  // Layer 1 is always "Country"
  if (index === 0) {
    return 'Country';
  }

  // For Layer 2, we want the first level children (e.g., States for India)
  if (index === 1 && regionHierarchy && regionHierarchy.length > 0) {
    // Find the country region first
    const countryRegion = regionHierarchy.find((region: Region) => region.type === 'country');

    if (countryRegion) {
      // Find direct children of the country
      const stateRegions = regionHierarchy.filter(
        (region: Region) => region.parent_id === countryRegion.id
      );

      if (stateRegions.length > 0) {
        const regionType = stateRegions[0].type;
        return regionType.charAt(0).toUpperCase() + regionType.slice(1) + 's';
      }
    }

    // Fallback: Look for regions that have a parent but are not country
    const firstLevelRegions = regionHierarchy.filter(
      (region: Region) => region.type !== 'country' && region.parent_id
    );

    if (firstLevelRegions.length > 0) {
      // Group by type and pick the most common one (likely the state level)
      const typeCount = firstLevelRegions.reduce((acc: Record<string, number>, region: Region) => {
        acc[region.type] = (acc[region.type] || 0) + 1;
        return acc;
      }, {});

      const mostCommonType = Object.keys(typeCount).reduce((a, b) =>
        typeCount[a] > typeCount[b] ? a : b
      );

      return mostCommonType.charAt(0).toUpperCase() + mostCommonType.slice(1) + 's';
    }
  }

  // For Layer 3+, would need more complex logic based on selected parent regions
  // For now, use fallback

  // Fallback when no hierarchy data is available
  const titles = ['Country', 'States', 'Districts', 'Wards'];
  return titles[index] || `Layer ${index + 1}`;
}
