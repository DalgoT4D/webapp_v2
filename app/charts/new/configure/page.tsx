'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChartDataConfigurationV3 } from '@/components/charts/ChartDataConfigurationV3';
import { ChartCustomizations } from '@/components/charts/ChartCustomizations';
import { MapDataConfigurationV3 } from '@/components/charts/map/MapDataConfigurationV3';
import { MapCustomizations } from '@/components/charts/map/MapCustomizations';
import { UnsavedChangesExitDialog } from '@/components/charts/UnsavedChangesExitDialog';
import { useColumns } from '@/hooks/api/useChart';
import { type ChartDataPayload, type ChartBuilderFormData } from '@/types/charts';
import { generateAutoPrefilledConfig } from '@/lib/chartAutoPrefill';
import { trackFeatureView } from '@/lib/analytics';
import { FEATURES } from '@/constants/analytics';
import { CHART_BUILDER_TAB_ANALYTICS } from '@/components/charts/utils';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
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
import { useSaveNewChart } from '@/components/charts/hooks/useSaveNewChart';
import { buildChartDataPayload } from '@/components/charts/logic/payload';
import { useUnsavedChangesGuard } from '@/components/charts/hooks/useUnsavedChangesGuard';
import { ChartBuilderLayout } from '@/components/charts/builder/ChartBuilderLayout';
import { BuilderChartPanel } from '@/components/charts/builder/BuilderChartPanel';
import { BuilderDataPanel } from '@/components/charts/builder/BuilderDataPanel';
import { CreateChartHeader } from '@/components/charts/builder/CreateChartHeader';

function ConfigureChartPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const pages = usePreviewPagination('create', config.pagination);

  // ✅ ADD: Drill-down state management for table charts
  const tableDrill = useTableDrillDown({
    dimensions: config.dimensions,
    isTable: config.chart_type === 'table',
    drillUpColumns: 'all',
    onLevelChange: pages.resetTableChartPage,
  });

  // Map drill-down (regions requests, region click, breadcrumbs); same hook position as the old region fetches.
  const mapDrill = useMapDrillDown(config, 'create');

  // Browser leave warning (refresh, close tab, external links) + the Back/Cancel leave dialog.
  const guard = useUnsavedChangesGuard(hasUnsavedChanges);

  // Build payload for chart data - memoized to prevent infinite re-render loops
  const chartDataPayload: ChartDataPayload | null = useMemo(
    () => buildChartDataPayload(config, tableDrill.tableDrillDownState, 'create'),
    [config, tableDrill.tableDrillDownState]
  );

  const preview = useChartPreviewData({
    config,
    payload: chartDataPayload,
    builder: 'create',
    pages,
  });

  // Get all columns for raw data
  const { data: columns } = useColumns(config.schema_name || null, config.table_name || null);

  // BUILDER-DRIFT: the create page prefills here AND in ChartDataConfigurationV3 (raw vs normalized columns).
  // Auto-prefill when columns are loaded
  useEffect(() => {
    if (columns && config.schema_name && config.table_name && config.chart_type) {
      // Check if we should auto-prefill (no existing configuration)
      if (!hasExistingChartConfig(config)) {
        const autoConfig = generateAutoPrefilledConfig(config.chart_type, columns);
        if (Object.keys(autoConfig).length > 0) {
          patchConfig(autoConfig);
        }
      }
    }
  }, [columns, config.schema_name, config.table_name, config.chart_type]);

  // Writes the map preview payloads into the config (the old page effect, same position/order).
  const mapPreview = useBuilderMapPreview({
    config,
    builder: 'create',
    drillDownPath: mapDrill.drillDownPath,
    patchConfig,
  });

  const { handleSave, isMutating } = useSaveNewChart({ config, isFromDashboard, markSaved });

  const handleBack = () => {
    if (hasUnsavedChanges) {
      guard.askToLeave(isFromDashboard ? 'back' : '/charts/new');
    } else if (isFromDashboard) {
      router.back();
    } else {
      router.push('/charts/new');
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
        <CreateChartHeader
          isFromDashboard={isFromDashboard}
          title={config.title}
          onTitleChange={(title) => patchConfig({ title })}
          onBack={handleBack}
          onSave={handleSave}
          canSave={canSaveChart(config)}
          isSaving={isMutating}
        />
      }
      configTabValue={configurationTab}
      onConfigTabChange={(value) => {
        setConfigurationTab(value);
        handleTabView(value);
      }}
      dataConfigPanel={
        config.chart_type === 'map' ? (
          <MapDataConfigurationV3 formData={config} onFormDataChange={patchConfig} />
        ) : (
          <ChartDataConfigurationV3
            formData={config}
            onChange={patchConfig}
            disabled={false}
            isNewChart
          />
        )
      }
      stylingPanel={
        config.chart_type === 'map' ? (
          <MapCustomizations formData={config} onFormDataChange={patchConfig} />
        ) : (
          <ChartCustomizations
            chartType={config.chart_type || 'bar'}
            formData={config}
            onChange={patchConfig}
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
          config={config}
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
        <BuilderDataPanel builder="create" config={config} preview={preview} pages={pages} />
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
