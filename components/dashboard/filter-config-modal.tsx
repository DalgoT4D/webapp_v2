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
  Calendar,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiGet, apiPost } from '@/lib/api';
import useSWR from 'swr';
import { useColumns } from '@/hooks/api/useChart';
import { DatasetSelector } from '@/components/charts/DatasetSelector';
import type { DashboardFilter } from '@/hooks/api/useDashboards';
import { useDashboardFilter } from '@/hooks/api/useDashboards';
import type {
  DashboardFilterConfig,
  CreateFilterPayload,
  UpdateFilterPayload,
  ValueFilterSettings,
  NumericalFilterSettings,
  DateTimeFilterSettings,
} from '@/types/dashboard-filters';
import {
  DashboardFilterType,
  NumericalFilterUIMode,
  FilterOption,
  NumericalFilterStats,
} from '@/types/dashboard-filters';

// Convert DashboardFilter (API response) to DashboardFilterConfig (frontend format)
function convertFilterToConfig(
  filter: DashboardFilter,
  position?: { x: number; y: number; w: number; h: number }
): DashboardFilterConfig {
  const baseConfig = {
    id: filter.id.toString(),
    name: filter.name,
    schema_name: filter.schema_name,
    table_name: filter.table_name,
    column_name: filter.column_name,
    filter_type: filter.filter_type as DashboardFilterType,
    position: position || { x: 0, y: 0, w: 4, h: 3 }, // Default position if not provided
  };

  if (filter.filter_type === 'value') {
    return {
      ...baseConfig,
      filter_type: DashboardFilterType.VALUE,
      settings: filter.settings as ValueFilterSettings,
    };
  } else if (filter.filter_type === 'numerical') {
    return {
      ...baseConfig,
      filter_type: DashboardFilterType.NUMERICAL,
      settings: filter.settings as NumericalFilterSettings,
    };
  } else if (filter.filter_type === 'datetime') {
    return {
      ...baseConfig,
      filter_type: DashboardFilterType.DATETIME,
      settings: filter.settings as DateTimeFilterSettings,
    };
  } else {
    // Fallback to VALUE type for unknown types
    return {
      ...baseConfig,
      filter_type: DashboardFilterType.VALUE,
      settings: filter.settings as ValueFilterSettings,
    };
  }
}

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
      ? `/api/filters/preview/?schema_name=${encodeURIComponent(schemaName)}&table_name=${encodeURIComponent(tableName)}&column_name=${encodeURIComponent(columnName)}&filter_type=${filterType}&limit=100`
      : null,
    (url: string) => apiGet(url),
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
  const [numericalUIMode, setNumericalUIMode] = useState<NumericalFilterUIMode>(
    NumericalFilterUIMode.SLIDER
  );
  const [defaultRangeValue, setDefaultRangeValue] = useState({ min: 0, max: 100 });

  // Data fetching using existing warehouse APIs
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
        setName(dataToUse.name || '');
        setSchemaName(dataToUse.schema_name || '');
        setTableName(dataToUse.table_name || '');
        setColumnName(dataToUse.column_name || '');
        setFilterType((dataToUse.filter_type as DashboardFilterType) || DashboardFilterType.VALUE);

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
            setNumericalUIMode(settings.ui_mode || NumericalFilterUIMode.SLIDER);
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
      setNumericalUIMode(NumericalFilterUIMode.SLIDER);
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

  // Auto-detect filter type based on column data type
  useEffect(() => {
    if (columnName && columns) {
      const selectedColumn = columns.find(
        (col: any) => col.column_name === columnName || col.name === columnName
      );

      if (selectedColumn?.recommended_filter_type) {
        setFilterType(selectedColumn.recommended_filter_type as DashboardFilterType);
      } else if (selectedColumn?.data_type) {
        // Fallback to local detection if backend doesn't provide recommended_filter_type
        const dataType = selectedColumn.data_type.toLowerCase();

        if (
          ['timestamp', 'datetime', 'date', 'timestamptz', 'time'].some((t) => dataType.includes(t))
        ) {
          setFilterType(DashboardFilterType.DATETIME);
        } else if (
          ['integer', 'bigint', 'numeric', 'decimal', 'double', 'real', 'float'].some((t) =>
            dataType.includes(t)
          )
        ) {
          setFilterType(DashboardFilterType.NUMERICAL);
        } else {
          setFilterType(DashboardFilterType.VALUE);
        }
      }
    }
  }, [columnName, columns]);

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

  // Handle dataset selection from DatasetSelector
  const handleDatasetChange = (schema_name: string, table_name: string) => {
    setSchemaName(schema_name);
    setTableName(table_name);
    // Reset all column-dependent state when dataset changes
    setColumnName('');
    setFilterType(DashboardFilterType.VALUE); // Reset to default type
    setCanSelectMultiple(false); // Reset to single select
    setNumericalUIMode(NumericalFilterUIMode.SLIDER); // Reset to default UI mode
    setDefaultRangeValue({ min: 0, max: 100 }); // Reset range values
  };

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
        // available_values are fetched dynamically, not stored
      } as ValueFilterSettings;
    } else {
      settings = {
        ui_mode: numericalUIMode,
        default_min: defaultRangeValue.min,
        default_max: defaultRangeValue.max,
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
    setNumericalUIMode(NumericalFilterUIMode.SLIDER);
    setIsInitialized(false);
    onClose();
  };

  const isFormValid = mode === 'edit' ? !!name : name && schemaName && tableName && columnName;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="!max-w-[900px] !w-[90vw] max-h-[90vh] overflow-hidden">
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
          <div className="flex-1 overflow-visible">
            <Tabs defaultValue="info" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="preview" disabled={!columnName}>
                  Preview
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-visible mt-4">
                <TabsContent value="info" className="h-full overflow-visible">
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Dataset</Label>
                          <DatasetSelector
                            schema_name={schemaName}
                            table_name={tableName}
                            onDatasetChange={handleDatasetChange}
                            className="mt-1"
                          />
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

                      {/* Auto-detected filter type display */}
                      {columnName && columns && (
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center gap-3">
                            {filterType === DashboardFilterType.VALUE && (
                              <>
                                <List className="w-5 h-5 text-blue-600" />
                                <div>
                                  <div className="font-medium">Dropdown Filter</div>
                                  <div className="text-sm text-muted-foreground">
                                    Auto-detected from{' '}
                                    {columns.find(
                                      (col: any) =>
                                        col.column_name === columnName || col.name === columnName
                                    )?.data_type || 'column type'}
                                  </div>
                                </div>
                              </>
                            )}
                            {filterType === DashboardFilterType.NUMERICAL && (
                              <>
                                <Hash className="w-5 h-5 text-green-600" />
                                <div>
                                  <div className="font-medium">Range Filter</div>
                                  <div className="text-sm text-muted-foreground">
                                    Auto-detected from{' '}
                                    {columns.find(
                                      (col: any) =>
                                        col.column_name === columnName || col.name === columnName
                                    )?.data_type || 'column type'}
                                  </div>
                                </div>
                              </>
                            )}
                            {filterType === DashboardFilterType.DATETIME && (
                              <>
                                <Calendar className="w-5 h-5 text-purple-600" />
                                <div>
                                  <div className="font-medium">Date Range Filter</div>
                                  <div className="text-sm text-muted-foreground">
                                    Auto-detected from{' '}
                                    {columns.find(
                                      (col: any) =>
                                        col.column_name === columnName || col.name === columnName
                                    )?.data_type || 'column type'}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Type-specific configuration */}
                      {columnName && filterType === DashboardFilterType.VALUE && (
                        <div className="bg-white border border-gray-200 rounded-lg">
                          <div className="p-4 pb-2 border-b border-gray-100">
                            <h3 className="text-sm font-medium">Dropdown Configuration</h3>
                          </div>
                          <div className="p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="single-select"
                                  checked={!canSelectMultiple}
                                  onCheckedChange={(checked) =>
                                    setCanSelectMultiple(checked !== true)
                                  }
                                />
                                <Label htmlFor="single-select">Single Select</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="multi-select"
                                  checked={canSelectMultiple}
                                  onCheckedChange={(checked) =>
                                    setCanSelectMultiple(checked === true)
                                  }
                                />
                                <Label htmlFor="multi-select">Multi Select</Label>
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded">
                              <strong>Renders as:</strong> Dropdown menu with{' '}
                              {canSelectMultiple
                                ? 'checkboxes (multiple selection)'
                                : 'radio buttons (single selection)'}
                            </div>
                          </div>
                        </div>
                      )}

                      {columnName && filterType === DashboardFilterType.NUMERICAL && (
                        <div className="bg-white border border-gray-200 rounded-lg">
                          <div className="p-4 pb-2 border-b border-gray-100">
                            <h3 className="text-sm font-medium">Numerical Filter Configuration</h3>
                          </div>
                          <div className="p-4 space-y-4">
                            <div>
                              <Label className="text-sm font-medium">UI Style</Label>
                              <div className="grid grid-cols-2 gap-4 mt-2">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id="slider-ui"
                                    checked={numericalUIMode === NumericalFilterUIMode.SLIDER}
                                    onCheckedChange={(checked) =>
                                      setNumericalUIMode(
                                        checked
                                          ? NumericalFilterUIMode.SLIDER
                                          : NumericalFilterUIMode.INPUT
                                      )
                                    }
                                  />
                                  <Label htmlFor="slider-ui">Interactive Slider</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id="input-ui"
                                    checked={numericalUIMode === NumericalFilterUIMode.INPUT}
                                    onCheckedChange={(checked) =>
                                      setNumericalUIMode(
                                        checked
                                          ? NumericalFilterUIMode.INPUT
                                          : NumericalFilterUIMode.SLIDER
                                      )
                                    }
                                  />
                                  <Label htmlFor="input-ui">Min/Max Inputs</Label>
                                </div>
                              </div>
                            </div>

                            <div className="text-sm text-muted-foreground bg-green-50 p-3 rounded">
                              <strong>Will render as:</strong>{' '}
                              {numericalUIMode === NumericalFilterUIMode.SLIDER
                                ? 'Dual-handle range slider for min/max selection'
                                : 'Separate Min and Max input fields'}
                              . Range limits automatically computed from your data.
                            </div>
                          </div>
                        </div>
                      )}

                      {columnName && filterType === DashboardFilterType.DATETIME && (
                        <div className="bg-white border border-gray-200 rounded-lg">
                          <div className="p-4 pb-2 border-b border-gray-100">
                            <h3 className="text-sm font-medium">Date Range Filter</h3>
                          </div>
                          <div className="p-4">
                            <div className="text-sm text-muted-foreground bg-purple-50 p-3 rounded">
                              <strong>Renders as:</strong> Date range picker with start and end date
                              selection. Date limits automatically computed from your data.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="h-full overflow-auto">
                  <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="p-4 pb-2 border-b border-gray-100">
                      <h2 className="text-lg font-medium">Filter Preview</h2>
                    </div>
                    <div className="p-4">
                      {loadingPreview ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span className="ml-2">Loading preview...</span>
                        </div>
                      ) : filterPreview ? (
                        <div className="space-y-4">
                          {filterType === DashboardFilterType.VALUE && filterPreview.options && (
                            <div>
                              <h4 className="font-medium mb-2">
                                Available Values ({filterPreview.options.length})
                              </h4>
                              <ScrollArea className="h-48">
                                <div className="space-y-2">
                                  {filterPreview.options.slice(0, 50).map((option: any) => (
                                    <div
                                      key={option.value}
                                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                                    >
                                      <span>{option.label}</span>
                                      {option.count && (
                                        <Badge variant="outline">{option.count}</Badge>
                                      )}
                                    </div>
                                  ))}
                                  {filterPreview.options.length > 50 && (
                                    <div className="text-center text-sm text-gray-500 p-2">
                                      ... and {filterPreview.options.length - 50} more values
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
                                    className="h-full bg-green-500 rounded"
                                    style={{ width: '100%' }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {filterType === DashboardFilterType.DATETIME && filterPreview?.stats && (
                            <div>
                              <h4 className="font-medium mb-2">Date Range Filter</h4>
                              <div className="bg-purple-50 p-4 rounded">
                                <p className="text-sm text-purple-800 mb-3">
                                  This column contains date/time data. Users will be able to select
                                  start and end dates to filter the data.
                                </p>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="font-medium text-purple-900">Date Range:</span>
                                    <div className="text-purple-700">
                                      {filterPreview.stats.min_date
                                        ? new Date(
                                            filterPreview.stats.min_date
                                          ).toLocaleDateString()
                                        : 'N/A'}{' '}
                                      -{' '}
                                      {filterPreview.stats.max_date
                                        ? new Date(
                                            filterPreview.stats.max_date
                                          ).toLocaleDateString()
                                        : 'N/A'}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="font-medium text-purple-900">
                                      Unique Days:
                                    </span>
                                    <div className="text-purple-700">
                                      {filterPreview.stats.distinct_days || 0}
                                    </div>
                                  </div>
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
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}

        <div className="flex items-center justify-between pt-8 mt-6 border-t relative z-0">
          <div className="text-sm text-muted-foreground">
            {!isFormValid && 'Fill in all required fields to continue'}
          </div>
          <div className="flex gap-2">
            <Button variant="cancel" onClick={handleClose}>
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
