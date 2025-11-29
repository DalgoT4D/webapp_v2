'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { MetricsSelector, DatasetSelector, ChartTypeSelector } from '../left-panel';
import { FiltersSection } from '../chart-data-config';
import { DynamicLevelConfig } from './DynamicLevelConfig';
import { useColumns } from '@/hooks/api/useChart';
import type { ChartBuilderFormData, ChartMetric } from '@/types/charts';
import { generateAutoPrefilledConfig } from '@/lib/chartAutoPrefill';

interface MapDataConfigurationV3Props {
  formData: ChartBuilderFormData;
  onFormDataChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

export function MapDataConfigurationV3({
  formData,
  onFormDataChange,
  disabled,
}: MapDataConfigurationV3Props) {
  const { data: columns } = useColumns(formData.schema_name || null, formData.table_name || null);

  // Normalize columns to consistent format
  const normalizedColumns =
    columns?.map((col) => ({
      column_name: col.column_name || col.name,
      data_type: col.data_type,
      name: col.column_name || col.name,
    })) || [];

  // Handle dataset changes with complete form reset for maps
  const handleDatasetChange = (schema_name: string, table_name: string) => {
    if (formData.schema_name === schema_name && formData.table_name === table_name) {
      return;
    }

    // Preserve only essential chart identity fields
    const preservedFields = {
      title: formData.title,
      chart_type: formData.chart_type,
      customizations: formData.customizations || {},
    };

    // Reset all map-specific fields to ensure compatibility with new dataset
    onFormDataChange({
      ...preservedFields,
      schema_name,
      table_name,
      geographic_column: undefined,
      value_column: undefined,
      aggregate_function: 'sum',
      selected_geojson_id: undefined,
      metrics: [],
      filters: [],
      computation_type: 'aggregated',
      district_column: undefined,
      ward_column: undefined,
      subward_column: undefined,
      drill_down_enabled: false,
      geojsonPreviewPayload: undefined,
      dataOverlayPayload: undefined,
      country_code: 'IND',
    });
  };

  // Auto-prefill map configuration when columns are loaded
  React.useEffect(() => {
    if (columns && formData.schema_name && formData.table_name && formData.chart_type === 'map') {
      const hasExistingConfig = !!(
        formData.geographic_column ||
        formData.value_column ||
        formData.aggregate_column
      );

      if (!hasExistingConfig) {
        const autoConfig = generateAutoPrefilledConfig('map', normalizedColumns);
        if (Object.keys(autoConfig).length > 0) {
          onFormDataChange(autoConfig);
        }
      }
    }
  }, [columns, formData.schema_name, formData.table_name, normalizedColumns, onFormDataChange]);

  return (
    <div className="space-y-4">
      {/* Chart Type Selector */}
      <ChartTypeSelector
        value={formData.chart_type}
        onChange={(chart_type) =>
          onFormDataChange({ chart_type: chart_type as ChartBuilderFormData['chart_type'] })
        }
        disabled={disabled}
      />

      {/* Data Source */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Data Source</Label>
        <DatasetSelector
          schema_name={formData.schema_name}
          table_name={formData.table_name}
          onDatasetChange={handleDatasetChange}
          disabled={disabled}
          className="w-full"
        />
      </div>

      {/* Metrics - use MetricsSelector with single metric */}
      <MetricsSelector
        metrics={formData.metrics || []}
        onChange={(metrics: ChartMetric[]) => {
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

      {/* Filters Section - using shared component */}
      <FiltersSection
        filters={formData.filters || []}
        columns={normalizedColumns}
        schemaName={formData.schema_name}
        tableName={formData.table_name}
        onChange={(filters) => onFormDataChange({ filters })}
        disabled={disabled}
      />

      {/* Map Configuration */}
      {formData.aggregate_function &&
        (formData.aggregate_function === 'count' || formData.aggregate_column) && (
          <div className="space-y-4 pt-4 border-t">
            <div>
              <Label className="text-sm font-medium text-gray-900">Map Configuration</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Configure geographic levels and drill-down functionality
              </p>
            </div>

            <DynamicLevelConfig
              formData={formData}
              onChange={onFormDataChange}
              disabled={disabled}
            />
          </div>
        )}
    </div>
  );
}
