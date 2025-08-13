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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye } from 'lucide-react';
import {
  useSchemas,
  useTables,
  useColumns,
  useRegions,
  useChildRegions,
  useRegionGeoJSONs,
  useAvailableLayers,
} from '@/hooks/api/useChart';
import { MultiSelectLayerCard } from './MultiSelectLayerCard';

interface Layer {
  id: string;
  level: number;
  geographic_column?: string;
  region_id?: number;
  geojson_id?: number;
  region_name?: string;
  geojson_name?: string;
  // For Layer 2+ multi-select support
  selected_regions?: Array<{
    region_id: number;
    region_name: string;
    geojson_id?: number;
    geojson_name?: string;
  }>;
}

interface MapDataConfigurationProps {
  formData: any;
  onFormDataChange: (data: any) => void;
}

export function MapDataConfiguration({ formData, onFormDataChange }: MapDataConfigurationProps) {
  const [viewingLayer, setViewingLayer] = useState<number | null>(null);

  // Fetch warehouse data
  const { data: schemas } = useSchemas();
  const { data: tables } = useTables(formData.schema_name || null);
  const { data: columns } = useColumns(formData.schema_name || null, formData.table_name || null);

  // Handler functions
  const handleSchemaChange = (schema_name: string) => {
    onFormDataChange({
      ...formData,
      schema_name,
      table_name: undefined,
      geographic_column: undefined,
      value_column: undefined,
      aggregate_column: undefined,
      aggregate_func: undefined,
      selected_geojson_id: undefined,
      layers: [createDefaultLayer()],
    });
  };

  const handleTableChange = (table_name: string) => {
    onFormDataChange({
      ...formData,
      table_name,
      geographic_column: undefined,
      value_column: undefined,
      aggregate_column: undefined,
      selected_geojson_id: undefined,
      layers: [createDefaultLayer()],
    });
  };

  // Create default first layer
  const createDefaultLayer = (): Layer => ({
    id: '0',
    level: 0,
    geographic_column: undefined,
    region_id: undefined,
    geojson_id: undefined,
  });

  // Initialize layers if not present
  const layers: Layer[] = formData.layers || [createDefaultLayer()];

  const updateLayer = (layerId: string, updates: Partial<Layer>) => {
    const newLayers = layers.map((layer) =>
      layer.id === layerId ? { ...layer, ...updates } : layer
    );

    // For first layer, also update the main form fields for backward compatibility
    if (layerId === '0') {
      const firstLayer = newLayers[0];
      onFormDataChange({
        ...formData,
        layers: newLayers,
        geographic_column: firstLayer.geographic_column,
        selected_geojson_id: firstLayer.geojson_id,
        // Set value_column and aggregate_column from the aggregate_column field
        value_column: formData.aggregate_column,
        aggregate_function: formData.aggregate_func,
      });
    } else {
      onFormDataChange({
        ...formData,
        layers: newLayers,
      });
    }
  };

  const addLayer = () => {
    const newLayer: Layer = {
      id: Date.now().toString(),
      level: layers.length,
      geographic_column: undefined,
    };

    onFormDataChange({
      ...formData,
      layers: [...layers, newLayer],
    });
  };

  const removeLayer = (layerId: string) => {
    const newLayers = layers.filter((layer) => layer.id !== layerId);
    // Re-index the levels
    newLayers.forEach((layer, index) => {
      layer.level = index;
    });

    onFormDataChange({
      ...formData,
      layers: newLayers,
    });
  };

  const handleViewLayer = (
    layerIndex: number,
    regionId?: number,
    payloads?: {
      geojsonPayload: any;
      dataOverlayPayload: any;
      selectedRegion: any;
    }
  ) => {
    const layer = layers[layerIndex];

    // Handle Layer 1 (single selection)
    if (layerIndex === 0) {
      if (!layer.geographic_column || !layer.geojson_id) return;

      // Build separate payloads for GeoJSON and data overlay
      const geojsonPayload = {
        geojsonId: layer.geojson_id,
      };

      const dataOverlayPayload = {
        schema_name: formData.schema_name,
        table_name: formData.table_name,
        geographic_column: layer.geographic_column,
        value_column: formData.aggregate_column,
        aggregate_func: formData.aggregate_func,
      };

      // Trigger separated fetching preview
      onFormDataChange({
        ...formData,
        geojsonPreviewPayload: geojsonPayload,
        dataOverlayPayload: dataOverlayPayload,
        viewingLayer: layerIndex,
      });

      setViewingLayer(layerIndex);
    } else {
      // Handle Layer 2+ (multi-select) with specific region and payloads
      if (payloads) {
        // Use the payloads provided by MultiSelectLayerCard
        onFormDataChange({
          ...formData,
          geojsonPreviewPayload: payloads.geojsonPayload,
          dataOverlayPayload: payloads.dataOverlayPayload,
          viewingLayer: layerIndex,
          selectedRegionForPreview: payloads.selectedRegion,
        });
      }
      setViewingLayer(layerIndex);
    }
  };

  // Auto-trigger Layer 1 view when component loads with valid data (edit mode)
  useEffect(() => {
    const layers = formData.layers || [];
    const firstLayer = layers[0];

    // Check if we have a valid first layer configuration and haven't viewed yet
    if (
      firstLayer?.geographic_column &&
      firstLayer?.geojson_id &&
      formData.aggregate_column &&
      formData.aggregate_func &&
      viewingLayer === null
    ) {
      // Automatically view Layer 1
      handleViewLayer(0);
    }
  }, [formData.layers, formData.aggregate_column, formData.aggregate_func]);

  // Filter numeric columns for aggregate column selection
  const numericColumns = (columns || [])
    .filter((col) =>
      ['integer', 'numeric', 'bigint', 'float', 'double', 'decimal'].includes(
        col.data_type?.toLowerCase()
      )
    )
    .map((col) => ({
      // Handle both name and column_name properties
      name: col.name || col.column_name,
      data_type: col.data_type,
    }));

  return (
    <div className="space-y-8">
      {/* Dataset Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle>Dataset Configuration</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select the schema, table, aggregate_column, and aggregate_function.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Chart Info */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="title">Chart Title</Label>
              <Input
                id="title"
                value={formData.title || ''}
                onChange={(e) => onFormDataChange({ ...formData, title: e.target.value })}
                placeholder="Enter chart title"
              />
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
                placeholder="Enter chart description"
                rows={2}
              />
            </div>
          </div>

          {/* Schema Selection */}
          <div>
            <Label htmlFor="schema">Schema</Label>
            <Select value={formData.schema_name || ''} onValueChange={handleSchemaChange}>
              <SelectTrigger id="schema">
                <SelectValue placeholder="Select a schema" />
              </SelectTrigger>
              <SelectContent>
                {(schemas || []).map((schema: string) => (
                  <SelectItem key={schema} value={schema}>
                    {schema}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table Selection */}
          <div>
            <Label htmlFor="table">Table</Label>
            <Select
              value={formData.table_name || ''}
              onValueChange={handleTableChange}
              disabled={!formData.schema_name}
            >
              <SelectTrigger id="table">
                <SelectValue
                  placeholder={!formData.schema_name ? 'Select a schema first' : 'Select a table'}
                />
              </SelectTrigger>
              <SelectContent>
                {(tables || []).map((table: any) => {
                  const tableName = typeof table === 'string' ? table : table.table_name;
                  return (
                    <SelectItem key={tableName} value={tableName}>
                      {tableName}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Aggregate Column */}
          <div>
            <Label className="text-sm font-medium">Aggregate Column</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Select the numeric column with values to aggregate
            </p>
            <Select
              value={formData.aggregate_column || ''}
              onValueChange={(value) =>
                onFormDataChange({
                  ...formData,
                  aggregate_column: value,
                  value_column: value, // Keep both for backward compatibility
                })
              }
              disabled={!formData.schema_name || !formData.table_name}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !formData.table_name ? 'Select a table first' : 'Select column to aggregate'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {numericColumns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.name} ({col.data_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Aggregate Function */}
          <div>
            <Label className="text-sm font-medium">Aggregate Function</Label>
            <p className="text-xs text-muted-foreground mb-2">
              How to aggregate the values by region
            </p>
            <Select
              value={formData.aggregate_func || 'sum'}
              onValueChange={(value) =>
                onFormDataChange({
                  ...formData,
                  aggregate_func: value,
                  aggregate_function: value, // Keep both for backward compatibility
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select aggregate function" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sum">Sum</SelectItem>
                <SelectItem value="avg">Average</SelectItem>
                <SelectItem value="count">Count</SelectItem>
                <SelectItem value="min">Minimum</SelectItem>
                <SelectItem value="max">Maximum</SelectItem>
                <SelectItem value="count_distinct">Count Distinct</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Map Configuration Section */}
      {formData.schema_name &&
        formData.table_name &&
        formData.aggregate_column &&
        formData.aggregate_func && (
          <Card>
            <CardHeader>
              <CardTitle>Map Configuration</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure geographic layers for visualization and drill-down functionality
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {layers.map((layer, index) => {
                  const isFirstLayer = index === 0;

                  return isFirstLayer ? (
                    <LayerCard
                      key={layer.id}
                      layer={layer}
                      index={index}
                      formData={formData}
                      onUpdate={(updates) => updateLayer(layer.id, updates)}
                      onView={() => handleViewLayer(index)}
                      isFirstLayer={true}
                      columns={columns || []}
                    />
                  ) : (
                    <MultiSelectLayerCard
                      key={layer.id}
                      layer={layer}
                      index={index}
                      formData={formData}
                      onUpdate={(updates) => updateLayer(layer.id, updates)}
                      onView={(regionId, payloads) => handleViewLayer(index, regionId, payloads)}
                      onRemove={() => removeLayer(layer.id)}
                      columns={columns || []}
                    />
                  );
                })}

                {/* Add Layer Button */}
                <div className="pt-4 border-t">
                  <Button onClick={addLayer} variant="outline" className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Layer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Show completion message when basic configuration is done */}
      {!formData.schema_name ||
      !formData.table_name ||
      !formData.aggregate_column ||
      !formData.aggregate_func ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Please complete the dataset configuration to set up map layers</p>
        </div>
      ) : null}
    </div>
  );
}

interface LayerCardProps {
  layer: Layer;
  index: number;
  formData: any;
  onUpdate: (updates: Partial<Layer>) => void;
  onView: () => void;
  isFirstLayer: boolean;
  columns: any[];
}

function LayerCard({
  layer,
  index,
  formData,
  onUpdate,
  onView,
  isFirstLayer,
  columns,
}: LayerCardProps) {
  const countryCode = formData.country_code || 'IND';

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

  // Get available countries dynamically
  const { data: availableCountries } = useAvailableLayers('country');

  // Get regions based on layer level
  const { data: regions } = useRegions(countryCode, getRegionTypeForLevel(index));

  // For Layer 2+, we need to determine the parent region to get child regions and GeoJSONs
  const parentLayer = index > 0 ? (formData.layers || [])[index - 1] : null;

  // For Layer 2, if parent layer (Layer 1) is configured but has no region_id,
  // it means we're showing country-level data and Layer 2 should show states
  let parentRegionId = null;
  if (index === 1 && parentLayer?.geographic_column && !parentLayer?.region_id) {
    // Layer 2 case: parent is country level, so show states of India
    parentRegionId = 1; // India country ID
  } else if (parentLayer?.region_id) {
    // Layer 3+ case: parent has a specific region selected
    parentRegionId = parentLayer.region_id;
  }

  // For Layer 2+, get child regions from the parent region
  const { data: childRegions } = useChildRegions(parentRegionId, index > 0 && !!parentRegionId);

  // Determine which region ID to use for fetching GeoJSONs
  let geojsonRegionId = null;
  if (isFirstLayer) {
    // For first layer, use India country region (id: 1)
    geojsonRegionId = regions?.find((r) => r.type === 'country')?.id || 1;
  } else {
    // For Layer 2+, if user has selected a region, use that region ID
    // Otherwise, don't fetch GeoJSONs yet
    if (layer.region_id) {
      geojsonRegionId = layer.region_id;
    }
  }

  const { data: geojsons } = useRegionGeoJSONs(geojsonRegionId);

  // Determine which regions to show in the dropdown
  const availableRegions = index === 0 ? regions : childRegions;
  const layerTitle = getLayerTitle(index);
  const canView = layer.geographic_column && layer.geojson_id;

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant={isFirstLayer ? 'default' : 'secondary'}>
              {isFirstLayer ? 'First Layer' : `Layer ${index + 1}`}
            </Badge>
            <CardTitle className="text-base">{layerTitle}</CardTitle>
          </div>
          {canView && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onView}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
            >
              <Eye className="h-4 w-4" />
              View
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* First layer shows country selection */}
        {isFirstLayer && (
          <div>
            <Label>Select Country</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Choose the country for your map visualization
            </p>
            <Select
              value={countryCode}
              onValueChange={(value) => {
                // Update form data with new country and reset region/geojson selections
                onUpdate({ region_id: undefined, geojson_id: undefined });
                // Also update the main form country_code
                if (formData.onFormDataChange) {
                  formData.onFormDataChange({
                    ...formData,
                    country_code: value,
                  });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {(availableCountries || []).map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
                region_id: undefined,
                geojson_id: undefined,
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

        {/* GeoJSON Selection - Show after geographic column is selected */}
        {layer.geographic_column && (
          <div>
            <Label>Select GeoJSON</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Custom or Default.{' '}
              {isFirstLayer
                ? 'At this point, display an India map with states but no data configured.'
                : ''}
            </p>
            <Select
              value={layer.geojson_id?.toString() || ''}
              onValueChange={(value) => {
                const selectedGeojson = (geojsons || []).find((g) => g.id.toString() === value);
                onUpdate({
                  geojson_id: parseInt(value),
                  geojson_name: selectedGeojson?.version_name,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select GeoJSON version" />
              </SelectTrigger>
              <SelectContent>
                {geojsons?.map((geojson: any) => (
                  <SelectItem key={geojson.id} value={geojson.id.toString()}>
                    <div className="flex items-center justify-between w-full">
                      <span>{geojson.version_name}</span>
                      {geojson.is_default && (
                        <Badge variant="outline" className="ml-2">
                          Default
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Region Selection for subsequent layers */}
        {!isFirstLayer && layer.geographic_column && (
          <div>
            <Label>Select {layerTitle}</Label>
            <p className="text-xs text-muted-foreground mb-2">
              {index === 1
                ? 'e.g., Maharashtra. The user can select multiple states, but each state must be configured with its own GeoJSON.'
                : 'Choose the specific region for this layer.'}
            </p>
            <Select
              value={layer.region_id?.toString() || ''}
              onValueChange={(value) => {
                const selectedRegion = availableRegions?.find((r) => r.id.toString() === value);
                onUpdate({
                  region_id: parseInt(value),
                  region_name: selectedRegion?.display_name,
                  geojson_id: undefined,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select ${layerTitle.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {availableRegions?.map((region: any) => (
                  <SelectItem key={region.id} value={region.id.toString()}>
                    {region.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Status Display */}
        <div className="flex flex-wrap gap-2 pt-2">
          {layer.geographic_column && (
            <Badge variant="outline" className="bg-green-50 text-green-700">
              Column: {layer.geographic_column}
            </Badge>
          )}
          {layer.geojson_name && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              GeoJSON: {layer.geojson_name}
            </Badge>
          )}
          {layer.region_name && (
            <Badge variant="outline" className="bg-purple-50 text-purple-700">
              Region: {layer.region_name}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function getLayerTitle(index: number): string {
  const titles = ['Country/State', 'District/County', 'Ward/Block', 'Sub-Ward'];
  return titles[index] || `Layer ${index + 1}`;
}

function getRegionTypeForLevel(level: number): string | undefined {
  const types = [undefined, 'state', 'district', 'ward'];
  return types[level];
}
