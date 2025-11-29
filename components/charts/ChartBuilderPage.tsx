'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, ArrowLeft, AlertCircle } from 'lucide-react';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { useChart } from '@/hooks/api/useChart';
import { LeftPanel } from '@/components/charts/left-panel';
import { RightPanel } from '@/components/charts/right-panel';
import { SaveOptionsDialog, UnsavedChangesExitDialog } from '@/components/charts/dialogs';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  chartToFormData,
  generateDefaultChartName,
  getDefaultCustomizations,
} from '@/hooks/useChartForm';
import { useMapDrillDown } from '@/hooks/useMapDrillDown';
import { usePagination } from '@/hooks/usePagination';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useChartDataSources } from '@/hooks/useChartDataSources';
import { useChartSave } from '@/hooks/useChartSave';
import { isChartFormValid } from '@/lib/chart-validation';
import { generateAutoPrefilledConfig } from '@/lib/chartAutoPrefill';
import type { ChartBuilderFormData } from '@/types/charts';

export interface ChartBuilderPageProps {
  /** Chart ID for edit mode. If undefined, operates in create mode */
  chartId?: number;
  /** Initial schema name (for create mode) */
  schema?: string;
  /** Initial table name (for create mode) */
  table?: string;
  /** Initial chart type (for create mode) */
  chartType?: string;
  /** Back navigation URL */
  backUrl?: string;
}

/**
 * Unified Chart Builder Page component.
 * Handles both create and edit modes based on whether chartId is provided.
 */
export function ChartBuilderPage({
  chartId,
  schema = '',
  table = '',
  chartType = 'bar',
  backUrl,
}: ChartBuilderPageProps) {
  const router = useRouter();
  const { hasPermission } = useUserPermissions();
  const isEditMode = !!chartId;

  // Permissions
  const canEditChart = hasPermission('can_edit_charts');
  const canCreateChart = hasPermission('can_create_charts');

  // Fetch existing chart (only in edit mode)
  const {
    data: existingChart,
    error: chartError,
    isLoading: chartLoading,
  } = useChart(isEditMode ? chartId : null);

  // Form state
  const [formData, setFormData] = useState<ChartBuilderFormData | null>(null);
  const [originalFormData, setOriginalFormData] = useState<ChartBuilderFormData | null>(null);
  const [isFormInitialized, setIsFormInitialized] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState('chart');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [isExitingAfterSave, setIsExitingAfterSave] = useState(false);

  // Initialize form data
  useEffect(() => {
    if (isFormInitialized) return;

    if (isEditMode) {
      // Edit mode: wait for chart to load
      if (existingChart) {
        const initialData = chartToFormData(existingChart);
        setFormData(initialData);
        setOriginalFormData(initialData);
        setIsFormInitialized(true);
      }
    } else {
      // Create mode: initialize with URL params
      const initialData: ChartBuilderFormData = {
        title: generateDefaultChartName(chartType, table),
        chart_type: chartType as ChartBuilderFormData['chart_type'],
        schema_name: schema,
        table_name: table,
        computation_type: 'aggregated',
        customizations: getDefaultCustomizations(chartType),
        aggregate_function: 'count',
      };
      setFormData(initialData);
      setOriginalFormData(initialData);
      setIsFormInitialized(true);
    }
  }, [isEditMode, existingChart, schema, table, chartType, isFormInitialized]);

  // Check for unsaved changes
  const hasUnsavedChanges =
    formData && originalFormData
      ? JSON.stringify(formData) !== JSON.stringify(originalFormData)
      : false;

  // Browser navigation protection
  const { navigateWithoutWarning, dialogState } = useUnsavedChanges(hasUnsavedChanges);

  // Mark as saved helper
  const markAsSaved = () => {
    if (formData) {
      setOriginalFormData({ ...formData });
    }
  };

  // Pagination states
  const dataPreviewPagination = usePagination(1, 25);
  const rawDataPagination = usePagination(1, 20);
  const tableChartPagination = usePagination(1, 20);

  // Map drill-down state
  const {
    drillDownPath,
    currentGeojsonId,
    drillDownFilters,
    handleRegionClick,
    handleDrillUp,
    handleDrillHome,
  } = useMapDrillDown({
    formData: formData || ({} as ChartBuilderFormData),
    enabled: formData?.chart_type === 'map',
  });

  // Data fetching
  const dataSources = useChartDataSources({
    formData: formData || ({} as ChartBuilderFormData),
    drillDownPath,
    drillDownFilters,
    currentGeojsonId,
    dataPreviewPagination: {
      page: dataPreviewPagination.page,
      pageSize: dataPreviewPagination.pageSize,
    },
    rawDataPagination: {
      page: rawDataPagination.page,
      pageSize: rawDataPagination.pageSize,
    },
    tableChartPagination: {
      page: tableChartPagination.page,
      pageSize: tableChartPagination.pageSize,
    },
  });

  // Chart save operations
  const chartSave = useChartSave({
    chartId,
    formData: formData || ({} as ChartBuilderFormData),
    markAsSaved,
    navigateWithoutWarning,
  });

  // Form change handler
  const handleFormChange = (updates: Partial<ChartBuilderFormData>) => {
    if (formData) {
      setFormData((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  // Auto-prefill for create mode when columns load
  useEffect(() => {
    if (isEditMode || !formData || !dataSources.columns) return;

    const hasExistingConfig = !!(
      formData.dimension_column ||
      formData.aggregate_column ||
      formData.geographic_column ||
      formData.x_axis_column ||
      formData.y_axis_column ||
      formData.table_columns?.length ||
      (formData.metrics && formData.metrics.length > 0)
    );

    if (!hasExistingConfig && formData.schema_name && formData.table_name && formData.chart_type) {
      const autoConfig = generateAutoPrefilledConfig(formData.chart_type, dataSources.columns);
      if (Object.keys(autoConfig).length > 0) {
        handleFormChange(autoConfig);
      }
    }
  }, [
    isEditMode,
    dataSources.columns,
    formData?.schema_name,
    formData?.table_name,
    formData?.chart_type,
  ]);

  // Generate map preview payloads
  useEffect(() => {
    if (!formData) return;

    // For count operations, aggregate_column is not required
    const needsAggregateColumn = formData.aggregate_function !== 'count';
    const hasRequiredAggregateConfig = !needsAggregateColumn || formData.aggregate_column;

    if (
      formData.chart_type === 'map' &&
      formData.geographic_column &&
      formData.selected_geojson_id &&
      hasRequiredAggregateConfig &&
      formData.aggregate_function &&
      formData.schema_name &&
      formData.table_name
    ) {
      // Determine value_column - for count, use geographic_column as fallback
      const valueColumn =
        formData.aggregate_column || formData.value_column || formData.geographic_column;

      const needsUpdate =
        !formData.geojsonPreviewPayload ||
        !formData.dataOverlayPayload ||
        formData.geojsonPreviewPayload.geojsonId !== formData.selected_geojson_id ||
        formData.dataOverlayPayload.geographic_column !== formData.geographic_column ||
        formData.dataOverlayPayload.value_column !== valueColumn ||
        formData.dataOverlayPayload.aggregate_function !== formData.aggregate_function;

      if (needsUpdate) {
        setFormData((prev) =>
          prev
            ? {
                ...prev,
                geojsonPreviewPayload: { geojsonId: formData.selected_geojson_id! },
                dataOverlayPayload: {
                  schema_name: formData.schema_name!,
                  table_name: formData.table_name!,
                  geographic_column: formData.geographic_column!,
                  value_column: valueColumn,
                  aggregate_function: formData.aggregate_function!,
                  selected_geojson_id: formData.selected_geojson_id!,
                  filters: {},
                  chart_filters: formData.filters || [],
                },
              }
            : null
        );
      }
    }
  }, [
    formData?.chart_type,
    formData?.geographic_column,
    formData?.selected_geojson_id,
    formData?.aggregate_column,
    formData?.value_column,
    formData?.aggregate_function,
    formData?.schema_name,
    formData?.table_name,
    formData?.filters,
  ]);

  // Determine back URL
  const resolvedBackUrl = backUrl || (isEditMode ? `/charts/${chartId}` : '/charts/new');

  // Save handlers
  const handleSave = () => {
    if (!formData || !isChartFormValid(formData)) return;
    setIsExitingAfterSave(false);
    if (isEditMode) {
      setShowSaveDialog(true);
    } else {
      // Create mode: direct save
      handleCreateChart();
    }
  };

  const handleCreateChart = async () => {
    if (!formData) return;
    try {
      await chartSave.saveAsNew(formData.title || 'Untitled Chart');
    } catch {
      // Error handled in useChartSave
    }
  };

  const handleUpdateExisting = async () => {
    await chartSave.updateChart();
    if (isExitingAfterSave) {
      setIsExitingAfterSave(false);
      navigateWithoutWarning('/charts');
    }
  };

  const handleSaveAsNew = async (newTitle: string) => {
    await chartSave.saveAsNew(newTitle);
    if (isExitingAfterSave) {
      setIsExitingAfterSave(false);
      navigateWithoutWarning('/charts');
    }
  };

  // Cancel/Exit handlers
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setShowExitDialog(true);
    } else {
      router.push(resolvedBackUrl);
    }
  };

  const handleSaveAndLeave = () => {
    if (!formData || !isChartFormValid(formData)) return;
    setIsExitingAfterSave(true);
    setShowExitDialog(false);
    if (isEditMode) {
      setShowSaveDialog(true);
    } else {
      handleCreateChart();
    }
  };

  const handleLeaveWithoutSaving = () => {
    setShowExitDialog(false);
    navigateWithoutWarning(resolvedBackUrl);
  };

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      setShowExitDialog(true);
    } else {
      router.push(resolvedBackUrl);
    }
  };

  // Permission checks
  if (isEditMode && !canEditChart) {
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

  if (!isEditMode && !canCreateChart) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">You don't have permission to create charts.</p>
          <Button variant="outline" onClick={() => router.push('/charts')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Charts
          </Button>
        </div>
      </div>
    );
  }

  // Loading state (edit mode only)
  if (isEditMode && chartLoading) {
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

  // Error state (edit mode only)
  if (isEditMode && (chartError || (!existingChart && !chartLoading))) {
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

  // Wait for form data to be initialized
  if (!formData) {
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

  const isSaving = chartSave.isMutating || chartSave.isCreating;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleBackClick}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <Input
              value={formData.title}
              onChange={(e) => handleFormChange({ title: e.target.value })}
              className="text-lg font-semibold border border-gray-200 shadow-sm px-4 py-2 h-11 bg-white min-w-[300px]"
              placeholder="Untitled Chart"
            />
          </div>

          <div className="flex items-center gap-4">
            {isEditMode && (
              <Button
                variant="cancel"
                onClick={handleCancel}
                disabled={isSaving}
                className="px-8 h-11"
              >
                Cancel
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={!isChartFormValid(formData) || isSaving}
              className="px-8 h-11 text-white hover:opacity-90"
              style={{ backgroundColor: '#06887b' }}
            >
              {isSaving ? 'Saving...' : 'Save Chart'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8 h-[calc(100vh-144px)]">
        <div className="flex h-full bg-white rounded-lg shadow-sm border overflow-hidden">
          <LeftPanel formData={formData} onFormChange={handleFormChange} />
          <RightPanel
            formData={formData}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            chartData={dataSources.chartData}
            mapData={{
              geojsonData: dataSources.geojsonData.data,
              geojsonLoading: dataSources.geojsonData.isLoading,
              geojsonError: dataSources.geojsonData.error,
              mapDataOverlay: dataSources.mapDataOverlay.data,
              mapDataLoading: dataSources.mapDataOverlay.isLoading,
              mapDataError: dataSources.mapDataOverlay.error,
            }}
            tableChartData={{
              data: dataSources.tableChartData.data,
              isLoading: dataSources.tableChartData.isLoading,
              error: dataSources.tableChartData.error,
              pagination: {
                page: tableChartPagination.page,
                pageSize: tableChartPagination.pageSize,
                total: dataSources.tableChartTotalRows,
                onPageChange: tableChartPagination.setPage,
                onPageSizeChange: tableChartPagination.handlePageSizeChange,
              },
            }}
            dataPreview={{
              data: dataSources.dataPreview.data,
              isLoading: dataSources.dataPreview.isLoading,
              error: dataSources.dataPreview.error,
              pagination: {
                page: dataPreviewPagination.page,
                pageSize: dataPreviewPagination.pageSize,
                total: dataSources.chartDataTotalRows,
                onPageChange: dataPreviewPagination.setPage,
                onPageSizeChange: dataPreviewPagination.handlePageSizeChange,
              },
            }}
            rawData={{
              data: dataSources.rawTableData.data,
              isLoading: dataSources.rawTableData.isLoading,
              error: dataSources.rawTableData.error,
              tableCount: dataSources.tableCount,
              pagination: {
                page: rawDataPagination.page,
                pageSize: rawDataPagination.pageSize,
                onPageChange: rawDataPagination.setPage,
                onPageSizeChange: rawDataPagination.handlePageSizeChange,
              },
            }}
            drillDown={{
              path: drillDownPath,
              onRegionClick: handleRegionClick,
              onDrillUp: handleDrillUp,
              onDrillHome: handleDrillHome,
            }}
          />
        </div>
      </div>

      {/* Save Options Dialog (Edit mode only) */}
      {isEditMode && (
        <SaveOptionsDialog
          open={showSaveDialog}
          onOpenChange={setShowSaveDialog}
          originalTitle={existingChart?.title || ''}
          onSaveExisting={handleUpdateExisting}
          onSaveAsNew={handleSaveAsNew}
          isLoading={isSaving}
        />
      )}

      {/* Exit Dialog */}
      <UnsavedChangesExitDialog
        open={showExitDialog}
        onOpenChange={setShowExitDialog}
        onSave={handleSaveAndLeave}
        onLeave={handleLeaveWithoutSaving}
        onStay={() => setShowExitDialog(false)}
        isSaving={isSaving}
      />

      {/* Browser Navigation Dialog */}
      <ConfirmationDialog
        open={dialogState.open}
        onOpenChange={(open) => {
          if (!open) dialogState.onCancel();
        }}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to leave without saving?"
        confirmText="Leave Without Saving"
        cancelText="Cancel"
        type="warning"
        onConfirm={dialogState.onConfirm}
        onCancel={dialogState.onCancel}
      />
    </div>
  );
}
