'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import {
  Loader2,
  BarChart,
  LineChart,
  PieChart,
  Save,
  Download,
  Eye,
  EyeOff,
  ScatterChart,
  TrendingUp,
  Funnel,
  Radar,
  Grid,
  Table,
  Gauge,
  BoxSelect,
  CandlestickChart,
  Network,
  Grid3x3,
  CircleDot,
  Hash,
} from 'lucide-react';
import {
  useSchemas,
  useTables,
  useColumns,
  useChartData,
  useChartSave,
  ChartDataPayload,
  ChartCreatePayload,
} from '@/hooks/api/useChart';
import { ChartPreview } from './ChartPreview';
import ChartExport from './ChartExport';
import { useToast } from '@/components/ui/use-toast';
import { getSampleDataForChartType } from '@/lib/chartTemplates';

type ChartType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'scatter'
  | 'area'
  | 'funnel'
  | 'radar'
  | 'heatmap'
  | 'table'
  | 'gauge'
  | 'boxplot'
  | 'candlestick'
  | 'sankey'
  | 'treemap'
  | 'sunburst'
  | 'number';

interface ChartBuilderProps {
  onSave: (data: ChartCreatePayload) => Promise<void>;
  onCancel?: () => void;
  chartId?: number;
}

interface ChartFormData extends ChartDataPayload {
  title?: string;
  description?: string;
  chart_type: ChartType;
  dimension_col?: string;
  aggregate_col?: string;
  aggregate_func?: string;
  aggregate_col_alias?: string;
}

const chartTypeOptions: Array<{ value: ChartType; label: string; icon: any }> = [
  { value: 'bar', label: 'Bar Chart', icon: BarChart },
  { value: 'line', label: 'Line Chart', icon: LineChart },
  { value: 'pie', label: 'Pie Chart', icon: PieChart },
];

export default function ChartBuilder({ onSave, onCancel, chartId }: ChartBuilderProps) {
  const { toast } = useToast();
  const chartPreviewRef = useRef<any>(null);

  const [formData, setFormData] = useState<ChartFormData>({
    title: '',
    description: '',
    chart_type: 'bar',
    computation_type: 'raw',
    schema_name: '',
    table: '',
    xAxis: '',
    yAxis: '',
    dimensions: [],
    offset: 0,
    limit: 100,
  });

  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedChartId, setSavedChartId] = useState<number | null>(chartId || null);
  const [useSampleData, setUseSampleData] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted - handleSubmit called');
    setIsSaving(true);

    try {
      // Prepare the payload based on whether using sample data or not
      let payload: ChartCreatePayload;

      if (useSampleData) {
        // For sample data, create a minimal payload that matches backend schema
        payload = {
          title: formData.title || 'Untitled Chart',
          description: formData.description,
          chart_type: formData.chart_type,
          schema_name: 'sample',
          table: 'sample_data',
          config: {
            chartType: formData.chart_type,
            computation_type: 'raw',
            xAxis: 'x',
            yAxis: 'y',
            dimensions: [],
          },
          is_public: false,
        };
      } else {
        // For real data, use the full configuration
        payload = {
          title: formData.title || 'Untitled Chart',
          description: formData.description,
          chart_type: formData.chart_type,
          schema_name: formData.schema_name,
          table: formData.table,
          config: {
            chartType: formData.chart_type,
            computation_type: formData.computation_type,
            xAxis: formData.xAxis,
            yAxis: formData.yAxis,
            dimensions: formData.dimensions,
            aggregate_col: formData.aggregate_col,
            aggregate_func: formData.aggregate_func,
            aggregate_col_alias: formData.aggregate_col_alias,
            dimension_col: formData.dimension_col,
          },
          is_public: false,
        };
      }

      console.log('Sending payload to onSave:', payload);
      const result = await onSave(payload);
      console.log('Save result:', result);
      toast({
        title: 'Success',
        description: 'Chart saved successfully',
      });
    } catch (error: any) {
      console.error('Failed to save chart - Full error:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);

      toast({
        title: 'Error',
        description: error.message || 'Failed to save chart',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChartTypeChange = (type: ChartType) => {
    setFormData((prev) => ({
      ...prev,
      chart_type: type,
      computation_type: isAggregatedChartType(type) ? 'aggregated' : 'raw',
    }));
  };

  const isAggregatedChartType = (type: string) => {
    return ['pie', 'funnel', 'gauge', 'treemap', 'sunburst', 'number'].includes(type);
  };

  // Refs
  const { data: schemas, isLoading: schemasLoading, error: schemasError } = useSchemas();
  const {
    data: tables,
    isLoading: tablesLoading,
    error: tablesError,
  } = useTables(formData.schema_name);
  const {
    data: columns,
    isLoading: columnsLoading,
    error: columnsError,
  } = useColumns(formData.schema_name, formData.table);
  const { save } = useChartSave();

  // Chart data payload
  const chartDataPayload: ChartDataPayload | null = React.useMemo(() => {
    if (!formData.schema_name || !formData.table) return null;

    const basePayload: ChartDataPayload = {
      chart_type: formData.chart_type,
      computation_type: formData.computation_type,
      schema_name: formData.schema_name,
      table: formData.table,
      offset: 0,
      limit: 100,
    };

    if (formData.computation_type === 'raw') {
      if (formData.xAxis && formData.yAxis) {
        return {
          ...basePayload,
          xAxis: formData.xAxis,
          yAxis: formData.yAxis,
        };
      }
    } else {
      if (formData.dimension_col && formData.aggregate_col && formData.aggregate_func) {
        return {
          ...basePayload,
          xaxis: formData.dimension_col, // Backend expects xaxis for aggregated charts
          aggregate_col: formData.aggregate_col,
          aggregate_func: formData.aggregate_func,
          aggregate_col_alias:
            formData.aggregate_col_alias || `${formData.aggregate_func}_${formData.aggregate_col}`,
        };
      }
    }

    return null;
  }, [
    formData.chart_type,
    formData.computation_type,
    formData.schema_name,
    formData.table,
    formData.xAxis,
    formData.yAxis,
    formData.dimension_col,
    formData.aggregate_col,
    formData.aggregate_func,
    formData.aggregate_col_alias,
  ]);

  const {
    data: chartData,
    isLoading: chartLoading,
    error: chartError,
  } = useChartData(chartDataPayload);

  // Chart type options
  // const chartTypeOptions = [
  //   { value: 'bar', label: 'Bar Chart', icon: BarChart },
  //   { value: 'line', label: 'Line Chart', icon: LineChart },
  //   { value: 'pie', label: 'Pie Chart', icon: PieChart },
  // ];

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
    if (formData.chart_type) progress += 20;
    if (formData.computation_type) progress += 20;
    if (formData.schema_name) progress += 20;
    if (formData.table) progress += 20;
    if (formData.computation_type === 'raw' && formData.xAxis && formData.yAxis) progress += 20;
    if (
      formData.computation_type === 'aggregated' &&
      formData.dimension_col &&
      formData.aggregate_col &&
      formData.aggregate_func
    )
      progress += 20;
    return progress;
  };

  // Auto-advance steps
  useEffect(() => {
    if (formData.chart_type && formData.schema_name && formData.table) {
      // setCurrentStep(4); // This line was removed from the new_code, so it's removed here.
    } else if (formData.chart_type && formData.schema_name) {
      // setCurrentStep(3); // This line was removed from the new_code, so it's removed here.
    } else if (formData.chart_type) {
      // setCurrentStep(2); // This line was removed from the new_code, so it's removed here.
    }
  }, [formData.chart_type, formData.schema_name, formData.table]);

  // Reset dependent selections
  useEffect(() => {
    // setSelectedTable(''); // This line was removed from the new_code, so it's removed here.
    // setSelectedXAxis(''); // This line was removed from the new_code, so it's removed here.
    // setSelectedYAxis(''); // This line was removed from the new_code, so it's removed here.
    // setDimensionCol(''); // This line was removed from the new_code, so it's removed here.
    // setAggregateCol(''); // This line was removed from the new_code, so it's removed here.
  }, [formData.schema_name]);

  useEffect(() => {
    // setSelectedXAxis(''); // This line was removed from the new_code, so it's removed here.
    // setSelectedYAxis(''); // This line was removed from the new_code, so it's removed here.
    // setDimensionCol(''); // This line was removed from the new_code, so it's removed here.
    // setAggregateCol(''); // This line was removed from the new_code, so it's removed here.
  }, [formData.table]);

  // Handle save
  const handleSave = async () => {
    if (!formData.title || !chartDataPayload) return;

    setIsSaving(true);
    try {
      const chartConfig = {
        chartType: formData.chart_type,
        computation_type: formData.computation_type,
        ...(formData.computation_type === 'raw'
          ? { xAxis: formData.xAxis, yAxis: formData.yAxis }
          : {
              dimension_col: formData.dimension_col,
              aggregate_col: formData.aggregate_col,
              aggregate_func: formData.aggregate_func,
              aggregate_col_alias: formData.aggregate_col_alias,
            }),
        dimensions: formData.dimensions,
      };

      const payload = {
        title: formData.title,
        description: formData.description,
        chart_type: formData.chart_type, // Use the actual chart type, not 'echarts'
        schema_name: formData.schema_name,
        table: formData.table,
        config: chartConfig,
        is_public: false,
      };

      const result = await save(payload);

      // Store the saved chart ID
      if (result && result.data && result.data.id) {
        setSavedChartId(result.data.id);
        toast({
          title: 'Success',
          description: 'Chart saved successfully',
          variant: 'default',
        });
      }

      if (onSave) {
        onSave(result);
      }
    } catch (error) {
      console.error('Error saving chart:', error);
      // Show error message
      toast({
        title: 'Error saving chart',
        description: error.message || 'Failed to save chart. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  console.log(schemas);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Chart Builder</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Chart Type Selection */}
          <div className="space-y-4">
            <Label>Chart Type</Label>
            <div className="grid grid-cols-3 gap-4">
              {chartTypeOptions.map((option) => (
                <div
                  key={option.value}
                  className={`flex items-center p-2 rounded-lg cursor-pointer border ${
                    formData.chart_type === option.value
                      ? 'border-primary bg-primary/10'
                      : 'border-gray-200'
                  }`}
                  onClick={() => handleChartTypeChange(option.value)}
                >
                  <option.icon className="w-4 h-4 mr-2" />
                  <span>{option.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Data Source Selection */}
          {formData.chart_type && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium mb-2">Choose Data Source</h3>
                <RadioGroup
                  value={useSampleData ? 'sample' : 'warehouse'}
                  onValueChange={(value) => {
                    setUseSampleData(value === 'sample');
                    if (value === 'sample') {
                      // Load sample data for the selected chart type
                      const sampleTemplate = getSampleDataForChartType(formData.chart_type);
                      setFormData((prev) => ({
                        ...prev,
                        title: sampleTemplate.title,
                        description: sampleTemplate.description,
                      }));
                    }
                  }}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <RadioGroupItem value="sample" id="sample" />
                    <Label htmlFor="sample" className="font-normal cursor-pointer">
                      Use Sample Data (Quick Preview)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="warehouse" id="warehouse" />
                    <Label htmlFor="warehouse" className="font-normal cursor-pointer">
                      Connect to Data Warehouse
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Computation Type Selection - Only show for warehouse data */}
              {!useSampleData && (
                <div className="space-y-2">
                  <Label>Data Type</Label>
                  <RadioGroup
                    value={formData.computation_type}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        computation_type: value as 'raw' | 'aggregated',
                      }))
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="raw" id="raw" />
                      <Label htmlFor="raw">Raw Data</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="aggregated" id="aggregated" />
                      <Label htmlFor="aggregated">Aggregated Data</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>
          )}

          {/* Schema Selection - Only show for warehouse data */}
          {!useSampleData && formData.chart_type && formData.computation_type && (
            <div className="space-y-2">
              <Label htmlFor="schema">Schema</Label>
              <Select
                value={formData.schema_name}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    schema_name: value,
                    table: '',
                    xAxis: '',
                    yAxis: '',
                    dimension_col: '',
                    aggregate_col: '',
                  }))
                }
              >
                <SelectTrigger id="schema">
                  <SelectValue placeholder="Select a schema" />
                </SelectTrigger>
                <SelectContent>
                  {schemasLoading && (
                    <SelectItem value="loading" disabled>
                      Loading...
                    </SelectItem>
                  )}
                  {schemasError && (
                    <SelectItem value="error" disabled>
                      Error loading schemas
                    </SelectItem>
                  )}
                  {schemas?.map((schema: string) => (
                    <SelectItem key={schema} value={schema}>
                      {schema}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Table Selection - Only show for warehouse data */}
          {!useSampleData && formData.schema_name && (
            <div className="space-y-2">
              <Label htmlFor="table">Table</Label>
              <Select
                value={formData.table}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    table: value,
                    xAxis: '',
                    yAxis: '',
                    dimension_col: '',
                    aggregate_col: '',
                  }))
                }
              >
                <SelectTrigger id="table">
                  <SelectValue placeholder="Select a table" />
                </SelectTrigger>
                <SelectContent>
                  {tablesLoading && (
                    <SelectItem value="loading" disabled>
                      Loading...
                    </SelectItem>
                  )}
                  {tablesError && (
                    <SelectItem value="error" disabled>
                      Error loading tables
                    </SelectItem>
                  )}
                  {tables?.map((table: any) => (
                    <SelectItem key={table.name} value={table.name}>
                      {table.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Column Selection for Raw Data - Only show for warehouse data */}
          {!useSampleData && formData.computation_type === 'raw' && formData.table && (
            <>
              <div className="space-y-2">
                <Label htmlFor="xAxis">X-Axis Column</Label>
                <Select
                  value={formData.xAxis}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, xAxis: value }))}
                >
                  <SelectTrigger id="xAxis">
                    <SelectValue placeholder="Select X-axis column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columnsLoading && (
                      <SelectItem value="loading" disabled>
                        Loading...
                      </SelectItem>
                    )}
                    {columnsError && (
                      <SelectItem value="error" disabled>
                        Error loading columns
                      </SelectItem>
                    )}
                    {columns?.map((col: any) => (
                      <SelectItem key={col.name} value={col.name}>
                        {col.name} ({col.data_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="yAxis">Y-Axis Column</Label>
                <Select
                  value={formData.yAxis}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, yAxis: value }))}
                >
                  <SelectTrigger id="yAxis">
                    <SelectValue placeholder="Select Y-axis column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columnsLoading && (
                      <SelectItem value="loading" disabled>
                        Loading...
                      </SelectItem>
                    )}
                    {columnsError && (
                      <SelectItem value="error" disabled>
                        Error loading columns
                      </SelectItem>
                    )}
                    {columns
                      ?.filter((col: any) =>
                        ['integer', 'numeric', 'double precision', 'real', 'bigint'].includes(
                          col.data_type.toLowerCase()
                        )
                      )
                      ?.map((col: any) => (
                        <SelectItem key={col.name} value={col.name}>
                          {col.name} ({col.data_type})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Column Selection for Aggregated Data - Only show for warehouse data */}
          {!useSampleData && formData.computation_type === 'aggregated' && formData.table && (
            <>
              <div className="space-y-2">
                <Label htmlFor="dimension">Dimension Column</Label>
                <Select
                  value={formData.dimension_col || ''}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, dimension_col: value }))
                  }
                >
                  <SelectTrigger id="dimension">
                    <SelectValue placeholder="Select dimension column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columnsLoading && (
                      <SelectItem value="loading" disabled>
                        Loading...
                      </SelectItem>
                    )}
                    {columnsError && (
                      <SelectItem value="error" disabled>
                        Error loading columns
                      </SelectItem>
                    )}
                    {columns?.map((col: any) => (
                      <SelectItem key={col.name} value={col.name}>
                        {col.name} ({col.data_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aggregate">Aggregate Column</Label>
                <Select
                  value={formData.aggregate_col || ''}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, aggregate_col: value }))
                  }
                >
                  <SelectTrigger id="aggregate">
                    <SelectValue placeholder="Select aggregate column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columnsLoading && (
                      <SelectItem value="loading" disabled>
                        Loading...
                      </SelectItem>
                    )}
                    {columnsError && (
                      <SelectItem value="error" disabled>
                        Error loading columns
                      </SelectItem>
                    )}
                    {columns
                      ?.filter((col: any) =>
                        ['integer', 'numeric', 'double precision', 'real', 'bigint'].includes(
                          col.data_type.toLowerCase()
                        )
                      )
                      ?.map((col: any) => (
                        <SelectItem key={col.name} value={col.name}>
                          {col.name} ({col.data_type})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="function">Aggregate Function</Label>
                <Select
                  value={formData.aggregate_func || ''}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, aggregate_func: value }))
                  }
                >
                  <SelectTrigger id="function">
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
            </>
          )}

          {/* Chart Title and Description */}
          {(formData.table || useSampleData) && (
            <>
              <div className="space-y-2">
                <Label htmlFor="title">Chart Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter chart title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Enter chart description"
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Progress Indicator */}
          {!useSampleData && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{getProgress()}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${getProgress()}%` }}
                />
              </div>
            </div>
          )}

          {/* Preview Section */}
          {(chartData || useSampleData) && (
            <div className="space-y-4">
              <Separator />
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Chart Preview</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPreviewMode(!isPreviewMode)}
                >
                  {isPreviewMode ? (
                    <>
                      <EyeOff className="w-4 h-4 mr-2" /> Hide Preview
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" /> Show Preview
                    </>
                  )}
                </Button>
              </div>

              {isPreviewMode && (
                <div className="border rounded-lg p-4">
                  <ChartPreview
                    ref={chartPreviewRef}
                    chartData={
                      useSampleData
                        ? getSampleDataForChartType(formData.chart_type).echarts
                        : chartData
                    }
                    config={{
                      title: formData.title || 'Chart Preview',
                      chartType: formData.chart_type as 'bar' | 'line' | 'pie',
                      isLoading: !useSampleData && chartLoading,
                      error: !useSampleData ? chartError : null,
                      useSampleData: useSampleData,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || (!formData.title && !useSampleData)}>
              {isSaving ? 'Saving...' : 'Save Chart'}
            </Button>
          </div>
        </form>

        {savedChartId && (
          <div className="mt-4">
            <ChartExport
              chartId={savedChartId}
              chartTitle={formData.title || 'Untitled Chart'}
              echartsRef={chartPreviewRef}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
