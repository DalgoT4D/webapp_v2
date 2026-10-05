'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChartDataConfiguration } from '@/components/charts/ChartDataConfiguration';
import { ChartCustomizations } from '@/components/charts/ChartCustomizations';
import { MapDataConfiguration } from '@/components/charts/chart-types/map/MapDataConfiguration';
import { MapCustomizations } from '@/components/charts/chart-types/map/MapCustomizations';
import { useChart, useColumns } from '@/hooks/api/useChart';
import { ChartTypes, type ChartDataPayload } from '@/types/charts';
import { trackFeatureView } from '@/lib/analytics';
import { FEATURES } from '@/constants/analytics';
import { CHART_BUILDER_TAB_ANALYTICS } from '@/components/charts/utils';
import { getWidgetBackLabel } from '@/lib/widget-navigation';
import { canSaveChart } from '@/components/charts/logic/validation';
import { createEmptyEditConfig, toBuilderConfig } from '@/components/charts/logic/saved-chart';
import { useChartBuilderState } from '@/components/charts/hooks/useChartBuilderState';
import { usePreviewPagination } from '@/components/charts/hooks/usePreviewPagination';
import { useChartPreviewData } from '@/components/charts/hooks/useChartPreviewData';
import { useBuilderMapPreview } from '@/components/charts/hooks/useBuilderMapPreview';
import { useMapDrillDown } from '@/components/charts/hooks/useMapDrillDown';
import { useTableDrillDown } from '@/components/charts/hooks/useTableDrillDown';
import { useConfigIncompleteOverlay } from '@/components/charts/hooks/useConfigIncompleteOverlay';
import { useEditChartNavigation } from '@/components/charts/hooks/useEditChartNavigation';
import { useSaveExistingChart } from '@/components/charts/hooks/useSaveExistingChart';
import { buildChartDataPayload } from '@/components/charts/logic/payload';
import { useUnsavedChangesGuard } from '@/components/charts/hooks/useUnsavedChangesGuard';
import { ChartBuilderLayout } from '@/components/charts/builder/ChartBuilderLayout';
import { BuilderChartPanel } from '@/components/charts/builder/BuilderChartPanel';
import { BuilderDataPanel } from '@/components/charts/builder/BuilderDataPanel';
import { ConfigIncompleteOverlay } from '@/components/charts/builder/ConfigIncompleteOverlay';
import { EditChartHeader } from '@/components/charts/builder/EditChartHeader';
import { EditChartDialogs } from '@/components/charts/builder/EditChartDialogs';
import {
  EditChartAccessDenied,
  EditChartLoading,
  EditChartNotFound,
} from '@/components/charts/builder/EditChartStates';

function EditChartPageContent() {
  const params = useParams();
  const router = useRouter();
  const chartId = Number(params.id);
  const { data: chart, error: chartError, isLoading: chartLoading } = useChart(chartId);
  // Per-resource access — a member granted edit has chart.access_level === 'edit'
  // even without the role-level can_edit_charts slug. Backend enforces on save.
  const canEditThisChart = chart?.access_level === 'edit';

  // Every patch goes through the edit page's legacy second pass (applied by the reducer); a patch
  // that keeps the chart type is a plain merge. BUILDER-DRIFT: the create page merges type switches as is.
  const {
    config,
    savedConfig,
    hasUnsavedChanges,
    patchConfig,
    loadSavedChart,
    setSavedBaseline,
    markSaved,
  } = useChartBuilderState('edit', createEmptyEditConfig);

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

  const pages = usePreviewPagination('edit', config.pagination);

  // ✅ ADD: Drill-down state management for table charts
  const tableDrill = useTableDrillDown({
    dimensions: config.dimensions,
    isTable: config.chart_type === ChartTypes.TABLE,
    drillUpColumns: 'drillEnabled',
    onLevelChange: pages.resetTableChartPage,
  });

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isExitingAfterSave, setIsExitingAfterSave] = useState(false);

  // Update form data when chart loads
  useEffect(() => {
    if (chart) loadSavedChart(toBuilderConfig(chart));
  }, [chart, loadSavedChart]);

  // Chart missing and not loading: the empty config is the baseline (enables the unsaved check).
  useEffect(() => {
    if (!chart && !chartLoading && !savedConfig) setSavedBaseline(createEmptyEditConfig());
  }, [chart, chartLoading, savedConfig, setSavedBaseline]);

  const nav = useEditChartNavigation({ markSaved });
  const { navigationSource, hasNavigationSource, chartDetailUrl } = nav;

  // Browser leave warning (refresh, close tab, external links) + the exit / back leave dialogs.
  const guard = useUnsavedChangesGuard(hasUnsavedChanges);

  // Build payload for chart data - use useMemo to update when drill-down state changes
  const chartDataPayload: ChartDataPayload | null = useMemo(
    () => buildChartDataPayload(config, tableDrill.tableDrillDownState, 'edit'),
    [config, tableDrill.tableDrillDownState]
  );

  const preview = useChartPreviewData({
    config,
    payload: chartDataPayload,
    builder: 'edit',
    pages,
  });

  const overlay = useConfigIncompleteOverlay({
    config,
    chartDataLoading: preview.chartDataLoading,
    chartData: preview.chartData,
  });

  // Map drill-down (regions requests, region click, breadcrumbs). Runs after the preview-data
  // hook above; the requests are independent of each other.
  const mapDrill = useMapDrillDown(config, 'edit');
  const mapPreview = useBuilderMapPreview({
    config,
    builder: 'edit',
    drillDownPath: mapDrill.drillDownPath,
    chartId,
  });

  // Get all columns for raw data
  const { data: columns } = useColumns(config.schema_name || null, config.table_name || null);

  const { handleUpdateExisting, handleSaveAsNew, isMutating, isCreating } = useSaveExistingChart({
    chartId,
    config,
    savedConfig,
    markSaved,
    nav,
    isExitingAfterSave,
    setIsExitingAfterSave,
  });

  const isFormValid = () => canSaveChart(config);

  // Show save options dialog
  const handleSave = () => {
    if (!isFormValid()) {
      return;
    }
    // Make sure we're not in exit mode when using regular save
    setIsExitingAfterSave(false);
    setShowSaveDialog(true);
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      guard.askToLeave('back');
    } else if (hasNavigationSource) {
      router.back();
    } else {
      router.push(chartDetailUrl(chartId));
    }
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
      nav.navigateBackWithoutWarning();
    } else {
      router.push(chartDetailUrl(chartId));
    }
  };

  const handleConfirmBack = () => {
    guard.closeLeavePrompt();
    if (hasNavigationSource) {
      nav.navigateBackWithoutWarning();
    } else {
      nav.navigateWithoutWarning(chartDetailUrl(chartId));
    }
  };

  // Per-resource access denied — chart loaded but caller lacks edit on THIS chart.
  // (Gated after load so the loading skeleton doesn't briefly flash the denied UI.)
  if (!chartLoading && chart && !canEditThisChart) {
    return <EditChartAccessDenied onBack={() => router.push('/charts')} />;
  }

  if (chartLoading) {
    return <EditChartLoading />;
  }

  if (chartError || (!chart && !chartLoading && chartId && chartId > 0)) {
    return <EditChartNotFound hasError={!!chartError} />;
  }

  return (
    <ChartBuilderLayout
      builder="edit"
      header={
        <EditChartHeader
          backLabel={navigationSource ? getWidgetBackLabel(navigationSource) : 'Back'}
          title={config.title}
          onTitleChange={(title) => patchConfig({ title })}
          onBack={handleBack}
          onCancel={handleCancel}
          onSave={handleSave}
          canSave={isFormValid()}
          isBusy={isMutating || isCreating}
        />
      }
      onConfigTabChange={handleTabView}
      dataConfigPanel={
        config.chart_type === ChartTypes.MAP ? (
          <MapDataConfiguration formData={config} onFormDataChange={patchConfig} />
        ) : (
          <ChartDataConfiguration formData={config} onChange={patchConfig} disabled={false} />
        )
      }
      stylingPanel={
        config.chart_type === ChartTypes.MAP ? (
          <MapCustomizations formData={config} onFormDataChange={patchConfig} />
        ) : (
          <ChartCustomizations
            chartType={config.chart_type || ChartTypes.BAR}
            formData={config}
            onChange={patchConfig}
            columns={columns}
            currentDrillLevel={tableDrill.currentDrillLevel}
          />
        )
      }
      previewTab={activeTab}
      onPreviewTabChange={handlePreviewTabChange}
      chartOverlay={
        /* Configuration error toast - properly centered in chart area with working click */
        overlay.isVisible && <ConfigIncompleteOverlay onDismiss={overlay.dismiss} />
      }
      chartPanel={
        <BuilderChartPanel
          builder="edit"
          config={config}
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
        <BuilderDataPanel builder="edit" config={config} preview={preview} pages={pages} />
      }
      dialogs={
        <EditChartDialogs
          title={config.title}
          showSaveDialog={showSaveDialog}
          onSaveDialogChange={setShowSaveDialog}
          onSaveExisting={handleUpdateExisting}
          onSaveAsNew={handleSaveAsNew}
          isSaving={isMutating || isCreating}
          isMutating={isMutating}
          leaveTarget={guard.leaveTarget}
          onCloseLeavePrompt={guard.closeLeavePrompt}
          onSaveAndLeave={handleSaveAndLeave}
          onLeave={handleLeaveWithoutSaving}
          onStay={guard.closeLeavePrompt}
          onConfirmBack={handleConfirmBack}
        />
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
