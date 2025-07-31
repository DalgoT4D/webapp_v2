'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartTypeSelector } from './ChartTypeSelector';
import { ChartDataConfiguration } from './ChartDataConfiguration';
import { ChartCustomizations } from './ChartCustomizations';
import { ChartMetadata } from './ChartMetadata';
import { ChartPreview } from './ChartPreview';
import { DataPreview } from './DataPreview';
import { useChartData, useChartDataPreview } from '@/hooks/api/useChart';
import type { ChartCreate, ChartDataPayload } from '@/types/charts';
import { debounce } from 'lodash';

interface ChartBuilderProps {
  onSave: (chart: ChartCreate) => void;
  onCancel: () => void;
  isSaving?: boolean;
  initialData?: Partial<ChartCreate>;
}

export function ChartBuilder({
  onSave,
  onCancel,
  isSaving = false,
  initialData,
}: ChartBuilderProps) {
  const [formData, setFormData] = useState<Partial<ChartCreate>>({
    chart_type: 'bar',
    computation_type: 'raw',
    customizations: {},
    ...initialData,
  });

  const [activeTab, setActiveTab] = useState('chart');
  const [dataPreviewPage, setDataPreviewPage] = useState(1);

  // Build payload for chart data
  const chartDataPayload: ChartDataPayload | null =
    formData.schema_name && formData.table_name
      ? {
          chart_type: formData.chart_type!,
          computation_type: formData.computation_type!,
          schema_name: formData.schema_name,
          table_name: formData.table_name,
          x_axis: formData.x_axis_column,
          y_axis: formData.y_axis_column,
          dimension_col: formData.dimension_column,
          aggregate_col: formData.aggregate_column,
          aggregate_func: formData.aggregate_function,
          extra_dimension: formData.extra_dimension_column,
          customizations: {
            ...formData.customizations,
            title: formData.title || '',
          },
        }
      : null;

  // Fetch chart data
  const {
    data: chartData,
    error: chartError,
    isLoading: chartLoading,
  } = useChartData(chartDataPayload);

  // Fetch data preview
  const {
    data: dataPreview,
    error: previewError,
    isLoading: previewLoading,
  } = useChartDataPreview(chartDataPayload, dataPreviewPage, 50);

  const handleFormChange = useCallback((updates: Partial<ChartCreate>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const debouncedFormChange = useCallback(debounce(handleFormChange, 500), [handleFormChange]);

  const isFormValid = () => {
    if (!formData.title || !formData.chart_type || !formData.schema_name || !formData.table_name) {
      return false;
    }

    // Special validation for number charts
    if (formData.chart_type === 'number') {
      return !!(formData.aggregate_column && formData.aggregate_function);
    }

    if (formData.computation_type === 'raw') {
      return !!(formData.x_axis_column && formData.y_axis_column);
    } else {
      return !!(
        formData.dimension_column &&
        formData.aggregate_column &&
        formData.aggregate_function
      );
    }
  };

  const handleSave = () => {
    if (!isFormValid()) {
      return;
    }

    // Construct the payload with extra_config structure
    const chartData: ChartCreate = {
      title: formData.title!,
      description: formData.description,
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
        customizations: formData.customizations,
      },
    };

    onSave(chartData);
  };

  const getStepStatus = (step: number) => {
    switch (step) {
      case 1:
        return formData.chart_type ? 'complete' : 'current';
      case 2:
        return formData.schema_name && formData.table_name
          ? 'complete'
          : formData.chart_type
            ? 'current'
            : 'pending';
      case 3:
        // Special handling for number charts
        if (formData.chart_type === 'number') {
          return formData.aggregate_column && formData.aggregate_function
            ? 'complete'
            : formData.table_name
              ? 'current'
              : 'pending';
        }

        if (formData.computation_type === 'raw') {
          return formData.x_axis_column && formData.y_axis_column
            ? 'complete'
            : formData.table_name
              ? 'current'
              : 'pending';
        } else {
          return formData.dimension_column && formData.aggregate_column
            ? 'complete'
            : formData.table_name
              ? 'current'
              : 'pending';
        }
      case 4:
        return formData.title
          ? 'complete'
          : formData.x_axis_column || formData.dimension_column || formData.aggregate_column
            ? 'current'
            : 'pending';
      default:
        return 'pending';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-12rem)]">
      {/* Left Panel - Configuration */}
      <Card className="p-8 overflow-y-auto">
        <div className="space-y-8">
          {/* Step 1: Chart Type */}
          <div
            className={`transition-opacity ${getStepStatus(1) === 'pending' ? 'opacity-50' : ''}`}
          >
            <h3 className="text-lg font-semibold mb-6">1. Select Chart Type</h3>
            <ChartTypeSelector
              value={formData.chart_type}
              onChange={(chart_type) => {
                const updates: any = {
                  chart_type: chart_type as 'bar' | 'pie' | 'line' | 'number' | 'map',
                };

                // For number charts, always set computation_type to aggregated
                if (chart_type === 'number') {
                  updates.computation_type = 'aggregated';
                }

                handleFormChange(updates);
              }}
            />
          </div>

          {/* Step 2: Data Configuration */}
          <div
            className={`transition-opacity ${getStepStatus(2) === 'pending' ? 'opacity-50' : ''}`}
          >
            <h3 className="text-lg font-semibold mb-6">2. Configure Data Source</h3>
            <ChartDataConfiguration
              formData={formData}
              onChange={handleFormChange}
              disabled={!formData.chart_type}
            />
          </div>

          {/* Step 3: Customizations */}
          <div
            className={`transition-opacity ${getStepStatus(3) === 'pending' ? 'opacity-50' : ''}`}
          >
            <h3 className="text-lg font-semibold mb-6">3. Customize Chart</h3>
            <ChartCustomizations
              chartType={formData.chart_type!}
              formData={formData}
              onChange={handleFormChange}
              disabled={!formData.table_name}
            />
          </div>

          {/* Step 4: Metadata */}
          <div
            className={`transition-opacity ${getStepStatus(4) === 'pending' ? 'opacity-50' : ''}`}
          >
            <h3 className="text-lg font-semibold mb-6">4. Add Details</h3>
            <ChartMetadata
              formData={formData}
              onChange={handleFormChange}
              disabled={getStepStatus(3) !== 'complete'}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-4 pt-6 mt-8 border-t">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isFormValid() || isSaving}>
              {isSaving ? 'Saving...' : 'Save Chart'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Right Panel - Preview */}
      <Card className="p-8 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chart">Chart Preview</TabsTrigger>
            <TabsTrigger value="data">Data Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="chart" className="h-[calc(100%-3rem)]">
            <ChartPreview
              config={chartData?.echarts_config}
              isLoading={chartLoading}
              error={chartError}
            />
          </TabsContent>

          <TabsContent value="data" className="h-[calc(100%-3rem)]">
            <DataPreview
              data={Array.isArray(dataPreview?.data) ? dataPreview.data : []}
              columns={dataPreview?.columns || []}
              columnTypes={dataPreview?.column_types || {}}
              isLoading={previewLoading}
              error={previewError}
              pagination={
                dataPreview
                  ? {
                      page: dataPreview.page,
                      pageSize: dataPreview.page_size,
                      total: dataPreview.total_rows,
                      onPageChange: setDataPreviewPage,
                    }
                  : undefined
              }
            />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
