'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Eye, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useRegions, useChildRegions, useRegionGeoJSONs, useColumns } from '@/hooks/api/useChart';
import { ColumnTypeIcon } from '@/lib/columnTypeIcons';
import { Combobox, highlightText } from '@/components/ui/combobox';

interface Layer {
  id: string;
  level: number;
  geographic_column?: string;
  region_id?: number;
  geojson_id?: number;
  parent_selections?: Array<{
    region_id: number;
    region_name: string;
  }>;
}

interface LayerConfigurationProps {
  formData: any;
  onFormDataChange: (data: any) => void;
  onPreviewLayer: (layerIndex: number, regionId: number, geojsonId: number) => void;
}

export function LayerConfiguration({
  formData,
  onFormDataChange,
  onPreviewLayer,
}: LayerConfigurationProps) {
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set(['0']));

  // Get columns for geographic selection
  const { data: columns } = useColumns(formData.schema_name || null, formData.table_name || null);

  // Initialize layers if not present
  const layers: Layer[] = formData.layers || [{ id: '0', level: 0, geographic_column: undefined }];

  const updateLayers = (newLayers: Layer[]) => {
    onFormDataChange({
      ...formData,
      layers: newLayers,
    });
  };

  const addLayer = () => {
    const newLayer: Layer = {
      id: Date.now().toString(),
      level: layers.length,
      geographic_column: undefined,
      parent_selections: [],
    };
    updateLayers([...layers, newLayer]);
    setExpandedLayers((prev) => new Set([...prev, newLayer.id]));
  };

  const removeLayer = (layerId: string) => {
    const newLayers = layers.filter((layer) => layer.id !== layerId);
    updateLayers(newLayers);
    setExpandedLayers((prev) => {
      const newSet = new Set(prev);
      newSet.delete(layerId);
      return newSet;
    });
  };

  const updateLayer = (layerId: string, updates: Partial<Layer>) => {
    const newLayers = layers.map((layer) =>
      layer.id === layerId ? { ...layer, ...updates } : layer
    );
    updateLayers(newLayers);
  };

  const toggleLayerExpanded = (layerId: string) => {
    setExpandedLayers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(layerId)) {
        newSet.delete(layerId);
      } else {
        newSet.add(layerId);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Map Layers Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Configure geographic layers for drill-down functionality
          </p>
        </div>
        <Button onClick={addLayer} variant="outline" size="sm" className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Layer
        </Button>
      </div>

      <div className="space-y-3">
        {layers.map((layer, index) => (
          <LayerCard
            key={layer.id}
            layer={layer}
            index={index}
            isExpanded={expandedLayers.has(layer.id)}
            onToggleExpanded={() => toggleLayerExpanded(layer.id)}
            onUpdate={(updates) => updateLayer(layer.id, updates)}
            onRemove={() => removeLayer(layer.id)}
            onPreview={(regionId, geojsonId) => onPreviewLayer(index, regionId, geojsonId)}
            canRemove={layers.length > 1}
            columns={columns || []}
            countryCode={formData.country_code || 'IND'}
          />
        ))}
      </div>
    </div>
  );
}

interface LayerCardProps {
  layer: Layer;
  index: number;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onUpdate: (updates: Partial<Layer>) => void;
  onRemove: () => void;
  onPreview: (regionId: number, geojsonId: number) => void;
  canRemove: boolean;
  columns: any[];
  countryCode: string;
}

function LayerCard({
  layer,
  index,
  isExpanded,
  onToggleExpanded,
  onUpdate,
  onRemove,
  onPreview,
  canRemove,
  columns,
  countryCode,
}: LayerCardProps) {
  // Get regions based on layer level
  const { data: regions } = useRegions(countryCode, getRegionTypeForLevel(index));

  // Get child regions if this is not the first layer
  const parentRegionId = layer.parent_selections?.[layer.parent_selections.length - 1]?.region_id;
  const { data: childRegions } = useChildRegions(parentRegionId, index > 0);

  // Get GeoJSONs for selected region
  const { data: geojsons } = useRegionGeoJSONs(layer.region_id);

  const availableRegions = index === 0 ? regions : childRegions;

  return (
    <Card className={`transition-all ${isExpanded ? 'ring-2 ring-blue-200' : ''}`}>
      <CardHeader className="cursor-pointer" onClick={onToggleExpanded}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant={index === 0 ? 'default' : 'secondary'}>Layer {index + 1}</Badge>
            <CardTitle className="text-base">
              {getLayerTitle(index)} {layer.geographic_column ? `(${layer.geographic_column})` : ''}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {layer.region_id && layer.geojson_id && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(layer.region_id!, layer.geojson_id!);
                }}
                className="flex items-center gap-1"
              >
                <Eye className="h-4 w-4" />
                View
              </Button>
            )}
            {canRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {isExpanded ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Geographic Column Selection */}
          <div>
            <Label>Geographic Column</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Select the column that contains {getLayerTitle(index).toLowerCase()} names
            </p>
            <Combobox
              items={columns.map((column) => ({
                value: column.column_name,
                label: column.column_name,
                data_type: column.data_type,
              }))}
              value={layer.geographic_column || ''}
              onValueChange={(value) => onUpdate({ geographic_column: value })}
              searchPlaceholder="Search columns..."
              placeholder={`Select ${getLayerTitle(index).toLowerCase()} column`}
              renderItem={(item, _isSelected, searchQuery) => (
                <div className="flex items-center gap-2 min-w-0">
                  <ColumnTypeIcon dataType={item.data_type} className="w-4 h-4" />
                  <span className="truncate">{highlightText(item.label, searchQuery)}</span>
                </div>
              )}
            />
          </div>

          {/* Region Selection */}
          {layer.geographic_column && (
            <div>
              <Label>Select {getLayerTitle(index)}</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Choose the geographic region for this layer
              </p>
              <Combobox
                items={(availableRegions || []).map((region: any) => ({
                  value: region.id.toString(),
                  label: region.display_name,
                }))}
                value={layer.region_id?.toString() || ''}
                onValueChange={(value) => onUpdate({ region_id: parseInt(value) })}
                searchPlaceholder="Search regions..."
                placeholder={`Select ${getLayerTitle(index).toLowerCase()}`}
              />
            </div>
          )}

          {/* GeoJSON Selection */}
          {layer.region_id && (
            <div>
              <Label>GeoJSON Version</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Select the map boundary data to use
              </p>
              <Combobox
                items={(geojsons || []).map((geojson: any) => ({
                  value: geojson.id.toString(),
                  label: geojson.is_default ? `${geojson.name} (Default)` : geojson.name,
                }))}
                value={layer.geojson_id?.toString() || ''}
                onValueChange={(value) => onUpdate({ geojson_id: parseInt(value) })}
                searchPlaceholder="Search..."
                placeholder="Select GeoJSON version"
              />
            </div>
          )}

          {/* Parent Selections Display */}
          {index > 0 && layer.parent_selections && layer.parent_selections.length > 0 && (
            <div>
              <Label>Drill-down Context</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {layer.parent_selections.map((selection, idx) => (
                  <Badge key={idx} variant="outline">
                    {selection.region_name}
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

function getLayerTitle(index: number): string {
  const titles = ['Country/State', 'District/County', 'Ward/Block', 'Sub-Ward'];
  return titles[index] || `Layer ${index + 1}`;
}

function getRegionTypeForLevel(level: number): string | undefined {
  const types = [undefined, 'state', 'district', 'ward'];
  return types[level];
}
