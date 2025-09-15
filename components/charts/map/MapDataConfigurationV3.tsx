'use client';

import React, { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  MapPin,
  Table,
  Plus,
  Eye,
  ChevronDown,
  ChevronUp,
  Trash2,
  Filter,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { MetricsSelector } from '@/components/charts/MetricsSelector';
import { DatasetSelector } from '@/components/charts/DatasetSelector';
import { ChartTypeSelector } from '@/components/charts/ChartTypeSelector';
import { CountryLevelConfig } from './CountryLevelConfig';
import { DynamicLevelConfig } from './DynamicLevelConfig';
import { useColumns, useChartDataPreview } from '@/hooks/api/useChart';
import type { ChartBuilderFormData, ChartMetric } from '@/types/charts';
import { generateAutoPrefilledConfig } from '@/lib/chartAutoPrefill';

// Column data type
interface TableColumn {
  name: string;
  data_type: string;
  column_name: string;
}

interface MapDataConfigurationV3Props {
  formData: ChartBuilderFormData;
  onFormDataChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

const AGGREGATE_FUNCTIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'count_distinct', label: 'Count Distinct' },
];

// Component for searchable value input - same as in ChartDataConfigurationV3
const SearchableValueInput = React.memo(function SearchableValueInput({
  schema,
  table,
  column,
  operator,
  value,
  onChange,
  disabled,
}: {
  schema?: string;
  table?: string;
  column: string;
  operator: string;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}) {
  // Get column values from preview data instead of separate API call
  const { data: previewData } = useChartDataPreview(
    schema && table
      ? {
          chart_type: 'bar',
          computation_type: 'raw',
          schema_name: schema,
          table_name: table,
          x_axis: column,
          y_axis: column,
        }
      : null,
    1,
    500 // Get more rows to have better distinct values
  );

  // Extract distinct values from preview data
  const columnValues = React.useMemo(() => {
    if (!previewData?.data || !column) return null;

    const distinctValues = new Set<string>();
    previewData.data.forEach((row: Record<string, any>) => {
      const value = row[column];
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        distinctValues.add(String(value));
      }
    });

    return Array.from(distinctValues).sort();
  }, [previewData, column]);

  // For null checks, no value input needed
  if (operator === 'is_null' || operator === 'is_not_null') {
    return null;
  }

  // For 'in' and 'not_in' operators, show multiselect dropdown if we have column values
  if (operator === 'in' || operator === 'not_in') {
    if (columnValues && columnValues.length > 0) {
      const selectedValues = Array.isArray(value)
        ? value
        : value
          ? String(value)
              .split(',')
              .map((v: string) => v.trim())
          : [];

      return (
        <div className="h-8 flex-1">
          <Select
            value={selectedValues.length > 0 ? selectedValues.join(',') : ''}
            onValueChange={(selectedValue) => {
              const currentSelected = selectedValues.includes(selectedValue)
                ? selectedValues.filter((v: string) => v !== selectedValue)
                : [...selectedValues, selectedValue];
              onChange(currentSelected.join(', '));
            }}
            disabled={disabled}
          >
            <SelectTrigger className="h-8">
              <SelectValue
                placeholder={
                  selectedValues.length > 0 ? `${selectedValues.length} selected` : 'Select values'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {columnValues
                .filter((val) => val !== null && val !== undefined && val.toString().trim() !== '')
                .slice(0, 100)
                .map((val) => (
                  <SelectItem key={val} value={val.toString()}>
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedValues.includes(val.toString())}
                        readOnly
                        className="w-4 h-4 flex-shrink-0"
                      />
                      <span className="truncate" title={val.toString()}>
                        {val}
                      </span>
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      );
    } else {
      // Fallback to text input for in/not_in when no column values
      return (
        <Input
          type="text"
          placeholder="value1, value2, value3"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-8 flex-1"
        />
      );
    }
  }

  // If we have column values, show searchable dropdown
  if (columnValues && columnValues.length > 0) {
    return (
      <Select
        value={value || ''}
        onValueChange={(selectedValue) => onChange(selectedValue)}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 flex-1">
          <SelectValue placeholder="Select or type value" />
        </SelectTrigger>
        <SelectContent>
          <div className="p-2">
            <Input
              type="text"
              placeholder="Type to search..."
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="h-8 mb-2"
            />
          </div>
          {columnValues
            .filter(
              (val) =>
                val !== null &&
                val !== undefined &&
                val.toString().trim() !== '' &&
                val
                  .toString()
                  .toLowerCase()
                  .includes((value || '').toString().toLowerCase())
            )
            .slice(0, 100)
            .map((val) => (
              <SelectItem key={val} value={val.toString()}>
                <span className="truncate" title={val.toString()}>
                  {val}
                </span>
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    );
  }

  // Fallback to regular input
  return (
    <Input
      type="text"
      placeholder="Enter value"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-8 flex-1"
    />
  );
});

export function MapDataConfigurationV3({
  formData,
  onFormDataChange,
  disabled,
}: MapDataConfigurationV3Props) {
  // 🔍 COMPREHENSIVE LOGGING: Component initialization
  console.log('⚙️ [MAP-DATA-CONFIG-V3] Component initialized with formData:', {
    schema_name: formData.schema_name,
    table_name: formData.table_name,
    chart_type: formData.chart_type,
    geographic_column: formData.geographic_column,
    aggregate_column: formData.aggregate_column,
    aggregate_function: formData.aggregate_function,
    selected_geojson_id: formData.selected_geojson_id,
    district_column: formData.district_column,
    drill_down_enabled: formData.drill_down_enabled,
    hasGeojsonPreviewPayload: !!formData.geojsonPreviewPayload,
    hasDataOverlayPayload: !!formData.dataOverlayPayload,
    disabled,
  });

  const [isEditingDataset, setIsEditingDataset] = useState(false);
  const { data: columns } = useColumns(formData.schema_name || null, formData.table_name || null);

  // 🔍 LOG: Column data loaded
  console.log('📋 [MAP-DATA-CONFIG-V3] Columns loaded:', {
    columnsCount: columns?.length || 0,
    sampleColumns: columns?.slice(0, 3) || [],
  });

  // Filter columns by type
  const normalizedColumns =
    columns?.map((col) => ({
      name: col.column_name || col.name, // Use 'name' to match TableColumn interface
      data_type: col.data_type,
      column_name: col.column_name || col.name, // Add this for backward compatibility
    })) || [];

  const allColumns = normalizedColumns;

  // Handle dataset changes with complete form reset for maps
  const handleDatasetChange = (schema_name: string, table_name: string) => {
    console.log('🔄 [MAP-DATA-CONFIG-V3] Dataset change requested:', {
      current_schema: formData.schema_name,
      current_table: formData.table_name,
      new_schema: schema_name,
      new_table: table_name,
    });

    // Prevent unnecessary resets if dataset hasn't actually changed
    if (formData.schema_name === schema_name && formData.table_name === table_name) {
      console.log('⏭️ [MAP-DATA-CONFIG-V3] Dataset unchanged, skipping reset');
      setIsEditingDataset(false);
      return;
    }

    console.log('🔄 [MAP-DATA-CONFIG-V3] Resetting form for new dataset');
    console.log('⚠️ [MAP-DATA-CONFIG-V3] Previous drill-down config will be lost:', {
      district_column: formData.district_column,
      drill_down_enabled: formData.drill_down_enabled,
    });

    // Preserve only essential chart identity fields
    const preservedFields = {
      title: formData.title,
      chart_type: formData.chart_type,
      customizations: formData.customizations || {}, // Keep styling preferences
    };

    // Reset all map-specific fields to ensure compatibility with new dataset
    onFormDataChange({
      ...preservedFields,
      schema_name,
      table_name,
      // Reset all column selections
      geographic_column: undefined,
      value_column: undefined,
      aggregate_function: 'sum', // Default aggregate function
      selected_geojson_id: undefined,
      // Reset data configuration
      metrics: [],
      filters: [],
      computation_type: 'aggregated',
      // Reset simplified map fields
      district_column: undefined,
      ward_column: undefined,
      subward_column: undefined,
      drill_down_enabled: false,
      geojsonPreviewPayload: undefined,
      dataOverlayPayload: undefined,
      country_code: 'IND', // Reset to default country
    });

    // Exit edit mode after successful change
    setIsEditingDataset(false);
  };

  // Auto-prefill map configuration when columns are loaded
  React.useEffect(() => {
    if (columns && formData.schema_name && formData.table_name && formData.chart_type === 'map') {
      // Check if we should auto-prefill (no existing configuration)
      const hasExistingConfig = !!(
        formData.geographic_column ||
        formData.value_column ||
        formData.aggregate_column
      );

      if (!hasExistingConfig) {
        const autoConfig = generateAutoPrefilledConfig('map', normalizedColumns);
        if (Object.keys(autoConfig).length > 0) {
          console.log('🤖 [MAP-DATA-CONFIG-V3] Auto-prefilling map configuration:', autoConfig);
          onFormDataChange(autoConfig);
        }
      }
    }
  }, [columns, formData.schema_name, formData.table_name, normalizedColumns, onFormDataChange]);

  // Handle canceling dataset edit
  const handleCancelDatasetEdit = () => {
    setIsEditingDataset(false);
  };

  return (
    <div className="space-y-4">
      {/* Chart Type Selector - without duplicate title */}
      <ChartTypeSelector
        value={formData.chart_type}
        onChange={(chart_type) => onFormDataChange({ chart_type })}
        disabled={disabled}
      />

      {/* Data Source - Inline Edit Pattern */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Data Source</Label>
        {!isEditingDataset ? (
          // Read-only view with edit button
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border w-full group hover:bg-gray-100 transition-colors">
            <Table className="h-5 w-5 text-gray-600" />
            <span className="font-mono text-sm flex-1">
              {formData.schema_name}.{formData.table_name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setIsEditingDataset(true)}
              disabled={disabled}
            >
              <Edit2 className="h-3 w-3 text-gray-500" />
            </Button>
          </div>
        ) : (
          // Edit mode with dataset selector
          <div className="space-y-2">
            <DatasetSelector
              schema_name={formData.schema_name}
              table_name={formData.table_name}
              onDatasetChange={handleDatasetChange}
              disabled={disabled}
              className="w-full"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelDatasetEdit}
                disabled={disabled}
                className="h-7 px-2 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
              <span className="text-xs text-gray-500">Select a dataset to continue</span>
            </div>
          </div>
        )}
      </div>

      {/* Metrics - use MetricsSelector with single metric */}
      <MetricsSelector
        metrics={formData.metrics || []}
        onChange={(metrics: ChartMetric[]) => {
          // Map metrics to legacy fields for compatibility
          const metric = metrics[0];
          onFormDataChange({
            metrics,
            value_column: metric?.column,
            aggregate_column: metric?.column,
            aggregate_function: metric?.aggregation,
          });
        }}
        columns={normalizedColumns}
        disabled={disabled}
        chartType="map"
        maxMetrics={1}
      />

      {/* Filters Section */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Data Filters</Label>
        <div className="space-y-2">
          {(formData.filters || []).map((filter, index) => (
            <div key={index} className="flex gap-2 items-center">
              <Select
                value={filter.column}
                onValueChange={(value) => {
                  const newFilters = [...(formData.filters || [])];
                  newFilters[index] = { ...filter, column: value };
                  onFormDataChange({ filters: newFilters });
                }}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 flex-1">
                  <SelectValue placeholder="Column" />
                </SelectTrigger>
                <SelectContent>
                  {allColumns.map((col) => (
                    <SelectItem key={col.column_name} value={col.column_name}>
                      <span className="truncate" title={col.column_name}>
                        {col.column_name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filter.operator}
                onValueChange={(value) => {
                  const newFilters = [...(formData.filters || [])];
                  newFilters[index] = { ...filter, operator: value as any };
                  onFormDataChange({ filters: newFilters });
                }}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 w-32">
                  <SelectValue placeholder="Operator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="not_equals">Not equals</SelectItem>
                  <SelectItem value="greater_than">Greater than (&gt;)</SelectItem>
                  <SelectItem value="greater_than_equal">Greater or equal (&gt;=)</SelectItem>
                  <SelectItem value="less_than">Less than (&lt;)</SelectItem>
                  <SelectItem value="less_than_equal">Less or equal (&lt;=)</SelectItem>
                  <SelectItem value="like">Like</SelectItem>
                  <SelectItem value="like_case_insensitive">Like (case insensitive)</SelectItem>
                  <SelectItem value="in">In</SelectItem>
                  <SelectItem value="not_in">Not in</SelectItem>
                  <SelectItem value="is_null">Is null</SelectItem>
                  <SelectItem value="is_not_null">Is not null</SelectItem>
                </SelectContent>
              </Select>

              <SearchableValueInput
                schema={formData.schema_name}
                table={formData.table_name}
                column={filter.column}
                operator={filter.operator}
                value={filter.value}
                onChange={(value) => {
                  const newFilters = [...(formData.filters || [])];
                  newFilters[index] = { ...filter, value };
                  onFormDataChange({ filters: newFilters });
                }}
                disabled={disabled}
              />

              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  const newFilters = (formData.filters || []).filter((_, i) => i !== index);
                  onFormDataChange({ filters: newFilters });
                }}
                disabled={disabled}
              >
                ✕
              </Button>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newFilters = [
                ...(formData.filters || []),
                { column: '', operator: 'equals' as any, value: '' },
              ];
              onFormDataChange({ filters: newFilters });
            }}
            disabled={disabled}
            className="w-full bg-gray-900 text-white hover:bg-gray-700 hover:text-white border-gray-900"
          >
            + Add Filter
          </Button>
        </div>
      </div>

      {/* Simplified Map Configuration */}
      {formData.aggregate_column && formData.aggregate_function && (
        <div className="space-y-4 pt-4 border-t">
          <div>
            <Label className="text-sm font-medium text-gray-900">Map Configuration</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Configure geographic levels and drill-down functionality
            </p>
          </div>

          {/* Simplified Map Configuration - Single Card */}
          <DynamicLevelConfig formData={formData} onChange={onFormDataChange} disabled={disabled} />
        </div>
      )}
    </div>
  );
}
