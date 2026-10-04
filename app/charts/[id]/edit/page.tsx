'use client';

import { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, ArrowLeft } from 'lucide-react';
import { ChartDataConfigurationV3 } from '@/components/charts/ChartDataConfigurationV3';
import { ChartCustomizations } from '@/components/charts/ChartCustomizations';
import { MapDataConfigurationV3 } from '@/components/charts/map/MapDataConfigurationV3';
import { MapCustomizations } from '@/components/charts/map/MapCustomizations';
import { SaveOptionsDialog } from '@/components/charts/SaveOptionsDialog';
import { UnsavedChangesExitDialog } from '@/components/charts/UnsavedChangesExitDialog';
import { useChart, useUpdateChart, useCreateChart, useColumns } from '@/hooks/api/useChart';
import { toastSuccess, toastError } from '@/lib/toast';
import { ChartTypes } from '@/types/charts';
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
import { useMapDrillDown } from '@/components/charts/hooks/useMapDrillDown';
import { useTableDrillDown } from '@/components/charts/hooks/useTableDrillDown';
import { buildChartDataPayload, buildEditChartPayload } from '@/components/charts/logic/payload';
import { useUnsavedChangesGuard } from '@/components/charts/hooks/useUnsavedChangesGuard';
import { ChartBuilderLayout } from '@/components/charts/builder/ChartBuilderLayout';
import { BuilderChartPanel } from '@/components/charts/builder/BuilderChartPanel';
import { BuilderDataPanel } from '@/components/charts/builder/BuilderDataPanel';

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
  const [isExitingAfterSave, setIsExitingAfterSave] = useState(false);
  const [errorToastVisible, setErrorToastVisible] = useState(false);
  const [errorToastDismissed, setErrorToastDismissed] = useState(false);

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

  // Browser leave warning (refresh, close tab, external links) + the exit / back leave dialogs.
  const guard = useUnsavedChangesGuard(hasUnsavedChanges);

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

  // Map drill-down (regions requests, region click, breadcrumbs); same hook position as the old region fetches.
  const mapDrill = useMapDrillDown(formData, 'edit');
  const mapPreview = useBuilderMapPreview({
    config: formData,
    builder: 'edit',
    drillDownPath: mapDrill.drillDownPath,
    chartId,
  });

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
      guard.askToLeave('exit');
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
    guard.closeLeavePrompt();
    setShowSaveDialog(true);
  };

  const handleLeaveWithoutSaving = () => {
    guard.closeLeavePrompt();
    if (hasNavigationSource) {
      navigateBackWithoutWarning();
    } else {
      router.push(chartDetailUrl(chartId));
    }
  };

  const handleStayOnPage = () => {
    guard.closeLeavePrompt();
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
    <ChartBuilderLayout
      builder="edit"
      header={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back Button */}
            <Button
              data-testid="chart-edit-back-button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (hasUnsavedChanges) {
                  guard.askToLeave('back');
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
      }
      onConfigTabChange={handleTabView}
      dataConfigPanel={
        formData.chart_type === ChartTypes.MAP ? (
          <MapDataConfigurationV3 formData={formData} onFormDataChange={handleFormChange} />
        ) : (
          <ChartDataConfigurationV3
            formData={formData}
            onChange={handleFormChange}
            disabled={false}
          />
        )
      }
      stylingPanel={
        formData.chart_type === ChartTypes.MAP ? (
          <MapCustomizations formData={formData} onFormDataChange={handleFormChange} />
        ) : (
          <ChartCustomizations
            chartType={formData.chart_type || ChartTypes.BAR}
            formData={formData}
            onChange={handleFormChange}
            columns={columns}
            currentDrillLevel={tableDrill.currentDrillLevel}
          />
        )
      }
      previewTab={activeTab}
      onPreviewTabChange={handlePreviewTabChange}
      chartOverlay={
        /* Configuration error toast - properly centered in chart area with working click */
        errorToastVisible && (
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
                Please check the dataset or metric column to complete the chart configuration
                <div className="text-xs text-red-600 mt-2 font-medium">✕ Click to dismiss</div>
              </AlertDescription>
            </Alert>
          </div>
        )
      }
      chartPanel={
        <BuilderChartPanel
          builder="edit"
          config={formData}
          map={{ ...mapPreview, ...mapDrill }}
          table={{
            drill: tableDrill,
            data: preview.tableChartData,
            isLoading: preview.tableChartLoading,
            error: preview.tableChartError,
            page: pages.tableChart,
            total: preview.chartDataTotalRows || 0,
            showPagination: !!chartDataPayload,
          }}
          chart={{
            data: preview.chartData,
            isLoading: preview.chartDataLoading,
            error: preview.chartDataError,
            lastValidConfig: preview.lastValidChartConfig,
          }}
        />
      }
      dataPanel={
        <BuilderDataPanel builder="edit" config={formData} preview={preview} pages={pages} />
      }
      dialogs={
        <>
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
            open={guard.leaveTarget === 'exit'}
            onOpenChange={(open) => !open && guard.closeLeavePrompt()}
            onSave={handleSaveAndLeave}
            onLeave={handleLeaveWithoutSaving}
            onStay={handleStayOnPage}
            isSaving={isMutating}
          />

          {/* Unsaved Changes Dialog (for the Back button) */}
          <ConfirmationDialog
            open={guard.leaveTarget === 'back'}
            onOpenChange={(open) => !open && guard.closeLeavePrompt()}
            title="Unsaved Changes"
            description="You have unsaved changes. Are you sure you want to leave without saving?"
            confirmText="Leave Without Saving"
            cancelText="Cancel"
            type="warning"
            testIdPrefix="chart-edit-leave-confirm"
            onConfirm={() => {
              guard.closeLeavePrompt();
              if (hasNavigationSource) {
                navigateBackWithoutWarning();
              } else {
                navigateWithoutWarning(chartDetailUrl(chartId));
              }
            }}
            onCancel={guard.closeLeavePrompt}
          />
        </>
      }
    />
  );
}

export default function EditChartPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EditChartPageContent />
    </Suspense>
  );
}
