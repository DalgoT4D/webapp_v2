'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import debounce from 'lodash/debounce';

// SWR Hooks
import {
  useSchemas,
  useTables,
  useColumns,
  useChartSave,
  useChartUpdate,
  useChartDelete,
  useChartData,
  type Column,
  type GenerateChartPayload,
  type SaveChartPayload,
  type ChartData,
} from '@/hooks/api/useChart';

// Extend GenerateChartPayload type locally
interface ExtendedGenerateChartPayload extends Omit<GenerateChartPayload, 'computation_type'> {
  computation_type: 'raw' | 'aggregated';
  aggregate_col_alias?: string;
  dimension_col?: string;
}

// Chart Components
import EChartsComponent from './EChartsComponent';
// Temporarily remove Nivo until it's updated
// import NivoComponent from "./NivoComponent";

// Chart Utilities
import {
  getSupportedChartTypes,
  validateChartData,
  getRecommendedChartType,
  generateChartTitleSuggestions,
  CHART_TYPE_CONFIGS,
} from './chartUtils';

// Form data interface
interface ChartFormData {
  schema: string;
  table: string;
  xAxis: string;
  yAxis: string;
  chartName: string;
  chartDescription: string;
  chartType: string;
  dataLimit: string;
  computation_type: 'raw' | 'aggregated';
  aggregateFunc: string;
  aggregate_col_alias: string;
  dimension_col: string;
}

interface EditChart {
  id: number;
  title: string;
  description: string;
  chart_type: string;
  schema_name: string;
  table: string;
  config: {
    xAxis: string;
    yAxis: string;
    chartType: string;
    aggregate_col_alias?: string;
    dimension_col?: string;
    aggregate_func?: string;
    aggregate_col?: string;
    computation_type?: 'raw' | 'aggregated';
  };
}

interface ChartFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (chartData: {
    schema: string;
    table: string;
    xAxis: string;
    yAxis: string;
    chartName: string;
    chartDescription: string;
    chartType: string;
  }) => void;
  onUpdate?: (
    chartId: number,
    chartData: {
      schema: string;
      table: string;
      xAxis: string;
      yAxis: string;
      chartName: string;
      chartDescription: string;
      chartType: string;
    }
  ) => void;
  onDelete?: (chartId: number) => void;
  title: string;
  chartLibraryType: 'echarts' | 'nivo' | 'recharts';
  editChart?: EditChart | null;
}

// Debounce hook
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function ChartForm({
  open,
  onOpenChange,
  onSave,
  onUpdate,
  onDelete,
  title,
  chartLibraryType,
  editChart,
}: ChartFormProps) {
  // React Hook Form setup
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    resetField,
    reset: resetForm,
    formState: { errors, isValid },
  } = useForm<ChartFormData>({
    defaultValues: {
      schema: '',
      table: '',
      xAxis: '',
      yAxis: '',
      chartName: '',
      chartDescription: '',
      chartType: 'bar',
      dataLimit: '10',
      computation_type: 'raw',
      aggregateFunc: 'count',
      aggregate_col_alias: '',
      dimension_col: '',
    },
    mode: 'onChange',
  });

  // Watch form fields for reactive updates
  const watchedSchema = watch('schema');
  const watchedTable = watch('table');
  const watchedXAxis = watch('xAxis');
  const watchedYAxis = watch('yAxis');
  const watchedChartType = watch('chartType');
  const watchedDataLimit = watch('dataLimit');
  const watchedChartName = watch('chartName');
  const watchedMode = watch('computation_type');
  const watchedAggregateFunc = watch('aggregateFunc');
  const watchedAggregateColAlias = watch('aggregate_col_alias');
  const watchedDimension = watch('dimension_col');

  // SWR hooks for data fetching
  const { data: schemas, isLoading: schemasLoading, error: schemasError } = useSchemas();
  const { data: tables, isLoading: tablesLoading, error: tablesError } = useTables(watchedSchema);
  const {
    data: columns,
    isLoading: columnsLoading,
    error: columnsError,
  } = useColumns(watchedSchema, watchedTable);

  // SWR mutations
  // const { trigger: generateChart, isMutating: isGenerating, error: generateError } = useChartGeneration()
  const { trigger: saveChart, isMutating: isSaving } = useChartSave();
  const { trigger: updateChart, isMutating: isUpdating } = useChartUpdate();
  const { trigger: deleteChart, isMutating: isDeleting } = useChartDelete();

  // Chart data generation payload
  const chartPayload = useMemo((): ExtendedGenerateChartPayload | null => {
    if (!watchedSchema || !watchedTable) return null;

    if (watchedMode === 'raw') {
      return {
        chart_type: watchedChartType,
        computation_type: 'raw',
        schema_name: watchedSchema,
        table_name: watchedTable,
        xaxis: watchedXAxis,
        yaxis: watchedYAxis,
        offset: 0,
        limit: parseInt(watchedDataLimit) || 10,
      };
    }

    // For aggregated mode
    // if (!watchedAggregateFunc) return null;

    // For count, we don't need aggregate_col

    return {
      chart_type: watchedChartType,
      computation_type: 'aggregated',
      schema_name: watchedSchema,
      table_name: watchedTable,
      xaxis: watchedXAxis,
      dimension_col: watchedDimension,
      aggregate_func: watchedAggregateFunc,
      aggregate_col: watchedAggregateFunc === 'count' ? '*' : watchedYAxis,
      aggregate_col_alias: watchedAggregateColAlias,
      offset: 0,
      limit: parseInt(watchedDataLimit) || 10,
    };
  }, [
    watchedSchema,
    watchedTable,
    watchedMode,
    watchedXAxis,
    watchedYAxis,
    watchedAggregateFunc,
    watchedAggregateColAlias,
    watchedDimension,
    watchedDataLimit,
    watchedChartType,
    watchedMode,
  ]);

  // Chart data with SWR caching
  const {
    data: chartData,
    error: chartDataError,
    isLoading: isChartDataLoading,
  } = useChartData(chartPayload, { enabled: Boolean(chartPayload) });

  // Initialize form with edit data
  useEffect(() => {
    if (open && editChart) {
      resetForm({
        schema: editChart.schema_name,
        table: editChart.table,
        xAxis: editChart.config.xAxis,
        yAxis: editChart.config.yAxis,
        chartName: editChart.title,
        chartDescription: editChart.description,
        chartType: editChart.config.chartType,
        dataLimit: '10',
        aggregate_col_alias:
          editChart.config.aggregate_col_alias ||
          `total_${editChart.config.dimension_col?.toLowerCase() || ''}`,
        dimension_col: editChart.config.dimension_col || '',
      });
    } else if (open && !editChart) {
      resetForm();
    }
  }, [open, editChart, resetForm]);

  // Auto-suggest chart titles
  useEffect(() => {
    if (watchedXAxis && watchedYAxis && watchedChartType && !watchedChartName && !editChart) {
      const suggestions = generateChartTitleSuggestions(
        watchedXAxis,
        watchedYAxis,
        watchedChartType
      );
      if (suggestions.length > 0) {
        setValue('chartName', suggestions[0]);
      }
    }
  }, [watchedXAxis, watchedYAxis, watchedChartType, watchedChartName, editChart, setValue]);

  // Chart validation
  const chartValidation = useMemo(() => {
    if (!chartData || !watchedChartType) return null;

    const validation = validateChartData(chartData, watchedChartType);
    const recommendedType = getRecommendedChartType(chartData, chartLibraryType);
    const suggestions = generateChartTitleSuggestions(watchedXAxis, watchedYAxis, watchedChartType);

    return {
      isValid: validation.isValid,
      errors: validation.errors,
      recommendations: validation.isValid
        ? []
        : [
            `Recommended chart type: ${CHART_TYPE_CONFIGS[recommendedType]?.name || recommendedType}`,
            ...suggestions.slice(0, 2).map((s) => `Suggested title: "${s}"`),
          ],
    };
  }, [chartData, watchedChartType, chartLibraryType, watchedXAxis, watchedYAxis]);

  // Save chart function
  const handleSaveChart = async () => {
    if (!chartPayload || !chartData) return;

    try {
      const formData = watch();
      const savePayload: SaveChartPayload = {
        title: formData.chartName,
        description: formData.chartDescription,
        chart_type: chartLibraryType,
        schema_name: formData.schema,
        table: formData.table,
        config: {
          chartType: formData.chartType,
          computation_type: formData.computation_type,
          xAxis: formData.xAxis,
          yAxis: formData.yAxis,
          ...(formData.computation_type === 'aggregated' && {
            aggregate_func: formData.aggregateFunc,
            aggregate_col: formData.aggregateFunc === 'count' ? '*' : formData.yAxis,
            aggregate_col_alias: formData.aggregate_col_alias,
            dimension_col: formData.dimension_col,
          }),
        },
      };

      if (editChart && onUpdate) {
        await updateChart({ id: editChart.id, ...savePayload });
        onUpdate(editChart.id, {
          schema: formData.schema,
          table: formData.table,
          xAxis: formData.xAxis,
          yAxis: formData.yAxis,
          chartName: formData.chartName,
          chartDescription: formData.chartDescription,
          chartType: formData.chartType,
        });
      } else {
        await saveChart(savePayload);
        onSave({
          schema: formData.schema,
          table: formData.table,
          xAxis: formData.xAxis,
          yAxis: formData.yAxis,
          chartName: formData.chartName,
          chartDescription: formData.chartDescription,
          chartType: formData.chartType,
        });
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save chart:', error);
    }
  };

  // Delete chart function
  const handleDeleteChart = async () => {
    if (!editChart || !onDelete) return;

    try {
      await deleteChart({ id: editChart.id });
      onDelete(editChart.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to delete chart:', error);
    }
  };

  const dynmaicXaxisLables = () => {
    const chartType = ['pie'];
    if (chartType.includes(watchedChartType)) {
      return 'Category';
    }
    return 'X-Axis';
  };

  const dynamicYaxisLables = () => {
    const chartType = ['pie'];
    if (watchedMode === 'raw' && chartType.includes(watchedChartType)) {
      return 'Value';
    } else if (watchedMode == 'raw') {
      return 'Y-Axis';
    } else if (watchedMode == 'aggregated') {
      return 'Aggregate Column';
    }
  };

  const isLoading = isSaving || isUpdating || isDeleting;

  // Local state for smooth typing
  const [localAliasValue, setLocalAliasValue] = useState('');

  // Update form value when local value changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      setValue('aggregate_col_alias', localAliasValue);
    }, 500);

    return () => clearTimeout(timer);
  }, [localAliasValue, setValue]);

  // Set default alias when aggregate function or column changes
  useEffect(() => {
    if (
      watchedMode === 'aggregated' &&
      watchedAggregateFunc &&
      watchedAggregateFunc !== 'count' &&
      watchedYAxis
    ) {
      const defaultAlias = `total_${watchedYAxis.toLowerCase()}`;
      setValue('aggregate_col_alias', defaultAlias);
      setLocalAliasValue(defaultAlias);
    } else if (watchedMode === 'aggregated' && watchedAggregateFunc === 'count') {
      setValue('aggregate_col_alias', '');
      setLocalAliasValue('');
    }
  }, [watchedMode, watchedAggregateFunc, watchedYAxis, setValue]);

  // Reset alias when switching computation modes
  useEffect(() => {
    if (watchedMode === 'raw') {
      setValue('aggregate_col_alias', '');
      setLocalAliasValue('');
    }
  }, [watchedMode, setValue]);

  // Initialize alias when editing
  useEffect(() => {
    if (open && editChart) {
      if (editChart.config.aggregate_col_alias) {
        setValue('aggregate_col_alias', editChart.config.aggregate_col_alias);
        setLocalAliasValue(editChart.config.aggregate_col_alias);
      } else if (editChart.config.aggregate_func && editChart.config.aggregate_func !== 'count') {
        const col = editChart.config.yAxis;
        const defaultAlias = `total_${col?.toLowerCase() || ''}`;
        setValue('aggregate_col_alias', defaultAlias);
        setLocalAliasValue(defaultAlias);
      } else {
        setValue('aggregate_col_alias', '');
        setLocalAliasValue('');
      }
    } else if (open && !editChart) {
      setValue('aggregate_col_alias', '');
      setLocalAliasValue('');
    }
  }, [open, editChart, setValue]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] flex flex-col !w-[85vw] !max-w-[85vw] sm:!max-w-[85vw] md:!max-w-[85vw] lg:!max-w-[85vw]">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle>{editChart ? `Edit ${title}` : title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-7 gap-6 min-h-full lg:h-[calc(95vh-8rem)]">
            {/* Form Section - Chart Configuration */}
            <div className="lg:col-span-1 xl:col-span-2 space-y-6 lg:overflow-y-auto lg:pr-2">
              <form className="space-y-6">
                {/* Chart Configuration Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide border-b pb-2">
                    Chart Configuration
                  </h3>

                  {/* Chart Type */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Chart Type</label>
                    <Select
                      value={watchedChartType}
                      onValueChange={(value) => setValue('chartType', value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {getSupportedChartTypes(chartLibraryType).map((type) => {
                          const config = CHART_TYPE_CONFIGS[type];
                          return (
                            <SelectItem key={type} value={type}>
                              <div className="flex items-center gap-3 py-1">
                                <span className="text-lg">{config.icon}</span>
                                <div className="flex flex-col">
                                  <div className="font-medium text-foreground">{config.name}</div>
                                  <div className="text-xs text-muted-foreground/80">
                                    {config.description}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Schema */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Schema</label>
                    <Select
                      value={watchedSchema}
                      onValueChange={(value) => setValue('schema', value)}
                      disabled={schemasLoading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={schemasLoading ? 'Loading...' : 'Select schema'}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {schemasError && (
                          <div className="px-3 py-2 text-red-500 text-sm">
                            {schemasError.message}
                          </div>
                        )}
                        {schemas?.map((schema) => (
                          <SelectItem key={schema} value={schema}>
                            {schema}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Table */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Table</label>
                    <div className="space-y-2">
                      <Select
                        value={watchedTable}
                        onValueChange={(value) => setValue('table', value)}
                        disabled={!watchedSchema || tablesLoading}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={tablesLoading ? 'Loading...' : 'Select table'}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {tablesError && (
                            <div className="px-3 py-2 text-red-500 text-sm">
                              {tablesError.message}
                            </div>
                          )}
                          {tables?.length === 0 && !tablesLoading && (
                            <div className="px-3 py-2 text-muted-foreground text-sm">
                              No tables found
                            </div>
                          )}
                          {tables?.map((table) => (
                            <SelectItem key={table} value={table}>
                              {table}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Data Mode */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Data Mode</label>
                    <Select
                      value={watchedMode}
                      onValueChange={(value) => {
                        // Reset data mode specific fields when switching modes
                        if (value === 'raw') {
                          setValue('computation_type', 'raw');
                          setValue('xAxis', '');
                          setValue('yAxis', '');
                        } else {
                          setValue('computation_type', 'aggregated');
                          setValue('xAxis', '');
                          setValue('aggregateFunc', '');
                          setValue('yAxis', '');
                          setValue('dimension_col', '');
                          setValue('aggregate_col_alias', '');
                          setLocalAliasValue('');
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select computation_type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="raw">Raw data</SelectItem>
                        <SelectItem value="aggregated">Aggregated data</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Raw Data Fields */}
                  {watchedMode === 'raw' && (
                    <div className="space-y-4 bg-muted/30 border border-muted rounded-lg p-4">
                      {/* X-Axis */}
                      <div>
                        <label className="block text-sm font-medium mb-2">X-Axis</label>
                        <Select
                          value={watchedXAxis}
                          onValueChange={(value) => setValue('xAxis', value)}
                          disabled={!watchedTable || columnsLoading}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={columnsLoading ? 'Loading...' : 'Choose X-Axis'}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {columnsError && (
                              <div className="px-3 py-2 text-red-500 text-sm">
                                {columnsError.message}
                              </div>
                            )}
                            {columns?.map((column) => (
                              <SelectItem key={column.name} value={column.name}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{column.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {column.data_type}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Y-Axis */}
                      <div>
                        <label className="block text-sm font-medium mb-2">Y-Axis</label>
                        <Select
                          value={watchedYAxis}
                          onValueChange={(value) => setValue('yAxis', value)}
                          disabled={!watchedTable || columnsLoading}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={columnsLoading ? 'Loading...' : 'Choose Y-Axis'}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {columnsError && (
                              <div className="px-3 py-2 text-red-500 text-sm">
                                {columnsError.message}
                              </div>
                            )}
                            {columns?.map((column) => (
                              <SelectItem key={column.name} value={column.name}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{column.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {column.data_type}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* Aggregated Data Fields */}
                  {watchedMode === 'aggregated' && (
                    <div className="space-y-4 bg-muted/30 border border-muted rounded-lg p-4">
                      {/* X-Axis */}
                      <div>
                        <label className="block text-sm font-medium mb-2">X-Axis</label>
                        <Select
                          value={watchedXAxis}
                          onValueChange={(value) => setValue('xAxis', value)}
                          disabled={!watchedTable || columnsLoading}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={columnsLoading ? 'Loading...' : 'Choose X-Axis'}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {columnsError && (
                              <div className="px-3 py-2 text-red-500 text-sm">
                                {columnsError.message}
                              </div>
                            )}
                            {columns?.map((column) => (
                              <SelectItem key={column.name} value={column.name}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{column.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {column.data_type}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Aggregate Function */}
                      <div>
                        <label className="block text-sm font-medium mb-2">Aggregate Function</label>
                        <Select
                          value={watchedAggregateFunc}
                          onValueChange={(value) => setValue('aggregateFunc', value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select function" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sum">Sum</SelectItem>
                            <SelectItem value="avg">Average</SelectItem>
                            <SelectItem value="min">Min</SelectItem>
                            <SelectItem value="max">Max</SelectItem>
                            <SelectItem value="count">Count</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Aggregate Column (not shown for count) */}
                      {watchedAggregateFunc !== 'count' && (
                        <div>
                          <label className="block text-sm font-medium mb-2">Aggregate Column</label>
                          <Select
                            value={watchedYAxis}
                            onValueChange={(value) => setValue('yAxis', value)}
                            disabled={!watchedTable || columnsLoading}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={columnsLoading ? 'Loading...' : 'Choose column'}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {columnsError && (
                                <div className="px-3 py-2 text-red-500 text-sm">
                                  {columnsError.message}
                                </div>
                              )}
                              {columns?.map((column) => (
                                <SelectItem key={column.name} value={column.name}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{column.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {column.data_type}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Aggregate Column Alias */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Aggregate Column Alias
                        </label>
                        <Input
                          placeholder="Enter alias for aggregate column"
                          value={localAliasValue}
                          onChange={(e) => setLocalAliasValue(e.target.value)}
                          className="h-9"
                        />
                      </div>

                      {/* Dimension Field */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-medium">Dimension</label>
                          {watchedDimension && (
                            <span
                              className="text-sm text-muted-foreground cursor-pointer hover:text-foreground text-red-500"
                              onClick={() => setValue('dimension_col', '')}
                            >
                              Clear
                            </span>
                          )}
                        </div>
                        <Select
                          value={watchedDimension}
                          onValueChange={(value) => setValue('dimension_col', value)}
                          disabled={!watchedTable || columnsLoading}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={columnsLoading ? 'Loading...' : 'Choose dimension'}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {columnsError && (
                              <div className="px-3 py-2 text-red-500 text-sm">
                                {columnsError.message}
                              </div>
                            )}
                            {columns
                              ?.filter((column) => column.name !== watchedXAxis)
                              .map((column) => (
                                <SelectItem key={column.name} value={column.name}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{column.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {column.data_type}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* Data Limit */}
                  {chartLibraryType === 'echarts' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Data Limit</label>
                      <Select
                        value={watchedDataLimit}
                        onValueChange={(value) => setValue('dataLimit', value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="10 records" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 records</SelectItem>
                          <SelectItem value="10">10 records</SelectItem>
                          <SelectItem value="25">25 records</SelectItem>
                          <SelectItem value="50">50 records</SelectItem>
                          <SelectItem value="100">100 records</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Validation Messages */}
                {chartValidation && !chartValidation.isValid && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-amber-800 font-medium text-sm mb-2">
                      <span>⚠️</span>
                      <span>Recommendations</span>
                    </div>
                    {chartValidation.errors.length > 0 && (
                      <div className="text-sm text-amber-700 mb-2">
                        <strong>Issues:</strong> {chartValidation.errors.join(', ')}
                      </div>
                    )}
                    {chartValidation.recommendations && (
                      <div className="text-sm text-amber-700">
                        {chartValidation.recommendations.map((rec, index) => (
                          <div key={index} className="flex items-start gap-1">
                            <span>•</span>
                            <span>{rec}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {chartValidation && chartValidation.isValid && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-emerald-800 font-medium text-sm">
                      <span>✅</span>
                      <span>Configuration looks great!</span>
                    </div>
                  </div>
                )}

                {chartDataError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="text-red-800 text-sm font-medium">Error</div>
                    <div className="text-red-700 text-sm">{chartDataError?.message}</div>
                  </div>
                )}
              </form>
            </div>

            {/* Chart Preview Section */}
            <div className="lg:col-span-1 xl:col-span-5 lg:overflow-y-auto lg:pl-2">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold">Chart Preview</h3>
                  <p className="text-sm text-muted-foreground">
                    Live preview updates as you configure
                  </p>
                </div>

                {/* Chart Rendering Area */}
                <div className="w-full">
                  {isChartDataLoading && (
                    <div className="flex items-center justify-center min-h-[400px] bg-muted/30 rounded-lg border border-dashed">
                      <div className="text-center">
                        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                        <div className="text-muted-foreground font-medium text-lg">
                          Generating chart...
                        </div>
                        <div className="text-sm text-muted-foreground mt-2">
                          This may take a few moments
                        </div>
                      </div>
                    </div>
                  )}

                  {chartDataError && (
                    <div className="flex items-center justify-center min-h-[400px] bg-red-50 rounded-lg border border-red-200">
                      <div className="text-center text-red-600">
                        <div className="text-4xl mb-4">⚠️</div>
                        <div className="font-medium text-lg">Unable to generate chart</div>
                        <div className="text-sm text-red-500 mt-2">
                          Check your configuration and try again
                        </div>
                      </div>
                    </div>
                  )}

                  {!chartData && !isChartDataLoading && !chartDataError && (
                    <div className="flex items-center justify-center min-h-[400px] bg-muted/30 rounded-lg border-2 border-dashed">
                      <div className="text-center text-muted-foreground">
                        <div className="text-5xl mb-4">📊</div>
                        <p className="font-medium mb-2 text-lg">Ready to create your chart</p>
                        <p className="text-sm">Fill out the form to see a live preview</p>
                      </div>
                    </div>
                  )}

                  {chartData && !isChartDataLoading && (
                    <div className="space-y-6">
                      {/* Chart Rendering Area - Responsive Height */}
                      <div className="w-full min-h-[400px] overflow-auto">
                        {chartLibraryType === 'echarts' && (
                          <EChartsComponent data={chartData} customOptions={{}} />
                        )}

                        {chartLibraryType === 'nivo' && (
                          <div className="flex items-center justify-center h-[400px] bg-muted/30 rounded-lg border-2 border-dashed">
                            <div className="text-center text-muted-foreground">
                              <p className="font-medium mb-2 text-lg">
                                Nivo charts are being updated
                              </p>
                              <p className="text-sm">Please use ECharts for now</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Chart Details for Saving */}
                      <div className="pt-6 border-t bg-background space-y-4">
                        <h4 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide border-b pb-2">
                          Save Chart
                        </h4>

                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">Chart Name</label>
                            <Input
                              {...register('chartName', { required: 'Chart name is required' })}
                              placeholder="Enter a descriptive name"
                              className="w-full"
                            />
                            {errors.chartName && (
                              <span className="text-red-500 text-sm mt-1 block">
                                {errors.chartName.message}
                              </span>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Description (Optional)
                            </label>
                            <Textarea
                              {...register('chartDescription')}
                              placeholder="Add context about what this chart shows..."
                              className="min-h-[40px] resize-none"
                              rows={3}
                            />
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                          <Button onClick={handleSaveChart} disabled={isLoading} className="flex-1">
                            {isLoading
                              ? editChart
                                ? 'Updating...'
                                : 'Saving...'
                              : editChart
                                ? 'Update Chart'
                                : 'Save Chart'}
                          </Button>
                          {editChart && onDelete && (
                            <Button
                              variant="destructive"
                              onClick={handleDeleteChart}
                              disabled={isLoading}
                              className="sm:w-auto"
                            >
                              {isLoading ? 'Deleting...' : 'Delete'}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            onClick={() => {
                              resetForm();
                              onOpenChange(false);
                            }}
                            disabled={isLoading}
                            className="sm:w-auto"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
