'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import { ChartDataConfigurationV3 } from '@/components/charts/ChartDataConfigurationV3';
import { ChartCustomizations } from '@/components/charts/ChartCustomizations';
import { MapDataConfigurationV3 } from '@/components/charts/map/MapDataConfigurationV3';
import { MapCustomizations } from '@/components/charts/map/MapCustomizations';
import { UnsavedChangesExitDialog } from '@/components/charts/UnsavedChangesExitDialog';
import { useCreateChart, useColumns } from '@/hooks/api/useChart';
import { toastSuccess, toastError } from '@/lib/toast';
import { type ChartCreate, type ChartDataPayload, type ChartBuilderFormData } from '@/types/charts';
import { generateAutoPrefilledConfig } from '@/lib/chartAutoPrefill';
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
  getUsedSavedMetricIds,
  isDrillDownEnabled,
} from '@/components/charts/utils';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { DashboardNameHint } from '@/components/onboarding/dashboard-name-hint';
import { Label } from '@/components/ui/label';
import {
  isStageBefore,
  markChartCreated,
} from '@/components/onboarding/insight-walkthrough-constants';
import { getDefaultCustomizations } from '@/components/charts/chart-types/default-customizations';
import { canSaveChart } from '@/components/charts/logic/validation';
import { generateDefaultChartName } from '@/components/charts/logic/default-name';
import { hasExistingChartConfig } from '@/components/charts/logic/auto-prefill';
import { useChartBuilderState } from '@/components/charts/hooks/useChartBuilderState';
import { usePreviewPagination } from '@/components/charts/hooks/usePreviewPagination';
import { useChartPreviewData } from '@/components/charts/hooks/useChartPreviewData';
import { useBuilderMapPreview } from '@/components/charts/hooks/useBuilderMapPreview';
import { useMapDrillDown } from '@/components/charts/hooks/useMapDrillDown';
import { useTableDrillDown } from '@/components/charts/hooks/useTableDrillDown';
import { buildChartDataPayload, buildCreateChartPayload } from '@/components/charts/logic/payload';
import { useUnsavedChangesGuard } from '@/components/charts/hooks/useUnsavedChangesGuard';
import { ChartBuilderLayout } from '@/components/charts/builder/ChartBuilderLayout';
import { BuilderChartPanel } from '@/components/charts/builder/BuilderChartPanel';
import { BuilderDataPanel } from '@/components/charts/builder/BuilderDataPanel';

function ConfigureChartPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { trigger: createChart, isMutating } = useCreateChart();

  // Get parameters from URL
  const schema = searchParams.get('schema') || '';
  const table = searchParams.get('table') || '';
  const chartType = searchParams.get('type') || 'bar';
  const isFromDashboard = searchParams.get('from') === 'dashboard';

  const { config, hasUnsavedChanges, patchConfig, markSaved } = useChartBuilderState(
    'create',
    () => ({
      title: generateDefaultChartName(chartType, table),
      chart_type: chartType as ChartBuilderFormData['chart_type'],
      schema_name: schema,
      table_name: table,
      computation_type: 'aggregated',
      customizations: getDefaultCustomizations(chartType, 'create'),
      // Set default aggregate function to prevent API errors. PINNED-BUGS C-E7: edit starts with 'sum'.
      aggregate_function: 'count',
    })
  );
  const formData = config; // renamed in Task 9

  const [activeTab, setActiveTab] = useState('chart');
  const [configurationTab, setConfigurationTab] = useState('configuration');
  const walkthroughStage = useInsightWalkthroughStore((s) => s.stage);
  useEffect(() => {
    if (walkthroughStage === 'chart_data_config') setConfigurationTab('configuration');
    if (walkthroughStage === 'chart_styling') setConfigurationTab('styling');
  }, [walkthroughStage]);

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

  const pages = usePreviewPagination('create', formData.pagination);

  // ✅ ADD: Drill-down state management for table charts
  const tableDrill = useTableDrillDown({
    dimensions: formData.dimensions,
    isTable: formData.chart_type === 'table',
    drillUpColumns: 'all',
    onLevelChange: pages.resetTableChartPage,
  });

  // Map drill-down (regions requests, region click, breadcrumbs); same hook position as the old region fetches.
  const mapDrill = useMapDrillDown(formData, 'create');

  // Browser leave warning (refresh, close tab, external links) + the Back/Cancel leave dialog.
  const guard = useUnsavedChangesGuard(hasUnsavedChanges);

  // Build payload for chart data - memoized to prevent infinite re-render loops
  const chartDataPayload: ChartDataPayload | null = useMemo(
    () => buildChartDataPayload(formData, tableDrill.tableDrillDownState, 'create'),
    [formData, tableDrill.tableDrillDownState]
  );

  const preview = useChartPreviewData({
    config: formData,
    payload: chartDataPayload,
    builder: 'create',
    pages,
  });

  // Get all columns for raw data
  const { data: columns } = useColumns(formData.schema_name || null, formData.table_name || null);

  const handleFormChange = patchConfig;

  // BUILDER-DRIFT: the create page prefills here AND in ChartDataConfigurationV3 (raw vs normalized columns).
  // Auto-prefill when columns are loaded
  useEffect(() => {
    if (columns && formData.schema_name && formData.table_name && formData.chart_type) {
      // Check if we should auto-prefill (no existing configuration)
      if (!hasExistingChartConfig(formData)) {
        const autoConfig = generateAutoPrefilledConfig(formData.chart_type, columns);
        if (Object.keys(autoConfig).length > 0) {
          handleFormChange(autoConfig);
        }
      }
    }
  }, [columns, formData.schema_name, formData.table_name, formData.chart_type]);

  // Writes the map preview payloads into the config (the old page effect, same position/order).
  const mapPreview = useBuilderMapPreview({
    config: formData,
    builder: 'create',
    drillDownPath: mapDrill.drillDownPath,
    patchConfig,
  });

  const isFormValid = () => canSaveChart(formData);

  const handleSave = async () => {
    if (!isFormValid()) {
      return;
    }

    const chartData: ChartCreate = buildCreateChartPayload(formData);

    try {
      const result = await createChart(chartData);
      trackEvent(ANALYTICS_EVENTS.CHART_CREATED, {
        chart_type: chartData.chart_type,
        chart_id: result.id,
        // Entered from the dashboard builder vs the charts list — same page, very
        // different intent, so they get distinct sources rather than one 'new'.
        source: isFromDashboard
          ? CHART_CREATE_SOURCES.NEW_FROM_DASHBOARD
          : CHART_CREATE_SOURCES.NEW,
        ...getMetricAnalyticsProps(formData.metrics),
        drill_down_enabled: isDrillDownEnabled(formData),
      });
      // Charts are the main consumer of the metrics library — one METRIC_USED per
      // distinct saved metric, same as the KPI form does on its create path.
      getUsedSavedMetricIds(formData.metrics).forEach((metricId) => {
        // chart_id too — answers "which chart consumed this metric", not just how often.
        trackEvent(ANALYTICS_EVENTS.METRIC_USED, {
          metric_id: metricId,
          chart_id: result.id,
          source: METRIC_USE_SOURCES.CHART,
        });
      });
      // Reset unsaved changes state after successful save
      markSaved();
      toastSuccess.created('Chart');

      // Resume-nudge milestone — set regardless of an active coachmark session.
      markChartCreated();

      const walkthrough = useInsightWalkthroughStore.getState();
      // Saving the chart is the checkpoint, whatever hints were clicked past on the way here
      // (the two tab stages are read-this hints a user can skip straight over).
      if (
        walkthrough.active &&
        walkthrough.stage &&
        !isFromDashboard &&
        isStageBefore(walkthrough.path, walkthrough.stage, 'chart_dashboard_nudge')
      ) {
        // Hand the celebration to the chart's own page rather than showing it here: the user
        // should see the chart they just built behind the dialog, not the builder they're
        // leaving. The normal redirect below carries them there.
        walkthrough.setPendingCelebration('chart');
        // The next stage's coachmark points at the Dashboards nav item, which would otherwise
        // appear on the chart page underneath the dialog. Released when it closes, so the
        // nudge is what the user sees next.
        walkthrough.setSuppressCoachmark(true);
        walkthrough.advanceIfBefore('chart_dashboard_nudge');
      }

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
      guard.askToLeave(isFromDashboard ? 'back' : '/charts');
    } else if (isFromDashboard) {
      router.back();
    } else {
      router.push('/charts');
    }
  };

  const handleUnsavedChangesLeave = () => {
    const target = guard.leaveTarget;
    guard.closeLeavePrompt();
    if (target === 'back') {
      router.back();
    } else {
      router.push(target ?? '/charts');
    }
  };

  const handleUnsavedChangesSave = async () => {
    await handleSave();
    // handleSave will navigate away after successful save
  };

  const handleUnsavedChangesStay = () => {
    guard.closeLeavePrompt();
  };

  return (
    <ChartBuilderLayout
      builder="create"
      header={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back Button */}
            <Button
              data-testid="chart-create-back-button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (hasUnsavedChanges) {
                  guard.askToLeave(isFromDashboard ? 'back' : '/charts/new');
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
            <div className="space-y-1">
              <Label htmlFor="chart-name" className="flex items-center gap-2">
                Chart name
                <DashboardNameHint id="chart-name-guidance" />
              </Label>
              <Input
                id="chart-name"
                data-testid="chart-name-input"
                aria-describedby="chart-name-guidance"
                value={formData.title}
                onChange={(e) => handleFormChange({ title: e.target.value })}
                className="h-11 min-w-[300px] border border-gray-200 bg-white px-4 py-2 text-lg font-semibold shadow-sm"
                placeholder="Untitled Chart"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              data-testid="chart-edit-save-button"
              onClick={handleSave}
              variant="primary"
              disabled={!isFormValid() || isMutating}
              className="px-8 h-11"
            >
              {isMutating ? 'Saving...' : 'Save Chart'}
            </Button>
          </div>
        </div>
      }
      configTabValue={configurationTab}
      onConfigTabChange={(value) => {
        setConfigurationTab(value);
        handleTabView(value);
      }}
      dataConfigPanel={
        formData.chart_type === 'map' ? (
          <MapDataConfigurationV3 formData={formData} onFormDataChange={handleFormChange} />
        ) : (
          <ChartDataConfigurationV3
            formData={formData}
            onChange={handleFormChange}
            disabled={false}
            isNewChart
          />
        )
      }
      stylingPanel={
        formData.chart_type === 'map' ? (
          <MapCustomizations formData={formData} onFormDataChange={handleFormChange} />
        ) : (
          <ChartCustomizations
            chartType={formData.chart_type || 'bar'}
            formData={formData}
            onChange={handleFormChange}
            columns={columns}
            currentDrillLevel={tableDrill.currentDrillLevel}
          />
        )
      }
      previewTab={activeTab}
      onPreviewTabChange={handlePreviewTabChange}
      chartPanel={
        <BuilderChartPanel
          builder="create"
          config={formData}
          map={{ ...mapPreview, ...mapDrill }}
          table={{
            drill: tableDrill,
            data: preview.tableChartData,
            isLoading: preview.tableChartLoading,
            error: preview.tableChartError,
            page: pages.tableChart,
            total: preview.tableChartTotalRows || 0,
            showPagination: true,
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
        <BuilderDataPanel builder="create" config={formData} preview={preview} pages={pages} />
      }
      dialogs={
        /* Unsaved Changes Dialog */
        <UnsavedChangesExitDialog
          open={guard.leaveTarget !== null}
          onOpenChange={(open) => !open && guard.closeLeavePrompt()}
          onSave={handleUnsavedChangesSave}
          onLeave={handleUnsavedChangesLeave}
          onStay={handleUnsavedChangesStay}
          isSaving={isMutating}
        />
      }
    />
  );
}

export default function ConfigureChartPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfigureChartPageContent />
    </Suspense>
  );
}
