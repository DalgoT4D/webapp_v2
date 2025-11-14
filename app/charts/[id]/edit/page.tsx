'use client';

import { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ChevronLeft, Database, BarChart3, Lock, ArrowLeft } from 'lucide-react';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { ChartDataConfigurationV3 } from '@/components/charts/ChartDataConfigurationV3';
import { ChartCustomizations } from '@/components/charts/ChartCustomizations';
import { ChartPreview } from '@/components/charts/ChartPreview';
import { DataPreview } from '@/components/charts/DataPreview';
import { TableChart } from '@/components/charts/TableChart';
import { SimpleTableConfiguration } from '@/components/charts/SimpleTableConfiguration';
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
  useChartDataPreviewTotalRows,
  useGeoJSONData,
  useMapDataOverlay,
  useRawTableData,
  useTableCount,
  useColumns,
  useRegions,
  useChildRegions,
  useRegionGeoJSONs,
} from '@/hooks/api/useChart';
import { toastSuccess, toastError } from '@/lib/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
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
        legendDisplay: 'paginated',
        legendPosition: 'top',
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
        legendDisplay: 'paginated',
        legendPosition: 'top',
      };
    case 'line':
      return {
        lineStyle: 'smooth',
        showDataPoints: true,
        showTooltip: true,
        showLegend: true,
        legendDisplay: 'paginated',
        legendPosition: 'top',
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
        showLabels: false,
      };
    default:
      return {};
  }
}

function EditChartPageContent() {
  const params = useParams();
  const router = useRouter();
  const chartId = Number(params.id);
  console.log('🔍 [EDIT-PAGE] Initialized with params:', {
    rawId: params.id,
    chartId,
    isValidNumber: !isNaN(chartId) && chartId > 0,
  });
  const { hasPermission } = useUserPermissions();
  const canEditChart = hasPermission('can_edit_charts');
  const { data: chart, error: chartError, isLoading: chartLoading } = useChart(chartId);
  const { trigger: updateChart, isMutating } = useUpdateChart();
  const { trigger: createChart, isMutating: isCreating } = useCreateChart();

  // Check if user has edit permissions (temporarily disabled)
  if (!canEditChart) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">You don't have permission to edit charts.</p>
          <Button variant="outline" onClick={() => router.push('/charts')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Charts
          </Button>
        </div>
      </div>
    );
  }

  // Initialize form data with chart data when loaded
  const initialFormData: ChartBuilderFormData = {
    title: '',
    chart_type: 'bar',
    computation_type: 'aggregated',
    customizations: getDefaultCustomizations('bar'),
    aggregate_function: 'sum',
  };

  const [formData, setFormData] = useState<ChartBuilderFormData>(initialFormData);

  const [activeTab, setActiveTab] = useState('chart');
  const [dataPreviewPage, setDataPreviewPage] = useState(1);
  const [dataPreviewPageSize, setDataPreviewPageSize] = useState(25);
  const [rawDataPage, setRawDataPage] = useState(1);
  const [rawDataPageSize, setRawDataPageSize] = useState(20);
  const [tableChartPage, setTableChartPage] = useState(1);
  const [tableChartPageSize, setTableChartPageSize] = useState(20);
  const [originalFormData, setOriginalFormData] = useState<ChartBuilderFormData | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [isExitingAfterSave, setIsExitingAfterSave] = useState(false);
  const [unsavedChangesDialog, setUnsavedChangesDialog] = useState({
    open: false,
    onConfirm: () => {},
    onCancel: () => {},
  });
  const [errorToastVisible, setErrorToastVisible] = useState(false);
  const [errorToastDismissed, setErrorToastDismissed] = useState(false);
  const [lastValidChartConfig, setLastValidChartConfig] = useState<any>(null);

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

  // Table drill-down state management
  const [tableDrillDownPath, setTableDrillDownPath] = useState<
    Array<{
      level: number;
      column: string;
      value: any;
      display_name: string;
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
        time_grain: chart.extra_config?.time_grain,
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
        // Include table_columns for table charts
        table_columns: chart.extra_config?.table_columns || [],
        // Include drill_down_config for table charts
        drill_down_config: chart.extra_config?.drill_down_config,
      };
      setFormData(initialData);
      setOriginalFormData(initialData);
    }
  }, [chart]);

  // For new charts or charts that couldn't be loaded, set originalFormData to initial state
  // This enables unsaved changes detection even for new charts
  useEffect(() => {
    console.log('🔍 [UNSAVED-CHANGES] Checking conditions:', {
      hasChart: !!chart,
      chartLoading,
      hasOriginalFormData: !!originalFormData,
      chartId,
    });

    if (!chart && !chartLoading && !originalFormData) {
      console.log('✅ [UNSAVED-CHANGES] Setting originalFormData for new/unloaded chart');
      setOriginalFormData({ ...initialFormData });
    }
  }, [chart, chartLoading, originalFormData, initialFormData, chartId]);

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    const hasChanges = originalFormData ? !deepEqual(formData, originalFormData) : false;
    console.log('🔍 [UNSAVED-CHANGES] Detection:', {
      hasOriginalFormData: !!originalFormData,
      hasChanges,
      formDataTitle: formData.title,
      formDataSchema: formData.schema_name,
      formDataTable: formData.table_name,
      originalTitle: originalFormData?.title,
      originalSchema: originalFormData?.schema_name,
      originalTable: originalFormData?.table_name,
    });
    return hasChanges;
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
      return true; // Table charts just need basic schema/table selection
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
      return !!(
        formData.dimension_column &&
        formData.aggregate_function &&
        (formData.aggregate_function === 'count' || formData.aggregate_column)
      );
    }
  };

  // Build payload for chart data
  const chartDataPayload: ChartDataPayload | null = useMemo(() => {
    // Check if basic data is ready
    if (!formData.schema_name || !formData.table_name || !formData.chart_type) {
      return null;
    }

    // Check chart-type specific requirements
    if (formData.chart_type === 'number') {
      const needsAggregateColumn = formData.aggregate_function !== 'count';
      if (!formData.aggregate_function || (needsAggregateColumn && !formData.aggregate_column)) {
        return null;
      }
    } else if (formData.chart_type === 'map') {
      const needsValueColumn = formData.aggregate_function?.toLowerCase() !== 'count';
      if (
        !formData.geographic_column ||
        !formData.aggregate_function ||
        !formData.selected_geojson_id ||
        (needsValueColumn && !formData.value_column)
      ) {
        return null;
      }
    } else if (formData.chart_type !== 'table') {
      // For bar/line/pie charts with multiple metrics
      if (formData.metrics && formData.metrics.length > 0) {
        if (!formData.dimension_column) return null;
        for (const metric of formData.metrics) {
          if (
            !metric.aggregation ||
            (metric.aggregation.toLowerCase() !== 'count' && !metric.column)
          ) {
            return null;
          }
        }
      } else {
        // Legacy single metric approach
        const needsAggregateColumn = formData.aggregate_function !== 'count';
        if (
          !formData.dimension_column ||
          !formData.aggregate_function ||
          (needsAggregateColumn && !formData.aggregate_column)
        ) {
          return null;
        }
      }
    }

    // Build base filters from form data
    const baseFilters = formData.filters || [];

    // Add table drill-down filters if drill-down path exists
    const drillDownFilters = tableDrillDownPath.map((step) => ({
      column: step.column,
      operator: 'equals', // Backend expects 'equals', not '='
      value: step.value,
    }));

    const allFilters = [...baseFilters, ...drillDownFilters];

    // For table drill-down: determine which column to group by based on drill-down level
    let dimensionColumn = formData.dimension_column;
    let tableColumns = formData.table_columns;
    let metrics = formData.metrics;

    if (formData.chart_type === 'table' && formData.drill_down_config?.enabled) {
      const hierarchyLevels = formData.drill_down_config.hierarchy || [];

      // Determine which level we're at (0 = root, 1 = first drill, etc.)
      const currentLevel = tableDrillDownPath.length;

      // Get the hierarchy configuration for the current level to display
      const currentHierarchyLevel = hierarchyLevels[currentLevel];

      if (currentHierarchyLevel) {
        // Use the column from the hierarchy configuration
        dimensionColumn = currentHierarchyLevel.column;

        // Get aggregation columns (use from current level, fallback to first level for consistency)
        const aggregationColumns =
          currentHierarchyLevel.aggregation_columns ||
          hierarchyLevels[0]?.aggregation_columns ||
          [];

        // Create metrics for aggregation columns
        if (aggregationColumns.length > 0) {
          metrics = aggregationColumns.map((col) => ({
            column: col,
            aggregation: 'sum',
            alias: `sum_${col}`,
          }));
        }

        // Update table columns to show dimension + aggregation columns (with aliases)
        tableColumns = [dimensionColumn, ...aggregationColumns.map((col) => `sum_${col}`)];
      }
    }

    return {
      chart_type: formData.chart_type!,
      computation_type: formData.computation_type!,
      schema_name: formData.schema_name!,
      table_name: formData.table_name!,
      ...(formData.x_axis_column && { x_axis: formData.x_axis_column }),
      ...(formData.y_axis_column && { y_axis: formData.y_axis_column }),
      ...(dimensionColumn && { dimension_col: dimensionColumn }),
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
      // For table charts, pass selected columns
      ...(formData.chart_type === 'table' && {
        table_columns: tableColumns,
      }),
      // Include metrics for multiple metrics support
      ...(metrics && metrics.length > 0 && { metrics }),
      customizations: formData.customizations,
      extra_config: {
        filters: allFilters,
        pagination: formData.pagination,
        sort: formData.sort,
        time_grain: formData.time_grain,
        table_columns: tableColumns,
      },
    };
  }, [
    formData.chart_type,
    formData.computation_type,
    formData.schema_name,
    formData.table_name,
    formData.x_axis_column,
    formData.y_axis_column,
    formData.dimension_column,
    formData.aggregate_column,
    formData.aggregate_function,
    formData.extra_dimension_column,
    formData.geographic_column,
    formData.value_column,
    formData.selected_geojson_id,
    formData.layers,
    formData.table_columns,
    formData.metrics,
    formData.filters,
    formData.pagination,
    formData.sort,
    formData.time_grain,
    formData.customizations,
    formData.drill_down_config,
    tableDrillDownPath,
  ]);

  // Fetch chart data (including tables)
  const {
    data: chartData,
    error: chartDataError,
    isLoading: chartDataLoading,
  } = useChartData(formData.chart_type !== 'map' ? chartDataPayload : null);

  // Track last valid chart config for better UX
  useEffect(() => {
    if (chartData?.echarts_config) {
      setLastValidChartConfig(chartData.echarts_config);
    }
  }, [chartData?.echarts_config]);

  // Reset dismiss state when form configuration changes
  useEffect(() => {
    setErrorToastDismissed(false);
    console.log('Form config changed - reset dismiss state');
  }, [
    formData.chart_type,
    formData.aggregate_function,
    formData.aggregate_column,
    formData.dimension_column,
    formData.metrics,
    formData.schema_name,
    formData.table_name,
  ]);

  // Manage error toast visibility
  useEffect(() => {
    const hasBasicConfig = formData.schema_name && formData.table_name && formData.chart_type;
    const isConfigIncomplete =
      hasBasicConfig &&
      !isChartDataReady() &&
      formData.chart_type !== 'map' &&
      formData.chart_type !== 'table';
    const shouldShowToast = isConfigIncomplete && !chartDataLoading && !errorToastDismissed;

    // Debug specifically for number charts
    if (formData.chart_type === 'number') {
      console.log('Number chart debug:', {
        hasBasicConfig,
        isChartDataReady: isChartDataReady(),
        chartDataLoading,
        chartData: !!chartData,
        aggregate_function: formData.aggregate_function,
        aggregate_column: formData.aggregate_column,
        isConfigIncomplete,
        shouldShowToast,
      });
    }

    console.log('Toast visibility check:', {
      chartType: formData.chart_type,
      isConfigIncomplete,
      chartDataLoading,
      errorToastDismissed,
      shouldShowToast,
    });

    if (shouldShowToast && !errorToastVisible) {
      console.log('Showing toast');
      setErrorToastVisible(true);
    } else if (!isConfigIncomplete && errorToastVisible) {
      console.log('Hiding toast - config complete');
      setErrorToastVisible(false);
    }
  }, [
    formData,
    chartData,
    chartDataLoading,
    isChartDataReady,
    errorToastVisible,
    errorToastDismissed,
  ]);

  // Handle manual toast dismissal
  const handleDismissToast = (e: React.MouseEvent) => {
    console.log('Toast clicked - dismissing, current state:', errorToastVisible);
    e.preventDefault();
    e.stopPropagation();
    setErrorToastVisible(false);
    setErrorToastDismissed(true); // Mark as manually dismissed
    console.log('State set to false, dismissed set to true');
  };

  useEffect(() => {
    // reset the chart data page size and limit when pagination changes
    setDataPreviewPageSize(25);
    setDataPreviewPage(1);
  }, [formData.pagination?.page_size, formData.pagination?.enabled]);

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
  } = useChartDataPreview(chartDataPayload, dataPreviewPage, dataPreviewPageSize);

  // Fetch total rows for chart data preview pagination
  const { data: chartDataTotalRows } = useChartDataPreviewTotalRows(chartDataPayload);

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

  // Use chart data preview for table charts (same as data preview)
  const {
    data: tableChartData,
    error: tableChartError,
    isLoading: tableChartLoading,
  } = useChartDataPreview(
    formData.chart_type === 'table' ? chartDataPayload : null,
    tableChartPage,
    tableChartPageSize
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

  // Table drill-down handlers
  const handleTableDrillDown = useCallback(
    (column: string, value: any) => {
      console.log('🔽 Table drill-down:', { column, value, currentPath: tableDrillDownPath });
      setTableDrillDownPath((prev) => [
        ...prev,
        {
          level: prev.length,
          column,
          value,
          display_name: column,
        },
      ]);
    },
    [tableDrillDownPath]
  );

  const handleTableDrillUp = useCallback(
    (level?: number) => {
      console.log('🔼 Table drill-up:', { level, currentPath: tableDrillDownPath });
      if (level === undefined || level === 0) {
        setTableDrillDownPath([]);
      } else {
        setTableDrillDownPath((prev) => prev.slice(0, level));
      }
    },
    [tableDrillDownPath]
  );

  // Get all columns for raw data
  const { data: columns } = useColumns(formData.schema_name || null, formData.table_name || null);

  const handleFormChange = (updates: Partial<ChartBuilderFormData>) => {
    // Smart chart type switching logic (same as ChartBuilder)
    if (updates.chart_type && updates.chart_type !== formData.chart_type) {
      const newChartType = updates.chart_type;
      const oldChartType = formData.chart_type;

      // Smart column mapping based on chart type compatibility
      const smartUpdates = { ...updates };

      // Preserve dataset selection (schema, table, title)
      // These are compatible across all chart types - no need to change

      // Set computation_type based on chart type
      if (newChartType === 'number') {
        smartUpdates.computation_type = 'aggregated';
      } else if (newChartType === 'map') {
        smartUpdates.computation_type = 'aggregated';
      } else if (newChartType === 'table') {
        smartUpdates.computation_type = 'aggregated';
        // Keep existing columns for table display - don't clear them!
      } else {
        smartUpdates.computation_type = formData.computation_type || 'aggregated';
      }

      // Smart column mapping between chart types
      if (oldChartType && oldChartType !== newChartType) {
        // For aggregated chart types (bar, line, pie, number)
        if (['bar', 'line', 'pie', 'number'].includes(newChartType)) {
          // From maps: use geographic_column as dimension, value_column as aggregate
          if (oldChartType === 'map') {
            if (formData.geographic_column)
              smartUpdates.dimension_column = formData.geographic_column;
            if (formData.value_column) smartUpdates.aggregate_column = formData.value_column;
            if (formData.aggregate_function)
              smartUpdates.aggregate_function = formData.aggregate_function;
          }
          // From tables: preserve columns if they exist
          else if (oldChartType === 'table' && formData.table_columns?.length > 0) {
            if (formData.table_columns[0])
              smartUpdates.dimension_column = formData.table_columns[0];
            if (formData.table_columns[1])
              smartUpdates.aggregate_column = formData.table_columns[1];
            smartUpdates.aggregate_function = formData.aggregate_function || 'sum';
          }
        }
        // For map charts
        else if (newChartType === 'map') {
          // From other aggregated charts: use dimension as geographic, aggregate as value
          if (['bar', 'line', 'pie', 'number'].includes(oldChartType)) {
            if (formData.dimension_column)
              smartUpdates.geographic_column = formData.dimension_column;
            if (formData.aggregate_column) smartUpdates.value_column = formData.aggregate_column;
            if (formData.aggregate_function)
              smartUpdates.aggregate_function = formData.aggregate_function;
            if (formData.metrics) smartUpdates.metrics = formData.metrics;
          }
          // From tables: use first column as geographic if available
          else if (oldChartType === 'table' && formData.table_columns?.length > 0) {
            if (formData.table_columns[0])
              smartUpdates.geographic_column = formData.table_columns[0];
            if (formData.table_columns[1]) smartUpdates.value_column = formData.table_columns[1];
            smartUpdates.aggregate_function = formData.aggregate_function || 'sum';
          }
        }

        // For table charts
        else if (newChartType === 'table') {
          const tableColumns: string[] = [];

          // From aggregated charts: include dimension and aggregate columns
          if (['bar', 'line', 'pie', 'number'].includes(oldChartType)) {
            // Try to get the X axis column - check both dimension_column and x_axis_column
            let dimensionForTable = null;
            if (formData.dimension_column && formData.dimension_column !== 'undefined') {
              dimensionForTable = formData.dimension_column;
            } else if (formData.x_axis_column && formData.x_axis_column !== 'undefined') {
              dimensionForTable = formData.x_axis_column;
            }

            if (dimensionForTable) {
              tableColumns.push(dimensionForTable);
              // Map to x_axis_column for raw data compatibility
              smartUpdates.x_axis_column = dimensionForTable;
            }
            if (
              formData.aggregate_column &&
              formData.aggregate_column !== formData.dimension_column
            ) {
              tableColumns.push(formData.aggregate_column);
            }
            // Add metrics columns if available
            if (formData.metrics) {
              formData.metrics.forEach((metric) => {
                if (metric.column && !tableColumns.includes(metric.column)) {
                  tableColumns.push(metric.column);
                }
              });
            }
          }
          // From maps: include geographic and value columns
          else if (oldChartType === 'map') {
            if (formData.geographic_column) {
              tableColumns.push(formData.geographic_column);
              smartUpdates.x_axis_column = formData.geographic_column;
            }
            if (formData.value_column && formData.value_column !== formData.geographic_column) {
              tableColumns.push(formData.value_column);
            }
          }

          if (tableColumns.length > 0) {
            smartUpdates.table_columns = tableColumns;
          }
        }
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

      smartUpdates.customizations = {
        ...newDefaults,
        ...preservedFields,
      };

      setFormData((prev) => ({ ...prev, ...smartUpdates }));
    } else {
      // Regular form update without chart type change
      setFormData((prev) => ({ ...prev, ...updates }));
    }
  };

  const handleDataPreviewPageSizeChange = (newPageSize: number) => {
    setDataPreviewPageSize(newPageSize);
    setDataPreviewPage(1); // Reset to first page when page size changes
  };

  const handleTableChartPageSizeChange = (newPageSize: number) => {
    setTableChartPageSize(newPageSize);
    setTableChartPage(1); // Reset to first page when page size changes
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
      return true; // Table charts only need basic fields (title, chart_type, schema, table)
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
        // Include geographic_hierarchy to preserve drill-down configuration
        geographic_hierarchy: formData.geographic_hierarchy,
        customizations: formData.customizations,
        filters: formData.filters,
        pagination: formData.pagination,
        sort: formData.sort,
        time_grain: formData.time_grain,
        // Include table_columns for table charts
        table_columns: formData.table_columns,
        // Include drill_down_config for table charts
        drill_down_config: formData.drill_down_config,
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

      toastSuccess.updated('Chart');

      // Navigate based on context - if exiting after save, go to charts list
      if (isExitingAfterSave) {
        setIsExitingAfterSave(false);
        navigateWithoutWarning('/charts');
      } else {
        navigateWithoutWarning(`/charts/${chartId}`);
      }
    } catch (err) {
      toastError.update(err, 'chart');
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

      toastSuccess.created(`Chart "${newTitle}"`);

      // Navigate based on context - if exiting after save, go to charts list
      if (isExitingAfterSave) {
        setIsExitingAfterSave(false);
        navigateWithoutWarning('/charts');
      } else {
        navigateWithoutWarning(`/charts/${result.id}`);
      }
    } catch (err) {
      toastError.create(err, 'chart');
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
      <div className="h-full flex flex-col overflow-hidden bg-gray-50">
        <div className="bg-white border-b px-6 py-4 flex-shrink-0">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="flex-1 flex overflow-hidden p-8">
          <div className="flex w-full h-full bg-white rounded-lg shadow-sm border overflow-hidden">
            <Skeleton className="w-[30%] h-full" />
            <Skeleton className="w-[70%] h-full" />
          </div>
        </div>
      </div>
    );
  }

  if (chartError || (!chart && !chartLoading && chartId && chartId > 0)) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-gray-50">
        <div className="bg-white border-b px-6 py-4 flex-shrink-0">
          <h1 className="text-xl font-semibold">Edit Chart</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <Alert className="max-w-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {chartError ? 'Chart needs attention' : 'Chart not found'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      {/* Single Header with Everything */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                console.log('🔙 [BACK-BUTTON] Clicked. hasUnsavedChanges:', hasUnsavedChanges);
                if (hasUnsavedChanges) {
                  setUnsavedChangesDialog({
                    open: true,
                    onConfirm: () => {
                      setUnsavedChangesDialog({
                        open: false,
                        onConfirm: () => {},
                        onCancel: () => {},
                      });
                      navigateWithoutWarning(`/charts/${chartId}`);
                    },
                    onCancel: () => {
                      setUnsavedChangesDialog({
                        open: false,
                        onConfirm: () => {},
                        onCancel: () => {},
                      });
                    },
                  });
                } else {
                  router.push(`/charts/${chartId}`);
                }
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
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
              variant="cancel"
              onClick={handleCancel}
              disabled={isMutating || isCreating}
              className="px-8 h-11"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isFormValid() || isMutating || isCreating}
              className="px-8 h-11 text-white hover:opacity-90"
              style={{ backgroundColor: '#06887b' }}
            >
              {isMutating || isCreating ? 'Saving...' : 'Save Chart'}
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
                <TabsList
                  className={`grid w-full h-11 ${formData.chart_type === 'table' ? 'grid-cols-1' : 'grid-cols-2'}`}
                >
                  <TabsTrigger
                    value="configuration"
                    className="flex items-center justify-center gap-2 text-sm h-full"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Data Configuration
                  </TabsTrigger>
                  {formData.chart_type !== 'table' && (
                    <TabsTrigger
                      value="styling"
                      className="flex items-center justify-center gap-2 text-sm h-full"
                    >
                      <Database className="h-4 w-4" />
                      Chart Styling
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <TabsContent
                value="configuration"
                className="mt-6 h-[calc(100%-73px)] overflow-y-auto"
              >
                <div className="p-4 space-y-6">
                  {formData.chart_type === 'map' ? (
                    <MapDataConfigurationV3
                      formData={formData}
                      onFormDataChange={handleFormChange}
                    />
                  ) : (
                    <>
                      <ChartDataConfigurationV3
                        formData={formData}
                        onChange={handleFormChange}
                        disabled={false}
                      />
                      {/* Table-specific column configuration with drill-down */}
                      {formData.chart_type === 'table' &&
                        formData.schema_name &&
                        formData.table_name &&
                        columns && (
                          <SimpleTableConfiguration
                            availableColumns={columns?.map((col) => col.name) || []}
                            columnTypes={
                              columns?.reduce(
                                (acc, col) => ({ ...acc, [col.name]: col.data_type }),
                                {}
                              ) || {}
                            }
                            selectedColumns={formData.table_columns || []}
                            onColumnsChange={(table_columns) => handleFormChange({ table_columns })}
                            drillDownConfig={formData.drill_down_config}
                            onDrillDownConfigChange={(drill_down_config) =>
                              handleFormChange({ drill_down_config })
                            }
                          />
                        )}
                    </>
                  )}
                </div>
              </TabsContent>

              {formData.chart_type !== 'table' && (
                <TabsContent value="styling" className="mt-0 flex-1 overflow-y-auto">
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

              <TabsContent value="chart" className="h-[calc(100%-73px)] overflow-y-auto relative">
                <div className="p-4 h-full relative">
                  {/* Configuration error toast - properly centered in chart area with working click */}
                  {errorToastVisible && (
                    <div
                      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-auto cursor-pointer"
                      style={{
                        zIndex: 9999,
                        width: '90%',
                        maxWidth: '24rem',
                      }}
                      onClick={handleDismissToast}
                    >
                      <Alert
                        variant="destructive"
                        className="shadow-2xl animate-in slide-in-from-top-2 duration-300 hover:shadow-3xl transition-all border-2 border-red-300 bg-red-50 cursor-pointer"
                      >
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          Please check the dataset or metric column to complete the chart
                          configuration
                          <div className="text-xs text-red-600 mt-2 font-medium">
                            ✕ Click to dismiss
                          </div>
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {/* Chart content area - always full size */}
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
                        onRegionClick={handleRegionClick}
                        drillDownPath={drillDownPath}
                        onDrillUp={handleDrillUp}
                        onDrillHome={handleDrillHome}
                      />
                    </div>
                  ) : formData.chart_type === 'table' ? (
                    <div className="w-full h-full overflow-auto">
                      <TableChart
                        data={Array.isArray(tableChartData?.data) ? tableChartData.data : []}
                        config={{
                          table_columns: tableChartData?.columns || formData.table_columns,
                          column_formatting: {},
                          sort: formData.sort,
                          pagination: formData.pagination || { enabled: true, page_size: 20 },
                          drill_down_config: formData.drill_down_config,
                        }}
                        isLoading={tableChartLoading}
                        error={tableChartError}
                        pagination={
                          chartDataPayload
                            ? {
                                page: tableChartPage,
                                pageSize: tableChartPageSize,
                                total: chartDataTotalRows || 0,
                                onPageChange: setTableChartPage,
                                onPageSizeChange: handleTableChartPageSizeChange,
                              }
                            : undefined
                        }
                        drillDownPath={tableDrillDownPath}
                        onDrillDown={handleTableDrillDown}
                        onDrillUp={handleTableDrillUp}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full">
                      <ChartPreview
                        key={`${formData.schema_name}-${formData.table_name}`}
                        config={chartData?.echarts_config || lastValidChartConfig}
                        isLoading={chartDataLoading}
                        error={null} // Error handled by toast
                        chartType={formData.chart_type}
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
                      className={`grid w-full ${formData.chart_type === 'table' ? 'grid-cols-1' : 'grid-cols-2'} flex-shrink-0`}
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
                      <TabsContent value="chart-data" className="flex-1 overflow-auto">
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

                    <TabsContent value="raw-data" className="flex-1 overflow-auto">
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
