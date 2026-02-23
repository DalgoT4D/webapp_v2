'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, BarChart3, ArrowLeft } from 'lucide-react';
import { ChartDataConfigurationV3 } from '@/components/charts/ChartDataConfigurationV3';
import { ChartCustomizations } from '@/components/charts/ChartCustomizations';
import { ChartPreview } from '@/components/charts/ChartPreview';
import { DataPreview } from '@/components/charts/DataPreview';
import { TableChart } from '@/components/charts/TableChart';
import { MapDataConfigurationV3 } from '@/components/charts/map/MapDataConfigurationV3';
import { MapCustomizations } from '@/components/charts/map/MapCustomizations';
import { MapPreview } from '@/components/charts/map/MapPreview';
import { UnsavedChangesExitDialog } from '@/components/charts/UnsavedChangesExitDialog';
import {
  useChartData,
  useChartDataPreview,
  useChartDataPreviewTotalRows,
  useCreateChart,
  useGeoJSONData,
  useMapDataOverlay,
  useRawTableData,
  useTableCount,
  useColumns,
  useRegions,
  useChildRegions,
  useRegionGeoJSONs,
} from '@/hooks/api/useChart';
import { toastSuccess, toastError, toastInfo } from '@/lib/toast';
import type { ChartCreate, ChartDataPayload, ChartBuilderFormData } from '@/types/charts';
import { generateAutoPrefilledConfig } from '@/lib/chartAutoPrefill';
import { deepEqual } from '@/lib/form-utils';

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

// Generate default chart name
function generateDefaultChartName(chartType: string, table: string): string {
  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const typeNames = {
    bar: 'Bar chart',
    line: 'Line chart',
    pie: 'Pie chart',
    number: 'Number card',
    map: 'Map chart',
  };

  return `${typeNames[chartType as keyof typeof typeNames] || 'Chart'} - ${table} ${timestamp}`;
}

function ConfigureChartPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { trigger: createChart, isMutating } = useCreateChart();

  // ✅ ADD: Drill-up and drill-home handlers for create mode
  const handleDrillUp = useCallback((targetLevel: number) => {
    if (targetLevel < 0) {
      setDrillDownPath([]);
    } else {
      setDrillDownPath((prev) => prev.slice(0, targetLevel + 1));
    }
  }, []);

  const handleDrillHome = useCallback(() => {
    setDrillDownPath([]);
  }, []);

  // Get parameters from URL
  const schema = searchParams.get('schema') || '';
  const table = searchParams.get('table') || '';
  const chartType = searchParams.get('type') || 'bar';
  const isFromDashboard = searchParams.get('from') === 'dashboard';

  // Initialize form data
  const [formData, setFormData] = useState<ChartBuilderFormData>({
    title: generateDefaultChartName(chartType, table),
    chart_type: chartType as ChartBuilderFormData['chart_type'],
    schema_name: schema,
    table_name: table,
    computation_type: 'aggregated',
    customizations: getDefaultCustomizations(chartType),
    // Set default aggregate function to prevent API errors
    aggregate_function: 'count',
  });

  const [activeTab, setActiveTab] = useState('chart');
  const [dataPreviewPage, setDataPreviewPage] = useState(1);
  const [dataPreviewPageSize, setDataPreviewPageSize] = useState(20);
  const [rawDataPage, setRawDataPage] = useState(1);
  const [rawDataPageSize, setRawDataPageSize] = useState(20);
  const [tableChartPage, setTableChartPage] = useState(1);
  const [tableChartPageSize, setTableChartPageSize] = useState(20);

  // Unsaved changes detection state
  const [originalFormData, setOriginalFormData] = useState<ChartBuilderFormData | null>(null);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string>('/charts');

  // ✅ ADD: Drill-down state management for create mode (map charts)
  const [drillDownPath, setDrillDownPath] = useState<
    Array<{
      level: number;
      name: string;
      geographic_column: string;
      parent_selections: Array<{
        column: string;
        value: string;
      }>;
      region_id: number;
    }>
  >([]);

  // ✅ ADD: Drill-down state management for table charts
  const [tableDrillDownState, setTableDrillDownState] = useState<{
    currentLevel: number; // 0 = first dimension, 1 = second dimension, etc.
    appliedFilters: Record<string, string>; // { dimension_column: value }
  } | null>(null);

  // ✅ ADD: Fetch regions for drill-down functionality (match edit mode exactly)
  const { data: states } = useRegions('IND', 'state');
  const { data: districts } = useChildRegions(
    drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1].region_id : null,
    drillDownPath.length > 0
  );
  const { data: regionGeojsons } = useRegionGeoJSONs(
    drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1].region_id : null
  );

  // Initialize original form data for unsaved changes detection
  useEffect(() => {
    if (!originalFormData) {
      setOriginalFormData({ ...formData });
    }
  }, [formData.schema_name, formData.table_name, formData.chart_type, originalFormData]);

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!originalFormData) return false;

    const hasChanges = !deepEqual(formData, originalFormData);

    return hasChanges;
  }, [formData, originalFormData]);

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

    // For table charts, check for dimensions array or dimension_column
    if (formData.chart_type === 'table') {
      const hasDimensions =
        (formData.dimensions &&
          formData.dimensions.length > 0 &&
          formData.dimensions.some((d) => d.column)) ||
        !!formData.dimension_column;
      // Table charts can work with just dimensions (no metrics required)
      if (hasDimensions) {
        return true;
      }
      // If metrics are provided, validate them
      if (formData.metrics && formData.metrics.length > 0) {
        return formData.metrics.every(
          (metric) =>
            metric.aggregation && (metric.aggregation.toLowerCase() === 'count' || metric.column)
        );
      }
      return false;
    }

    {
      // For bar/line charts with multiple metrics
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

      // For single metric charts
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
        // Multiple metrics for bar/line charts
        ...(formData.metrics && { metrics: formData.metrics }),
        // For table charts, include dimensions array with drill-down support
        ...(formData.chart_type === 'table' &&
          formData.dimensions &&
          formData.dimensions.length > 0 && {
            dimensions: (() => {
              const isDrillDownEnabled = formData.dimensions.some(
                (dim) => dim.enable_drill_down === true
              );

              if (!isDrillDownEnabled) {
                // Show all dimensions if drill-down disabled
                return formData.dimensions.map((d) => d.column).filter(Boolean);
              }

              // When drill-down is enabled, only use dimensions with enable_drill_down
              const drillDownDimensions = formData.dimensions
                .filter((dim) => dim.enable_drill_down)
                .map((d) => d.column)
                .filter(Boolean);

              // When drill-down is enabled and active, use only the current level dimension
              if (tableDrillDownState) {
                const nextIndex = Math.min(
                  tableDrillDownState.currentLevel + 1,
                  drillDownDimensions.length - 1
                );
                return [drillDownDimensions[nextIndex]]; // Only current level
              }

              // Drill-down enabled but not yet started: use top-level dimension only
              return [drillDownDimensions[0]]; // Only first dimension
            })(),
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
        // For number charts: only send subtitle to API for positioning (other customizations applied on frontend)
        // For table charts: don't send customizations in preview payload (formatting is frontend-only)
        // For pie charts: exclude numberFormat and decimalPlaces (frontend-only), send rest to API
        // For other charts: send all customizations to API
        ...(formData.chart_type !== 'table' && {
          customizations:
            formData.chart_type === 'number'
              ? { subtitle: formData.customizations?.subtitle }
              : formData.chart_type === 'pie'
                ? (() => {
                    const { numberFormat, decimalPlaces, ...rest } = formData.customizations || {};
                    return rest;
                  })()
                : formData.customizations,
        }),
        extra_config: {
          filters: [
            ...(formData.filters || []),
            // Add drill-down filters from tableDrillDownState
            ...(formData.chart_type === 'table' && tableDrillDownState?.appliedFilters
              ? Object.entries(tableDrillDownState.appliedFilters).map(([column, value]) => ({
                  column,
                  operator: 'equals',
                  value,
                }))
              : []),
          ],
          pagination: formData.pagination,
          sort: formData.sort,
          time_grain: formData.time_grain,
        },
      }
    : null;

  // Fetch chart data
  const {
    data: chartData,
    error: chartError,
    isLoading: chartLoading,
  } = useChartData(
    formData.chart_type !== 'map' && formData.chart_type !== 'table' ? chartDataPayload : null
  );

  // Fetch GeoJSON data for maps
  // Make geojsonId drill-down aware
  const geojsonId = useMemo(() => {
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
    drillDownPath,
    regionGeojsons,
  ]);

  const {
    data: geojsonData,
    error: geojsonError,
    isLoading: geojsonLoading,
  } = useGeoJSONData(geojsonId);

  // Fetch map data overlay
  // ✅ FIXED: Keep original data overlay logic, just make it drill-down aware
  const baseDataOverlayPayload =
    formData.chart_type === 'map' && formData.dataOverlayPayload
      ? formData.dataOverlayPayload
      : null;

  const dataOverlayPayload = useMemo(() => {
    if (!baseDataOverlayPayload) return null;

    // If no drill-down, use original payload
    if (drillDownPath.length === 0) {
      return baseDataOverlayPayload;
    }

    // If drill-down active, modify payload for drill-down level
    const drillDownFilters: Record<string, string> = {};
    drillDownPath.forEach((level) => {
      level.parent_selections.forEach((selection) => {
        drillDownFilters[selection.column] = selection.value;
      });
    });

    // Determine active geographic column for drill-down
    const hasDynamicDrillDown = formData.geographic_hierarchy?.drill_down_levels?.length > 0;
    const drillDownColumn = hasDynamicDrillDown
      ? formData.geographic_hierarchy.drill_down_levels[0]?.column
      : formData.district_column;

    const drillDownPayload = {
      ...baseDataOverlayPayload,
      geographic_column: drillDownColumn || baseDataOverlayPayload.geographic_column,
      filters: {
        ...baseDataOverlayPayload.filters,
        ...drillDownFilters,
      },
    };

    return drillDownPayload;
  }, [
    baseDataOverlayPayload,
    drillDownPath,
    formData.geographic_hierarchy,
    formData.district_column,
  ]);

  const {
    data: mapDataOverlay,
    error: mapDataError,
    isLoading: mapDataLoading,
  } = useMapDataOverlay(dataOverlayPayload);

  // Fetch data preview
  const {
    data: dataPreview,
    error: previewError,
    isLoading: previewLoading,
  } = useChartDataPreview(chartDataPayload, dataPreviewPage, dataPreviewPageSize);

  // Fetch total rows for chart data preview pagination
  const { data: chartDataTotalRows } = useChartDataPreviewTotalRows(chartDataPayload);

  // Fetch table chart data for table charts with server-side pagination
  const {
    data: tableChartData,
    error: tableChartError,
    isLoading: tableChartLoading,
  } = useChartDataPreview(
    formData.chart_type === 'table' ? chartDataPayload : null,
    tableChartPage,
    tableChartPageSize
  );

  // Fetch total rows for table chart pagination
  const { data: tableChartDataTotalRows } = useChartDataPreviewTotalRows(
    formData.chart_type === 'table' ? chartDataPayload : null
  );

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

  // Get all columns for raw data
  const { data: columns } = useColumns(formData.schema_name || null, formData.table_name || null);

  const handleFormChange = (updates: Partial<ChartBuilderFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  // Auto-prefill when columns are loaded
  useEffect(() => {
    if (columns && formData.schema_name && formData.table_name && formData.chart_type) {
      // Check if we should auto-prefill (no existing configuration)
      const hasExistingConfig = !!(
        formData.dimension_column ||
        formData.aggregate_column ||
        formData.geographic_column ||
        formData.x_axis_column ||
        formData.y_axis_column ||
        formData.table_columns?.length ||
        (formData.metrics && formData.metrics.length > 0)
      );

      if (!hasExistingConfig) {
        const autoConfig = generateAutoPrefilledConfig(formData.chart_type, columns);
        if (Object.keys(autoConfig).length > 0) {
          handleFormChange(autoConfig);
        }
      }
    }
  }, [columns, formData.schema_name, formData.table_name, formData.chart_type]);

  // Generate map preview payloads in create mode
  useEffect(() => {
    if (
      formData.chart_type === 'map' &&
      formData.geographic_column &&
      formData.selected_geojson_id &&
      formData.aggregate_column &&
      formData.aggregate_function &&
      formData.schema_name &&
      formData.table_name
    ) {
      // Check if payloads need updating
      const needsUpdate =
        !formData.geojsonPreviewPayload ||
        !formData.dataOverlayPayload ||
        formData.geojsonPreviewPayload.geojsonId !== formData.selected_geojson_id ||
        formData.dataOverlayPayload.geographic_column !== formData.geographic_column;

      if (needsUpdate) {
        const geojsonPayload = {
          geojsonId: formData.selected_geojson_id,
        };

        const dataOverlayPayload = {
          schema_name: formData.schema_name,
          table_name: formData.table_name,
          geographic_column: formData.geographic_column,
          value_column: formData.aggregate_column,
          aggregate_function: formData.aggregate_function,
          selected_geojson_id: formData.selected_geojson_id,
          filters: {},
          chart_filters: formData.filters || [],
        };

        setFormData((prev) => ({
          ...prev,
          geojsonPreviewPayload: geojsonPayload,
          dataOverlayPayload: dataOverlayPayload,
        }));
      }
    }
  }, [
    formData.chart_type,
    formData.geographic_column,
    formData.selected_geojson_id,
    formData.aggregate_column,
    formData.aggregate_function,
    formData.schema_name,
    formData.table_name,
    formData.filters,
    // ✅ FIX: Include geographic_hierarchy to regenerate payloads when drill-down config changes
    JSON.stringify(formData.geographic_hierarchy || {}),
    // Stringify payloads to prevent infinite loops
    JSON.stringify(formData.geojsonPreviewPayload || {}),
    JSON.stringify(formData.dataOverlayPayload || {}),
  ]);

  const handleDataPreviewPageSizeChange = (newPageSize: number) => {
    setDataPreviewPageSize(newPageSize);
    setDataPreviewPage(1); // Reset to first page when page size changes
  };

  const handleRawDataPageSizeChange = (newPageSize: number) => {
    setRawDataPageSize(newPageSize);
    setRawDataPage(1); // Reset to first page when page size changes
  };

  // Handle table chart pagination page size change
  const handleTableChartPageSizeChange = (newPageSize: number) => {
    setTableChartPageSize(newPageSize);
    setTableChartPage(1); // Reset to first page when page size changes
  };

  // Handle table row click for drill-down
  const handleTableRowClick = useCallback(
    (rowData: Record<string, any>, columnName: string) => {
      if (formData.chart_type !== 'table') return;

      // Check if drill-down is enabled
      const isDrillDownEnabled = formData.dimensions?.some((dim) => dim.enable_drill_down === true);

      if (!isDrillDownEnabled) return;

      // Get all dimensions in order (only those with drill-down enabled)
      const allDimensions = formData.dimensions
        .filter((dim) => dim.enable_drill_down)
        .map((d) => d.column)
        .filter(Boolean);

      if (allDimensions.length === 0) return;

      // Get the current dimension index
      const currentDimensionIndex = tableDrillDownState ? tableDrillDownState.currentLevel : -1;

      // Determine which dimension column is currently displayed
      const currentDisplayedDimension =
        currentDimensionIndex === -1 ? allDimensions[0] : allDimensions[currentDimensionIndex + 1];

      // Only allow clicking on the currently displayed dimension column
      if (columnName !== currentDisplayedDimension) {
        return;
      }

      // Get the value from the clicked row
      const clickedValue = rowData[columnName];
      if (!clickedValue) return;

      // Update drill-down state
      const newLevel = currentDimensionIndex + 1;
      const newAppliedFilters = {
        ...(tableDrillDownState?.appliedFilters || {}),
        [currentDisplayedDimension]: String(clickedValue),
      };

      // If we've reached the last dimension, don't allow further drill-down
      if (newLevel >= allDimensions.length - 1) {
        return;
      }

      setTableDrillDownState({
        currentLevel: newLevel,
        appliedFilters: newAppliedFilters,
      });

      // Reset to first page when drilling down
      setTableChartPage(1);
    },
    [formData.chart_type, formData.dimensions, tableDrillDownState]
  );

  // Handle table drill-up (going back)
  const handleTableDrillUp = useCallback(() => {
    if (!tableDrillDownState) return;

    const newLevel = tableDrillDownState.currentLevel - 1;
    const allDimensions = formData.dimensions?.map((d) => d.column).filter(Boolean) || [];

    if (newLevel < 0) {
      // Reset to top level
      setTableDrillDownState(null);
    } else {
      // Go back one level
      const newAppliedFilters: Record<string, string> = {};
      for (let i = 0; i <= newLevel; i++) {
        const dimColumn = allDimensions[i];
        if (tableDrillDownState.appliedFilters[dimColumn]) {
          newAppliedFilters[dimColumn] = tableDrillDownState.appliedFilters[dimColumn];
        }
      }

      setTableDrillDownState({
        currentLevel: newLevel,
        appliedFilters: newAppliedFilters,
      });
    }

    // Reset to first page when drilling up
    setTableChartPage(1);
  }, [tableDrillDownState, formData.dimensions]);

  // FIX #3: Handle map region click for drill-down in create mode
  // Handle map region click for drill-down in create mode
  const handleMapRegionClick = useCallback(
    (regionName: string, regionData: any) => {
      // Check if drill-down is available - support both dynamic and legacy systems
      const hasDynamicDrillDown = formData.geographic_hierarchy?.drill_down_levels?.length > 0;
      const hasLegacyDrillDown = formData.district_column;

      if (!hasDynamicDrillDown && !hasLegacyDrillDown) {
        toastInfo.generic('Configure drill-down levels to enable region drilling');
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
        toastSuccess.generic(`✨ Drilling down to ${regionName} districts!`);
      } else {
        toastError.api(`Region "${regionName}" not found for drill-down`);
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
      // Count(*) doesn't need a value_column, similar to other chart types
      const needsValueColumn = formData.aggregate_function?.toLowerCase() !== 'count';
      return !!(
        formData.geographic_column &&
        (!needsValueColumn || formData.value_column) &&
        formData.aggregate_function &&
        formData.selected_geojson_id
      );
    }

    if (formData.chart_type === 'table') {
      return true; // Tables just need schema, table, title which are already checked above
    }

    {
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

  const handleSave = async () => {
    if (!isFormValid()) {
      return;
    }

    let selectedGeojsonId = formData.selected_geojson_id;
    if (formData.chart_type === 'map' && formData.layers && formData.layers.length > 0) {
      const firstLayer = formData.layers[0];
      if (firstLayer.geojson_id) {
        selectedGeojsonId = firstLayer.geojson_id;
      }
    }

    const chartData: ChartCreate = {
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
        layers: formData.layers,
        // For number charts: only send subtitle to API (other customizations applied on frontend)
        // For table charts: only send columnFormatting to API (formatting applied on frontend)
        // For other charts: send all customizations to API
        customizations:
          formData.chart_type === 'number'
            ? { subtitle: formData.customizations?.subtitle }
            : formData.chart_type === 'table'
              ? { columnFormatting: formData.customizations?.columnFormatting }
              : formData.customizations,
        filters: formData.filters,
        pagination: formData.pagination,
        sort: formData.sort,
        time_grain: formData.time_grain,
        // Include metrics for multiple metrics support
        ...(formData.metrics && formData.metrics.length > 0 && { metrics: formData.metrics }),
        // ✅ FIX: Include geographic_hierarchy for drill-down functionality
        ...(formData.geographic_hierarchy && {
          geographic_hierarchy: formData.geographic_hierarchy,
        }),
        // ✅ FIX: Include dimensions and dimension_columns for table charts
        ...(formData.chart_type === 'table' && {
          // Always include dimensions array (even if empty) to ensure structure is consistent
          dimensions:
            formData.dimensions && formData.dimensions.length > 0
              ? formData.dimensions
                  .filter((dim) => dim.column && dim.column.trim() !== '')
                  .map((dim) => ({
                    column: dim.column,
                    enable_drill_down: Boolean(dim.enable_drill_down === true),
                  }))
              : [],
          // Always include dimension_columns array for backward compatibility
          dimension_columns:
            formData.dimensions && formData.dimensions.length > 0
              ? formData.dimensions.map((d) => d.column).filter(Boolean)
              : [],
          // Keep table_columns for backward compatibility
          table_columns: formData.table_columns,
        }),
      },
    };

    try {
      const result = await createChart(chartData);
      // Reset unsaved changes state after successful save
      setOriginalFormData({ ...formData });
      toastSuccess.created('Chart');
      if (isFromDashboard) {
        // Use replace so back button from chart detail goes to dashboard
        router.replace(`/charts/${result.id}?from=dashboard`);
      } else {
        router.push(`/charts/${result.id}`);
      }
    } catch (error: any) {
      console.error('❌ [CREATE-MODE] Error saving chart:', error);
      console.error('❌ [CREATE-MODE] Error details:', {
        message: error?.message,
        response: error?.response,
        data: error?.data,
        stack: error?.stack,
        // Log what was being sent
        attempted_payload: {
          chart_type: chartData.chart_type,
          dimensions: chartData.extra_config.dimensions,
          dimension_columns: chartData.extra_config.dimension_columns,
        },
      });

      // Show more detailed error message
      toastError.api(error, 'save chart');
    }
  };

  const handleCancel = () => {
    console.log('🔙 [CREATE-MODE] Cancel button clicked. hasUnsavedChanges:', hasUnsavedChanges);
    if (hasUnsavedChanges) {
      setPendingNavigation(isFromDashboard ? 'back' : '/charts');
      setShowUnsavedChangesDialog(true);
    } else if (isFromDashboard) {
      router.back();
    } else {
      router.push('/charts');
    }
  };

  const handleUnsavedChangesLeave = () => {
    setShowUnsavedChangesDialog(false);
    if (pendingNavigation === 'back') {
      router.back();
    } else {
      router.push(pendingNavigation);
    }
  };

  const handleUnsavedChangesSave = async () => {
    await handleSave();
    // handleSave will navigate away after successful save
  };

  const handleUnsavedChangesStay = () => {
    setShowUnsavedChangesDialog(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Single Header with Everything */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back Button */}
            <Button
              data-testid="chart-create-back-button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (hasUnsavedChanges) {
                  setPendingNavigation(isFromDashboard ? 'back' : '/charts/new');
                  setShowUnsavedChangesDialog(true);
                } else if (isFromDashboard) {
                  router.back();
                } else {
                  router.push('/charts/new');
                }
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {isFromDashboard ? 'Back to Dashboard' : 'Back'}
            </Button>

            {/* Chart Title Input */}
            <Input
              value={formData.title}
              onChange={(e) => handleFormChange({ title: e.target.value })}
              className="text-lg font-semibold border border-gray-200 shadow-sm px-4 py-2 h-11 bg-white min-w-[300px]"
              placeholder="Untitled Chart"
            />
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={handleSave}
              disabled={!isFormValid() || isMutating}
              className="px-8 h-11 text-white hover:opacity-90"
              style={{ backgroundColor: '#06887b' }}
            >
              {isMutating ? 'Saving...' : 'Save Chart'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area with 2rem margin container */}
      <div className="p-8 h-[calc(100vh-144px)]">
        <div className="flex h-full bg-white rounded-lg shadow-sm border overflow-hidden">
          {/* Left Panel - 30% */}
          <div className="w-[30%] border-r">
            <Tabs defaultValue="configuration" className="h-full">
              <div className="px-4 pt-4">
                <TabsList className="grid w-full h-11 grid-cols-2">
                  <TabsTrigger
                    value="configuration"
                    className="flex items-center justify-center gap-2 text-sm h-full"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Data Configuration
                  </TabsTrigger>
                  <TabsTrigger
                    value="styling"
                    className="flex items-center justify-center gap-2 text-sm h-full"
                  >
                    <Database className="h-4 w-4" />
                    Chart Styling
                  </TabsTrigger>
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
                  ) : formData.chart_type === 'table' ? (
                    <ChartDataConfigurationV3
                      formData={formData}
                      onChange={handleFormChange}
                      disabled={false}
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

              <TabsContent value="styling" className="h-[calc(100%-73px)] overflow-y-auto">
                <div className="p-4">
                  {formData.chart_type === 'map' ? (
                    <MapCustomizations formData={formData} onFormDataChange={handleFormChange} />
                  ) : (
                    <ChartCustomizations
                      chartType={formData.chart_type || 'bar'}
                      formData={formData}
                      onChange={handleFormChange}
                      columns={columns}
                    />
                  )}
                </div>
              </TabsContent>
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

              <TabsContent value="chart" className="h-[calc(100%-73px)] overflow-y-auto">
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
                        valueColumn={formData.metrics?.[0]?.alias || formData.aggregate_column}
                        customizations={formData.customizations}
                        // ✅ UPDATE: Complete drill-down support in create mode
                        onRegionClick={handleMapRegionClick}
                        drillDownPath={drillDownPath}
                        onDrillUp={handleDrillUp}
                        onDrillHome={handleDrillHome}
                        showBreadcrumbs={true}
                      />
                    </div>
                  ) : formData.chart_type === 'table' ? (
                    <div className="w-full h-full flex flex-col">
                      {/* Breadcrumb navigation for drill-down */}
                      {tableDrillDownState && (
                        <div className="px-4 py-2 border-b bg-gray-50 flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleTableDrillUp}
                            className="h-8"
                          >
                            ← Back
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            {Object.entries(tableDrillDownState.appliedFilters)
                              .map(([col, val]) => `${col}: ${val}`)
                              .join(' → ')}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 overflow-hidden">
                        <TableChart
                          data={Array.isArray(tableChartData?.data) ? tableChartData.data : []}
                          config={{
                            table_columns: tableChartData?.columns || formData.table_columns || [],
                            column_formatting: formData.customizations?.columnFormatting || {},
                            sort: formData.sort || [],
                            pagination: formData.pagination || { enabled: true, page_size: 20 },
                          }}
                          isLoading={tableChartLoading}
                          error={tableChartError}
                          pagination={{
                            page: tableChartPage,
                            pageSize: tableChartPageSize,
                            total: tableChartDataTotalRows || 0,
                            onPageChange: setTableChartPage,
                            onPageSizeChange: handleTableChartPageSizeChange,
                          }}
                          onRowClick={handleTableRowClick}
                          drillDownEnabled={formData.dimensions?.some(
                            (dim) => dim.enable_drill_down === true
                          )}
                          currentDimensionColumn={
                            tableDrillDownState
                              ? formData.dimensions
                                  ?.filter((dim) => dim.enable_drill_down)
                                  .map((d) => d.column)
                                  .filter(Boolean)[tableDrillDownState.currentLevel + 1]
                              : formData.dimensions
                                  ?.filter((dim) => dim.enable_drill_down)
                                  .map((d) => d.column)
                                  .filter(Boolean)[0]
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full">
                      <ChartPreview
                        key={`${formData.schema_name}-${formData.table_name}`}
                        config={chartData?.echarts_config}
                        isLoading={chartLoading}
                        error={chartError}
                        chartType={formData.chart_type}
                        customizations={formData.customizations}
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="data" className="h-[calc(100%-73px)] overflow-y-auto">
                <div className="p-4">
                  <Tabs
                    defaultValue={formData.chart_type === 'table' ? 'raw-data' : 'chart-data'}
                    className="h-full flex flex-col"
                  >
                    <TabsList
                      className={`grid w-full ${formData.chart_type === 'table' ? 'grid-cols-1' : 'grid-cols-2'}`}
                    >
                      {formData.chart_type !== 'table' && (
                        <TabsTrigger value="chart-data" className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Chart Data
                        </TabsTrigger>
                      )}
                      <TabsTrigger value="raw-data" className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Raw Data
                      </TabsTrigger>
                    </TabsList>

                    {formData.chart_type !== 'table' && (
                      <TabsContent value="chart-data" className="flex-1">
                        <DataPreview
                          data={Array.isArray(dataPreview?.data) ? dataPreview.data : []}
                          columns={dataPreview?.columns || []}
                          columnTypes={dataPreview?.column_types || {}}
                          isLoading={previewLoading}
                          error={previewError}
                          pagination={{
                            page: dataPreviewPage,
                            pageSize: dataPreviewPageSize,
                            total: chartDataTotalRows || 0,
                            onPageChange: setDataPreviewPage,
                            onPageSizeChange: handleDataPreviewPageSizeChange,
                          }}
                        />
                      </TabsContent>
                    )}

                    <TabsContent value="raw-data" className="flex-1">
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

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesExitDialog
        open={showUnsavedChangesDialog}
        onOpenChange={setShowUnsavedChangesDialog}
        onSave={handleUnsavedChangesSave}
        onLeave={handleUnsavedChangesLeave}
        onStay={handleUnsavedChangesStay}
        isSaving={isMutating}
      />
    </div>
  );
}

export default function ConfigureChartPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfigureChartPageContent />
    </Suspense>
  );
}
