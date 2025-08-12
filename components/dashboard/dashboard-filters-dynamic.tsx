'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, ChevronDown, Check, Filter, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiGet } from '@/lib/api';
import useSWR from 'swr';

interface DashboardFilter {
  id: number;
  filter_type: 'value' | 'numerical';
  schema_name: string;
  table_name: string;
  column_name: string;
  settings: {
    label?: string;
    defaultValue?: any;
    multiSelect?: boolean;
    isRange?: boolean;
    min?: number;
    max?: number;
    step?: number;
  };
  order: number;
}

interface DashboardFiltersDynamicProps {
  filters: DashboardFilter[];
  selectedValues: Record<string, any>;
  onChange: (filterId: string, value: any) => void;
  onClear: () => void;
}

export function DashboardFiltersDynamic({
  filters,
  selectedValues,
  onChange,
  onClear,
}: DashboardFiltersDynamicProps) {
  const activeFilterCount = Object.keys(selectedValues).filter(
    (key) => selectedValues[key] !== null && selectedValues[key] !== undefined
  ).length;

  // Sort filters by order
  const sortedFilters = [...(filters || [])].sort((a, b) => a.order - b.order);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {sortedFilters.map((filter) => (
        <FilterComponent
          key={filter.id}
          filter={filter}
          value={selectedValues[filter.id.toString()]}
          onChange={(value) => onChange(filter.id.toString(), value)}
        />
      ))}

      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-8 px-2 text-xs">
          <X className="h-3.5 w-3.5 mr-1" />
          Clear All ({activeFilterCount})
        </Button>
      )}
    </div>
  );
}

// Individual filter component
function FilterComponent({
  filter,
  value,
  onChange,
}: {
  filter: DashboardFilter;
  value: any;
  onChange: (value: any) => void;
}) {
  const label = filter.settings?.label || filter.column_name;

  if (filter.filter_type === 'value') {
    return <CategoricalFilter filter={filter} label={label} value={value} onChange={onChange} />;
  } else if (filter.filter_type === 'numerical') {
    return <NumericalFilter filter={filter} label={label} value={value} onChange={onChange} />;
  }

  return null;
}

// Categorical filter component
function CategoricalFilter({
  filter,
  label,
  value,
  onChange,
}: {
  filter: DashboardFilter;
  label: string;
  value: any;
  onChange: (value: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const multiSelect = filter.settings?.multiSelect ?? false;

  // Fetch filter options from API
  const { data: options, isLoading } = useSWR(
    `/api/dashboards/filter-options/?schema=${filter.schema_name}&table=${filter.table_name}&column=${filter.column_name}`,
    apiGet,
    { revalidateOnFocus: false }
  );

  const selectedValues = multiSelect ? value || [] : value ? [value] : [];
  const hasSelection = selectedValues.length > 0;

  // Filter options based on search query
  const filteredOptions =
    options?.filter((option: string) => option.toLowerCase().includes(searchQuery.toLowerCase())) ||
    [];

  const handleSelect = (optionValue: string) => {
    if (multiSelect) {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter((v: string) => v !== optionValue)
        : [...selectedValues, optionValue];
      onChange(newValues.length > 0 ? newValues : null);
    } else {
      onChange(optionValue === value ? null : optionValue);
      setOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) {
          setSearchQuery('');
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 min-w-[120px] justify-between',
            hasSelection && 'bg-primary/5 border-primary/20'
          )}
        >
          <span className="text-xs font-medium mr-2">{label}:</span>
          <span className="text-xs truncate flex-1 text-left">
            {hasSelection ? (
              multiSelect ? (
                `${selectedValues.length} selected`
              ) : (
                selectedValues[0]
              )
            ) : (
              <span className="text-muted-foreground">All</span>
            )}
          </span>
          {hasSelection ? (
            <X className="h-3 w-3 ml-2 opacity-50 hover:opacity-100" onClick={handleClear} />
          ) : isLoading ? (
            <Loader2 className="h-3 w-3 ml-2 animate-spin opacity-50" />
          ) : (
            <ChevronDown className="h-3 w-3 ml-2 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="p-2">
          <div className="relative">
            <Input
              placeholder={`Search ${label.toLowerCase()}...`}
              className="h-9 mb-2 pr-8"
              disabled={isLoading}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {isLoading && (
              <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <ScrollArea className="h-[200px]">
            <div className="space-y-1">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mb-2" />
                  <div className="text-xs text-muted-foreground">Loading filter options...</div>
                </div>
              ) : filteredOptions && filteredOptions.length > 0 ? (
                filteredOptions.map((option: string) => (
                  <div
                    key={option}
                    onClick={() => handleSelect(option)}
                    className="flex items-center px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer rounded-sm"
                  >
                    {multiSelect ? (
                      <Checkbox
                        checked={selectedValues.includes(option)}
                        className="mr-2 h-3 w-3"
                      />
                    ) : (
                      <Check
                        className={cn(
                          'mr-2 h-3 w-3',
                          selectedValues.includes(option) ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                    )}
                    {option}
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  {searchQuery ? 'No matching options found' : 'No options available'}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Numerical filter component
function NumericalFilter({
  filter,
  label,
  value,
  onChange,
}: {
  filter: DashboardFilter;
  label: string;
  value: any;
  onChange: (value: any) => void;
}) {
  const isRange = filter.settings?.isRange ?? true;
  const min = filter.settings?.min ?? 0;
  const max = filter.settings?.max ?? 100;
  const step = filter.settings?.step ?? 1;

  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value || (isRange ? { min, max } : null));

  const hasValue = value !== null && value !== undefined;

  const handleApply = () => {
    onChange(localValue);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setLocalValue(isRange ? { min, max } : null);
  };

  if (isRange) {
    const rangeValue = localValue || { min, max };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 min-w-[140px] justify-between',
              hasValue && 'bg-primary/5 border-primary/20'
            )}
          >
            <span className="text-xs font-medium mr-2">{label}:</span>
            <span className="text-xs truncate flex-1 text-left">
              {hasValue ? (
                `${value.min} - ${value.max}`
              ) : (
                <span className="text-muted-foreground">All</span>
              )}
            </span>
            {hasValue ? (
              <X className="h-3 w-3 ml-2 opacity-50 hover:opacity-100" onClick={handleClear} />
            ) : (
              <ChevronDown className="h-3 w-3 ml-2 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px]" align="start">
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium">{label} Range</Label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={rangeValue.min}
                  onChange={(e) => setLocalValue({ ...rangeValue, min: Number(e.target.value) })}
                  min={min}
                  max={max}
                  step={step}
                  className="h-8 text-xs"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="number"
                  value={rangeValue.max}
                  onChange={(e) => setLocalValue({ ...rangeValue, max: Number(e.target.value) })}
                  min={min}
                  max={max}
                  step={step}
                  className="h-8 text-xs"
                />
              </div>

              <div className="mt-2">
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={rangeValue.min}
                  onChange={(e) => setLocalValue({ ...rangeValue, min: Number(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLocalValue({ min, max });
                  onChange(null);
                  setOpen(false);
                }}
              >
                Reset
              </Button>
              <Button size="sm" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  } else {
    // Single value numerical filter
    return (
      <div className="flex items-center gap-2">
        <Label className="text-xs font-medium">{label}:</Label>
        <Input
          type="number"
          value={localValue || ''}
          onChange={(e) => {
            const val = e.target.value ? Number(e.target.value) : null;
            setLocalValue(val);
            onChange(val);
          }}
          min={min}
          max={max}
          step={step}
          placeholder="All"
          className="h-8 w-24 text-xs"
        />
        {hasValue && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLocalValue(null);
              onChange(null);
            }}
            className="h-8 w-8 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }
}
