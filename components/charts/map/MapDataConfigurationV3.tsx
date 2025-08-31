'use client';

import React, { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  MapPin,
  Table,
  Plus,
  Eye,
  ChevronDown,
  ChevronUp,
  Trash2,
  Filter,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { MetricsSelector } from '@/components/charts/MetricsSelector';
import { DatasetSelector } from '@/components/charts/DatasetSelector';
import {
  useColumns,
  useRegions,
  useChildRegions,
  useRegionGeoJSONs,
  useAvailableLayers,
  useRegionHierarchy,
  useChartDataPreview,
} from '@/hooks/api/useChart';
import { useCascadingFilters } from '@/hooks/useCascadingFilters';
import type { ChartBuilderFormData, ChartMetric } from '@/types/charts';

// Region data type
interface Region {
  id: number;
  name: string;
  display_name?: string;
  type?: string;
  parent_id?: number;
  code?: string; // for country codes
}

// GeoJSON data type
interface GeoJSON {
  id: number;
  name: string;
  is_default?: boolean;
}

// Column data type
interface TableColumn {
  name: string;
  data_type: string;
}

// Payload types for view functions
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
  geojson_id?: number;
  region_name?: string;
  geojson_name?: string;
  selected_regions?: SelectedRegion[];
  name?: string;
}

interface MapDataConfigurationV3Props {
  formData: ChartBuilderFormData;
  onFormDataChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

const AGGREGATE_FUNCTIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'count_distinct', label: 'Count Distinct' },
];

// Component for searchable value input - same as in ChartDataConfigurationV3
const SearchableValueInput = React.memo(function SearchableValueInput({
  schema,
  table,
  column,
  operator,
  value,
  onChange,
  disabled,
}: {
  schema?: string;
  table?: string;
  column: string;
  operator: string;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}) {
  // Get column values from preview data instead of separate API call
  const { data: previewData } = useChartDataPreview(
    schema && table
      ? {
          chart_type: 'bar',
          computation_type: 'raw',
          schema_name: schema,
          table_name: table,
          x_axis: column,
          y_axis: column,
        }
      : null,
    1,
    500 // Get more rows to have better distinct values
  );

  // Extract distinct values from preview data
  const columnValues = React.useMemo(() => {
    if (!previewData?.data || !column) return null;

    const distinctValues = new Set<string>();
    previewData.data.forEach((row: Record<string, any>) => {
      const value = row[column];
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        distinctValues.add(String(value));
      }
    });

    return Array.from(distinctValues).sort();
  }, [previewData, column]);

  // For null checks, no value input needed
  if (operator === 'is_null' || operator === 'is_not_null') {
    return null;
  }

  // For 'in' and 'not_in' operators, show multiselect dropdown if we have column values
  if (operator === 'in' || operator === 'not_in') {
    if (columnValues && columnValues.length > 0) {
      const selectedValues = Array.isArray(value)
        ? value
        : value
          ? String(value)
              .split(',')
              .map((v: string) => v.trim())
          : [];

      return (
        <div className="h-8 flex-1">
          <Select
            value={selectedValues.length > 0 ? selectedValues.join(',') : ''}
            onValueChange={(selectedValue) => {
              const currentSelected = selectedValues.includes(selectedValue)
                ? selectedValues.filter((v: string) => v !== selectedValue)
                : [...selectedValues, selectedValue];
              onChange(currentSelected.join(', '));
            }}
            disabled={disabled}
          >
            <SelectTrigger className="h-8">
              <SelectValue
                placeholder={
                  selectedValues.length > 0 ? `${selectedValues.length} selected` : 'Select values'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {columnValues
                .filter((val) => val !== null && val !== undefined && val.toString().trim() !== '')
                .slice(0, 100)
                .map((val) => (
                  <SelectItem key={val} value={val.toString()}>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedValues.includes(val.toString())}
                        readOnly
                        className="w-4 h-4"
                      />
                      {val}
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      );
    } else {
      // Fallback to text input for in/not_in when no column values
      return (
        <Input
          type="text"
          placeholder="value1, value2, value3"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-8 flex-1"
        />
      );
    }
  }

  // If we have column values, show searchable dropdown
  if (columnValues && columnValues.length > 0) {
    return (
      <Select
        value={value || ''}
        onValueChange={(selectedValue) => onChange(selectedValue)}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 flex-1">
          <SelectValue placeholder="Select or type value" />
        </SelectTrigger>
        <SelectContent>
          <div className="p-2">
            <Input
              type="text"
              placeholder="Type to search..."
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="h-8 mb-2"
            />
          </div>
          {columnValues
            .filter(
              (val) =>
                val !== null &&
                val !== undefined &&
                val.toString().trim() !== '' &&
                val
                  .toString()
                  .toLowerCase()
                  .includes((value || '').toString().toLowerCase())
            )
            .slice(0, 100)
            .map((val) => (
              <SelectItem key={val} value={val.toString()}>
                {val}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    );
  }

  // Fallback to regular input
  return (
    <Input
      type="text"
      placeholder="Enter value"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-8 flex-1"
    />
  );
});

export function MapDataConfigurationV3({
  formData,
  onFormDataChange,
  disabled,
}: MapDataConfigurationV3Props) {
  const [viewingLayer, setViewingLayer] = useState<number | null>(null);
  const [isEditingDataset, setIsEditingDataset] = useState(false);
  const { data: columns } = useColumns(formData.schema_name || null, formData.table_name || null);

  // Filter columns by type
  const normalizedColumns =
    columns?.map((col) => ({
      name: col.column_name || col.name, // Use 'name' to match TableColumn interface
      data_type: col.data_type,
    })) || [];

  const numericColumns = normalizedColumns.filter((col) =>
    ['integer', 'bigint', 'numeric', 'double precision', 'real', 'float', 'decimal'].includes(
      col.data_type.toLowerCase()
    )
  );

  const allColumns = normalizedColumns;

  // Handle dataset changes with complete form reset for maps
  const handleDatasetChange = (schema_name: string, table_name: string) => {
    // Prevent unnecessary resets if dataset hasn't actually changed
    if (formData.schema_name === schema_name && formData.table_name === table_name) {
      setIsEditingDataset(false);
      return;
    }

    // Preserve only essential chart identity fields
    const preservedFields = {
      title: formData.title,
      description: formData.description,
      chart_type: formData.chart_type,
      customizations: formData.customizations || {}, // Keep styling preferences
    };

    // Reset all map-specific fields to ensure compatibility with new dataset
    onFormDataChange({
      ...preservedFields,
      schema_name,
      table_name,
      // Reset all column selections
      geographic_column: undefined,
      value_column: undefined,
      aggregate_function: 'sum', // Default aggregate function
      selected_geojson_id: undefined,
      // Reset data configuration
      metrics: [],
      filters: [],
      sort: [],
      pagination: { enabled: false, page_size: 50 },
      computation_type: 'aggregated',
      // Reset map-specific fields
      layers: undefined, // Will be recreated with default layer
      geojsonPreviewPayload: undefined,
      dataOverlayPayload: undefined,
      country_code: 'IND', // Reset to default country
    });

    // Exit edit mode after successful change
    setIsEditingDataset(false);
  };

  // Handle canceling dataset edit
  const handleCancelDatasetEdit = () => {
    setIsEditingDataset(false);
  };

  // Fetch region hierarchy for dynamic layer structure
  const countryCode = formData.country_code || 'IND';
  const { data: regionHierarchy } = useRegionHierarchy(countryCode);

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
        value_column: formData.aggregate_column || formData.value_column,
        aggregate_function: formData.aggregate_function,
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

  const handleViewLayer = (layerIndex: number) => {
    const layer = layers[layerIndex];

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
        value_column: formData.aggregate_column || formData.value_column,
        aggregate_function: formData.aggregate_function,
        selected_geojson_id: layer.geojson_id,
      };

      // Trigger separated fetching preview
      onFormDataChange({
        ...formData,
        geojsonPreviewPayload: geojsonPayload,
        dataOverlayPayload: dataOverlayPayload,
        viewingLayer: layerIndex,
      } as any);

      setViewingLayer(layerIndex);
    }
  };

  const handleViewRegion = (layerIndex: number, regionId: number, payloads?: ViewPayloads) => {
    // Handle view for multi-select layers
    if (payloads) {
      onFormDataChange({
        ...formData,
        geojsonPreviewPayload: payloads.geojsonPayload,
        dataOverlayPayload: payloads.dataOverlayPayload,
        viewingLayer: layerIndex,
        selectedRegionForPreview: payloads.selectedRegion,
      } as any);
    }
    setViewingLayer(layerIndex);
  };

  return (
    <div className="space-y-4">
      {/* Chart Type - Show readonly */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Chart Type</Label>
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border w-full">
          <MapPin className="h-5 w-5 text-blue-600" />
          <span className="font-medium">Map</span>
        </div>
      </div>

      {/* Data Source - Inline Edit Pattern */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Data Source</Label>
        {!isEditingDataset ? (
          // Read-only view with edit button
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border w-full group hover:bg-gray-100 transition-colors">
            <Table className="h-5 w-5 text-gray-600" />
            <span className="font-mono text-sm flex-1">
              {formData.schema_name}.{formData.table_name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setIsEditingDataset(true)}
              disabled={disabled}
            >
              <Edit2 className="h-3 w-3 text-gray-500" />
            </Button>
          </div>
        ) : (
          // Edit mode with dataset selector
          <div className="space-y-2">
            <DatasetSelector
              schema_name={formData.schema_name}
              table_name={formData.table_name}
              onDatasetChange={handleDatasetChange}
              disabled={disabled}
              className="w-full"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelDatasetEdit}
                disabled={disabled}
                className="h-7 px-2 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
              <span className="text-xs text-gray-500">Select a dataset to continue</span>
            </div>
          </div>
        )}
      </div>

      {/* Metrics - use MetricsSelector with single metric */}
      <MetricsSelector
        metrics={formData.metrics || []}
        onChange={(metrics: ChartMetric[]) => {
          // Map metrics to legacy fields for compatibility
          const metric = metrics[0];
          onFormDataChange({
            metrics,
            value_column: metric?.column,
            aggregate_column: metric?.column,
            aggregate_function: metric?.aggregation,
          });
        }}
        columns={normalizedColumns}
        disabled={disabled}
        chartType="map"
        maxMetrics={1}
      />

      {/* Filters Section */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Data Filters</Label>
        <div className="space-y-2">
          {(formData.filters || []).map((filter, index) => (
            <div key={index} className="flex gap-2 items-center">
              <Select
                value={filter.column}
                onValueChange={(value) => {
                  const newFilters = [...(formData.filters || [])];
                  newFilters[index] = { ...filter, column: value };
                  onFormDataChange({ filters: newFilters });
                }}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 flex-1">
                  <SelectValue placeholder="Column" />
                </SelectTrigger>
                <SelectContent>
                  {allColumns.map((col) => (
                    <SelectItem key={col.column_name} value={col.column_name}>
                      {col.column_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filter.operator}
                onValueChange={(value) => {
                  const newFilters = [...(formData.filters || [])];
                  newFilters[index] = { ...filter, operator: value as any };
                  onFormDataChange({ filters: newFilters });
                }}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 w-32">
                  <SelectValue placeholder="Operator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="not_equals">Not equals</SelectItem>
                  <SelectItem value="greater_than">Greater than (&gt;)</SelectItem>
                  <SelectItem value="greater_than_equal">Greater or equal (&gt;=)</SelectItem>
                  <SelectItem value="less_than">Less than (&lt;)</SelectItem>
                  <SelectItem value="less_than_equal">Less or equal (&lt;=)</SelectItem>
                  <SelectItem value="like">Like</SelectItem>
                  <SelectItem value="like_case_insensitive">Like (case insensitive)</SelectItem>
                  <SelectItem value="in">In</SelectItem>
                  <SelectItem value="not_in">Not in</SelectItem>
                  <SelectItem value="is_null">Is null</SelectItem>
                  <SelectItem value="is_not_null">Is not null</SelectItem>
                </SelectContent>
              </Select>

              <SearchableValueInput
                schema={formData.schema_name}
                table={formData.table_name}
                column={filter.column}
                operator={filter.operator}
                value={filter.value}
                onChange={(value) => {
                  const newFilters = [...(formData.filters || [])];
                  newFilters[index] = { ...filter, value };
                  onFormDataChange({ filters: newFilters });
                }}
                disabled={disabled}
              />

              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  const newFilters = (formData.filters || []).filter((_, i) => i !== index);
                  onFormDataChange({ filters: newFilters });
                }}
                disabled={disabled}
              >
                ✕
              </Button>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newFilters = [
                ...(formData.filters || []),
                { column: '', operator: 'equals' as any, value: '' },
              ];
              onFormDataChange({ filters: newFilters });
            }}
            disabled={disabled}
            className="w-full bg-gray-900 text-white hover:bg-gray-700 hover:text-white border-gray-900"
          >
            + Add Filter
          </Button>
        </div>
      </div>

      {/* Pagination Section */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Pagination</Label>
        <Select
          value={
            formData.pagination?.enabled
              ? (formData.pagination?.page_size || 50).toString()
              : '__none__'
          }
          onValueChange={(value) => {
            if (value === '__none__') {
              onFormDataChange({ pagination: { enabled: false, page_size: 50 } });
            } else {
              onFormDataChange({
                pagination: {
                  enabled: true,
                  page_size: parseInt(value),
                },
              });
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 w-full">
            <SelectValue placeholder="Select pagination" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No pagination</SelectItem>
            <SelectItem value="20">20 items</SelectItem>
            <SelectItem value="50">50 items</SelectItem>
            <SelectItem value="100">100 items</SelectItem>
            <SelectItem value="200">200 items</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort Section */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Sort Metric</Label>
        <Select
          value={
            formData.sort && formData.sort.length > 0 ? formData.sort[0].direction : '__none__'
          }
          onValueChange={(value) => {
            if (value === '__none__') {
              onFormDataChange({ sort: [] });
            } else {
              // Sort by the aggregate/value column for maps
              const sortColumn = formData.aggregate_column;

              if (sortColumn) {
                onFormDataChange({
                  sort: [{ column: sortColumn, direction: value as 'asc' | 'desc' }],
                });
              }
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 w-full">
            <SelectValue placeholder="Select sort order" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            <SelectItem value="asc">Asc</SelectItem>
            <SelectItem value="desc">Desc</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Map Layers Configuration */}
      {formData.aggregate_column && formData.aggregate_function && (
        <div className="space-y-4 pt-4 border-t">
          <div>
            <Label className="text-sm font-medium text-gray-900">Map Layers</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Configure geographic layers for visualization and drill-down functionality
            </p>
          </div>

          <div className="space-y-3">
            {layers.map((layer, index) => (
              <LayerCard
                key={layer.id}
                layer={layer}
                index={index}
                formData={formData}
                onUpdate={(updates) => updateLayer(layer.id, updates)}
                onView={() => handleViewLayer(index)}
                onViewRegion={(regionId, payloads) => handleViewRegion(index, regionId, payloads)}
                isFirstLayer={index === 0}
                columns={allColumns}
                onRemove={index === 0 ? undefined : () => removeLayer(layer.id)}
                onFormDataChange={onFormDataChange}
              />
            ))}

            {/* Add Layer Button - Show if we have fewer than 4 layers */}
            {layers.length < 4 && (
              <Button
                onClick={addLayer}
                variant="outline"
                size="sm"
                className="w-full bg-gray-900 text-white hover:bg-gray-700 hover:text-white border-gray-900"
                disabled={disabled}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Layer
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface LayerCardProps {
  layer: Layer;
  index: number;
  formData: ChartBuilderFormData;
  onUpdate: (updates: Partial<Layer>) => void;
  onView: () => void;
  onViewRegion: (regionId: number, payloads?: ViewPayloads) => void;
  isFirstLayer: boolean;
  columns: TableColumn[];
  onRemove?: () => void;
  onFormDataChange: (updates: Partial<ChartBuilderFormData>) => void;
}

function LayerCard({
  layer,
  index,
  formData,
  onUpdate,
  onView,
  onViewRegion,
  isFirstLayer,
  columns,
  onRemove,
  onFormDataChange,
}: LayerCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const countryCode = formData.country_code || 'IND';

  // Get region hierarchy from parent component
  const { data: regionHierarchy } = useRegionHierarchy(countryCode);

  // Get available countries dynamically
  const { data: availableCountries } = useAvailableLayers('country');

  // Get regions based on layer level
  const { data: regions } = useRegions(countryCode, getRegionTypeForLevel(index, regionHierarchy));

  // For Layer 2+, determine the parent region to get child regions and GeoJSONs
  const parentLayer = index > 0 ? (formData.layers || [])[index - 1] : null;

  let parentRegionId = null;
  if (index === 1 && (parentLayer as any)?.geographic_column && !(parentLayer as any)?.region_id) {
    // Layer 2 case: parent is country level, so show states
    parentRegionId = 1; // India country ID
  } else if ((parentLayer as any)?.region_id) {
    // Layer 3+ case: parent has a specific region selected
    parentRegionId = (parentLayer as any).region_id;
  }

  // For Layer 2+, get child regions from the parent region
  const { data: childRegions } = useChildRegions(parentRegionId, index > 0 && !!parentRegionId);

  // Determine which region ID to use for fetching GeoJSONs
  let geojsonRegionId = null;
  if (isFirstLayer) {
    // For first layer, use India country region (id: 1)
    geojsonRegionId = regions?.find((r: Region) => r.type === 'country')?.id || 1;
  } else {
    // For Layer 2+, if user has selected a region, use that region ID
    if (layer.region_id) {
      geojsonRegionId = layer.region_id;
    }
  }

  const { data: geojsons } = useRegionGeoJSONs(geojsonRegionId);

  // Auto-select default GeoJSON when geographic column is selected and geojsons are available
  useEffect(() => {
    if (isFirstLayer && layer.geographic_column && geojsons && !layer.geojson_id) {
      const defaultGeojson = geojsons.find((g: GeoJSON) => g.is_default);
      if (defaultGeojson) {
        onUpdate({
          geojson_id: defaultGeojson.id,
          geojson_name: defaultGeojson.name,
        });
      }
    }
  }, [layer.geographic_column, geojsons, layer.geojson_id, onUpdate, isFirstLayer]);

  // Auto-render map when Layer 1 is configured
  useEffect(() => {
    if (
      isFirstLayer &&
      layer.geographic_column &&
      layer.geojson_id &&
      formData.aggregate_column &&
      formData.aggregate_function
    ) {
      // Check if we haven't already set these payloads to avoid infinite loop
      // Also check if filters/pagination/sort have changed to trigger regeneration
      const currentFiltersHash = JSON.stringify(formData.filters || []);
      const currentPaginationHash = JSON.stringify(formData.pagination || {});
      const currentSortHash = JSON.stringify(formData.sort || []);

      const payloadFiltersHash = JSON.stringify(
        (formData.dataOverlayPayload as any)?.chart_filters || []
      );
      const payloadPaginationHash = JSON.stringify(
        (formData.dataOverlayPayload as any)?.extra_config?.pagination || {}
      );
      const payloadSortHash = JSON.stringify(
        (formData.dataOverlayPayload as any)?.extra_config?.sort || []
      );

      const hasValidPayloads =
        formData.geojsonPreviewPayload?.geojsonId === layer.geojson_id &&
        formData.dataOverlayPayload?.geographic_column === layer.geographic_column &&
        (formData as any).viewingLayer === 0 &&
        currentFiltersHash === payloadFiltersHash && // ✅ Check filters changed
        currentPaginationHash === payloadPaginationHash && // ✅ Check pagination changed
        currentSortHash === payloadSortHash; // ✅ Check sort changed

      if (!hasValidPayloads) {
        // Build separate payloads for GeoJSON and data overlay
        const geojsonPayload = {
          geojsonId: layer.geojson_id,
        };

        const dataOverlayPayload = {
          schema_name: formData.schema_name,
          table_name: formData.table_name,
          geographic_column: layer.geographic_column,
          value_column: formData.aggregate_column || formData.value_column,
          aggregate_function: formData.aggregate_function,
          selected_geojson_id: layer.geojson_id,
          // Include filters, pagination, and sorting for full functionality
          filters: {}, // ✅ Empty dict for drill-down filters
          chart_filters: formData.filters || [], // ✅ Array for chart-level filters
          extra_config: {
            filters: formData.filters || [],
            pagination: formData.pagination,
            sort: formData.sort,
          },
        };

        // Trigger separated fetching preview automatically
        onFormDataChange({
          ...formData,
          geojsonPreviewPayload: geojsonPayload,
          dataOverlayPayload: dataOverlayPayload,
          viewingLayer: 0,
        } as any);
      }
    }
  }, [
    layer.geographic_column,
    layer.geojson_id,
    formData.aggregate_column,
    formData.aggregate_function,
    formData.filters, // ✅ Critical: Include filters dependency
    formData.pagination, // ✅ Include pagination dependency
    formData.sort, // ✅ Include sort dependency
    isFirstLayer,
  ]);

  // Determine which regions to show in the dropdown/checkboxes
  const allAvailableRegions = index === 0 ? regions : childRegions;

  // Apply cascading filters to available regions
  const { filteredRegions, invalidSelections, hasFiltersApplied, filteredCount } =
    useCascadingFilters(index, formData, allAvailableRegions);

  // Use filtered regions instead of all available regions
  const availableRegions = filteredRegions;
  const layerTitle = getLayerTitle(index, regionHierarchy, countryCode);

  // Auto-cleanup invalid selections when filters change
  useEffect(() => {
    if (invalidSelections.length > 0 && layer.selected_regions) {
      const validSelections = layer.selected_regions.filter(
        (selection) =>
          !invalidSelections.some((invalid) => invalid.region_id === selection.region_id)
      );

      if (validSelections.length !== layer.selected_regions.length) {
        const updatedLayers = [...(formData.layers || [])];
        updatedLayers[index] = {
          ...layer,
          selected_regions: validSelections,
        };
        onFormDataChange({
          layers: updatedLayers,
        });
      }
    }
  }, [invalidSelections, layer.selected_regions, index, formData.layers, layer, onFormDataChange]);
  const canView =
    !isFirstLayer && layer.geographic_column && (layer.selected_regions?.length || 0) > 0;

  // Filter out columns that are already used in previous layers
  const getAvailableColumns = () => {
    if (!columns) return [];

    const usedColumns = new Set<string>();

    // Add columns used in previous layers
    const layers = formData.layers || [];
    for (let i = 0; i < index; i++) {
      const previousLayer = layers[i];
      if ((previousLayer as any)?.geographic_column) {
        usedColumns.add((previousLayer as any).geographic_column);
      }
    }

    // Filter out used columns
    return columns.filter((column) => {
      const columnName = column.name;
      return !usedColumns.has(columnName);
    });
  };

  const availableColumns = getAvailableColumns();
  const selectedRegions = layer.selected_regions || [];

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

  // Handle view button click for a specific region (multi-select layers)
  const handleViewRegionClick = (regionId: number) => {
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
      value_column: formData.aggregate_column || formData.value_column,
      aggregate_function: formData.aggregate_function,
      selected_geojson_id: region.geojson_id,
    };

    // Pass the payloads to parent for preview
    onViewRegion(regionId, {
      geojsonPayload,
      dataOverlayPayload,
      selectedRegion: region,
    });
  };

  return (
    <Card
      className={`${isFirstLayer ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-gray-300'}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={isFirstLayer ? 'default' : 'secondary'}>
              {isFirstLayer ? 'First Layer' : `Layer ${index + 1}`}
            </Badge>
            <span className="text-sm font-medium">{layerTitle}</span>
            {!isFirstLayer && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 w-6 p-0"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isFirstLayer && (
              <Badge variant="outline" className="text-xs">
                {selectedRegions.length} selected
              </Badge>
            )}
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
            {onRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="h-7 px-2 text-red-600 hover:text-red-700"
                title="Remove layer"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {(isFirstLayer || isExpanded) && (
        <CardContent className="space-y-3 pt-0">
          {/* First layer shows country selection */}
          {isFirstLayer && (
            <div className="space-y-2">
              <Label>Select Country</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Choose the country for your map visualization
              </p>
              <Select
                value={countryCode}
                onValueChange={(value) => {
                  // Update form data with new country and reset region/geojson selections
                  onUpdate({ region_id: undefined, geojson_id: undefined });
                  onFormDataChange({
                    ...formData,
                    country_code: value,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {(availableCountries || []).map((country: Region) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Geographic Column Selection */}
          <div className="space-y-2">
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
                  selected_regions: [], // Reset selections when column changes
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select ${layerTitle.toLowerCase()} column`} />
              </SelectTrigger>
              <SelectContent>
                {availableColumns.map((column) => {
                  const columnName = column.name;
                  return (
                    <SelectItem key={columnName} value={columnName}>
                      {columnName} ({column.data_type})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Multi-Region Selection for Layer 2+ */}
          {!isFirstLayer && layer.geographic_column && (
            <div className="space-y-2">
              <Label>Select {layerTitle}s</Label>
              <p className="text-xs text-muted-foreground mb-2">
                {index === 1
                  ? 'e.g., Maharashtra. The user can select multiple states, but each state must be configured with its own GeoJSON.'
                  : 'Choose multiple regions to visualize. Each will have its own map.'}
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

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableRegions?.map((region: Region) => (
                  <RegionSelectionItem
                    key={region.id}
                    region={region}
                    isSelected={selectedRegions.some((r) => r.region_id === region.id)}
                    selectedRegion={selectedRegions.find((r) => r.region_id === region.id)}
                    onToggle={handleRegionToggle}
                    onGeoJSONSelect={handleGeoJSONSelect}
                    onView={handleViewRegionClick}
                    canView={!!layer.geographic_column}
                  />
                ))}

                {availableRegions?.length === 0 && allAvailableRegions?.length > 0 && (
                  <div className="text-sm text-gray-500 italic text-center py-4">
                    All {layerTitle.toLowerCase()}s filtered out by current filters
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status Display for multi-select layers */}
          {!isFirstLayer && selectedRegions.length > 0 && (
            <div className="pt-2 border-t">
              <Label className="text-sm font-medium mb-2 block">Selected Regions:</Label>
              <div className="flex flex-wrap gap-1">
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

          {/* Status Display for primary layer */}
          {isFirstLayer && (
            <div className="flex flex-wrap gap-1">
              {layer.geographic_column && (
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  Column: {layer.geographic_column}
                </Badge>
              )}
              {layer.geojson_name && (
                <Badge variant="outline" className="bg-purple-50 text-purple-700">
                  GeoJSON: {layer.geojson_name}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Individual region selection component with checkboxes
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
    <div className="border rounded-lg p-2 space-y-2">
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
            className="h-6 px-2 text-green-600 hover:text-green-700"
          >
            <Eye className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

function getLayerTitle(
  index: number,
  regionHierarchy?: Region[],
  countryCode: string = 'IND'
): string {
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

  // Fallback when no hierarchy data is available
  const titles = ['Country', 'States', 'Districts', 'Wards'];
  return titles[index] || `Layer ${index + 1}`;
}

function getRegionTypeForLevel(level: number, regionHierarchy?: Region[]): string | undefined {
  if (regionHierarchy && regionHierarchy.length > 0) {
    // Build hierarchy from region data - group by type and get unique types
    const regionTypes = Array.from(new Set(regionHierarchy.map((region: Region) => region.type)));

    // Return the region type for the requested level
    return regionTypes[level];
  }

  // Fallback to static types when no hierarchy data is available
  const types = [undefined, 'state', 'district', 'ward'];
  return types[level];
}
