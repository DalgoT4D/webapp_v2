'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Filter,
  Loader2,
  Database,
  Table,
  Hash,
  Type as TypeIcon,
  Settings2,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiGet, apiPost } from '@/lib/api';
import useSWR from 'swr';
import { useSchemas, useTables, useColumns } from '@/hooks/api/useChart';
import { useDashboardFilter } from '@/hooks/api/useDashboards';
import {
  DashboardFilterType,
  NumericalFilterMode,
  CreateFilterPayload,
  UpdateFilterPayload,
  FilterOption,
  NumericalFilterStats,
  ValueFilterSettings,
  NumericalFilterSettings,
} from '@/types/dashboard-filters';

interface FilterConfigModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (filter: CreateFilterPayload | UpdateFilterPayload, filterId?: number) => void;
  initialData?: Partial<CreateFilterPayload>;
  mode?: 'create' | 'edit';
  filterId?: number;
  dashboardId?: number;
}

function useFilterPreview(
  schemaName?: string,
  tableName?: string,
  columnName?: string,
  filterType?: DashboardFilterType
) {
  return useSWR(
    schemaName && tableName && columnName && filterType
      ? [
          '/api/charts/chart-data/',
          {
            chart_type: 'bar',
            computation_type: 'aggregated',
            schema_name: schemaName,
            table_name: tableName,
            dimension_col: columnName,
            aggregate_col: null,
            aggregate_func: 'count',
            offset: 0,
            limit: filterType === 'value' ? 100 : 1,
          },
        ]
      : null,
    ([url, data]) => apiPost(url, data),
    { revalidateOnFocus: false }
  );
}

export function FilterConfigModal({
  open,
  onClose,
  onSave,
  initialData,
  mode = 'create',
  filterId,
  dashboardId,
}: FilterConfigModalProps) {
  // Fetch fresh filter data from API when editing
  const { data: filterData, isLoading: isLoadingFilter } = useDashboardFilter(
    dashboardId || 0,
    mode === 'edit' ? filterId : undefined
  );

  // Basic filter info - will be initialized from API data
  const [name, setName] = useState('');
  const [schemaName, setSchemaName] = useState('');
  const [tableName, setTableName] = useState('');
  const [columnName, setColumnName] = useState('');
  const [filterType, setFilterType] = useState<DashboardFilterType>(DashboardFilterType.VALUE);
  const [isInitialized, setIsInitialized] = useState(false);

  // Value filter settings
  const [hasDefaultValue, setHasDefaultValue] = useState(false);
  const [canSelectMultiple, setCanSelectMultiple] = useState(false);
  const [defaultValues, setDefaultValues] = useState<string[]>([]);

  // Numerical filter settings
  const [numericalMode, setNumericalMode] = useState<NumericalFilterMode>(
    NumericalFilterMode.RANGE
  );
  const [customRange, setCustomRange] = useState({ min: 0, max: 100 });
  const [defaultSingleValue, setDefaultSingleValue] = useState(0);
  const [defaultRangeValue, setDefaultRangeValue] = useState({ min: 0, max: 100 });

  // Data fetching using existing warehouse APIs
  const { data: schemas, isLoading: loadingSchemas } = useSchemas();
  const { data: tables, isLoading: loadingTables } = useTables(schemaName);
  const { data: columns, isLoading: loadingColumns } = useColumns(schemaName, tableName);
  const { data: filterPreview, isLoading: loadingPreview } = useFilterPreview(
    schemaName,
    tableName,
    columnName,
    filterType
  );

  // Initialize form when modal opens
  useEffect(() => {
    if (open && !isInitialized) {
      // Use fresh data from API for edit mode, initialData for create mode
      const dataToUse = mode === 'edit' ? filterData : initialData;

      if (dataToUse) {
        console.log('FilterConfigModal - Initializing with data:', dataToUse);

        setName(dataToUse.name || '');
        setSchemaName(dataToUse.schema_name || '');
        setTableName(dataToUse.table_name || '');
        setColumnName(dataToUse.column_name || '');
        setFilterType(dataToUse.filter_type || DashboardFilterType.VALUE);

        // Parse settings if they exist
        if (dataToUse.settings) {
          if (dataToUse.filter_type === DashboardFilterType.VALUE) {
            const settings = dataToUse.settings as any;
            setHasDefaultValue(settings.has_default_value || false);
            setCanSelectMultiple(settings.can_select_multiple || false);
            if (settings.default_value) {
              setDefaultValues(
                Array.isArray(settings.default_value)
                  ? settings.default_value
                  : [settings.default_value]
              );
            }
          } else if (dataToUse.filter_type === DashboardFilterType.NUMERICAL) {
            const settings = dataToUse.settings as any;
            setNumericalMode(settings.mode || NumericalFilterMode.RANGE);
            if (settings.min_value !== undefined && settings.max_value !== undefined) {
              setCustomRange({ min: settings.min_value, max: settings.max_value });
            }
            if (settings.default_value !== undefined) {
              setDefaultSingleValue(settings.default_value);
            }
            if (settings.default_min !== undefined && settings.default_max !== undefined) {
              setDefaultRangeValue({ min: settings.default_min, max: settings.default_max });
            }
          }
        }
        setIsInitialized(true);
      } else if (mode === 'create') {
        // No initial data (create mode)
        setIsInitialized(true);
      }
    }

    // Reset form when modal closes
    if (!open) {
      // Reset all form fields
      setName('');
      setSchemaName('');
      setTableName('');
      setColumnName('');
      setFilterType(DashboardFilterType.VALUE);
      setHasDefaultValue(false);
      setCanSelectMultiple(false);
      setDefaultValues([]);
      setNumericalMode(NumericalFilterMode.RANGE);
      setCustomRange({ min: 0, max: 100 });
      setDefaultSingleValue(0);
      setDefaultRangeValue({ min: 0, max: 100 });
      setIsInitialized(false);
    }
  }, [open, filterData, initialData, mode, isInitialized]);

  // Reset dependent fields when parent changes (only if not initializing)
  useEffect(() => {
    if (isInitialized && mode === 'create') {
      setTableName('');
      setColumnName('');
    }
  }, [schemaName]);

  useEffect(() => {
    if (isInitialized && mode === 'create') {
      setColumnName('');
    }
  }, [tableName]);

  useEffect(() => {
    // Auto-generate name when column is selected
    if (columnName && !name) {
      const autoName = columnName
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      setName(autoName);
    }
  }, [columnName, name]);

  const handleSave = () => {
    if (!name) {
      return;
    }

    // For create mode, all fields are required
    if (mode === 'create' && (!schemaName || !tableName || !columnName)) {
      return;
    }

    let settings: ValueFilterSettings | NumericalFilterSettings;

    if (filterType === DashboardFilterType.VALUE) {
      // Extract available values from the chart data
      const availableValues =
        filterPreview?.data?.xAxisData?.slice(0, 100).map((value: string, index: number) => ({
          label: value,
          value: value,
          count: filterPreview?.data?.series?.[0]?.data?.[index] || 0,
        })) || [];

      settings = {
        has_default_value: hasDefaultValue,
        default_value: hasDefaultValue
          ? canSelectMultiple
            ? defaultValues
            : defaultValues[0]
          : undefined,
        can_select_multiple: canSelectMultiple,
        available_values: availableValues,
      } as ValueFilterSettings;
    } else {
      settings = {
        mode: numericalMode,
        min_value: customRange.min,
        max_value: customRange.max,
        default_min:
          numericalMode === NumericalFilterMode.RANGE ? defaultRangeValue.min : undefined,
        default_max:
          numericalMode === NumericalFilterMode.RANGE ? defaultRangeValue.max : undefined,
        default_value:
          numericalMode === NumericalFilterMode.SINGLE ? defaultSingleValue : undefined,
        step: 1,
      } as NumericalFilterSettings;
    }

    if (mode === 'edit') {
      // For edit mode, send all fields that can be updated
      const updatePayload: UpdateFilterPayload = {
        name,
        schema_name: schemaName,
        table_name: tableName,
        column_name: columnName,
        filter_type: filterType,
        settings: settings,
      };
      onSave(updatePayload, filterId);
    } else {
      // For create mode, send all fields
      const createPayload: CreateFilterPayload = {
        name,
        schema_name: schemaName,
        table_name: tableName,
        column_name: columnName,
        filter_type: filterType,
        settings,
      };
      onSave(createPayload);
    }

    handleClose();
  };

  const handleClose = () => {
    // Reset form
    setName('');
    setSchemaName('');
    setTableName('');
    setColumnName('');
    setFilterType(DashboardFilterType.VALUE);
    setHasDefaultValue(false);
    setCanSelectMultiple(false);
    setDefaultValues([]);
    setNumericalMode(NumericalFilterMode.RANGE);
    setIsInitialized(false);
    onClose();
  };

  const isFormValid = mode === 'edit' ? !!name : name && schemaName && tableName && columnName;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            {mode === 'edit' ? 'Edit Dashboard Filter' : 'Create Dashboard Filter'}
          </DialogTitle>
        </DialogHeader>

        {mode === 'edit' && isLoadingFilter && !isInitialized ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading filter configuration...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="basic" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="settings" disabled={!columnName}>
                  Settings
                </TabsTrigger>
                <TabsTrigger value="preview" disabled={!columnName}>
                  Preview
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-hidden mt-4">
                <TabsContent value="basic" className="h-full overflow-auto">
                  <div className="space-y-6">
                    <div className="grid gap-4">
                      <div>
                        <Label htmlFor="filter-name">Filter Name</Label>
                        <Input
                          id="filter-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g., Product Category"
                          className="mt-1"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Schema</Label>
                          <Select
                            value={schemaName || ''}
                            onValueChange={setSchemaName}
                            key={`schema-${schemaName}`}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select schema" />
                            </SelectTrigger>
                            <SelectContent>
                              {loadingSchemas ? (
                                <div className="flex items-center justify-center py-2">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                </div>
                              ) : (
                                schemas?.map((schema: string) => (
                                  <SelectItem key={schema} value={schema}>
                                    <div className="flex items-center gap-2">
                                      <Database className="w-4 h-4" />
                                      {schema}
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Table</Label>
                          <Select
                            value={tableName || ''}
                            onValueChange={setTableName}
                            disabled={!schemaName && mode === 'create'}
                            key={`table-${tableName}`}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select table" />
                            </SelectTrigger>
                            <SelectContent>
                              {loadingTables ? (
                                <div className="flex items-center justify-center py-2">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                </div>
                              ) : (
                                tables?.map((table: any) => {
                                  const tableName =
                                    typeof table === 'string' ? table : table.table_name;
                                  return (
                                    <SelectItem key={tableName} value={tableName}>
                                      <div className="flex items-center gap-2">
                                        <Table className="w-4 h-4" />
                                        {tableName}
                                      </div>
                                    </SelectItem>
                                  );
                                })
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Column</Label>
                          <Select
                            value={columnName || ''}
                            onValueChange={setColumnName}
                            disabled={!tableName && mode === 'create'}
                            key={`column-${columnName}`}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select column" />
                            </SelectTrigger>
                            <SelectContent>
                              {loadingColumns ? (
                                <div className="flex items-center justify-center py-2">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                </div>
                              ) : (
                                columns?.map((column: any) => {
                                  const columnName = column.column_name || column.name;
                                  const dataType = column.data_type;
                                  const isNumeric = [
                                    'integer',
                                    'bigint',
                                    'numeric',
                                    'double precision',
                                    'real',
                                    'float',
                                  ].includes(dataType.toLowerCase());
                                  return (
                                    <SelectItem key={columnName} value={columnName}>
                                      <div className="flex items-center gap-2">
                                        {isNumeric ? (
                                          <Hash className="w-4 h-4" />
                                        ) : (
                                          <TypeIcon className="w-4 h-4" />
                                        )}
                                        <span>{columnName}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {dataType}
                                        </Badge>
                                      </div>
                                    </SelectItem>
                                  );
                                })
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label>Filter Type</Label>
                        <Select
                          value={filterType}
                          onValueChange={(value) => setFilterType(value as DashboardFilterType)}
                          disabled={!columnName}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={DashboardFilterType.VALUE}>
                              <div className="flex items-center gap-2">
                                <TypeIcon className="w-4 h-4" />
                                <div>
                                  <div>Value (Dropdown)</div>
                                  <div className="text-xs text-muted-foreground">
                                    For categorical data
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                            <SelectItem value={DashboardFilterType.NUMERICAL}>
                              <div className="flex items-center gap-2">
                                <Hash className="w-4 h-4" />
                                <div>
                                  <div>Numerical (Slider)</div>
                                  <div className="text-xs text-muted-foreground">
                                    For numerical data
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="settings" className="h-full overflow-auto">
                  <div className="space-y-6">
                    {filterType === DashboardFilterType.VALUE && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Settings2 className="w-5 h-5" />
                            Value Filter Settings
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="has-default"
                              checked={hasDefaultValue}
                              onCheckedChange={setHasDefaultValue}
                            />
                            <Label htmlFor="has-default">Has default value</Label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="multiple-select"
                              checked={canSelectMultiple}
                              onCheckedChange={setCanSelectMultiple}
                            />
                            <Label htmlFor="multiple-select">Can select multiple values</Label>
                          </div>

                          {hasDefaultValue && (
                            <div>
                              <Label>Default Value(s)</Label>
                              {loadingPreview ? (
                                <div className="mt-2 flex items-center justify-center py-4 border border-dashed rounded-md">
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                  <span className="text-sm text-muted-foreground">
                                    Loading available values...
                                  </span>
                                </div>
                              ) : filterPreview?.data?.xAxisData ? (
                                <div className="mt-2 space-y-2 max-h-32 overflow-auto">
                                  {filterPreview.data.xAxisData
                                    .slice(0, 20)
                                    .map((option: string, index: number) => (
                                      <div key={option} className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`default-${option}`}
                                          checked={defaultValues.includes(option)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              if (canSelectMultiple) {
                                                setDefaultValues([...defaultValues, option]);
                                              } else {
                                                setDefaultValues([option]);
                                              }
                                            } else {
                                              setDefaultValues(
                                                defaultValues.filter((v) => v !== option)
                                              );
                                            }
                                          }}
                                        />
                                        <Label htmlFor={`default-${option}`} className="flex-1">
                                          <div className="flex items-center justify-between">
                                            <span>{option}</span>
                                            {filterPreview.data.series?.[0]?.data?.[index] && (
                                              <Badge variant="outline" className="text-xs">
                                                {filterPreview.data.series[0].data[index]}
                                              </Badge>
                                            )}
                                          </div>
                                        </Label>
                                      </div>
                                    ))}
                                </div>
                              ) : (
                                <div className="mt-2 text-sm text-muted-foreground p-4 border border-dashed rounded-md text-center">
                                  No values available. Please select a column first.
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {filterType === DashboardFilterType.NUMERICAL && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Settings2 className="w-5 h-5" />
                            Numerical Filter Settings
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <Label>Filter Mode</Label>
                            <Select
                              value={numericalMode}
                              onValueChange={(value) =>
                                setNumericalMode(value as NumericalFilterMode)
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NumericalFilterMode.SINGLE}>
                                  Single Value
                                </SelectItem>
                                <SelectItem value={NumericalFilterMode.RANGE}>
                                  Range (Min/Max)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {filterType === DashboardFilterType.NUMERICAL && (
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <Info className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-900">Note</span>
                              </div>
                              <p className="text-sm text-blue-800">
                                For numerical filters, you can set custom min/max ranges or let
                                users define their own. The actual data range will be determined
                                dynamically when filters are applied.
                              </p>
                            </div>
                          )}

                          {numericalMode === NumericalFilterMode.SINGLE && (
                            <div>
                              <Label>Default Value</Label>
                              <Input
                                type="number"
                                value={defaultSingleValue}
                                onChange={(e) => setDefaultSingleValue(Number(e.target.value))}
                                className="mt-1"
                              />
                            </div>
                          )}

                          {numericalMode === NumericalFilterMode.RANGE && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Default Min</Label>
                                <Input
                                  type="number"
                                  value={defaultRangeValue.min}
                                  onChange={(e) =>
                                    setDefaultRangeValue((prev) => ({
                                      ...prev,
                                      min: Number(e.target.value),
                                    }))
                                  }
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label>Default Max</Label>
                                <Input
                                  type="number"
                                  value={defaultRangeValue.max}
                                  onChange={(e) =>
                                    setDefaultRangeValue((prev) => ({
                                      ...prev,
                                      max: Number(e.target.value),
                                    }))
                                  }
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="h-full overflow-auto">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Filter Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingPreview ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span className="ml-2">Loading preview...</span>
                        </div>
                      ) : filterPreview?.data ? (
                        <div className="space-y-4">
                          {filterType === DashboardFilterType.VALUE &&
                            filterPreview.data.xAxisData && (
                              <div>
                                <h4 className="font-medium mb-2">
                                  Available Values ({filterPreview.data.xAxisData.length})
                                </h4>
                                <ScrollArea className="h-48">
                                  <div className="space-y-2">
                                    {filterPreview.data.xAxisData
                                      .slice(0, 50)
                                      .map((value: string, index: number) => (
                                        <div
                                          key={value}
                                          className="flex items-center justify-between p-2 bg-gray-50 rounded"
                                        >
                                          <span>{value}</span>
                                          {filterPreview.data.series?.[0]?.data?.[index] && (
                                            <Badge variant="outline">
                                              {filterPreview.data.series[0].data[index]}
                                            </Badge>
                                          )}
                                        </div>
                                      ))}
                                    {filterPreview.data.xAxisData.length > 50 && (
                                      <div className="text-center text-sm text-gray-500 p-2">
                                        ... and {filterPreview.data.xAxisData.length - 50} more
                                        values
                                      </div>
                                    )}
                                  </div>
                                </ScrollArea>
                              </div>
                            )}

                          {filterType === DashboardFilterType.NUMERICAL && (
                            <div>
                              <h4 className="font-medium mb-2">Numerical Filter Ready</h4>
                              <div className="bg-gray-50 p-4 rounded">
                                <p className="text-sm text-gray-600">
                                  This column is ready for numerical filtering. Users will be able
                                  to set min/max ranges or single values to filter the data.
                                </p>
                                <div className="mt-2 h-2 bg-gray-200 rounded relative">
                                  <div
                                    className="h-full bg-blue-500 rounded"
                                    style={{ width: '100%' }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          {columnName
                            ? 'Loading data preview...'
                            : 'Select schema, table, and column to see preview'}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {!isFormValid && 'Fill in all required fields to continue'}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isFormValid}>
              {mode === 'edit' ? 'Save Changes' : 'Create Filter'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
