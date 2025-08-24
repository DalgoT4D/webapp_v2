'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ChevronLeft, Database, BarChart3 } from 'lucide-react';
import { ChartDataConfigurationV3 } from '@/components/charts/ChartDataConfigurationV3';
import { ChartCustomizations } from '@/components/charts/ChartCustomizations';
import { ChartPreview } from '@/components/charts/ChartPreview';
import { DataPreview } from '@/components/charts/DataPreview';
import { SimpleTableConfiguration } from '@/components/charts/SimpleTableConfiguration';
import { MapDataConfigurationV3 } from '@/components/charts/map/MapDataConfigurationV3';
import { MapCustomizations } from '@/components/charts/map/MapCustomizations';
import { MapPreview } from '@/components/charts/map/MapPreview';
import {
  useChartData,
  useChartDataPreview,
  useCreateChart,
  useGeoJSONData,
  useMapDataOverlay,
  useRawTableData,
  useTableCount,
  useColumns,
} from '@/hooks/api/useChart';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { ChartCreate, ChartDataPayload, ChartBuilderFormData } from '@/types/charts';

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
        legendPosition: 'right',
      };
    case 'line':
      return {
        lineStyle: 'smooth',
        showDataPoints: true,
        showTooltip: true,
        showLegend: true,
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
      };
    default:
      return {};
  }
}

// Generate default chart name
function generateDefaultChartName(chartType: string, table: string): string {
  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const typeNames = {
    bar: 'Bar chart',
    line: 'Line chart',
    pie: 'Pie chart',
    number: 'Number card',
    map: 'Map chart',
  };

  return `${typeNames[chartType as keyof typeof typeNames] || 'Chart'} - ${table} ${timestamp}`;
}

function ConfigureChartPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { trigger: createChart, isMutating } = useCreateChart();

  // Get parameters from URL
  const schema = searchParams.get('schema') || '';
  const table = searchParams.get('table') || '';
  const chartType = searchParams.get('type') || 'bar';

  // Initialize form data
  const [formData, setFormData] = useState<ChartBuilderFormData>({
    title: generateDefaultChartName(chartType, table),
    chart_type: chartType as ChartBuilderFormData['chart_type'],
    schema_name: schema,
    table_name: table,
    computation_type: 'aggregated',
    customizations: getDefaultCustomizations(chartType),
    // Set default aggregate function to prevent API errors
    aggregate_function: 'sum',
  });

  const [activeTab, setActiveTab] = useState('chart');
  const [rawDataPage, setRawDataPage] = useState(1);
  const [rawDataPageSize, setRawDataPageSize] = useState(50);

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
      return !!(
        formData.geographic_column &&
        formData.value_column &&
        formData.aggregate_function &&
        formData.selected_geojson_id
      );
    }

    if (formData.computation_type === 'raw') {
      return !!(formData.x_axis_column && formData.y_axis_column);
    } else {
      // For bar/line/table charts with multiple metrics
      if (
        ['bar', 'line', 'table'].includes(formData.chart_type || '') &&
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

      // For single metric charts
      return !!(
        formData.dimension_column &&
        formData.aggregate_function &&
        (formData.aggregate_function === 'count' || formData.aggregate_column)
      );
    }
  };

  // Build payload for chart data
  const chartDataPayload: ChartDataPayload | null = isChartDataReady()
    ? {
        chart_type: formData.chart_type!,
        computation_type: formData.computation_type!,
        schema_name: formData.schema_name!,
        table_name: formData.table_name!,
        ...(formData.x_axis_column && { x_axis: formData.x_axis_column }),
        ...(formData.y_axis_column && { y_axis: formData.y_axis_column }),
        ...(formData.dimension_column && { dimension_col: formData.dimension_column }),
        ...(formData.aggregate_column && { aggregate_col: formData.aggregate_column }),
        ...(formData.aggregate_function && { aggregate_func: formData.aggregate_function }),
        ...(formData.extra_dimension_column && {
          extra_dimension: formData.extra_dimension_column,
        }),
        // Multiple metrics for bar/line charts
        ...(formData.metrics && { metrics: formData.metrics }),
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
        customizations: formData.customizations,
        extra_config: {
          filters: formData.filters,
          pagination: formData.pagination,
          sort: formData.sort,
        },
      }
    : null;

  // Debug logging
  console.log('Chart Configuration Debug:', {
    isChartDataReady: isChartDataReady(),
    formData,
    chartDataPayload,
  });

  // Fetch chart data
  const {
    data: chartData,
    error: chartError,
    isLoading: chartLoading,
  } = useChartData(
    formData.chart_type !== 'map' && formData.chart_type !== 'table' ? chartDataPayload : null
  );

  // Fetch GeoJSON data for maps
  const {
    data: geojsonData,
    error: geojsonError,
    isLoading: geojsonLoading,
  } = useGeoJSONData(
    formData.chart_type === 'map' && formData.geojsonPreviewPayload?.geojsonId
      ? formData.geojsonPreviewPayload.geojsonId
      : null
  );

  // Fetch map data overlay
  const {
    data: mapDataOverlay,
    error: mapDataError,
    isLoading: mapDataLoading,
  } = useMapDataOverlay(
    formData.chart_type === 'map' && formData.dataOverlayPayload
      ? formData.dataOverlayPayload
      : null
  );

  // Fetch data preview
  const {
    data: dataPreview,
    error: previewError,
    isLoading: previewLoading,
  } = useChartDataPreview(chartDataPayload, 1, 50);

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

  // Get table count for raw data pagination
  const { data: tableCount } = useTableCount(
    formData.schema_name || null,
    formData.table_name || null
  );

  // Get all columns for raw data
  const { data: columns } = useColumns(formData.schema_name || null, formData.table_name || null);

  const handleFormChange = (updates: Partial<ChartBuilderFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
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
      return !!(
        formData.geographic_column &&
        formData.value_column &&
        formData.aggregate_function &&
        formData.selected_geojson_id
      );
    }

    if (formData.chart_type === 'table') {
      return true; // Tables just need schema, table, title which are already checked above
    }

    if (formData.computation_type === 'raw') {
      return !!(formData.x_axis_column && formData.y_axis_column);
    } else {
      // For bar/line/table charts with multiple metrics
      if (
        ['bar', 'line', 'table'].includes(formData.chart_type || '') &&
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

  const handleSave = async () => {
    if (!isFormValid()) {
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
        geographic_column: formData.geographic_column,
        value_column: formData.value_column,
        selected_geojson_id: selectedGeojsonId,
        layers: formData.layers,
        customizations: formData.customizations,
        filters: formData.filters,
        pagination: formData.pagination,
        sort: formData.sort,
        // Include metrics for multiple metrics support
        ...(formData.metrics && formData.metrics.length > 0 && { metrics: formData.metrics }),
      },
    };

    try {
      const result = await createChart(chartData);
      toast.success('Chart created successfully');
      router.push(`/charts/${result.id}`);
    } catch {
      toast.error('Failed to create chart');
    }
  };

  const handleCancel = () => {
    router.push('/charts');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Single Header with Everything */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link href="/charts" className="hover:text-foreground transition-colors">
                CHARTS
              </Link>
              <span>/</span>
              <span className="text-foreground font-medium">CREATE CHART</span>
            </div>

            <Link href="/charts/new">
              <Button variant="ghost" size="icon">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Input
              value={formData.title}
              onChange={(e) => handleFormChange({ title: e.target.value })}
              className="text-lg font-semibold border border-gray-200 shadow-sm px-4 py-2 h-11 bg-white min-w-[250px]"
              placeholder="Untitled Chart"
            />
            <Input
              placeholder="Brief description"
              value={formData.description || ''}
              onChange={(e) => handleFormChange({ description: e.target.value })}
              className="w-80 border border-gray-200 shadow-sm px-4 py-2 h-11"
            />
            <Button
              onClick={handleSave}
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
            <Tabs defaultValue="configuration" className="h-full">
              <div className="border-b px-6">
                <TabsList
                  className={`grid w-full ${formData.chart_type === 'table' ? 'grid-cols-1' : 'grid-cols-2'} bg-transparent p-0`}
                >
                  <TabsTrigger
                    value="configuration"
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 py-3"
                  >
                    Data Configuration
                  </TabsTrigger>
                  {formData.chart_type !== 'table' && (
                    <TabsTrigger
                      value="styling"
                      className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 py-3"
                    >
                      Chart Styling
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <TabsContent
                value="configuration"
                className="mt-0 h-[calc(100%-49px)] overflow-y-auto"
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

              {formData.chart_type !== 'table' && (
                <TabsContent value="styling" className="mt-0 h-[calc(100%-49px)] overflow-y-auto">
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
              <div className="border-b px-6">
                <TabsList className="grid w-fit grid-cols-2 bg-transparent p-0">
                  <TabsTrigger
                    value="chart"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-sm px-4 py-2 text-sm font-medium"
                  >
                    CHART
                  </TabsTrigger>
                  <TabsTrigger
                    value="data"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-sm px-4 py-2 text-sm font-medium"
                  >
                    DATA
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="chart" className="mt-0 h-[calc(100%-49px)] overflow-y-auto">
                <div className="p-4 h-full">
                  {formData.chart_type === 'map' ? (
                    <div className="w-full h-full">
                      <MapPreview
                        geojsonData={geojsonData?.geojson_data}
                        geojsonLoading={geojsonLoading}
                        geojsonError={geojsonError}
                        mapData={mapDataOverlay?.data}
                        mapDataLoading={mapDataLoading}
                        mapDataError={mapDataError}
                        title={formData.title}
                        valueColumn={formData.aggregate_column}
                      />
                    </div>
                  ) : formData.chart_type === 'table' ? (
                    <div className="w-full h-full">
                      <DataPreview
                        data={Array.isArray(dataPreview?.data) ? dataPreview.data : []}
                        columns={dataPreview?.columns || []}
                        columnTypes={dataPreview?.column_types || {}}
                        isLoading={previewLoading}
                        error={previewError}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full">
                      <ChartPreview
                        config={chartData?.echarts_config}
                        isLoading={chartLoading}
                        error={chartError}
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="data" className="mt-0 h-[calc(100%-49px)] overflow-y-auto">
                <div className="p-4">
                  <Tabs defaultValue="chart-data" className="h-full flex flex-col">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="chart-data" className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Chart Data
                      </TabsTrigger>
                      <TabsTrigger value="raw-data" className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Raw Data
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="chart-data" className="flex-1 mt-6">
                      <DataPreview
                        data={Array.isArray(dataPreview?.data) ? dataPreview.data : []}
                        columns={dataPreview?.columns || []}
                        columnTypes={dataPreview?.column_types || {}}
                        isLoading={previewLoading}
                        error={previewError}
                      />
                    </TabsContent>

                    <TabsContent value="raw-data" className="flex-1 mt-6">
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
