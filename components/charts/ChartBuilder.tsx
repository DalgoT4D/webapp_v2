'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, BarChart, LineChart, PieChart, Save, Download, Eye, EyeOff } from 'lucide-react';
import {
  useSchemas,
  useTables,
  useColumns,
  useChartData,
  useChartSave,
  ChartDataPayload,
} from '@/hooks/api/useChart';
import { ChartPreview } from './ChartPreview';

export interface ChartBuilderProps {
  chartId?: number;
  onSave?: (chart: any) => void;
  onCancel?: () => void;
}

export function ChartBuilder({ chartId, onSave, onCancel }: ChartBuilderProps) {
  // Form state
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const [computationType, setComputationType] = useState<'raw' | 'aggregated'>('raw');
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedXAxis, setSelectedXAxis] = useState<string>('');
  const [selectedYAxis, setSelectedYAxis] = useState<string>('');
  const [dimensions, setDimensions] = useState<string[]>([]);
  const [aggregateCol, setAggregateCol] = useState<string>('');
  const [aggregateFunc, setAggregateFunc] = useState<string>('sum');
  const [aggregateColAlias, setAggregateColAlias] = useState<string>('');
  const [dimensionCol, setDimensionCol] = useState<string>('');

  // Chart metadata
  const [chartTitle, setChartTitle] = useState<string>('');
  const [chartDescription, setChartDescription] = useState<string>('');
  const [isPublic, setIsPublic] = useState<boolean>(false);

  // UI state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // API hooks
  const { data: schemas, isLoading: schemasLoading, error: schemasError } = useSchemas();
  const { data: tables, isLoading: tablesLoading, error: tablesError } = useTables(selectedSchema);
  const {
    data: columns,
    isLoading: columnsLoading,
    error: columnsError,
  } = useColumns(selectedSchema, selectedTable);
  const { save } = useChartSave();

  // Chart data payload
  const chartDataPayload: ChartDataPayload | null = React.useMemo(() => {
    if (!selectedSchema || !selectedTable) return null;

    const basePayload: ChartDataPayload = {
      chart_type: chartType,
      computation_type: computationType,
      schema_name: selectedSchema,
      table_name: selectedTable,
      offset: 0,
      limit: 100,
    };

    if (computationType === 'raw') {
      if (selectedXAxis && selectedYAxis) {
        return {
          ...basePayload,
          xaxis: selectedXAxis,
          yaxis: selectedYAxis,
        };
      }
    } else {
      if (dimensionCol && aggregateCol && aggregateFunc) {
        return {
          ...basePayload,
          dimension_col: dimensionCol,
          aggregate_col: aggregateCol,
          aggregate_func: aggregateFunc,
          aggregate_col_alias: aggregateColAlias || `${aggregateFunc}_${aggregateCol}`,
        };
      }
    }

    return null;
  }, [
    chartType,
    computationType,
    selectedSchema,
    selectedTable,
    selectedXAxis,
    selectedYAxis,
    dimensionCol,
    aggregateCol,
    aggregateFunc,
    aggregateColAlias,
  ]);

  const {
    data: chartData,
    isLoading: chartLoading,
    error: chartError,
  } = useChartData(chartDataPayload);

  // Chart type options
  const chartTypeOptions = [
    { value: 'bar', label: 'Bar Chart', icon: BarChart },
    { value: 'line', label: 'Line Chart', icon: LineChart },
    { value: 'pie', label: 'Pie Chart', icon: PieChart },
  ];

  // Aggregate functions
  const aggregateFunctions = [
    { value: 'sum', label: 'Sum' },
    { value: 'avg', label: 'Average' },
    { value: 'count', label: 'Count' },
    { value: 'min', label: 'Minimum' },
    { value: 'max', label: 'Maximum' },
  ];

  // Progress tracking
  const getProgress = () => {
    let progress = 0;
    if (chartType) progress += 20;
    if (selectedSchema) progress += 20;
    if (selectedTable) progress += 20;
    if (computationType === 'raw' && selectedXAxis && selectedYAxis) progress += 40;
    if (computationType === 'aggregated' && dimensionCol && aggregateCol) progress += 40;
    return progress;
  };

  // Auto-advance steps
  useEffect(() => {
    if (chartType && selectedSchema && selectedTable) {
      setCurrentStep(4);
    } else if (chartType && selectedSchema) {
      setCurrentStep(3);
    } else if (chartType) {
      setCurrentStep(2);
    }
  }, [chartType, selectedSchema, selectedTable]);

  // Reset dependent selections
  useEffect(() => {
    setSelectedTable('');
    setSelectedXAxis('');
    setSelectedYAxis('');
    setDimensionCol('');
    setAggregateCol('');
  }, [selectedSchema]);

  useEffect(() => {
    setSelectedXAxis('');
    setSelectedYAxis('');
    setDimensionCol('');
    setAggregateCol('');
  }, [selectedTable]);

  // Handle save
  const handleSave = async () => {
    if (!chartTitle || !chartDataPayload) return;

    setIsSaving(true);
    try {
      const chartConfig = {
        chartType,
        computation_type: computationType,
        ...(computationType === 'raw'
          ? { xAxis: selectedXAxis, yAxis: selectedYAxis }
          : {
              dimension_col: dimensionCol,
              aggregate_col: aggregateCol,
              aggregate_func: aggregateFunc,
              aggregate_col_alias: aggregateColAlias,
            }),
        dimensions,
      };

      const payload = {
        title: chartTitle,
        description: chartDescription,
        chart_type: 'echarts', // Chart library type
        schema_name: selectedSchema,
        table: selectedTable,
        config: chartConfig,
        is_public: isPublic,
      };

      const result = await save(payload);

      if (onSave) {
        onSave(result);
      }
    } catch (error) {
      console.error('Error saving chart:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full max-h-screen">
      {/* Left Panel - Configuration */}
      <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Chart Builder</h2>
              <p className="text-gray-600 mt-1">Create interactive charts from your data</p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">Progress: {getProgress()}%</Badge>
              <Button variant="outline" size="sm" onClick={() => setIsPreviewMode(!isPreviewMode)}>
                {isPreviewMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                Preview
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${getProgress()}%` }}
            />
          </div>

          {/* Step 1: Chart Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Step 1: Select Chart Type</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={chartType} onValueChange={(value) => setChartType(value as any)}>
                <div className="grid grid-cols-3 gap-4">
                  {chartTypeOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label
                        htmlFor={option.value}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <option.icon className="h-4 w-4" />
                        <span>{option.label}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Step 2: Data Processing Type */}
          {chartType && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Step 2: Data Processing</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={computationType}
                  onValueChange={(value) => setComputationType(value as any)}
                >
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="raw" id="raw" />
                      <Label htmlFor="raw">
                        <div>
                          <div className="font-medium">Raw Data</div>
                          <div className="text-sm text-gray-600">Direct column mapping</div>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="aggregated" id="aggregated" />
                      <Label htmlFor="aggregated">
                        <div>
                          <div className="font-medium">Aggregated Data</div>
                          <div className="text-sm text-gray-600">Group and aggregate data</div>
                        </div>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Schema and Table Selection */}
          {chartType && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Step 3: Data Source</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Schema</Label>
                  <Select value={selectedSchema} onValueChange={setSelectedSchema}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={schemasLoading ? 'Loading schemas...' : 'Select schema'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {schemasError && (
                        <div className="text-red-500 p-2 text-sm">Error loading schemas</div>
                      )}
                      {schemas?.map((schema: string) => (
                        <SelectItem key={schema} value={schema}>
                          {schema}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Table</Label>
                  <Select
                    value={selectedTable}
                    onValueChange={setSelectedTable}
                    disabled={!selectedSchema}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={tablesLoading ? 'Loading tables...' : 'Select table'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {tablesError && (
                        <div className="text-red-500 p-2 text-sm">Error loading tables</div>
                      )}
                      {tables?.map((table: string) => (
                        <SelectItem key={table} value={table}>
                          {table}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Column Configuration */}
          {selectedSchema && selectedTable && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Step 4: Configure Data Mapping</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {computationType === 'raw' ? (
                  <>
                    <div>
                      <Label>X-Axis Column</Label>
                      <Select value={selectedXAxis} onValueChange={setSelectedXAxis}>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={columnsLoading ? 'Loading...' : 'Select X-axis'}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {columnsError && (
                            <div className="text-red-500 p-2 text-sm">Error loading columns</div>
                          )}
                          {columns?.map((column: { name: string; data_type: string }) => (
                            <SelectItem key={column.name} value={column.name}>
                              {column.name} ({column.data_type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Y-Axis Column</Label>
                      <Select value={selectedYAxis} onValueChange={setSelectedYAxis}>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={columnsLoading ? 'Loading...' : 'Select Y-axis'}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {columnsError && (
                            <div className="text-red-500 p-2 text-sm">Error loading columns</div>
                          )}
                          {columns?.map((column: { name: string; data_type: string }) => (
                            <SelectItem key={column.name} value={column.name}>
                              {column.name} ({column.data_type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label>Dimension Column</Label>
                      <Select value={dimensionCol} onValueChange={setDimensionCol}>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={columnsLoading ? 'Loading...' : 'Select dimension'}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {columnsError && (
                            <div className="text-red-500 p-2 text-sm">Error loading columns</div>
                          )}
                          {columns?.map((column: { name: string; data_type: string }) => (
                            <SelectItem key={column.name} value={column.name}>
                              {column.name} ({column.data_type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Aggregate Column</Label>
                      <Select value={aggregateCol} onValueChange={setAggregateCol}>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              columnsLoading ? 'Loading...' : 'Select column to aggregate'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {columnsError && (
                            <div className="text-red-500 p-2 text-sm">Error loading columns</div>
                          )}
                          {columns?.map((column: { name: string; data_type: string }) => (
                            <SelectItem key={column.name} value={column.name}>
                              {column.name} ({column.data_type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Aggregate Function</Label>
                      <Select value={aggregateFunc} onValueChange={setAggregateFunc}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select function" />
                        </SelectTrigger>
                        <SelectContent>
                          {aggregateFunctions.map((func) => (
                            <SelectItem key={func.value} value={func.value}>
                              {func.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Alias (Optional)</Label>
                      <Input
                        value={aggregateColAlias}
                        onChange={(e) => setAggregateColAlias(e.target.value)}
                        placeholder="Enter custom alias"
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 5: Chart Details */}
          {chartDataPayload && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Step 5: Chart Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Chart Title *</Label>
                  <Input
                    value={chartTitle}
                    onChange={(e) => setChartTitle(e.target.value)}
                    placeholder="Enter chart title"
                  />
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={chartDescription}
                    onChange={(e) => setChartDescription(e.target.value)}
                    placeholder="Enter chart description"
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                  />
                  <Label htmlFor="isPublic">Make chart public</Label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                disabled={!chartDataPayload}
                onClick={() => {
                  /* Handle export */
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button disabled={!chartTitle || !chartDataPayload || isSaving} onClick={handleSave}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Chart
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Preview */}
      <div className="w-1/2 bg-gray-50">
        <div className="p-6 h-full">
          <ChartPreview
            chartType={chartType}
            chartData={chartData}
            isLoading={chartLoading}
            error={chartError}
            title={chartTitle || 'Preview'}
          />
        </div>
      </div>
    </div>
  );
}
