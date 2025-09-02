'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, BarChart3 } from 'lucide-react';
import { ChartTypeSelector } from './ChartTypeSelector';
import { ChartDataConfigurationV3 } from './ChartDataConfigurationV3';
import { ChartCustomizations } from './ChartCustomizations';
import { ChartFiltersConfiguration } from './ChartFiltersConfiguration';
import { ChartPaginationConfiguration } from './ChartPaginationConfiguration';
import { ChartSortConfiguration } from './ChartSortConfiguration';
import { WorkInProgress } from './WorkInProgress';
import { SimpleTableConfiguration } from './SimpleTableConfiguration';
import { ChartPreview } from './ChartPreview';
import { DataPreview } from './DataPreview';
import { MapDataConfigurationV3 } from './map/MapDataConfigurationV3';
import { MapCustomizations } from './map/MapCustomizations';
import { MapPreview } from './map/MapPreview';
import { DynamicLevelConfig } from './map/DynamicLevelConfig';
import {
  useChartData,
  useChartDataPreview,
  useTables,
  useColumns,
  useMapData,
  useGeoJSONData,
  useMapDataOverlay,
  useRawTableData,
  useTableCount,
  useRegions,
  useChildRegions,
  useRegionGeoJSONs,
} from '@/hooks/api/useChart';
import type {
  ChartCreate,
  ChartDataPayload,
  ChartBuilderFormData,
  GeographicHierarchy,
} from '@/types/charts';
import { debounce } from 'lodash';
import { generateAutoPrefilledConfig } from '@/lib/chartAutoPrefill';

// Default customizations for each chart type
function getDefaultCustomizations(chartType: string): Record<string, any> {
  switch (chartType) {
    case 'bar':
      return {
        orientation: 'vertical',
        showDataLabels: false,
        dataLabelPosition: 'top',
        stacked: false,
        showTooltip: true,
        showLegend: true,
        xAxisTitle: '',
        yAxisTitle: '',
        xAxisLabelRotation: 'horizontal',
        yAxisLabelRotation: 'horizontal',
      };
    case 'pie':
      return {
        chartStyle: 'donut',
        labelFormat: 'percentage',
        showDataLabels: true,
        dataLabelPosition: 'outside',
        showTooltip: true,
        showLegend: true,
        legendPosition: 'right',
      };
    case 'line':
      return {
        lineStyle: 'smooth',
        showDataPoints: true,
        showTooltip: true,
        showLegend: true,
        showDataLabels: false,
        dataLabelPosition: 'top',
        xAxisTitle: '',
        yAxisTitle: '',
        xAxisLabelRotation: 'horizontal',
        yAxisLabelRotation: 'horizontal',
      };
    case 'number':
      return {
        numberSize: 'medium',
        subtitle: '',
        numberFormat: 'default',
        decimalPlaces: 0,
        numberPrefix: '',
        numberSuffix: '',
      };
    case 'map':
      return {
        colorScheme: 'Blues',
        showTooltip: true,
        showLegend: true,
        nullValueLabel: 'No Data',
        title: '',
      };
    case 'table':
      return {
        // No complex customizations for tables - keep it simple
      };
    default:
      return {};
  }
}

interface ChartBuilderProps {
  onSave: (chart: ChartCreate) => void;
  onCancel: () => void;
  isSaving?: boolean;
  initialData?: ChartBuilderFormData;
}

export function ChartBuilder({
  onSave,
  onCancel,
  isSaving = false,
  initialData,
}: ChartBuilderProps) {
  const [formData, setFormData] = useState<ChartBuilderFormData>({
    chart_type: 'bar',
    computation_type: 'aggregated', // Default to aggregated
    customizations: getDefaultCustomizations('bar'),
    ...initialData,
  });

  const [activeTab, setActiveTab] = useState('chart');
  const [dataPreviewPage, setDataPreviewPage] = useState(1);
  const [rawDataPage, setRawDataPage] = useState(1);

  // Drill-down state for maps
  const [drillDownState, setDrillDownState] = useState<{
    selectedState?: string;
    stateId?: number;
  } | null>(null);

  // Build payload for chart data
  const chartDataPayload: ChartDataPayload | null =
    formData.schema_name && formData.table_name
      ? {
          chart_type: formData.chart_type === 'table' ? 'bar' : formData.chart_type!,
          computation_type: formData.computation_type || 'aggregated',
          schema_name: formData.schema_name,
          table_name: formData.table_name,
          x_axis: formData.x_axis_column,
          y_axis: formData.y_axis_column,
          dimension_col: formData.dimension_column,
          aggregate_col: formData.aggregate_column,
          aggregate_func: formData.aggregate_function,
          extra_dimension: formData.extra_dimension_column,
          // Multiple metrics for bar/line charts
          metrics: formData.metrics,
          // Map-specific fields - also populate dimension_col for map charts
          geographic_column: formData.geographic_column,
          value_column: formData.value_column,
          selected_geojson_id:
            formData.selected_geojson_id ||
            (formData.chart_type === 'map' && formData.layers?.[0]?.geojson_id
              ? formData.layers[0].geojson_id
              : undefined),
          // For map charts, also set dimension_col to geographic_column for compatibility
          ...(formData.chart_type === 'map' && {
            dimension_col: formData.geographic_column,
            aggregate_col: formData.aggregate_column || formData.value_column,
          }),
          customizations: formData.customizations,
        }
      : null;

  // Debug logging
  console.log('ChartBuilder Debug:', {
    formData,
    chartDataPayload,
    hasSchemaAndTable: !!(formData.schema_name && formData.table_name),
    metricsLength: formData.metrics?.length || 0,
  });

  // Fetch chart data - use different hooks for maps, tables, vs regular charts
  const {
    data: chartData,
    error: chartError,
    isLoading: chartLoading,
  } = useChartData(
    formData.chart_type !== 'map' && formData.chart_type !== 'table' ? chartDataPayload : null
  );

  // Fetch GeoJSON data separately for map charts
  const {
    data: geojsonData,
    error: geojsonError,
    isLoading: geojsonLoading,
  } = useGeoJSONData(
    formData.chart_type === 'map' && formData.geojsonPreviewPayload?.geojsonId
      ? formData.geojsonPreviewPayload.geojsonId
      : null
  );

  // Fetch map data overlay separately
  const {
    data: mapDataOverlay,
    error: mapDataError,
    isLoading: mapDataLoading,
  } = useMapDataOverlay(
    formData.chart_type === 'map' && formData.dataOverlayPayload
      ? formData.dataOverlayPayload
      : null
  );

  // Fetch data preview (used by both charts and tables)
  const {
    data: dataPreview,
    error: previewError,
    isLoading: previewLoading,
  } = useChartDataPreview(chartDataPayload, dataPreviewPage, 50);

  // Fetch raw table data
  const {
    data: rawTableData,
    error: rawDataError,
    isLoading: rawDataLoading,
  } = useRawTableData(formData.schema_name || null, formData.table_name || null, rawDataPage, 50);

  // Get table count for raw data pagination
  const { data: tableCount } = useTableCount(
    formData.schema_name || null,
    formData.table_name || null
  );

  // Get states for drill-down functionality
  const countryCode = formData.country_code || 'IND';
  const { data: states } = useRegions(countryCode, 'state');

  // Get child regions (districts) for the selected state when drilling down
  const { data: childDistricts } = useChildRegions(
    drillDownState?.stateId || null,
    !!drillDownState?.stateId
  );

  // Get district-level GeoJSON - use the first district's parent region for district boundaries
  // District boundaries are usually stored at the district level, not state level
  const districtRegionId =
    childDistricts && childDistricts.length > 0
      ? childDistricts[0].parent_id // Use parent ID for district-level boundaries
      : drillDownState?.stateId || null; // Fallback to state ID

  const { data: districtGeojsonData } = useRegionGeoJSONs(districtRegionId);

  // Get drill-down column - support both dynamic and legacy systems
  const drillDownColumn =
    formData.geographic_hierarchy?.drill_down_levels[0]?.column || formData.district_column;

  const districtDataPayload =
    drillDownState && drillDownColumn
      ? {
          schema_name: formData.schema_name!,
          table_name: formData.table_name!,
          geographic_column: drillDownColumn,
          value_column: formData.aggregate_column || formData.value_column!,
          aggregate_function: formData.aggregate_function!,
          selected_geojson_id: districtGeojsonData?.[0]?.id || 0,
          // Use filters parameter for proper geographic filtering
          filters: {
            [formData.geographic_column!]: drillDownState.selectedState,
          },
          chart_filters: formData.filters || [], // Keep existing chart filters separate
        }
      : null;

  const { data: districtMapData } = useMapDataOverlay(districtDataPayload);

  // Fetch warehouse data for map configuration
  const { data: tables } = useTables(formData.schema_name);
  const { data: columns } = useColumns(formData.schema_name, formData.table_name);

  const handleFormChange = useCallback((updates: Partial<ChartBuilderFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const debouncedFormChange = useCallback(debounce(handleFormChange, 500), [handleFormChange]);

  // Auto-prefill when dataset is selected
  useEffect(() => {
    if (columns && formData.schema_name && formData.table_name && formData.chart_type) {
      // Check if we should auto-prefill (no existing configuration)
      const hasExistingConfig = !!(
        formData.dimension_column ||
        formData.aggregate_column ||
        formData.geographic_column ||
        formData.x_axis_column ||
        formData.y_axis_column ||
        formData.table_columns?.length
      );

      if (!hasExistingConfig) {
        const autoConfig = generateAutoPrefilledConfig(formData.chart_type, columns);
        if (Object.keys(autoConfig).length > 0) {
          handleFormChange(autoConfig);
        }
      }
    }
  }, [columns, formData.schema_name, formData.table_name, formData.chart_type, handleFormChange]);

  // Handle state click for drill-down
  const handleRegionClick = useCallback(
    (regionName: string, regionData: any) => {
      // Check if drill-down is available - support both dynamic and legacy systems
      const hasDynamicDrillDown = formData.geographic_hierarchy?.drill_down_levels.length > 0;
      const hasLegacyDrillDown = formData.district_column;

      if (!hasDynamicDrillDown && !hasLegacyDrillDown) {
        return;
      }

      // Determine drill-down column based on system type
      const drillDownColumn = hasDynamicDrillDown
        ? formData.geographic_hierarchy.drill_down_levels[0]?.column
        : formData.district_column;

      if (!drillDownColumn) {
        return;
      }

      // Find the region that was clicked
      const clickedRegion = states?.find(
        (state: any) => state.name === regionName || state.display_name === regionName
      );

      if (clickedRegion) {
        setDrillDownState({
          selectedState: regionName,
          stateId: clickedRegion.id,
        });
      }
    },
    [formData.geographic_hierarchy, formData.district_column, states]
  );

  // Handle drill-up (going back to country level)
  const handleDrillUp = useCallback(() => {
    setDrillDownState(null);
  }, []);

  const isFormValid = () => {
    if (!formData.title || !formData.chart_type || !formData.schema_name || !formData.table_name) {
      return false;
    }

    // Special validation for number charts
    if (formData.chart_type === 'number') {
      // For count function, aggregate_column is not required
      const needsAggregateColumn = formData.aggregate_function !== 'count';
      return !!(
        formData.aggregate_function &&
        (!needsAggregateColumn || formData.aggregate_column)
      );
    }

    // Special validation for map charts
    if (formData.chart_type === 'map') {
      return !!(
        formData.geographic_column &&
        formData.value_column &&
        formData.aggregate_function &&
        formData.selected_geojson_id
      );
    }

    // Special validation for table charts
    if (formData.chart_type === 'table') {
      return !!(formData.schema_name && formData.table_name && formData.title);
    }

    if (formData.computation_type === 'raw') {
      return !!(formData.x_axis_column && formData.y_axis_column);
    } else {
      // For bar/line/pie charts with multiple metrics
      if (
        ['bar', 'line', 'pie'].includes(formData.chart_type || '') &&
        formData.metrics &&
        formData.metrics.length > 0
      ) {
        return !!(
          formData.dimension_column &&
          formData.metrics.every(
            (metric) =>
              metric.aggregation && (metric.aggregation.toLowerCase() === 'count' || metric.column)
          )
        );
      }

      // For aggregated charts, allow count function without aggregate column
      const needsAggregateColumn = formData.aggregate_function !== 'count';
      return !!(
        formData.dimension_column &&
        formData.aggregate_function &&
        (!needsAggregateColumn || formData.aggregate_column)
      );
    }
  };

  // Helper to convert simplified drill-down selections to layers structure
  const convertSimplifiedToLayers = (formData: ChartBuilderFormData) => {
    const layers = [];
    let layerIndex = 0;

    // Level 0: Always include the main geographic column (states/counties/provinces)
    if (formData.geographic_column) {
      layers.push({
        id: layerIndex.toString(),
        level: layerIndex,
        geographic_column: formData.geographic_column,
        geojson_id: formData.selected_geojson_id,
        selected_regions: [] as any[], // Allow all regions by default
      });
      layerIndex++;
    }

    // Level 1+: Add additional levels based on simplified fields
    const additionalLevels = [
      { field: 'district_column', name: 'District Level' },
      { field: 'ward_column', name: 'Ward Level' },
      { field: 'subward_column', name: 'Sub-Ward Level' },
      // Future: can add more levels here easily
    ];

    additionalLevels.forEach((level) => {
      if ((formData as any)[level.field] && (formData as any)[level.field].trim() !== '') {
        layers.push({
          id: layerIndex.toString(),
          level: layerIndex,
          geographic_column: (formData as any)[level.field],
          selected_regions: [] as any[], // Allow all regions for drill-down
          parent_selections: [], // Will be populated during drill-down
        });
        layerIndex++;
      }
    });

    return layers.length > 0 ? layers : undefined;
  };

  // Convert new geographic hierarchy to legacy layers format
  const convertHierarchyToLayers = (hierarchy: GeographicHierarchy, baseGeojsonId?: number) => {
    const layers = [];

    // Base level (level 0)
    layers.push({
      id: '0',
      level: 0,
      geographic_column: hierarchy.base_level.column,
      geojson_id: baseGeojsonId || null,
      selected_regions: [] as any[],
    });

    // Drill-down levels
    hierarchy.drill_down_levels.forEach((level) => {
      layers.push({
        id: level.level.toString(),
        level: level.level,
        geographic_column: level.column,
        selected_regions: [],
        parent_selections: [],
      });
    });

    return layers.length > 0 ? layers : undefined;
  };

  const handleSave = () => {
    if (!isFormValid()) {
      return;
    }

    // For map charts, process geographic hierarchy and legacy layers
    let selectedGeojsonId = formData.selected_geojson_id;
    let layersToSave = formData.layers;

    if (formData.chart_type === 'map') {
      // New Dynamic System: Use geographic_hierarchy if available
      if (formData.geographic_hierarchy) {
        console.log('🔄 Using dynamic geographic hierarchy');
        console.log('✅ Geographic Hierarchy:', formData.geographic_hierarchy);

        // Convert hierarchy to layers for backward compatibility
        layersToSave = convertHierarchyToLayers(formData.geographic_hierarchy, selectedGeojsonId);
      }
      // Legacy System: Check for simplified drill-down fields
      else {
        const hasSimplifiedFields =
          formData.geographic_column &&
          (formData.district_column || formData.ward_column || formData.subward_column);

        if (hasSimplifiedFields) {
          console.log('🔄 Converting legacy simplified drill-down to layers structure');
          layersToSave = convertSimplifiedToLayers(formData);
          console.log('✅ Generated layers:', layersToSave);
        }
      }

      // Backward compatibility: set selectedGeojsonId from first layer
      if (layersToSave && layersToSave.length > 0) {
        const firstLayer = layersToSave[0];
        if (firstLayer.geojson_id) {
          selectedGeojsonId = firstLayer.geojson_id;
        }
      }
    }

    // Construct the payload with extra_config structure
    const chartData: ChartCreate = {
      title: formData.title!,
      description: formData.description,
      chart_type: formData.chart_type!,
      computation_type: formData.computation_type!,
      schema_name: formData.schema_name!,
      table_name: formData.table_name!,
      extra_config: {
        x_axis_column: formData.x_axis_column,
        y_axis_column: formData.y_axis_column,
        dimension_column: formData.dimension_column,
        aggregate_column: formData.aggregate_column,
        aggregate_function: formData.aggregate_function,
        extra_dimension_column: formData.extra_dimension_column,
        // Multiple metrics for bar/line charts
        metrics: formData.metrics,
        // Map-specific fields - maintain backward compatibility
        geographic_column: formData.geographic_column,
        value_column: formData.value_column,
        selected_geojson_id: selectedGeojsonId,
        // Store the layers configuration for multi-layer maps
        layers: layersToSave,
        // New dynamic geographic hierarchy
        geographic_hierarchy: formData.geographic_hierarchy,
        // Legacy simplified map configuration (backward compatibility)
        district_column: formData.district_column,
        ward_column: formData.ward_column,
        subward_column: formData.subward_column,
        drill_down_enabled:
          formData.drill_down_enabled ||
          (formData.geographic_hierarchy?.drill_down_levels.length || 0) > 0,
        // Table-specific fields
        table_columns: formData.table_columns,
        customizations: formData.customizations,
        // Chart-level filters, pagination, and sorting
        filters: formData.filters,
        pagination: formData.pagination,
        sort: formData.sort,
      },
    };

    onSave(chartData);
  };

  const getStepStatus = (step: number) => {
    switch (step) {
      case 1:
        return formData.chart_type ? 'complete' : 'current';
      case 2:
        // For data configuration step
        if (!formData.chart_type) {
          return 'pending';
        }

        // Special handling for map charts
        if (formData.chart_type === 'map') {
          const hasMapConfig =
            formData.schema_name &&
            formData.table_name &&
            formData.title &&
            formData.geographic_column &&
            formData.value_column &&
            formData.aggregate_function &&
            formData.selected_geojson_id;

          return hasMapConfig ? 'complete' : 'current';
        }

        // Special handling for table charts
        if (formData.chart_type === 'table') {
          const hasTableConfig = formData.schema_name && formData.table_name && formData.title;

          return hasTableConfig ? 'complete' : 'current';
        }

        const hasBasicConfig = formData.schema_name && formData.table_name && formData.title;

        if (formData.chart_type === 'number') {
          return hasBasicConfig && formData.aggregate_column && formData.aggregate_function
            ? 'complete'
            : formData.chart_type
              ? 'current'
              : 'pending';
        }

        if (formData.computation_type === 'raw') {
          return hasBasicConfig && formData.x_axis_column && formData.y_axis_column
            ? 'complete'
            : formData.chart_type
              ? 'current'
              : 'pending';
        } else {
          // For bar/line/pie charts with multiple metrics
          if (
            ['bar', 'line', 'pie'].includes(formData.chart_type || '') &&
            formData.metrics &&
            formData.metrics.length > 0
          ) {
            const hasValidMetrics = formData.metrics.every(
              (metric) =>
                metric.aggregation &&
                (metric.aggregation.toLowerCase() === 'count' || metric.column)
            );
            const hasRequiredFields =
              hasBasicConfig && formData.dimension_column && hasValidMetrics;
            return hasRequiredFields ? 'complete' : formData.chart_type ? 'current' : 'pending';
          }

          // For aggregated data, allow count function without aggregate column
          const needsAggregateColumn = formData.aggregate_function !== 'count';
          const hasRequiredFields =
            hasBasicConfig &&
            formData.dimension_column &&
            formData.aggregate_function &&
            (!needsAggregateColumn || formData.aggregate_column);

          return hasRequiredFields ? 'complete' : formData.chart_type ? 'current' : 'pending';
        }
      default:
        return 'pending';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-12rem)]">
      {/* Left Panel - Configuration */}
      <Card className="p-8 overflow-y-auto">
        <div className="space-y-8">
          {/* Step 1: Chart Type */}
          <div
            className={`transition-opacity ${getStepStatus(1) === 'pending' ? 'opacity-50' : ''}`}
          >
            <h3 className="text-lg font-semibold mb-6">1. Select Chart Type</h3>
            <ChartTypeSelector
              value={formData.chart_type}
              onChange={(chart_type) => {
                const newChartType = chart_type as ChartBuilderFormData['chart_type'];

                // Base updates - always set chart type
                const updates: Partial<ChartBuilderFormData> = {
                  chart_type: newChartType,
                };

                // Set computation_type based on chart type
                if (newChartType === 'number') {
                  updates.computation_type = 'aggregated';
                } else if (newChartType === 'map') {
                  // Maps always use aggregation
                  updates.computation_type = 'aggregated';
                  // Don't set default aggregate function - let user select
                } else if (newChartType === 'table') {
                  // Tables use raw data by default
                  updates.computation_type = 'raw';
                } else {
                  // For bar/line/pie, preserve existing computation_type
                  // If no existing value, default to aggregated
                  updates.computation_type = formData.computation_type || 'aggregated';
                }

                // Merge customizations intelligently
                const existingCustomizations = formData.customizations || {};
                const newDefaults = getDefaultCustomizations(newChartType);

                // Preserve common settings and user-entered text
                const preservedFields: Record<string, any> = {};

                // Common UI settings across chart types
                ['showTooltip', 'showLegend', 'showDataLabels'].forEach((field) => {
                  if (field in existingCustomizations && field in newDefaults) {
                    preservedFields[field] = existingCustomizations[field];
                  }
                });

                // Preserve user-entered text fields
                ['xAxisTitle', 'yAxisTitle', 'subtitle'].forEach((field) => {
                  if (existingCustomizations[field]?.trim()) {
                    preservedFields[field] = existingCustomizations[field];
                  }
                });

                // Preserve data label positions if compatible
                if (existingCustomizations.dataLabelPosition && newDefaults.dataLabelPosition) {
                  preservedFields.dataLabelPosition = existingCustomizations.dataLabelPosition;
                }

                updates.customizations = {
                  ...newDefaults,
                  ...preservedFields,
                };

                handleFormChange(updates);
              }}
            />
          </div>

          {/* Step 2: Data Configuration */}
          <div
            className={`transition-opacity ${getStepStatus(2) === 'pending' ? 'opacity-50' : ''}`}
          >
            <h3 className="text-lg font-semibold mb-6">2. Configure Chart</h3>
            {formData.chart_type === 'map' ? (
              <div className="space-y-6">
                <MapDataConfigurationV3 formData={formData} onFormDataChange={handleFormChange} />

                {/* Dynamic Level Configuration - New Feature */}
                {formData.schema_name && formData.table_name && formData.geographic_column && (
                  <DynamicLevelConfig formData={formData} onChange={handleFormChange} />
                )}
              </div>
            ) : formData.chart_type === 'table' ? (
              <div className="space-y-6">
                {/* Basic configuration using the same as other chart types */}
                <ChartDataConfigurationV3
                  formData={formData}
                  onChange={handleFormChange}
                  disabled={!formData.chart_type}
                />

                {/* Table-specific column configuration */}
                {formData.schema_name && formData.table_name && (
                  <SimpleTableConfiguration
                    availableColumns={columns?.map((col) => col.name) || []}
                    selectedColumns={formData.table_columns || []}
                    onColumnsChange={(table_columns) => handleFormChange({ table_columns })}
                  />
                )}
              </div>
            ) : (
              <ChartDataConfigurationV3
                formData={formData}
                onChange={handleFormChange}
                disabled={!formData.chart_type}
              />
            )}
          </div>

          {/* Step 3: Advanced Configuration - Show when chart type and data source are selected */}
          {formData.chart_type && formData.schema_name && formData.table_name && (
            <div className="space-y-6 pt-8 border-t">
              <h3 className="text-lg font-semibold">3. Advanced Options</h3>
              <p className="text-sm text-gray-600">
                Configure additional chart behavior and data processing options.
              </p>

              {/* Filters Configuration */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Data Filters</h4>
                <p className="text-xs text-gray-500">
                  Add conditions to limit which data appears in your chart
                </p>
                <ChartFiltersConfiguration
                  formData={formData}
                  columns={columns}
                  onChange={handleFormChange}
                  disabled={!formData.chart_type || !columns}
                />
              </div>

              {/* Pagination Configuration */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Pagination</h4>
                <p className="text-xs text-gray-500">
                  Control how many data points are shown at once
                </p>
                <ChartPaginationConfiguration
                  formData={formData}
                  onChange={handleFormChange}
                  disabled={!formData.chart_type}
                />
              </div>

              {/* Sort Configuration */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Data Sorting</h4>
                <p className="text-xs text-gray-500">
                  Set the order in which data appears in your chart
                </p>
                <ChartSortConfiguration
                  formData={formData}
                  columns={columns}
                  onChange={handleFormChange}
                  disabled={!formData.chart_type || !columns}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-4 pt-6 mt-8 border-t">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isFormValid() || isSaving}>
              {isSaving ? 'Saving...' : 'Save Chart'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Right Panel - Preview */}
      <Card className="p-8 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chart">Chart Preview</TabsTrigger>
            <TabsTrigger value="data">Data Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="chart" className="h-[calc(100%-3rem)]">
            {formData.chart_type === 'map' ? (
              <MapPreview
                geojsonData={
                  drillDownState
                    ? districtGeojsonData?.[0]?.geojson_data
                    : geojsonData?.geojson_data
                }
                geojsonLoading={geojsonLoading}
                geojsonError={geojsonError}
                mapData={drillDownState ? districtMapData?.data : mapDataOverlay?.data}
                mapDataLoading={mapDataLoading}
                mapDataError={mapDataError}
                title={formData.title}
                valueColumn={formData.aggregate_column}
                onRegionClick={handleRegionClick}
                drillDownPath={
                  drillDownState
                    ? [
                        {
                          level: 1,
                          name: drillDownState.selectedState,
                          geographic_column: '',
                          parent_selections: [],
                        },
                      ]
                    : undefined
                }
                onDrillUp={handleDrillUp}
                onDrillHome={() => setDrillDownState(null)}
                showBreadcrumbs={!!drillDownState}
              />
            ) : formData.chart_type === 'table' ? (
              <DataPreview
                data={Array.isArray(dataPreview?.data) ? dataPreview.data : []}
                columns={formData.table_columns || dataPreview?.columns || []}
                columnTypes={dataPreview?.column_types || {}}
                isLoading={previewLoading}
                error={previewError}
                pagination={
                  dataPreview
                    ? {
                        page: dataPreview.page,
                        pageSize: dataPreview.page_size,
                        total: dataPreview.total_rows,
                        onPageChange: setDataPreviewPage,
                      }
                    : undefined
                }
              />
            ) : (
              <ChartPreview
                config={chartData?.echarts_config}
                isLoading={chartLoading}
                error={chartError}
              />
            )}
          </TabsContent>

          <TabsContent value="data" className="h-[calc(100%-3rem)]">
            <Tabs defaultValue="chart-data" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="chart-data" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Chart Data
                </TabsTrigger>
                <TabsTrigger value="raw-data" className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Raw Data
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chart-data" className="flex-1 mt-6">
                <DataPreview
                  data={Array.isArray(dataPreview?.data) ? dataPreview.data : []}
                  columns={dataPreview?.columns || []}
                  columnTypes={dataPreview?.column_types || {}}
                  isLoading={previewLoading}
                  error={previewError}
                  pagination={
                    dataPreview
                      ? {
                          page: dataPreview.page,
                          pageSize: dataPreview.page_size,
                          total: dataPreview.total_rows,
                          onPageChange: setDataPreviewPage,
                        }
                      : undefined
                  }
                />
              </TabsContent>

              <TabsContent value="raw-data" className="flex-1 mt-6">
                <DataPreview
                  data={Array.isArray(rawTableData) ? rawTableData : []}
                  columns={
                    columns
                      ? columns.map((col: any) => (typeof col === 'string' ? col : col.column_name))
                      : []
                  }
                  columnTypes={{}}
                  isLoading={rawDataLoading}
                  error={rawDataError}
                  pagination={
                    tableCount && rawTableData?.length > 0
                      ? {
                          page: rawDataPage,
                          pageSize: 50,
                          total: tableCount.total_rows || 0,
                          onPageChange: setRawDataPage,
                        }
                      : undefined
                  }
                />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
