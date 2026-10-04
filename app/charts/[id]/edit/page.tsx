'use client';

import { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, BarChart3, Lock, ArrowLeft } from 'lucide-react';
import { ChartDataConfigurationV3 } from '@/components/charts/ChartDataConfigurationV3';
import { ChartCustomizations } from '@/components/charts/ChartCustomizations';
import { ChartPreview } from '@/components/charts/ChartPreview';
import { DataPreview } from '@/components/charts/DataPreview';
import { TableChart } from '@/components/charts/TableChart';
import { MapDataConfigurationV3 } from '@/components/charts/map/MapDataConfigurationV3';
import { MapCustomizations } from '@/components/charts/map/MapCustomizations';
import { MapPreview } from '@/components/charts/map/MapPreview';
import { SaveOptionsDialog } from '@/components/charts/SaveOptionsDialog';
import { UnsavedChangesExitDialog } from '@/components/charts/UnsavedChangesExitDialog';
import {
  useChart,
  useUpdateChart,
  useCreateChart,
  useColumns,
  useRegions,
  useChildRegions,
} from '@/hooks/api/useChart';
import { toastSuccess, toastError } from '@/lib/toast';
import { ChartTypes } from '@/types/charts';
import { mergeTableColumnFormatting, resolveTableColumnOrder } from '@/lib/chart-payload-utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { trackEvent, trackFeatureView } from '@/lib/analytics';
import {
  ANALYTICS_EVENTS,
  CHART_CREATE_SOURCES,
  FEATURES,
  METRIC_USE_SOURCES,
} from '@/constants/analytics';
import {
  CHART_BUILDER_TAB_ANALYTICS,
  getMetricAnalyticsProps,
  getNewlyUsedSavedMetricIds,
  getUsedSavedMetricIds,
  isDrillDownEnabled,
} from '@/components/charts/utils';
import type { ChartCreate, ChartUpdate, ChartDataPayload } from '@/types/charts';
import {
  getChartViewUrl,
  getWidgetBackLabel,
  parseWidgetNavigationSource,
} from '@/lib/widget-navigation';
import { canSaveChart, isChartReady } from '@/components/charts/logic/validation';
import { createEmptyEditConfig, toBuilderConfig } from '@/components/charts/logic/saved-chart';
import { useChartBuilderState } from '@/components/charts/hooks/useChartBuilderState';
import { usePreviewPagination } from '@/components/charts/hooks/usePreviewPagination';
import { useChartPreviewData } from '@/components/charts/hooks/useChartPreviewData';
import { useBuilderMapPreview } from '@/components/charts/hooks/useBuilderMapPreview';
import { useTableDrillDown } from '@/components/charts/hooks/useTableDrillDown';
import { getDrillDownColumns } from '@/components/charts/logic/table-drilldown';
import { buildChartDataPayload, buildEditChartPayload } from '@/components/charts/logic/payload';

function EditChartPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const navigationSource = parseWidgetNavigationSource(searchParams.get('from'));
  const hasNavigationSource = navigationSource !== null;
  const chartId = Number(params.id);
  const { data: chart, error: chartError, isLoading: chartLoading } = useChart(chartId);
  // Per-resource access — a member granted edit has chart.access_level === 'edit'
  // even without the role-level can_edit_charts slug. Backend enforces on save.
  const canEditThisChart = chart?.access_level === 'edit';
  const { trigger: updateChart, isMutating } = useUpdateChart();
  const { trigger: createChart, isMutating: isCreating } = useCreateChart();

  const {
    config,
    savedConfig,
    hasUnsavedChanges,
    patchConfig,
    loadSavedChart,
    setSavedBaseline,
    markSaved,
  } = useChartBuilderState('edit', createEmptyEditConfig);
  const formData = config; // renamed in Task 9

  const [activeTab, setActiveTab] = useState('chart');

  // Builder tabs are local state, so `feature:viewed` doesn't fire on switch —
  // report them explicitly. Fires on every switch (not once), so this answers
  // "did they ever open Chart Styling", not "how many times".
  const handleTabView = (tabValue: string) => {
    trackFeatureView(FEATURES.CHARTS, { tab: CHART_BUILDER_TAB_ANALYTICS[tabValue] ?? tabValue });
  };

  const handlePreviewTabChange = (tabValue: string) => {
    setActiveTab(tabValue);
    handleTabView(tabValue);
  };

  const pages = usePreviewPagination('edit', formData.pagination);

  // ✅ ADD: Drill-down state management for table charts
  const tableDrill = useTableDrillDown({
    dimensions: formData.dimensions,
    isTable: formData.chart_type === ChartTypes.TABLE,
    drillUpColumns: 'drillEnabled',
    onLevelChange: pages.resetTableChartPage,
  });

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

  // Update form data when chart loads
  useEffect(() => {
    if (chart) loadSavedChart(toBuilderConfig(chart));
  }, [chart, loadSavedChart]);

  // Chart missing and not loading: the empty config is the baseline (enables the unsaved check).
  useEffect(() => {
    if (!chart && !chartLoading && !savedConfig) setSavedBaseline(createEmptyEditConfig());
  }, [chart, chartLoading, savedConfig, setSavedBaseline]);

  const navigateWithoutWarning = useCallback(
    (url: string) => {
      markSaved(); // Mark as saved
      router.push(url);
    },
    [router, markSaved]
  );

  const navigateBackWithoutWarning = useCallback(() => {
    markSaved(); // Mark as saved
    router.back();
  }, [router, markSaved]);

  const navigateReplaceWithoutWarning = useCallback(
    (url: string) => {
      markSaved(); // Mark as saved
      router.replace(url);
    },
    [router, markSaved]
  );

  // Preserve dashboard/report context while moving between detail and edit.
  const chartDetailUrl = useCallback(
    (id: number | string) => {
      return getChartViewUrl(id, navigationSource);
    },
    [navigationSource]
  );

  // Replace for dashboard/report origins to keep the source as the previous history entry.
  const navigateToChartDetail = useCallback(
    (id: number | string) => {
      if (hasNavigationSource) {
        navigateReplaceWithoutWarning(chartDetailUrl(id));
      } else {
        navigateWithoutWarning(chartDetailUrl(id));
      }
    },
    [hasNavigationSource, navigateReplaceWithoutWarning, navigateWithoutWarning, chartDetailUrl]
  );

  // Navigate back to the originating dashboard/report after exit-save.
  const navigateToOrigin = useCallback(() => {
    if (hasNavigationSource) {
      navigateBackWithoutWarning();
    } else {
      navigateWithoutWarning('/charts');
    }
  }, [hasNavigationSource, navigateBackWithoutWarning, navigateWithoutWarning]);

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
  const isChartDataReady = () => isChartReady(formData, 'edit');

  // Build payload for chart data - use useMemo to update when drill-down state changes
  const chartDataPayload: ChartDataPayload | null = useMemo(
    () => buildChartDataPayload(formData, tableDrill.tableDrillDownState, 'edit'),
    [formData, tableDrill.tableDrillDownState]
  );

  const preview = useChartPreviewData({
    config: formData,
    payload: chartDataPayload,
    builder: 'edit',
    pages,
  });

  // Reset dismiss state when form configuration changes
  useEffect(() => {
    setErrorToastDismissed(false);
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
      formData.chart_type !== ChartTypes.MAP &&
      formData.chart_type !== ChartTypes.TABLE;
    const shouldShowToast = isConfigIncomplete && !preview.chartDataLoading && !errorToastDismissed;

    if (shouldShowToast && !errorToastVisible) {
      setErrorToastVisible(true);
    } else if (!isConfigIncomplete && errorToastVisible) {
      setErrorToastVisible(false);
    }
  }, [
    formData,
    preview.chartData,
    preview.chartDataLoading,
    isChartDataReady,
    errorToastVisible,
    errorToastDismissed,
  ]);

  // Handle manual toast dismissal
  const handleDismissToast = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setErrorToastVisible(false);
    setErrorToastDismissed(true);
  };

  // Drill-down functionality for maps - fetch regions
  const countryCode = 'IND'; // TODO: make this dynamic based on selected geojson
  const { data: states } = useRegions(countryCode, 'state');
  const { data: districts } = useChildRegions(
    drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1].region_id : null,
    drillDownPath.length > 0
  );
  const mapPreview = useBuilderMapPreview({
    config: formData,
    builder: 'edit',
    drillDownPath,
    chartId,
  });

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

  // Every patch goes through the edit page's legacy second pass (applied by the reducer); a patch
  // that keeps the chart type is a plain merge. BUILDER-DRIFT: the create page merges type switches as is.
  const handleFormChange = patchConfig;

  const isFormValid = () => canSaveChart(formData);

  // Helper to build chart data from form
  const buildChartData = (): ChartCreate => buildEditChartPayload(formData);

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
      trackEvent(ANALYTICS_EVENTS.CHART_UPDATED, {
        chart_type: chartData.chart_type,
        chart_id: chartId,
        ...getMetricAnalyticsProps(formData.metrics),
        drill_down_enabled: isDrillDownEnabled(formData),
      });
      // Only metrics this edit newly attached — otherwise every re-save of an
      // unchanged chart would re-report the same metrics as freshly used.
      getNewlyUsedSavedMetricIds(formData.metrics, savedConfig?.metrics).forEach((metricId) => {
        trackEvent(ANALYTICS_EVENTS.METRIC_USED, {
          metric_id: metricId,
          chart_id: chartId,
          source: METRIC_USE_SOURCES.CHART,
        });
      });

      // Update original data to reflect saved state
      markSaved();

      toastSuccess.updated('Chart');

      if (isExitingAfterSave) {
        setIsExitingAfterSave(false);
        navigateToOrigin();
      } else {
        navigateToChartDetail(chartId);
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
      // Save-as-new creates a chart, so it fires CHART_CREATED like every other
      // create path — `source` is what distinguishes it.
      trackEvent(ANALYTICS_EVENTS.CHART_CREATED, {
        chart_type: newChartData.chart_type,
        chart_id: result.id,
        source: CHART_CREATE_SOURCES.SAVE_AS_NEW,
        ...getMetricAnalyticsProps(formData.metrics),
        drill_down_enabled: isDrillDownEnabled(formData),
      });
      getUsedSavedMetricIds(formData.metrics).forEach((metricId) => {
        trackEvent(ANALYTICS_EVENTS.METRIC_USED, {
          metric_id: metricId,
          chart_id: result.id,
          source: METRIC_USE_SOURCES.CHART,
        });
      });

      toastSuccess.created(`Chart "${newTitle}"`);

      if (isExitingAfterSave) {
        setIsExitingAfterSave(false);
        navigateToOrigin();
      } else {
        navigateToChartDetail(result.id);
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
    } else if (hasNavigationSource) {
      router.back();
    } else {
      router.push(chartDetailUrl(chartId));
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
    if (hasNavigationSource) {
      navigateBackWithoutWarning();
    } else {
      router.push(chartDetailUrl(chartId));
    }
  };

  const handleStayOnPage = () => {
    setShowExitDialog(false);
  };

  // Per-resource access denied — chart loaded but caller lacks edit on THIS chart.
  // (Gated after load so the loading skeleton doesn't briefly flash the denied UI.)
  if (!chartLoading && chart && !canEditThisChart) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">You don't have edit access to this chart.</p>
          <Button
            variant="outline"
            onClick={() => router.push('/charts')}
            data-testid="chart-edit-access-denied-back-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Charts
          </Button>
        </div>
      </div>
    );
  }

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
              data-testid="chart-edit-back-button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (hasUnsavedChanges) {
                  setUnsavedChangesDialog({
                    open: true,
                    onConfirm: () => {
                      setUnsavedChangesDialog({
                        open: false,
                        onConfirm: () => {},
                        onCancel: () => {},
                      });
                      if (hasNavigationSource) {
                        navigateBackWithoutWarning();
                      } else {
                        navigateWithoutWarning(chartDetailUrl(chartId));
                      }
                    },
                    onCancel: () => {
                      setUnsavedChangesDialog({
                        open: false,
                        onConfirm: () => {},
                        onCancel: () => {},
                      });
                    },
                  });
                } else if (hasNavigationSource) {
                  router.back();
                } else {
                  router.push(chartDetailUrl(chartId));
                }
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {navigationSource ? getWidgetBackLabel(navigationSource) : 'Back'}
            </Button>

            {/* Chart Title Input */}
            <Input
              data-testid="chart-name-input"
              value={formData.title}
              onChange={(e) => handleFormChange({ title: e.target.value })}
              className="text-lg font-semibold border border-gray-200 shadow-sm px-4 py-2 h-11 bg-white min-w-[300px]"
              placeholder="Untitled Chart"
            />
          </div>

          <div className="flex items-center gap-4">
            <Button
              data-testid="chart-edit-cancel-button"
              variant="cancel"
              onClick={handleCancel}
              disabled={isMutating || isCreating}
              className="px-8 h-11"
            >
              Cancel
            </Button>
            <Button
              data-testid="chart-edit-save-button"
              onClick={handleSave}
              variant="primary"
              disabled={!isFormValid() || isMutating || isCreating}
              className="px-8 h-11"
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
            <Tabs defaultValue="configuration" onValueChange={handleTabView} className="h-full">
              <div className="px-4 pt-4">
                <TabsList className="grid w-full h-11 grid-cols-2" data-testid="chart-config-tabs">
                  <TabsTrigger
                    value="configuration"
                    className="flex items-center justify-center gap-2 text-sm h-full"
                    data-testid="chart-data-config-tab"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Data Configuration
                  </TabsTrigger>
                  <TabsTrigger
                    value="styling"
                    className="flex items-center justify-center gap-2 text-sm h-full"
                    data-testid="chart-styling-tab"
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
                  {formData.chart_type === ChartTypes.MAP ? (
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

              <TabsContent value="styling" className="mt-0 flex-1 overflow-y-auto">
                <div className="p-4">
                  {formData.chart_type === ChartTypes.MAP ? (
                    <MapCustomizations formData={formData} onFormDataChange={handleFormChange} />
                  ) : (
                    <ChartCustomizations
                      chartType={formData.chart_type || ChartTypes.BAR}
                      formData={formData}
                      onChange={handleFormChange}
                      columns={columns}
                      currentDrillLevel={tableDrill.currentDrillLevel}
                    />
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Panel - 70% */}
          <div className="w-[70%]">
            <Tabs value={activeTab} onValueChange={handlePreviewTabChange} className="h-full">
              <div className="px-4">
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger
                    value="chart"
                    className="flex items-center gap-2"
                    data-testid="chart-preview-tab-chart"
                  >
                    <BarChart3 className="h-4 w-4" />
                    CHART
                  </TabsTrigger>
                  <TabsTrigger
                    value="data"
                    className="flex items-center gap-2"
                    data-testid="chart-preview-tab-data"
                  >
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
                      data-testid="chart-config-incomplete-overlay"
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
                  {formData.chart_type === ChartTypes.MAP ? (
                    <div className="w-full h-full">
                      <MapPreview
                        geojsonData={mapPreview.geojsonData?.geojson_data}
                        geojsonLoading={mapPreview.geojsonLoading}
                        geojsonError={mapPreview.geojsonError}
                        mapData={mapPreview.mapDataOverlay?.data}
                        mapDataLoading={mapPreview.mapDataLoading}
                        mapDataError={mapPreview.mapDataError}
                        valueColumn={formData.metrics?.[0]?.alias || formData.aggregate_column}
                        customizations={formData.customizations}
                        onRegionClick={handleRegionClick}
                        drillDownPath={drillDownPath}
                        onDrillUp={handleDrillUp}
                        onDrillHome={handleDrillHome}
                      />
                    </div>
                  ) : formData.chart_type === ChartTypes.TABLE ? (
                    <div className="w-full h-full flex flex-col">
                      {/* Breadcrumb navigation for drill-down */}
                      {tableDrill.tableDrillDownState && (
                        <div className="px-4 py-2 border-b bg-gray-50 flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={tableDrill.handleTableDrillUp}
                            className="h-8"
                            data-testid="chart-table-drill-back-btn"
                          >
                            ← Back
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            {Object.entries(tableDrill.tableDrillDownState.appliedFilters)
                              .map(([col, val]) => `${col}: ${val}`)
                              .join(' → ')}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 overflow-hidden">
                        <TableChart
                          data={
                            Array.isArray(preview.tableChartData?.data)
                              ? preview.tableChartData.data
                              : []
                          }
                          config={{
                            table_columns: resolveTableColumnOrder({
                              cols: preview.tableChartData?.columns || formData.table_columns || [],
                              savedOrder: formData.customizations?.columnOrder,
                              drillDownDimensions: getDrillDownColumns(formData.dimensions),
                              currentDimensionColumn: tableDrill.currentDimensionColumn,
                            }),
                            column_formatting: mergeTableColumnFormatting(formData.customizations),
                            sort: formData.sort,
                            pagination: formData.pagination || { enabled: true, page_size: 20 },
                            conditionalFormatting:
                              formData.customizations?.conditionalFormatting || [],
                            columnAlignment: formData.customizations?.columnAlignment || {},
                            zebraRows: formData.customizations?.zebraRows ?? true,
                            freezeFirstColumn: formData.customizations?.freezeFirstColumn || false,
                            theme: formData.customizations?.theme,
                          }}
                          isLoading={preview.tableChartLoading}
                          error={preview.tableChartError}
                          pagination={
                            chartDataPayload
                              ? {
                                  page: pages.tableChart.page,
                                  pageSize: pages.tableChart.pageSize,
                                  total: preview.chartDataTotalRows || 0,
                                  onPageChange: pages.tableChart.setPage,
                                  onPageSizeChange: pages.tableChart.changePageSize,
                                }
                              : undefined
                          }
                          onRowClick={tableDrill.handleTableRowClick}
                          drillDownEnabled={tableDrill.isDrillDownEnabled}
                          currentDimensionColumn={tableDrill.currentDimensionColumn}
                          currentDrillLevel={tableDrill.currentDrillLevel}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full">
                      <ChartPreview
                        key={`${formData.schema_name}-${formData.table_name}`}
                        config={
                          formData.chart_type === 'pivot_table'
                            ? { extra_config: formData.extra_config }
                            : preview.chartData?.echarts_config || preview.lastValidChartConfig
                        }
                        tableData={
                          formData.chart_type === 'pivot_table'
                            ? preview.chartData?.data
                            : undefined
                        }
                        isLoading={preview.chartDataLoading}
                        error={null} // Error handled by toast
                        chartType={formData.chart_type}
                        customizations={formData.customizations}
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="data" className="h-[calc(100%-73px)] overflow-hidden">
                <div className="p-4 h-full">
                  <Tabs
                    defaultValue={
                      formData.chart_type === ChartTypes.TABLE ||
                      formData.chart_type === ChartTypes.PIVOT_TABLE
                        ? 'raw-data'
                        : 'chart-data'
                    }
                    className="h-full flex flex-col"
                  >
                    <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                      <TabsTrigger
                        value="chart-data"
                        className="flex items-center gap-2"
                        data-testid="chart-data-tab-chart-data"
                      >
                        <BarChart3 className="h-4 w-4" />
                        Chart Data
                      </TabsTrigger>
                      <TabsTrigger
                        value="raw-data"
                        className="flex items-center gap-2"
                        data-testid="chart-data-tab-raw-data"
                      >
                        <Database className="h-4 w-4" />
                        Raw Data
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="chart-data" className="flex-1 overflow-auto">
                      {formData.chart_type === ChartTypes.PIVOT_TABLE ? (
                        <ChartPreview
                          config={{ extra_config: formData.extra_config }}
                          tableData={preview.chartData?.data}
                          isLoading={preview.chartDataLoading}
                          error={null}
                          chartType={formData.chart_type}
                          customizations={formData.customizations}
                        />
                      ) : (
                        <DataPreview
                          data={
                            Array.isArray(preview.dataPreview?.data) ? preview.dataPreview.data : []
                          }
                          columns={preview.dataPreview?.columns || []}
                          columnTypes={preview.dataPreview?.column_types || {}}
                          isLoading={preview.previewLoading}
                          error={preview.previewError}
                          pagination={{
                            page: pages.dataPreview.page,
                            pageSize: pages.dataPreview.pageSize,
                            total: preview.chartDataTotalRows || 0,
                            onPageChange: pages.dataPreview.setPage,
                            onPageSizeChange: pages.dataPreview.changePageSize,
                          }}
                        />
                      )}
                    </TabsContent>

                    <TabsContent value="raw-data" className="flex-1 overflow-auto">
                      <DataPreview
                        data={Array.isArray(preview.rawTableData) ? preview.rawTableData : []}
                        columns={
                          preview.rawTableData && preview.rawTableData.length > 0
                            ? Object.keys(preview.rawTableData[0])
                            : []
                        }
                        columnTypes={{}}
                        isLoading={preview.rawDataLoading}
                        error={preview.rawDataError}
                        pagination={
                          preview.tableCount
                            ? {
                                page: pages.rawData.page,
                                pageSize: pages.rawData.pageSize,
                                total: preview.tableCount.total_rows || 0,
                                onPageChange: pages.rawData.setPage,
                                onPageSizeChange: pages.rawData.changePageSize,
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
        originalTitle={formData.title || ''}
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
        testIdPrefix="chart-edit-leave-confirm"
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
