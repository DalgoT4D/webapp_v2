'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useChildRegions, useRegionGeoJSONs, useRegionHierarchy } from '@/hooks/api/useChart';

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
  selected_regions?: SelectedRegion[];
}

interface MultiSelectLayerCardProps {
  layer: Layer;
  index: number;
  formData: any;
  onUpdate: (updates: Partial<Layer>) => void;
  onView: (
    regionId: number,
    payloads?: {
      geojsonPayload: any;
      dataOverlayPayload: any;
      selectedRegion: SelectedRegion;
    }
  ) => void;
  onRemove: () => void;
  columns: any[];
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

  const layerTitle = getLayerTitle(index, regionHierarchy, countryCode);
  const selectedRegions = layer.selected_regions || [];

  // Handle region selection (checkbox)
  const handleRegionToggle = (region: any, checked: boolean) => {
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
      value_column: formData.aggregate_column,
      aggregate_function: formData.aggregate_function || formData.aggregate_func,
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
            <Select
              value={layer.geographic_column || ''}
              onValueChange={(value) =>
                onUpdate({
                  geographic_column: value,
                  selected_regions: [], // Reset selections when column changes
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select ${layerTitle.toLowerCase()} column`} />
              </SelectTrigger>
              <SelectContent>
                {availableColumns.map((column) => {
                  const columnName = column.name || column.column_name;
                  return (
                    <SelectItem key={columnName} value={columnName}>
                      {columnName} ({column.data_type})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Multi-Region Selection */}
          {layer.geographic_column && (
            <div>
              <Label>Select {layerTitle}s</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Choose multiple {layerTitle.toLowerCase()}s to visualize. Each will have its own
                map.
              </p>

              <div className="space-y-3 max-h-60 overflow-y-auto">
                {availableRegions?.map((region: any) => (
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
  region: any;
  isSelected: boolean;
  selectedRegion?: SelectedRegion;
  onToggle: (region: any, checked: boolean) => void;
  onGeoJSONSelect: (regionId: number, geojsonId: number, geojsonName: string) => void;
  onView: (regionId: number) => void;
  canView: boolean;
}) {
  // Fetch GeoJSONs for this specific region
  const { data: geojsons } = useRegionGeoJSONs(isSelected ? region.id : null);

  // Auto-select default GeoJSON when region is selected and geojsons are available
  useEffect(() => {
    if (isSelected && geojsons && !selectedRegion?.geojson_id) {
      const defaultGeojson = geojsons.find((g: any) => g.is_default);
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

function getLayerTitle(
  index: number,
  regionHierarchy?: any[],
  countryCode: string = 'IND'
): string {
  // Layer 1 is always "Country"
  if (index === 0) {
    return 'Country';
  }

  // For Layer 2, we want the first level children (e.g., States for India)
  if (index === 1 && regionHierarchy && regionHierarchy.length > 0) {
    // Find the country region first
    const countryRegion = regionHierarchy.find((region: any) => region.type === 'country');

    if (countryRegion) {
      // Find direct children of the country
      const stateRegions = regionHierarchy.filter(
        (region: any) => region.parent_id === countryRegion.id
      );

      if (stateRegions.length > 0) {
        const regionType = stateRegions[0].type;
        return regionType.charAt(0).toUpperCase() + regionType.slice(1) + 's';
      }
    }

    // Fallback: Look for regions that have a parent but are not country
    const firstLevelRegions = regionHierarchy.filter(
      (region: any) => region.type !== 'country' && region.parent_id
    );

    if (firstLevelRegions.length > 0) {
      // Group by type and pick the most common one (likely the state level)
      const typeCount = firstLevelRegions.reduce((acc: any, region: any) => {
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
