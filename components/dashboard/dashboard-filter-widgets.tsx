'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { Filter, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  DashboardFilterConfig,
  ValueFilterConfig,
  NumericalFilterConfig,
  FilterOption,
  AppliedFilters,
} from '@/types/dashboard-filters';
import {
  DashboardFilterType,
  NumericalFilterUIMode,
  DateTimeFilterConfig,
} from '@/types/dashboard-filters';
import { DateTimeFilterWidget } from './datetime-filter-widget';
import useSWR from 'swr';
import { apiGet } from '@/lib/api';

interface FilterWidgetProps {
  filter: DashboardFilterConfig;
  value: any;
  onChange: (filterId: string, value: any) => void;
  className?: string;
  isEditMode?: boolean;
  showTitle?: boolean;
  compact?: boolean;
  isPublicMode?: boolean;
  publicToken?: string;
}

// Value Filter Widget (Dropdown/Multi-select)
function ValueFilterWidget({
  filter,
  value,
  onChange,
  className,
  isEditMode = false,
  isPublicMode = false,
  publicToken,
}: FilterWidgetProps) {
  const valueFilter = filter as ValueFilterConfig;
  const [selectedValues, setSelectedValues] = useState<string[]>(
    Array.isArray(value) ? value : value ? [value] : []
  );

  // Sync selectedValues when value prop changes (for default values)
  useEffect(() => {
    const newValues = Array.isArray(value) ? value : value ? [value] : [];
    if (JSON.stringify(selectedValues) !== JSON.stringify(newValues)) {
      setSelectedValues(newValues);
    }
  }, [value, selectedValues, filter.id]);

  // Build API URL based on public mode - now both use the preview endpoint format
  const apiUrl =
    filter.schema_name && filter.table_name && filter.column_name
      ? isPublicMode && publicToken
        ? `/api/v1/public/dashboards/${publicToken}/filters/preview/?schema_name=${encodeURIComponent(filter.schema_name)}&table_name=${encodeURIComponent(filter.table_name)}&column_name=${encodeURIComponent(filter.column_name)}&filter_type=value&limit=100`
        : `/api/filters/preview/?schema_name=${encodeURIComponent(filter.schema_name)}&table_name=${encodeURIComponent(filter.table_name)}&column_name=${encodeURIComponent(filter.column_name)}&filter_type=value&limit=100`
      : null;

  // Custom fetcher for public mode with better error handling
  const fetcher = isPublicMode
    ? async (url: string) => {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002'}${url}`
          );
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch filter options: ${response.status} ${errorText}`);
          }
          const data = await response.json();
          return data; // Return full response object
        } catch (error) {
          console.error('Filter options fetch error:', error);
          throw error;
        }
      }
    : async (url: string) => {
        try {
          return await apiGet(url);
        } catch (error) {
          console.error('Filter options API error:', error);
          throw error;
        }
      };

  // Fetch available options dynamically from the API
  const {
    data: filterOptions,
    error: filterOptionsError,
    isLoading: filterOptionsLoading,
  } = useSWR(apiUrl, fetcher, { revalidateOnFocus: false });

  // Ensure settings exists with default values
  if (!valueFilter.settings) {
    valueFilter.settings = {
      has_default_value: false,
      can_select_multiple: false,
    };
  }

  // Use dynamically fetched options
  const availableOptions = filterOptions?.options || [];

  const handleSelectionChange = (optionValue: string, isChecked: boolean) => {
    if (!optionValue) return; // Guard against invalid option values

    let newSelection: string[];

    if (valueFilter.settings?.can_select_multiple) {
      if (isChecked) {
        newSelection = [...(selectedValues || []), optionValue];
      } else {
        newSelection = (selectedValues || []).filter((v) => v !== optionValue);
      }
    } else {
      newSelection = isChecked ? [optionValue] : [];
    }

    const finalValue =
      newSelection.length === 0
        ? null
        : valueFilter.settings.can_select_multiple
          ? newSelection
          : newSelection[0];

    setSelectedValues(newSelection);
    onChange(filter.id, finalValue);
  };

  return (
    <div
      className={cn(
        'w-full rounded-lg',
        isEditMode
          ? 'bg-white border p-3 shadow-sm'
          : 'bg-white border border-gray-200 p-4 shadow-sm',
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-medium truncate',
              isEditMode ? 'text-xs text-gray-700' : 'text-sm text-gray-900'
            )}
          >
            {filter.name || filter.column_name || 'Filter'}
          </span>
        </div>
        {selectedValues.length > 0 && (
          <Badge
            variant={isEditMode ? 'secondary' : 'secondary'}
            className={cn(isEditMode ? 'text-xs h-4 px-1.5' : 'text-xs h-5 px-2')}
          >
            {selectedValues.length}
          </Badge>
        )}
      </div>
      <div>
        {filterOptionsLoading ? (
          <div className="text-xs text-muted-foreground p-2 bg-gray-50 rounded text-center">
            Loading options...
          </div>
        ) : filterOptionsError ? (
          <div className="text-xs text-red-600 p-2 bg-red-50 rounded text-center">
            <div>Options need attention</div>
            <div className="text-xs text-red-500 mt-1">
              {filterOptionsError.message || 'Please check your data connection'}
            </div>
          </div>
        ) : availableOptions.length === 0 ? (
          <div className="text-xs text-muted-foreground p-2 bg-gray-50 rounded text-center">
            No options available
          </div>
        ) : valueFilter.settings?.can_select_multiple ? (
          <Combobox
            mode="multi"
            items={availableOptions.map((opt: FilterOption) => ({
              value: opt.value,
              label: opt.label,
            }))}
            values={selectedValues}
            onValuesChange={(newValues) => {
              setSelectedValues(newValues);
              const finalValue = newValues.length === 0 ? null : newValues;
              onChange(filter.id, finalValue);
            }}
            placeholder={isEditMode ? 'Select...' : 'Choose option...'}
            searchPlaceholder="Search..."
            compact={isEditMode}
          />
        ) : (
          <Combobox
            items={availableOptions.map((opt: FilterOption) => ({
              value: opt.value,
              label: opt.label,
            }))}
            value={selectedValues[0] || ''}
            onValueChange={(val) => {
              const newSelection = val ? [val] : [];
              setSelectedValues(newSelection);
              onChange(filter.id, val || null);
            }}
            placeholder={isEditMode ? 'Select...' : 'Choose option...'}
            searchPlaceholder="Search..."
            compact={isEditMode}
          />
        )}
      </div>
    </div>
  );
}

// Numerical Filter Widget (Slider/Range)
function NumericalFilterWidget({
  filter,
  value,
  onChange,
  className,
  isEditMode = false,
  isPublicMode = false,
  publicToken,
}: FilterWidgetProps) {
  const numericalFilter = filter as NumericalFilterConfig;

  // Ensure settings exists with default values
  if (!numericalFilter.settings) {
    numericalFilter.settings = {
      ui_mode: NumericalFilterUIMode.SLIDER,
    };
  }

  // Default ui_mode to SLIDER if not specified
  const uiMode = numericalFilter.settings.ui_mode || NumericalFilterUIMode.SLIDER;

  // Build API URL based on public mode for numerical stats - now both use the preview endpoint format
  const numericalApiUrl =
    filter.schema_name && filter.table_name && filter.column_name
      ? isPublicMode && publicToken
        ? `/api/v1/public/dashboards/${publicToken}/filters/preview/?schema_name=${encodeURIComponent(filter.schema_name)}&table_name=${encodeURIComponent(filter.table_name)}&column_name=${encodeURIComponent(filter.column_name)}&filter_type=numerical&limit=100`
        : `/api/filters/preview/?schema_name=${encodeURIComponent(filter.schema_name)}&table_name=${encodeURIComponent(filter.table_name)}&column_name=${encodeURIComponent(filter.column_name)}&filter_type=numerical&limit=100`
      : null;

  // Custom fetcher for numerical filter in public mode
  const numericalFetcher = isPublicMode
    ? async (url: string) => {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002'}${url}`
        );
        if (!response.ok) throw new Error('Failed to fetch numerical stats');
        const data = await response.json();
        return data; // Return full response object
      }
    : (url: string) => apiGet(url);

  // Fetch numerical stats dynamically from the API
  const {
    data: numericalStats,
    error: numericalStatsError,
    isLoading: numericalStatsLoading,
  } = useSWR(numericalApiUrl, numericalFetcher, { revalidateOnFocus: false });

  // Use fetched values or fallbacks
  const minValue = numericalStats?.stats?.min_value ?? 0;
  const maxValue = numericalStats?.stats?.max_value ?? 100;
  const step = numericalFilter.settings.step || 1;

  const [localValue, setLocalValue] = useState<{ min: number; max: number }>(
    value || {
      min: numericalFilter.settings.default_min || minValue,
      max: numericalFilter.settings.default_max || maxValue,
    }
  );

  // Update local value when stats are loaded (if no value is set yet)
  useEffect(() => {
    if (!value && numericalStats?.stats) {
      setLocalValue({
        min: numericalFilter.settings.default_min || numericalStats.stats.min_value || 0,
        max: numericalFilter.settings.default_max || numericalStats.stats.max_value || 100,
      });
    }
  }, [
    numericalStats,
    value,
    numericalFilter.settings.default_min,
    numericalFilter.settings.default_max,
  ]);

  const handleSliderChange = (newValue: number[]) => {
    // Update local state immediately for smooth UI response
    const rangeValue = { min: newValue[0], max: newValue[1] };
    setLocalValue(rangeValue);
  };

  const handleSliderCommit = (newValue: number[]) => {
    // Only call onChange (which triggers API calls) when user finishes dragging
    const rangeValue = { min: newValue[0], max: newValue[1] };
    setLocalValue(rangeValue);
    onChange(filter.id, rangeValue);
  };

  // For immediate UI updates without triggering API calls
  const handleInputChange = (inputValue: string, type: 'min' | 'max') => {
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue)) return;

    const newRange = {
      ...localValue,
      [type]: Math.max(minValue, Math.min(maxValue, numValue)),
    };
    setLocalValue(newRange);
    // Don't call onChange here - wait for blur or Enter
  };

  // Apply the filter when user finishes typing (blur or Enter)
  const handleInputCommit = (type: 'min' | 'max') => {
    onChange(filter.id, localValue);
  };

  // Handle Enter key to apply filter
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, type: 'min' | 'max') => {
    if (e.key === 'Enter') {
      e.currentTarget.blur(); // This will trigger onBlur which calls handleInputCommit
    }
  };

  const handleReset = () => {
    const defaultValue = {
      min: numericalFilter.settings.default_min || minValue,
      max: numericalFilter.settings.default_max || maxValue,
    };

    setLocalValue(defaultValue);
    onChange(filter.id, defaultValue);
  };

  const getSliderValue = (): number[] => {
    return [localValue.min, localValue.max];
  };

  return (
    <div
      className={cn(
        'w-full rounded-lg',
        isEditMode
          ? 'bg-white border p-3 shadow-sm'
          : 'bg-white border border-gray-200 p-4 shadow-sm',
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-medium truncate',
              isEditMode ? 'text-xs text-gray-700' : 'text-sm text-gray-900'
            )}
          >
            {filter.name}
          </span>
        </div>
        <Badge
          variant={isEditMode ? 'secondary' : 'secondary'}
          className={cn(isEditMode ? 'text-xs h-4 px-1.5' : 'text-xs h-5 px-2')}
        >
          Range • {uiMode === NumericalFilterUIMode.SLIDER ? 'Slider' : 'Input'}
        </Badge>
      </div>
      <div className="space-y-3">
        {/* Current value display */}
        <div className="text-xs text-center font-medium text-gray-600">
          <span>
            {localValue.min} - {localValue.max}
          </span>
        </div>

        {/* Conditional UI based on ui_mode setting */}
        {uiMode === NumericalFilterUIMode.SLIDER ? (
          /* Slider UI */
          <div className="px-1">
            <Slider
              value={getSliderValue()}
              onValueChange={handleSliderChange}
              onValueCommit={handleSliderCommit}
              min={minValue}
              max={maxValue}
              step={step}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{minValue}</span>
              <span>{maxValue}</span>
            </div>
          </div>
        ) : (
          /* Input Fields UI */
          <>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Min</label>
                <Input
                  type="number"
                  value={localValue.min}
                  onChange={(e) => handleInputChange(e.target.value, 'min')}
                  onBlur={() => handleInputCommit('min')}
                  onKeyDown={(e) => handleInputKeyDown(e, 'min')}
                  min={minValue}
                  max={localValue.max}
                  step={step}
                  className="text-center h-7 text-xs"
                  placeholder="Min"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Max</label>
                <Input
                  type="number"
                  value={localValue.max}
                  onChange={(e) => handleInputChange(e.target.value, 'max')}
                  onBlur={() => handleInputCommit('max')}
                  onKeyDown={(e) => handleInputKeyDown(e, 'max')}
                  min={localValue.min}
                  max={maxValue}
                  step={step}
                  className="text-center h-7 text-xs"
                  placeholder="Max"
                />
              </div>
            </div>
            {/* Show range limits for input mode */}
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Min: {minValue}</span>
              <span>Max: {maxValue}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Main Filter Widget Component
export function DashboardFilterWidget(props: FilterWidgetProps) {
  if (!props.filter) {
    console.error('No filter provided to DashboardFilterWidget');
    return (
      <div className="p-4 text-red-500 border border-red-200 rounded">No filter data available</div>
    );
  }

  // Validate required filter properties
  if (
    !props.filter.id ||
    !props.filter.schema_name ||
    !props.filter.table_name ||
    !props.filter.column_name
  ) {
    console.error('Invalid filter data:', props.filter);
    return (
      <div className="p-4 text-red-500 border border-red-200 rounded">
        Invalid filter configuration
      </div>
    );
  }

  try {
    if (props.filter.filter_type === DashboardFilterType.VALUE) {
      return <ValueFilterWidget {...props} />;
    } else if (props.filter.filter_type === DashboardFilterType.NUMERICAL) {
      return <NumericalFilterWidget {...props} />;
    } else if (props.filter.filter_type === DashboardFilterType.DATETIME) {
      return <DateTimeFilterWidget {...props} />;
    }

    return (
      <div className="p-4 text-orange-500 border border-orange-200 rounded">
        Unknown filter type: {(props.filter as any).filter_type}
      </div>
    );
  } catch (error) {
    console.error('Error rendering filter widget:', error);
    return (
      <div className="p-4 text-red-500 border border-red-200 rounded">Filter needs attention</div>
    );
  }
}

// Filter Bar Component for Dashboard View
interface DashboardFilterBarProps {
  filters: DashboardFilterConfig[];
  values: AppliedFilters;
  onChange: (filterId: string, value: any) => void;
  onClearAll: () => void;
  className?: string;
}

export function DashboardFilterBar({
  filters,
  values,
  onChange,
  onClearAll,
  className,
}: DashboardFilterBarProps) {
  const hasActiveFilters = Object.values(values).some(
    (value) =>
      value !== null && value !== undefined && (Array.isArray(value) ? value.length > 0 : true)
  );

  if (filters.length === 0) {
    return null;
  }

  return (
    <div className={cn('bg-gray-50 border-b p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filters</span>
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-xs">
              {Object.values(values).filter((v) => v !== null && v !== undefined).length} active
            </Badge>
          )}
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearAll} className="h-6 text-xs">
            <RotateCcw className="w-3 h-3 mr-1" />
            Clear All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filters.map((filter) => (
          <DashboardFilterWidget
            key={filter.id}
            filter={filter}
            value={values[filter.id]}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}
