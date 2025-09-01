'use client';

import { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ChevronLeft, Database, BarChart3 } from 'lucide-react';
import { ChartDataConfigurationV3 } from '@/components/charts/ChartDataConfigurationV3';
import { ChartCustomizations } from '@/components/charts/ChartCustomizations';
import { ChartPreview } from '@/components/charts/ChartPreview';
import { DataPreview } from '@/components/charts/DataPreview';
import { MapDataConfigurationV3 } from '@/components/charts/map/MapDataConfigurationV3';
import { MapCustomizations } from '@/components/charts/map/MapCustomizations';
import { MapPreview } from '@/components/charts/map/MapPreview';
import { SaveOptionsDialog } from '@/components/charts/SaveOptionsDialog';
import { UnsavedChangesExitDialog } from '@/components/charts/UnsavedChangesExitDialog';
import {
  useChart,
  useUpdateChart,
  useCreateChart,
  useChartData,
  useChartDataPreview,
  useGeoJSONData,
  useMapDataOverlay,
  useRawTableData,
  useTableCount,
  useColumns,
  useRegions,
  useChildRegions,
  useRegionGeoJSONs,
} from '@/hooks/api/useChart';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { deepEqual } from '@/lib/form-utils';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import type {
  ChartCreate,
  ChartUpdate,
  ChartBuilderFormData,
  ChartDataPayload,
} from '@/types/charts';

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
    default:
      return {};
  }
}

function EditChartPageContent() {
  const params = useParams();
  const router = useRouter();
  const chartId = Number(params.id);

  const { data: chart, error: chartError, isLoading: chartLoading } = useChart(chartId);
  const { trigger: updateChart, isMutating } = useUpdateChart();
  const { trigger: createChart, isMutating: isCreating } = useCreateChart();

  // Initialize form data with chart data when loaded
  const [formData, setFormData] = useState<ChartBuilderFormData>({
    title: '',
    chart_type: 'bar',
    computation_type: 'aggregated',
    customizations: getDefaultCustomizations('bar'),
    aggregate_function: 'sum',
  });

  const [activeTab, setActiveTab] = useState('chart');
  const [rawDataPage, setRawDataPage] = useState(1);
  const [rawDataPageSize, setRawDataPageSize] = useState(50);
  const [originalFormData, setOriginalFormData] = useState<ChartBuilderFormData | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [isExitingAfterSave, setIsExitingAfterSave] = useState(false);
  const [unsavedChangesDialog, setUnsavedChangesDialog] = useState({
    open: false,
    onConfirm: () => {},
    onCancel: () => {},
  });

  // Drill-down state for map preview
  const [drillDownPath, setDrillDownPath] = useState<
    Array<{
      level: number;
      name: string;
      geographic_column: string;
      parent_selections: Array<{
        column: string;
        value: string;
      }>;
      region_id?: number; // Additional field for our use
    }>
  >([]);

  // Helper to convert layers structure back to simplified fields for UI
  const convertLayersToSimplified = (layers: any[]) => {
    if (!layers || layers.length === 0) {
      return {};
    }

    const simplified: any = {};

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

    console.log('🔄 Converting layers to simplified for edit:', {
      layers: layers.length,
      simplified,
    });

    return simplified;
  };

  // Update form data when chart loads
  useEffect(() => {
    if (chart) {
      // Convert layers to simplified fields if they exist
      const simplifiedFromLayers = chart.extra_config?.layers
        ? convertLayersToSimplified(chart.extra_config.layers)
        : {};

      const initialData: ChartBuilderFormData = {
        title: chart.title,
        description: chart.description,
        chart_type: chart.chart_type as 'bar' | 'pie' | 'line' | 'number' | 'map' | 'table',
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
        // Use converted simplified fields, fallback to direct extra_config values
        geographic_column:
          simplifiedFromLayers.geographic_column || chart.extra_config?.geographic_column,
        value_column: chart.extra_config?.value_column,
        selected_geojson_id:
          simplifiedFromLayers.selected_geojson_id || chart.extra_config?.selected_geojson_id,
        // Simplified map drill-down fields
        district_column:
          simplifiedFromLayers.district_column || chart.extra_config?.district_column,
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
        // ✅ FIX: Include geographic_hierarchy so DynamicLevelConfig can auto-fill
        geographic_hierarchy: chart.extra_config?.geographic_hierarchy,
      };
      setFormData(initialData);
      setOriginalFormData(initialData);
    }
  }, [chart]);

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!originalFormData) return false;
    return !deepEqual(formData, originalFormData);
  }, [formData, originalFormData]);

  const navigateWithoutWarning = useCallback(
    (url: string) => {
      setOriginalFormData({ ...formData }); // Mark as saved
      router.push(url);
    },
    [router, formData]
  );

  // Handle browser navigation (refresh, close tab, external links)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return 'You have unsaved changes. Are you sure you want to leave?';
      }
      return undefined;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Check if form data is complete enough to generate chart data
  const isChartDataReady = () => {
    if (!formData.schema_name || !formData.table_name || !formData.chart_type) {
      return false;
    }

    if (formData.chart_type === 'number') {
      return !!(
        formData.aggregate_function &&
        (formData.aggregate_function === 'count' || formData.aggregate_column)
      );
    }

    if (formData.chart_type === 'map') {
      return !!(
        formData.geographic_column &&
        formData.value_column &&
        formData.aggregate_function &&
        formData.selected_geojson_id
      );
    }

    if (formData.chart_type === 'table') {
      return true; // Table charts just need basic schema/table selection
    }

    if (formData.computation_type === 'raw') {
      return !!(formData.x_axis_column && formData.y_axis_column);
    } else {
      // For bar/line/table charts with multiple metrics
      if (
        ['bar', 'line', 'pie', 'table'].includes(formData.chart_type || '') &&
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

      // Legacy single metric approach
      return !!(
        formData.dimension_column &&
        formData.aggregate_function &&
        (formData.aggregate_function === 'count' || formData.aggregate_column)
      );
    }
  };

  // Build payload for chart data
  const chartDataPayload: ChartDataPayload | null = isChartDataReady()
    ? {
        chart_type: formData.chart_type!,
        computation_type: formData.computation_type!,
        schema_name: formData.schema_name!,
        table_name: formData.table_name!,
        ...(formData.x_axis_column && { x_axis: formData.x_axis_column }),
        ...(formData.y_axis_column && { y_axis: formData.y_axis_column }),
        ...(formData.dimension_column && { dimension_col: formData.dimension_column }),
        ...(formData.aggregate_column && { aggregate_col: formData.aggregate_column }),
        ...(formData.aggregate_function && { aggregate_func: formData.aggregate_function }),
        ...(formData.extra_dimension_column && {
          extra_dimension: formData.extra_dimension_column,
        }),
        ...(formData.geographic_column && { geographic_column: formData.geographic_column }),
        ...(formData.value_column && { value_column: formData.value_column }),
        ...(formData.selected_geojson_id && { selected_geojson_id: formData.selected_geojson_id }),
        ...(formData.chart_type === 'map' &&
          formData.layers?.[0]?.geojson_id && {
            selected_geojson_id: formData.layers[0].geojson_id,
          }),
        ...(formData.chart_type === 'map' && {
          ...(formData.geographic_column && { dimension_col: formData.geographic_column }),
          ...((formData.aggregate_column || formData.value_column) && {
            aggregate_col: formData.aggregate_column || formData.value_column,
          }),
        }),
        customizations: formData.customizations,
        // Include metrics for multiple metrics support
        ...(formData.metrics && formData.metrics.length > 0 && { metrics: formData.metrics }),
        extra_config: {
          filters: formData.filters,
          pagination: formData.pagination,
          sort: formData.sort,
        },
      }
    : null;

  // Fetch chart data
  const {
    data: chartData,
    error: chartDataError,
    isLoading: chartDataLoading,
  } = useChartData(
    formData.chart_type !== 'map' && formData.chart_type !== 'table' ? chartDataPayload : null
  );

  // Drill-down functionality for maps - fetch regions
  const countryCode = 'IND'; // TODO: make this dynamic based on selected geojson
  const { data: states } = useRegions(countryCode, 'state');
  const { data: districts } = useChildRegions(
    drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1].region_id : null,
    drillDownPath.length > 0
  );
  const { data: regionGeojsons } = useRegionGeoJSONs(
    drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1].region_id : null
  );

  // Dynamic GeoJSON ID based on drill-down state
  const activeGeojsonId = useMemo(() => {
    if (formData.chart_type !== 'map') return null;

    // If we're in drill-down mode and have region geojsons, use the first one
    if (drillDownPath.length > 0 && regionGeojsons && regionGeojsons.length > 0) {
      return regionGeojsons[0].id;
    }

    // Otherwise use the base geojson
    return formData.geojsonPreviewPayload?.geojsonId || null;
  }, [
    formData.chart_type,
    formData.geojsonPreviewPayload?.geojsonId,
    drillDownPath.length,
    regionGeojsons,
  ]);

  // Dynamic map data overlay payload with drill-down filters
  // Build map data overlay payload similar to view component (stable approach)
  const activeDataOverlayPayload = useMemo(() => {
    if (formData.chart_type !== 'map' || !formData.schema_name || !formData.table_name) return null;

    // Build filters from drill-down path
    const filters: Record<string, string> = {};
    if (drillDownPath.length > 0) {
      drillDownPath.forEach((level) => {
        level.parent_selections.forEach((selection) => {
          filters[selection.column] = selection.value;
        });
      });
    }

    // Determine active geographic column (drill-down or base)
    let activeGeographicColumn = formData.geographic_column;
    if (drillDownPath.length > 0) {
      const hasDynamicDrillDown = formData.geographic_hierarchy?.drill_down_levels?.length > 0;
      const drillDownColumn = hasDynamicDrillDown
        ? formData.geographic_hierarchy.drill_down_levels[0]?.column
        : formData.district_column;

      if (drillDownColumn) {
        activeGeographicColumn = drillDownColumn;
      }
    }

    return activeGeographicColumn
      ? {
          schema_name: formData.schema_name,
          table_name: formData.table_name,
          geographic_column: activeGeographicColumn,
          value_column: formData.aggregate_column,
          aggregate_function: formData.aggregate_function || 'sum',
          filters: filters,
          chart_filters: [] as any[],
          chart_id: chartId ? parseInt(String(chartId)) : undefined,
        }
      : null;
  }, [
    formData.chart_type,
    formData.schema_name,
    formData.table_name,
    formData.geographic_column,
    formData.aggregate_column,
    formData.aggregate_function,
    formData.geographic_hierarchy,
    formData.district_column,
    drillDownPath,
    chartId,
  ]);

  // Fetch GeoJSON data for maps (dynamic based on drill-down state)
  const {
    data: geojsonData,
    error: geojsonError,
    isLoading: geojsonLoading,
  } = useGeoJSONData(activeGeojsonId);

  // Fetch map data overlay (dynamic based on drill-down state)
  const {
    data: mapDataOverlay,
    error: mapDataError,
    isLoading: mapDataLoading,
  } = useMapDataOverlay(activeDataOverlayPayload);

  // Fetch data preview
  const {
    data: dataPreview,
    error: previewError,
    isLoading: previewLoading,
  } = useChartDataPreview(chartDataPayload, 1, 50);

  // Fetch raw table data
  const {
    data: rawTableData,
    error: rawDataError,
    isLoading: rawDataLoading,
  } = useRawTableData(
    formData.schema_name || null,
    formData.table_name || null,
    rawDataPage,
    rawDataPageSize
  );

  // Get table count for raw data pagination
  const { data: tableCount } = useTableCount(
    formData.schema_name || null,
    formData.table_name || null
  );

  // Handle drill-down region click
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
        const newDrillDownLevel = {
          level: 1,
          name: regionName,
          geographic_column: drillDownColumn,
          parent_selections: [
            {
              column: formData.geographic_column || '',
              value: regionName,
            },
          ],
          region_id: clickedRegion.id,
        };

        setDrillDownPath([newDrillDownLevel]);
      }
    },
    [
      formData.geographic_hierarchy,
      formData.district_column,
      formData.geographic_column,
      states,
      drillDownPath,
    ]
  );

  // Handle drill-up to a specific level (consistent with view mode)
  const handleDrillUp = useCallback((targetLevel: number) => {
    if (targetLevel < 0) {
      setDrillDownPath([]);
    } else {
      setDrillDownPath((prev) => prev.slice(0, targetLevel + 1));
    }
  }, []);

  // Handle drill to home (going back to country level)
  const handleDrillHome = useCallback(() => {
    setDrillDownPath([]);
  }, []);

  // Get all columns for raw data
  const { data: columns } = useColumns(formData.schema_name || null, formData.table_name || null);

  const handleFormChange = (updates: Partial<ChartBuilderFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleRawDataPageSizeChange = (newPageSize: number) => {
    setRawDataPageSize(newPageSize);
    setRawDataPage(1); // Reset to first page when page size changes
  };

  const isFormValid = () => {
    if (!formData.title || !formData.chart_type || !formData.schema_name || !formData.table_name) {
      return false;
    }

    if (formData.chart_type === 'number') {
      const needsAggregateColumn = formData.aggregate_function !== 'count';
      return !!(
        formData.aggregate_function &&
        (!needsAggregateColumn || formData.aggregate_column)
      );
    }

    if (formData.chart_type === 'map') {
      return !!(
        formData.geographic_column &&
        formData.value_column &&
        formData.aggregate_function &&
        formData.selected_geojson_id
      );
    }

    if (formData.chart_type === 'table') {
      return true; // Table charts only need basic fields (title, chart_type, schema, table)
    }

    if (formData.computation_type === 'raw') {
      return !!(formData.x_axis_column && formData.y_axis_column);
    } else {
      // For bar/line/table charts with multiple metrics
      if (
        ['bar', 'line', 'pie', 'table'].includes(formData.chart_type || '') &&
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

      // Legacy single metric approach
      const needsAggregateColumn = formData.aggregate_function !== 'count';
      return !!(
        formData.dimension_column &&
        formData.aggregate_function &&
        (!needsAggregateColumn || formData.aggregate_column)
      );
    }
  };

  // Helper to convert simplified drill-down selections to layers structure (same as ChartBuilder)
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
          selected_regions: [], // Allow all regions for drill-down
          parent_selections: [], // Will be populated during drill-down
        });
        layerIndex++;
      }
    });

    return layers.length > 0 ? layers : undefined;
  };

  // Helper to build chart data from form
  const buildChartData = (): ChartCreate => {
    // For map charts, process layers and simplified drill-down
    let selectedGeojsonId = formData.selected_geojson_id;
    let layersToSave = formData.layers;

    if (formData.chart_type === 'map') {
      // Check if we have simplified drill-down fields to convert
      const hasSimplifiedFields =
        formData.geographic_column &&
        (formData.district_column || formData.ward_column || formData.subward_column);

      if (hasSimplifiedFields) {
        console.log('🔄 Converting simplified drill-down to layers structure in edit mode');
        layersToSave = convertSimplifiedToLayers(formData);
        console.log('✅ Generated layers for save:', layersToSave);
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
        geographic_column: formData.geographic_column,
        value_column: formData.value_column,
        selected_geojson_id: selectedGeojsonId,
        layers: layersToSave,
        // Simplified drill-down fields
        district_column: formData.district_column,
        ward_column: formData.ward_column,
        subward_column: formData.subward_column,
        drill_down_enabled: formData.drill_down_enabled,
        customizations: formData.customizations,
        filters: formData.filters,
        pagination: formData.pagination,
        sort: formData.sort,
        // Include metrics for multiple metrics support
        ...(formData.metrics && formData.metrics.length > 0 && { metrics: formData.metrics }),
      },
    };
  };

  // Handle updating existing chart
  const handleUpdateExisting = async () => {
    if (!isFormValid()) {
      return;
    }

    try {
      const chartData = buildChartData();
      const updateData: ChartUpdate = {
        title: chartData.title,
        description: chartData.description,
        chart_type: chartData.chart_type,
        computation_type: chartData.computation_type,
        schema_name: chartData.schema_name,
        table_name: chartData.table_name,
        extra_config: chartData.extra_config,
      };

      await updateChart({
        id: chartId,
        data: updateData,
      });

      // Update original data to reflect saved state
      setOriginalFormData({ ...formData });

      toast.success('Chart updated successfully');

      // Navigate based on context - if exiting after save, go to charts list
      if (isExitingAfterSave) {
        setIsExitingAfterSave(false);
        navigateWithoutWarning('/charts');
      } else {
        navigateWithoutWarning(`/charts/${chartId}`);
      }
    } catch {
      toast.error('Failed to update chart');
    }
  };

  // Handle saving as new chart
  const handleSaveAsNew = async (newTitle: string) => {
    if (!isFormValid()) {
      return;
    }

    try {
      const chartData = buildChartData();
      const newChartData: ChartCreate = {
        ...chartData,
        title: newTitle,
      };

      const result = await createChart(newChartData);

      toast.success(`New chart "${newTitle}" created successfully!`);

      // Navigate based on context - if exiting after save, go to charts list
      if (isExitingAfterSave) {
        setIsExitingAfterSave(false);
        navigateWithoutWarning('/charts');
      } else {
        navigateWithoutWarning(`/charts/${result.id}`);
      }
    } catch {
      toast.error('Failed to create new chart');
    }
  };

  // Show save options dialog
  const handleSave = () => {
    if (!isFormValid()) {
      return;
    }
    // Make sure we're not in exit mode when using regular save
    setIsExitingAfterSave(false);
    setShowSaveDialog(true);
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setShowExitDialog(true);
    } else {
      router.push(`/charts/${chartId}`);
    }
  };

  // Handle exit dialog actions
  const handleSaveAndLeave = () => {
    if (!isFormValid()) {
      return;
    }
    // Mark that we're exiting after save
    setIsExitingAfterSave(true);
    // Close exit dialog and show save options dialog
    setShowExitDialog(false);
    setShowSaveDialog(true);
  };

  const handleLeaveWithoutSaving = () => {
    setShowExitDialog(false);
    router.push(`/charts/${chartId}`);
  };

  const handleStayOnPage = () => {
    setShowExitDialog(false);
  };

  if (chartLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b px-6 py-4">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="p-8 h-[calc(100vh-144px)]">
          <div className="flex h-full bg-white rounded-lg shadow-sm border overflow-hidden">
            <Skeleton className="w-[30%] h-full" />
            <Skeleton className="w-[70%] h-full" />
          </div>
        </div>
      </div>
    );
  }

  if (chartError || !chart) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b px-6 py-4">
          <h1 className="text-xl font-semibold">Edit Chart</h1>
        </div>
        <div className="p-8">
          <Alert className="max-w-2xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {chartError ? 'Failed to load chart' : 'Chart not found'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Single Header with Everything */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link href="/charts" className="hover:text-foreground transition-colors">
                CHARTS
              </Link>
              <span>/</span>
              <Link href={`/charts/${chartId}`} className="hover:text-foreground transition-colors">
                {chart.title}
              </Link>
              <span>/</span>
              <span className="text-foreground font-medium">EDIT</span>
            </div>

            <Button variant="ghost" size="icon" onClick={handleCancel}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <Input
              value={formData.title}
              onChange={(e) => handleFormChange({ title: e.target.value })}
              className="text-lg font-semibold border border-gray-200 shadow-sm px-4 py-2 h-11 bg-white min-w-[250px]"
              placeholder="Untitled Chart"
            />
            <Input
              placeholder="Brief description"
              value={formData.description || ''}
              onChange={(e) => handleFormChange({ description: e.target.value })}
              className="w-80 border border-gray-200 shadow-sm px-4 py-2 h-11"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isMutating || isCreating}
                className="px-8 h-11"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!isFormValid() || isMutating || isCreating}
                className="px-8 h-11"
              >
                {isMutating || isCreating ? 'Saving...' : 'Save Chart'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area with 2rem margin container */}
      <div className="p-8 h-[calc(100vh-144px)]">
        <div className="flex h-full bg-white rounded-lg shadow-sm border overflow-hidden">
          {/* Left Panel - 30% */}
          <div className="w-[30%] border-r">
            <Tabs defaultValue="configuration" className="h-full">
              <div className="px-4">
                <TabsList
                  className={`grid w-full ${formData.chart_type === 'table' ? 'grid-cols-1' : 'grid-cols-2'}`}
                >
                  <TabsTrigger value="configuration" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-5" />
                    Data Configuration
                  </TabsTrigger>
                  {formData.chart_type !== 'table' && (
                    <TabsTrigger value="styling" className="flex items-center gap-2">
                      <Database className="h-4 w-5" />
                      Chart Styling
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <TabsContent
                value="configuration"
                className="mt-6 h-[calc(100%-73px)] overflow-y-auto"
              >
                <div className="p-4">
                  {formData.chart_type === 'map' ? (
                    <MapDataConfigurationV3
                      formData={formData}
                      onFormDataChange={handleFormChange}
                    />
                  ) : (
                    <ChartDataConfigurationV3
                      formData={formData}
                      onChange={handleFormChange}
                      disabled={false}
                    />
                  )}
                </div>
              </TabsContent>

              {formData.chart_type !== 'table' && (
                <TabsContent value="styling" className="mt-6 h-[calc(100%-73px)] overflow-y-auto">
                  <div className="p-4">
                    {formData.chart_type === 'map' ? (
                      <MapCustomizations formData={formData} onFormDataChange={handleFormChange} />
                    ) : (
                      <ChartCustomizations
                        chartType={formData.chart_type || 'bar'}
                        formData={formData}
                        onChange={handleFormChange}
                      />
                    )}
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>

          {/* Right Panel - 70% */}
          <div className="w-[70%]">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
              <div className="px-4">
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="chart" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    CHART
                  </TabsTrigger>
                  <TabsTrigger value="data" className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    DATA
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="chart" className="mt-6 h-[calc(100%-73px)] overflow-y-auto">
                <div className="p-4 h-full">
                  {formData.chart_type === 'map' ? (
                    <div className="w-full h-full">
                      <MapPreview
                        geojsonData={geojsonData?.geojson_data}
                        geojsonLoading={geojsonLoading}
                        geojsonError={geojsonError}
                        mapData={mapDataOverlay?.data}
                        mapDataLoading={mapDataLoading}
                        mapDataError={mapDataError}
                        title={formData.title}
                        valueColumn={formData.aggregate_column}
                        onRegionClick={handleRegionClick}
                        drillDownPath={drillDownPath}
                        onDrillUp={handleDrillUp}
                        onDrillHome={handleDrillHome}
                      />
                    </div>
                  ) : formData.chart_type === 'table' ? (
                    <div className="w-full h-full">
                      <DataPreview
                        data={Array.isArray(dataPreview?.data) ? dataPreview.data : []}
                        columns={dataPreview?.columns || []}
                        columnTypes={dataPreview?.column_types || {}}
                        isLoading={previewLoading}
                        error={previewError}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full">
                      <ChartPreview
                        key={`${formData.schema_name}-${formData.table_name}`}
                        config={chartData?.echarts_config}
                        isLoading={chartDataLoading}
                        error={chartDataError}
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="data" className="mt-6 h-[calc(100%-73px)] overflow-y-auto">
                <div className="p-4">
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
                      />
                    </TabsContent>

                    <TabsContent value="raw-data" className="flex-1 mt-6">
                      <DataPreview
                        data={Array.isArray(rawTableData) ? rawTableData : []}
                        columns={
                          rawTableData && rawTableData.length > 0
                            ? Object.keys(rawTableData[0])
                            : []
                        }
                        columnTypes={{}}
                        isLoading={rawDataLoading}
                        error={rawDataError}
                        pagination={
                          tableCount
                            ? {
                                page: rawDataPage,
                                pageSize: rawDataPageSize,
                                total: tableCount.total_rows || 0,
                                onPageChange: setRawDataPage,
                                onPageSizeChange: handleRawDataPageSizeChange,
                              }
                            : undefined
                        }
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Save Options Dialog */}
      <SaveOptionsDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        originalTitle={chart?.title || ''}
        onSaveExisting={handleUpdateExisting}
        onSaveAsNew={handleSaveAsNew}
        isLoading={isMutating || isCreating}
      />

      {/* Exit Dialog - Save, Leave, or Stay */}
      <UnsavedChangesExitDialog
        open={showExitDialog}
        onOpenChange={setShowExitDialog}
        onSave={handleSaveAndLeave}
        onLeave={handleLeaveWithoutSaving}
        onStay={handleStayOnPage}
        isSaving={isMutating}
      />

      {/* Unsaved Changes Dialog (for browser navigation) */}
      <ConfirmationDialog
        open={unsavedChangesDialog.open}
        onOpenChange={(open) => setUnsavedChangesDialog((prev) => ({ ...prev, open }))}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to leave without saving?"
        confirmText="Leave Without Saving"
        cancelText="Cancel"
        type="warning"
        onConfirm={unsavedChangesDialog.onConfirm}
        onCancel={unsavedChangesDialog.onCancel}
      />
    </div>
  );
}

export default function EditChartPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EditChartPageContent />
    </Suspense>
  );
}
