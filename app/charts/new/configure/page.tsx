'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, BarChart3, ArrowLeft } from 'lucide-react';
import { ChartDataConfigurationV3 } from '@/components/charts/ChartDataConfigurationV3';
import { ChartCustomizations } from '@/components/charts/ChartCustomizations';
import { MapDataConfigurationV3 } from '@/components/charts/map/MapDataConfigurationV3';
import { MapCustomizations } from '@/components/charts/map/MapCustomizations';
import { RightPanel } from '@/components/charts/RightPanel';
import { UnsavedChangesExitDialog } from '@/components/charts/UnsavedChangesExitDialog';
import { useCreateChart } from '@/hooks/api/useChart';
import { toastSuccess, toastError } from '@/lib/toast';
import type { ChartCreate, ChartBuilderFormData } from '@/types/charts';
import { generateAutoPrefilledConfig } from '@/lib/chartAutoPrefill';
import { usePagination } from '@/hooks/usePagination';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useChartForm } from '@/hooks/useChartForm';
import { useMapDrillDown } from '@/hooks/useMapDrillDown';
import { useChartDataSources } from '@/hooks/useChartDataSources';
import { isChartFormValid } from '@/lib/chart-validation';

// Left Panel Component - Configuration and Styling tabs
interface LeftPanelProps {
  formData: ChartBuilderFormData;
  onFormChange: (updates: Partial<ChartBuilderFormData>) => void;
}

function LeftPanel({ formData, onFormChange }: LeftPanelProps) {
  return (
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

        <TabsContent value="configuration" className="mt-6 h-[calc(100%-73px)] overflow-y-auto">
          <div className="p-4">
            {formData.chart_type === 'map' ? (
              <MapDataConfigurationV3 formData={formData} onFormDataChange={onFormChange} />
            ) : (
              <ChartDataConfigurationV3
                formData={formData}
                onChange={onFormChange}
                disabled={false}
              />
            )}
          </div>
        </TabsContent>

        {formData.chart_type !== 'table' && (
          <TabsContent value="styling" className="h-[calc(100%-73px)] overflow-y-auto">
            <div className="p-4">
              {formData.chart_type === 'map' ? (
                <MapCustomizations formData={formData} onFormDataChange={onFormChange} />
              ) : (
                <ChartCustomizations
                  chartType={formData.chart_type || 'bar'}
                  formData={formData}
                  onChange={onFormChange}
                />
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function ConfigureChartPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { trigger: createChart, isMutating } = useCreateChart();
  // Get parameters from URL
  const schema = searchParams.get('schema') || '';
  const table = searchParams.get('table') || '';
  const chartType = searchParams.get('type') || 'bar';
  // UI state
  const [activeTab, setActiveTab] = useState('chart');
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string>('/charts');
  // Form state management
  const { formData, hasUnsavedChanges, handleFormChange, setFormData } = useChartForm({
    schema,
    table,
    chartType,
  });
  // Map drill-down state
  const {
    drillDownPath,
    currentGeojsonId,
    drillDownFilters,
    handleRegionClick,
    handleDrillUp,
    handleDrillHome,
  } = useMapDrillDown({ formData, enabled: formData.chart_type === 'map' });

  // Pagination states
  const dataPreviewPagination = usePagination(1, 20);
  const rawDataPagination = usePagination(1, 20);
  const tableChartPagination = usePagination(1, 20);

  // Data fetching
  const dataSources = useChartDataSources({
    formData,
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

  // Browser navigation protection
  const { navigateWithoutWarning } = useUnsavedChanges(hasUnsavedChanges);

  // Auto-prefill when columns are loaded
  useEffect(() => {
    if (dataSources.columns && formData.schema_name && formData.table_name && formData.chart_type) {
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
        const autoConfig = generateAutoPrefilledConfig(formData.chart_type, dataSources.columns);
        if (Object.keys(autoConfig).length > 0) {
          handleFormChange(autoConfig);
        }
      }
    }
  }, [dataSources.columns, formData.schema_name, formData.table_name, formData.chart_type]);

  // Generate map preview payloads
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
      const needsUpdate =
        !formData.geojsonPreviewPayload ||
        !formData.dataOverlayPayload ||
        formData.geojsonPreviewPayload.geojsonId !== formData.selected_geojson_id ||
        formData.dataOverlayPayload.geographic_column !== formData.geographic_column;

      if (needsUpdate) {
        setFormData((prev) => ({
          ...prev,
          geojsonPreviewPayload: { geojsonId: formData.selected_geojson_id! },
          dataOverlayPayload: {
            schema_name: formData.schema_name!,
            table_name: formData.table_name!,
            geographic_column: formData.geographic_column!,
            value_column: formData.aggregate_column,
            aggregate_function: formData.aggregate_function!,
            selected_geojson_id: formData.selected_geojson_id!,
            filters: {},
            chart_filters: formData.filters || [],
          },
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
    JSON.stringify(formData.geographic_hierarchy || {}),
    JSON.stringify(formData.geojsonPreviewPayload || {}),
    JSON.stringify(formData.dataOverlayPayload || {}),
  ]);

  const handleSave = async () => {
    if (!isChartFormValid(formData)) {
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
        customizations: formData.customizations,
        filters: formData.filters,
        pagination: formData.pagination,
        sort: formData.sort,
        time_grain: formData.time_grain,
        ...(formData.metrics && formData.metrics.length > 0 && { metrics: formData.metrics }),
        ...(formData.geographic_hierarchy && {
          geographic_hierarchy: formData.geographic_hierarchy,
        }),
      },
    };

    try {
      const result = await createChart(chartData);
      toastSuccess.created('Chart');
      navigateWithoutWarning(`/charts/${result.id}`);
    } catch (error) {
      toastError.create(error, 'chart');
    }
  };

  const handleNavigateWithCheck = (destination: string) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(destination);
      setShowUnsavedChangesDialog(true);
    } else {
      router.push(destination);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleNavigateWithCheck('/charts/new')}
            >
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
            <Button
              onClick={handleSave}
              disabled={!isChartFormValid(formData) || isMutating}
              className="px-8 h-11 text-white hover:opacity-90"
              style={{ backgroundColor: '#06887b' }}
            >
              {isMutating ? 'Saving...' : 'Save Chart'}
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

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesExitDialog
        open={showUnsavedChangesDialog}
        onOpenChange={setShowUnsavedChangesDialog}
        onSave={handleSave}
        onLeave={() => {
          setShowUnsavedChangesDialog(false);
          navigateWithoutWarning(pendingNavigation);
        }}
        onStay={() => setShowUnsavedChangesDialog(false)}
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
