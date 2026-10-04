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
import { useCreateChart, useColumns, useRegions, useChildRegions } from '@/hooks/api/useChart';
import { toastSuccess, toastError, toastInfo } from '@/lib/toast';
import { type ChartCreate, type ChartDataPayload, type ChartBuilderFormData } from '@/types/charts';
import { generateAutoPrefilledConfig } from '@/lib/chartAutoPrefill';
import { mergeTableColumnFormatting, resolveTableColumnOrder } from '@/lib/chart-payload-utils';
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
import { useTableDrillDown } from '@/components/charts/hooks/useTableDrillDown';
import { getDrillDownColumns } from '@/components/charts/logic/table-drilldown';
import { buildChartDataPayload, buildCreateChartPayload } from '@/components/charts/logic/payload';

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

  // Unsaved changes detection state
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
  const tableDrill = useTableDrillDown({
    dimensions: formData.dimensions,
    isTable: formData.chart_type === 'table',
    drillUpColumns: 'all',
    onLevelChange: pages.resetTableChartPage,
  });

  // ✅ ADD: Fetch regions for drill-down functionality (match edit mode exactly)
  const { data: states } = useRegions('IND', 'state');
  const { data: districts } = useChildRegions(
    drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1].region_id : null,
    drillDownPath.length > 0
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
    drillDownPath,
    patchConfig,
  });

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
      </div>

      {/* Main Content Area with 2rem margin container */}
      <div className="p-8 h-[calc(100vh-144px)]">
        <div className="flex h-full bg-white rounded-lg shadow-sm border overflow-hidden">
          {/* Left Panel - 30% */}
          <div className="w-[30%] border-r">
            <Tabs
              value={configurationTab}
              onValueChange={(value) => {
                setConfigurationTab(value);
                handleTabView(value);
              }}
              className="h-full"
            >
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
                      isNewChart
                    />
                  ) : (
                    <ChartDataConfigurationV3
                      formData={formData}
                      onChange={handleFormChange}
                      disabled={false}
                      isNewChart
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

              <TabsContent value="chart" className="h-[calc(100%-73px)] overflow-y-auto">
                <div className="p-4 h-full">
                  {formData.chart_type === 'map' ? (
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
                            sort: formData.sort || [],
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
                          pagination={{
                            page: pages.tableChart.page,
                            pageSize: pages.tableChart.pageSize,
                            total: preview.tableChartTotalRows || 0,
                            onPageChange: pages.tableChart.setPage,
                            onPageSizeChange: pages.tableChart.changePageSize,
                          }}
                          onRowClick={tableDrill.handleTableRowClick}
                          drillDownEnabled={tableDrill.isDrillDownEnabled}
                          currentDimensionColumn={tableDrill.currentDimensionColumn}
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
                            : preview.chartData?.echarts_config
                        }
                        tableData={
                          formData.chart_type === 'pivot_table'
                            ? preview.chartData?.data
                            : undefined
                        }
                        isLoading={preview.chartDataLoading}
                        error={preview.chartDataError}
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
                    defaultValue={
                      formData.chart_type === 'table' || formData.chart_type === 'pivot_table'
                        ? 'raw-data'
                        : 'chart-data'
                    }
                    className="h-full flex flex-col"
                  >
                    <TabsList className="grid w-full grid-cols-2">
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

                    <TabsContent value="chart-data" className="flex-1">
                      {formData.chart_type === 'pivot_table' ? (
                        <ChartPreview
                          config={{ extra_config: formData.extra_config }}
                          tableData={preview.chartData?.data}
                          isLoading={preview.chartDataLoading}
                          error={preview.chartDataError}
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

                    <TabsContent value="raw-data" className="flex-1">
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
