import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ChartBuilderFormData, Chart } from '@/types/charts';
import { deepEqual } from '@/lib/form-utils';

/**
 * Convert layers structure to simplified fields for UI.
 * Used when loading a chart for editing.
 */
function convertLayersToSimplified(layers: any[]): Record<string, any> {
  if (!layers || layers.length === 0) {
    return {};
  }

  const simplified: Record<string, any> = {};

  // Level 0: Geographic column (states/counties/provinces)
  if (layers[0]?.geographic_column) {
    simplified.geographic_column = layers[0].geographic_column;
    simplified.selected_geojson_id = layers[0].geojson_id;
  }

  // Level 1+: Additional drill-down levels
  const levelMappings = [
    { level: 1, field: 'district_column' },
    { level: 2, field: 'ward_column' },
    { level: 3, field: 'subward_column' },
  ];

  levelMappings.forEach((mapping) => {
    const layer = layers.find((l) => l.level === mapping.level);
    if (layer?.geographic_column) {
      simplified[mapping.field] = layer.geographic_column;
    }
  });

  // Set drill_down_enabled if we have any additional levels
  simplified.drill_down_enabled = layers.length > 1;

  return simplified;
}

/**
 * Convert chart API response to ChartBuilderFormData.
 * Handles all chart types including maps with layers.
 */
export function chartToFormData(chart: Chart): ChartBuilderFormData {
  // Convert layers to simplified fields if they exist
  const simplifiedFromLayers = chart.extra_config?.layers
    ? convertLayersToSimplified(chart.extra_config.layers)
    : {};

  return {
    title: chart.title,
    chart_type: chart.chart_type as ChartBuilderFormData['chart_type'],
    computation_type: chart.computation_type as 'raw' | 'aggregated',
    schema_name: chart.schema_name,
    table_name: chart.table_name,
    x_axis_column: chart.extra_config?.x_axis_column,
    y_axis_column: chart.extra_config?.y_axis_column,
    dimension_column: chart.extra_config?.dimension_column,
    aggregate_column: chart.extra_config?.aggregate_column,
    aggregate_function: chart.extra_config?.aggregate_function,
    extra_dimension_column: chart.extra_config?.extra_dimension_column,
    metrics: chart.extra_config?.metrics,
    time_grain: chart.extra_config?.time_grain,
    // Use converted simplified fields, fallback to direct extra_config values
    geographic_column:
      simplifiedFromLayers.geographic_column || chart.extra_config?.geographic_column,
    value_column: chart.extra_config?.value_column,
    selected_geojson_id:
      simplifiedFromLayers.selected_geojson_id || chart.extra_config?.selected_geojson_id,
    // Simplified map drill-down fields
    district_column: simplifiedFromLayers.district_column || chart.extra_config?.district_column,
    ward_column: simplifiedFromLayers.ward_column || chart.extra_config?.ward_column,
    subward_column: simplifiedFromLayers.subward_column || chart.extra_config?.subward_column,
    drill_down_enabled:
      simplifiedFromLayers.drill_down_enabled || chart.extra_config?.drill_down_enabled,
    country_code: chart.extra_config?.country_code || 'IND',
    layers:
      chart.extra_config?.layers ||
      (chart.chart_type === 'map'
        ? [
            {
              id: '0',
              level: 0,
              geographic_column: chart.extra_config?.geographic_column,
              geojson_id: chart.extra_config?.selected_geojson_id,
            },
          ]
        : undefined),
    customizations:
      chart.extra_config?.customizations || getDefaultCustomizations(chart.chart_type),
    filters: chart.extra_config?.filters || [],
    pagination: chart.extra_config?.pagination || { enabled: false, page_size: 50 },
    sort: chart.extra_config?.sort || [],
    geographic_hierarchy: chart.extra_config?.geographic_hierarchy,
    table_columns: chart.extra_config?.table_columns || [],
  };
}

// Default customizations for each chart type
function getDefaultCustomizations(chartType: string): Record<string, unknown> {
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
    default:
      return {};
  }
}

// Generate default chart name
function generateDefaultChartName(chartType: string, table: string): string {
  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const typeNames: Record<string, string> = {
    bar: 'Bar chart',
    line: 'Line chart',
    pie: 'Pie chart',
    number: 'Number card',
    map: 'Map chart',
  };

  return `${typeNames[chartType] || 'Chart'} - ${table} ${timestamp}`;
}

export interface UseChartFormParams {
  schema: string;
  table: string;
  chartType: string;
  /** Optional initial form data for edit mode */
  initialFormData?: ChartBuilderFormData;
}

export interface UseChartFormReturn {
  formData: ChartBuilderFormData;
  originalFormData: ChartBuilderFormData | null;
  hasUnsavedChanges: boolean;
  handleFormChange: (updates: Partial<ChartBuilderFormData>) => void;
  setFormData: React.Dispatch<React.SetStateAction<ChartBuilderFormData>>;
  resetToOriginal: () => void;
  markAsSaved: () => void;
}

/**
 * Hook for managing chart form state with unsaved changes detection.
 * Handles form initialization, updates, and change tracking.
 */
export function useChartForm({
  schema,
  table,
  chartType,
  initialFormData,
}: UseChartFormParams): UseChartFormReturn {
  // Initialize form data
  const [formData, setFormData] = useState<ChartBuilderFormData>(() => {
    if (initialFormData) {
      return initialFormData;
    }
    return {
      title: generateDefaultChartName(chartType, table),
      chart_type: chartType as ChartBuilderFormData['chart_type'],
      schema_name: schema,
      table_name: table,
      computation_type: 'aggregated',
      customizations: getDefaultCustomizations(chartType),
      aggregate_function: 'count',
    };
  });

  const [originalFormData, setOriginalFormData] = useState<ChartBuilderFormData | null>(null);

  // Initialize original form data for unsaved changes detection
  useEffect(() => {
    if (!originalFormData) {
      setOriginalFormData({ ...formData });
    }
  }, [formData.schema_name, formData.table_name, formData.chart_type, originalFormData]);

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!originalFormData) return false;
    return !deepEqual(formData, originalFormData);
  }, [formData, originalFormData]);

  // Handle form field changes
  const handleFormChange = useCallback((updates: Partial<ChartBuilderFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Reset form to original state
  const resetToOriginal = useCallback(() => {
    if (originalFormData) {
      setFormData({ ...originalFormData });
    }
  }, [originalFormData]);

  // Mark current state as saved (updates original to match current)
  const markAsSaved = useCallback(() => {
    setOriginalFormData({ ...formData });
  }, [formData]);

  return {
    formData,
    originalFormData,
    hasUnsavedChanges,
    handleFormChange,
    setFormData,
    resetToOriginal,
    markAsSaved,
  };
}

// Export utilities for reuse
export { getDefaultCustomizations, generateDefaultChartName };
