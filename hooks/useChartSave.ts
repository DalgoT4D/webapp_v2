import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUpdateChart, useCreateChart } from '@/hooks/api/useChart';
import { toastSuccess, toastError } from '@/lib/toast';
import type { ChartBuilderFormData, ChartCreate, ChartUpdate } from '@/types/charts';

export interface UseChartSaveParams {
  chartId?: number;
  formData: ChartBuilderFormData;
  markAsSaved: () => void;
  navigateWithoutWarning: (url: string) => void;
}

export interface UseChartSaveReturn {
  updateChart: () => Promise<void>;
  saveAsNew: (newTitle: string) => Promise<void>;
  isMutating: boolean;
  isCreating: boolean;
}

/**
 * Helper to convert simplified drill-down selections to layers structure.
 */
function convertSimplifiedToLayers(formData: ChartBuilderFormData) {
  const layers = [];
  let layerIndex = 0;

  // Level 0: Always include the main geographic column (states/counties/provinces)
  if (formData.geographic_column) {
    layers.push({
      id: layerIndex.toString(),
      level: layerIndex,
      geographic_column: formData.geographic_column,
      geojson_id: formData.selected_geojson_id,
      selected_regions: [] as any[],
    });
    layerIndex++;
  }

  // Level 1+: Add additional levels based on simplified fields
  const additionalLevels = [
    { field: 'district_column', name: 'District Level' },
    { field: 'ward_column', name: 'Ward Level' },
    { field: 'subward_column', name: 'Sub-Ward Level' },
  ];

  additionalLevels.forEach((level) => {
    const columnValue = (formData as Record<string, any>)[level.field];
    if (columnValue && columnValue.trim() !== '') {
      layers.push({
        id: layerIndex.toString(),
        level: layerIndex,
        geographic_column: columnValue,
        selected_regions: [],
        parent_selections: [],
      });
      layerIndex++;
    }
  });

  return layers.length > 0 ? layers : undefined;
}

/**
 * Build chart data object from form data for API submission.
 */
export function buildChartCreateData(formData: ChartBuilderFormData): ChartCreate {
  // For map charts, process layers and simplified drill-down
  let selectedGeojsonId = formData.selected_geojson_id;
  let layersToSave = formData.layers;

  if (formData.chart_type === 'map') {
    // Check if we have simplified drill-down fields to convert
    const hasSimplifiedFields =
      formData.geographic_column &&
      (formData.district_column || formData.ward_column || formData.subward_column);

    if (hasSimplifiedFields) {
      layersToSave = convertSimplifiedToLayers(formData);
    }

    // Backward compatibility: set selectedGeojsonId from first layer
    if (layersToSave && layersToSave.length > 0) {
      const firstLayer = layersToSave[0];
      if (firstLayer.geojson_id) {
        selectedGeojsonId = firstLayer.geojson_id;
      }
    }
  }

  return {
    title: formData.title!,
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
      geographic_column: formData.geographic_column,
      value_column: formData.value_column,
      selected_geojson_id: selectedGeojsonId,
      layers: layersToSave,
      district_column: formData.district_column,
      ward_column: formData.ward_column,
      subward_column: formData.subward_column,
      drill_down_enabled: formData.drill_down_enabled,
      geographic_hierarchy: formData.geographic_hierarchy,
      customizations: formData.customizations,
      filters: formData.filters,
      pagination: formData.pagination,
      sort: formData.sort,
      time_grain: formData.time_grain,
      table_columns: formData.table_columns,
      ...(formData.metrics && formData.metrics.length > 0 && { metrics: formData.metrics }),
    },
  };
}

/**
 * Hook for saving/updating charts.
 * Handles both update existing and save as new operations.
 */
export function useChartSave({
  chartId,
  formData,
  markAsSaved,
  navigateWithoutWarning,
}: UseChartSaveParams): UseChartSaveReturn {
  const { trigger: triggerUpdate, isMutating } = useUpdateChart();
  const { trigger: triggerCreate, isMutating: isCreating } = useCreateChart();

  const updateChart = useCallback(async () => {
    if (!chartId) return;

    try {
      const chartData = buildChartCreateData(formData);
      const updateData: ChartUpdate = {
        title: chartData.title,
        chart_type: chartData.chart_type,
        computation_type: chartData.computation_type,
        schema_name: chartData.schema_name,
        table_name: chartData.table_name,
        extra_config: chartData.extra_config,
      };

      await triggerUpdate({
        id: chartId,
        data: updateData,
      });

      markAsSaved();
      toastSuccess.updated('Chart');
      navigateWithoutWarning(`/charts/${chartId}`);
    } catch (err) {
      toastError.update(err, 'chart');
    }
  }, [chartId, formData, triggerUpdate, markAsSaved, navigateWithoutWarning]);

  const saveAsNew = useCallback(
    async (newTitle: string) => {
      try {
        const chartData = buildChartCreateData(formData);
        const newChartData: ChartCreate = {
          ...chartData,
          title: newTitle,
        };

        const result = await triggerCreate(newChartData);

        toastSuccess.created(`Chart "${newTitle}"`);
        navigateWithoutWarning(`/charts/${result.id}`);
      } catch (err) {
        toastError.create(err, 'chart');
      }
    },
    [formData, triggerCreate, navigateWithoutWarning]
  );

  return {
    updateChart,
    saveAsNew,
    isMutating,
    isCreating,
  };
}
