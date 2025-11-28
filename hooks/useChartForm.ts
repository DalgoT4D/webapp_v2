import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ChartBuilderFormData } from '@/types/charts';
import { deepEqual } from '@/lib/form-utils';

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
