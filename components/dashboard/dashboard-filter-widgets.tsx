'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Filter, ChevronDown, X, Check, Hash, Type, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DashboardFilterConfig,
  DashboardFilterType,
  NumericalFilterMode,
  ValueFilterConfig,
  NumericalFilterConfig,
  FilterOption,
  AppliedFilters,
} from '@/types/dashboard-filters';

interface FilterWidgetProps {
  filter: DashboardFilterConfig;
  value: any;
  onChange: (filterId: string, value: any) => void;
  className?: string;
}

// Value Filter Widget (Dropdown/Multi-select)
function ValueFilterWidget({ filter, value, onChange, className }: FilterWidgetProps) {
  const valueFilter = filter as ValueFilterConfig;
  const [open, setOpen] = useState(false);
  const [selectedValues, setSelectedValues] = useState<string[]>(
    Array.isArray(value) ? value : value ? [value] : []
  );

  // Ensure settings exists with default values
  if (!valueFilter.settings) {
    console.warn('Filter settings missing, using defaults');
    valueFilter.settings = {
      has_default_value: false,
      can_select_multiple: false,
      available_values: [],
    };
  }

  const availableOptions = valueFilter.settings?.available_values || [];

  const handleSelectionChange = (optionValue: string, isChecked: boolean) => {
    let newSelection: string[];

    if (valueFilter.settings.can_select_multiple) {
      if (isChecked) {
        newSelection = [...selectedValues, optionValue];
      } else {
        newSelection = selectedValues.filter((v) => v !== optionValue);
      }
    } else {
      newSelection = isChecked ? [optionValue] : [];
      setOpen(false);
    }

    setSelectedValues(newSelection);
    onChange(
      filter.id,
      newSelection.length === 0
        ? null
        : valueFilter.settings.can_select_multiple
          ? newSelection
          : newSelection[0]
    );
  };

  const handleClear = () => {
    setSelectedValues([]);
    onChange(filter.id, null);
  };

  const selectedLabels = selectedValues.map(
    (val) => availableOptions.find((opt) => opt.value === val)?.label || val
  );

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Type className="w-4 h-4" />
          {filter.name || filter.column_name || 'Filter'}
          {selectedValues.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {selectedValues.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {availableOptions.length === 0 ? (
            <div className="text-sm text-muted-foreground p-2 bg-gray-50 rounded">
              No filter options available. Configure filter in edit mode.
            </div>
          ) : valueFilter.settings?.can_select_multiple ? (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  <span className="truncate">
                    {selectedValues.length === 0
                      ? 'Select values...'
                      : `${selectedValues.length} selected`}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search options..." />
                  <CommandEmpty>No options found.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-auto">
                    {availableOptions.map((option) => (
                      <CommandItem
                        key={option.value}
                        onSelect={() => {
                          const isSelected = selectedValues.includes(option.value);
                          handleSelectionChange(option.value, !isSelected);
                        }}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <Checkbox
                            checked={selectedValues.includes(option.value)}
                            onChange={(checked) => handleSelectionChange(option.value, !!checked)}
                          />
                          <span className="flex-1">{option.label}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          ) : (
            <Select
              value={selectedValues[0] || ''}
              onValueChange={(val) => handleSelectionChange(val, true)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {availableOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center justify-between w-full">
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Selected values display for multi-select */}
          {valueFilter.settings.can_select_multiple && selectedValues.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedLabels.map((label, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {label}
                  <X
                    className="ml-1 w-3 h-3 cursor-pointer"
                    onClick={() => handleSelectionChange(selectedValues[index], false)}
                  />
                </Badge>
              ))}
            </div>
          )}

          {/* Clear button */}
          {selectedValues.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="h-6 text-xs">
              <RotateCcw className="w-3 h-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Numerical Filter Widget (Slider/Range)
function NumericalFilterWidget({ filter, value, onChange, className }: FilterWidgetProps) {
  const numericalFilter = filter as NumericalFilterConfig;
  const [localValue, setLocalValue] = useState<number | { min: number; max: number }>(
    value ||
      (numericalFilter.settings.mode === NumericalFilterMode.SINGLE
        ? numericalFilter.settings.default_value || 0
        : {
            min: numericalFilter.settings.default_min || numericalFilter.settings.min_value || 0,
            max: numericalFilter.settings.default_max || numericalFilter.settings.max_value || 100,
          })
  );

  const minValue = numericalFilter.settings.min_value || 0;
  const maxValue = numericalFilter.settings.max_value || 100;
  const step = numericalFilter.settings.step || 1;

  const handleSliderChange = (newValue: number[]) => {
    if (numericalFilter.settings.mode === NumericalFilterMode.SINGLE) {
      const singleValue = newValue[0];
      setLocalValue(singleValue);
      onChange(filter.id, singleValue);
    } else {
      const rangeValue = { min: newValue[0], max: newValue[1] };
      setLocalValue(rangeValue);
      onChange(filter.id, rangeValue);
    }
  };

  const handleInputChange = (inputValue: string, type: 'single' | 'min' | 'max') => {
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue)) return;

    if (type === 'single') {
      setLocalValue(numValue);
      onChange(filter.id, numValue);
    } else if (typeof localValue === 'object') {
      const newRange = {
        ...localValue,
        [type]: Math.max(minValue, Math.min(maxValue, numValue)),
      };
      setLocalValue(newRange);
      onChange(filter.id, newRange);
    }
  };

  const handleReset = () => {
    const defaultValue =
      numericalFilter.settings.mode === NumericalFilterMode.SINGLE
        ? numericalFilter.settings.default_value || minValue
        : {
            min: numericalFilter.settings.default_min || minValue,
            max: numericalFilter.settings.default_max || maxValue,
          };

    setLocalValue(defaultValue);
    onChange(filter.id, defaultValue);
  };

  const getSliderValue = (): number[] => {
    if (numericalFilter.settings.mode === NumericalFilterMode.SINGLE) {
      return [typeof localValue === 'number' ? localValue : minValue];
    } else {
      const range = typeof localValue === 'object' ? localValue : { min: minValue, max: maxValue };
      return [range.min, range.max];
    }
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Hash className="w-4 h-4" />
          {filter.name}
          <Badge variant="secondary" className="text-xs">
            {numericalFilter.settings.mode === NumericalFilterMode.SINGLE ? 'Single' : 'Range'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Current value display */}
        <div className="text-sm text-center font-medium">
          {numericalFilter.settings.mode === NumericalFilterMode.SINGLE ? (
            <span>{typeof localValue === 'number' ? localValue : minValue}</span>
          ) : (
            <span>
              {typeof localValue === 'object' ? localValue.min : minValue} -{' '}
              {typeof localValue === 'object' ? localValue.max : maxValue}
            </span>
          )}
        </div>

        {/* Slider */}
        <div className="px-2">
          <Slider
            value={getSliderValue()}
            onValueChange={handleSliderChange}
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

        {/* Manual input */}
        {numericalFilter.settings.mode === NumericalFilterMode.SINGLE ? (
          <Input
            type="number"
            value={typeof localValue === 'number' ? localValue : minValue}
            onChange={(e) => handleInputChange(e.target.value, 'single')}
            min={minValue}
            max={maxValue}
            step={step}
            className="text-center h-8"
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Min</label>
              <Input
                type="number"
                value={typeof localValue === 'object' ? localValue.min : minValue}
                onChange={(e) => handleInputChange(e.target.value, 'min')}
                min={minValue}
                max={typeof localValue === 'object' ? localValue.max : maxValue}
                step={step}
                className="text-center h-8"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Max</label>
              <Input
                type="number"
                value={typeof localValue === 'object' ? localValue.max : maxValue}
                onChange={(e) => handleInputChange(e.target.value, 'max')}
                min={typeof localValue === 'object' ? localValue.min : minValue}
                max={maxValue}
                step={step}
                className="text-center h-8"
              />
            </div>
          </div>
        )}

        {/* Reset button */}
        <Button variant="ghost" size="sm" onClick={handleReset} className="w-full h-6 text-xs">
          <RotateCcw className="w-3 h-3 mr-1" />
          Reset
        </Button>
      </CardContent>
    </Card>
  );
}

// Main Filter Widget Component
export function DashboardFilterWidget(props: FilterWidgetProps) {
  if (!props.filter) {
    console.error('No filter provided to DashboardFilterWidget');
    return <div>No filter data</div>;
  }

  if (props.filter.filter_type === DashboardFilterType.VALUE) {
    return <ValueFilterWidget {...props} />;
  } else if (props.filter.filter_type === DashboardFilterType.NUMERICAL) {
    return <NumericalFilterWidget {...props} />;
  }

  return <div></div>;
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
