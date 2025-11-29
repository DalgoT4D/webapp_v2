'use client';

import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { SimpleSelect, type SelectOption } from './SimpleSelect';
import { SORT_DIRECTIONS } from './constants';
import type { ChartMetric, ChartSort } from '@/types/charts';

interface SortableOption {
  value: string;
  label: string;
  type: 'column' | 'metric';
  uniqueId: string;
}

// Convert sort directions to SelectOption format
const DIRECTION_OPTIONS: SelectOption[] = SORT_DIRECTIONS.map((dir) => ({
  value: dir.value,
  label: dir.label,
}));

interface SortConfigurationProps {
  sort: ChartSort[];
  dimensionColumn?: string;
  metrics?: ChartMetric[];
  aggregateColumn?: string;
  aggregateFunction?: string;
  onChange: (sort: ChartSort[]) => void;
  disabled?: boolean;
}

/**
 * Build sortable options from dimension column and metrics
 */
function buildSortableOptions(
  dimensionColumn?: string,
  metrics?: ChartMetric[],
  aggregateColumn?: string,
  aggregateFunction?: string
): SortableOption[] {
  const options: SortableOption[] = [];

  // Add dimension column if available
  if (dimensionColumn) {
    options.push({
      value: dimensionColumn,
      label: dimensionColumn,
      type: 'column',
      uniqueId: `column-${dimensionColumn}`,
    });
  }

  // Add configured metrics using their aliases
  if (metrics && metrics.length > 0) {
    metrics.forEach((metric, index) => {
      if (metric.alias) {
        options.push({
          value: metric.alias,
          label: metric.alias,
          type: 'metric',
          uniqueId: `metric-${index}-${metric.alias}`,
        });
      }
    });
  } else if (aggregateColumn && aggregateFunction) {
    // Legacy single metric - create an alias for it
    const defaultAlias = `${aggregateFunction}(${aggregateColumn})`;
    options.push({
      value: defaultAlias,
      label: defaultAlias,
      type: 'metric',
      uniqueId: `metric-legacy-${defaultAlias}`,
    });
  }

  return options;
}

/**
 * SortConfiguration - Sort column and direction configuration
 *
 * Builds sortable options from:
 * - Dimension column (if set)
 * - Configured metrics (by alias)
 * - Legacy single metric (if no metrics configured)
 */
export function SortConfiguration({
  sort,
  dimensionColumn,
  metrics,
  aggregateColumn,
  aggregateFunction,
  onChange,
  disabled,
}: SortConfigurationProps) {
  const sortableOptions = useMemo(
    () => buildSortableOptions(dimensionColumn, metrics, aggregateColumn, aggregateFunction),
    [dimensionColumn, metrics, aggregateColumn, aggregateFunction]
  );

  const currentSort = sort && sort.length > 0 ? sort[0] : null;
  const currentColumn = currentSort?.column || '__none__';
  const currentDirection = currentSort?.direction || 'asc';

  // Check if current sort column is still available
  const isCurrentColumnAvailable =
    currentColumn === '__none__' || sortableOptions.some((opt) => opt.value === currentColumn);

  const handleColumnChange = (value: string) => {
    if (value === '__none__') {
      onChange([]);
    } else {
      onChange([
        {
          column: value,
          direction: currentDirection,
        },
      ]);
    }
  };

  const handleDirectionChange = (value: string) => {
    if (currentSort && currentColumn !== '__none__') {
      onChange([
        {
          column: currentColumn,
          direction: value as 'asc' | 'desc',
        },
      ]);
    }
  };

  if (sortableOptions.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-900">Sort Configuration</Label>
        <div className="text-sm text-gray-500">Configure metrics first to enable sorting</div>
      </div>
    );
  }

  // Convert sortable options to SelectOption format with badges
  const columnOptions: SelectOption[] = sortableOptions.map((option) => ({
    value: option.value,
    label: option.label,
    badge: option.type === 'column' ? 'COL' : 'METRIC',
    badgeColor: option.type === 'column' ? 'blue' : 'green',
  }));

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-900">Sort Configuration</Label>
      <div className="grid grid-cols-2 gap-2">
        {/* Column/Metric Selection */}
        <SimpleSelect
          options={columnOptions}
          value={
            isCurrentColumnAvailable
              ? currentColumn === '__none__'
                ? undefined
                : currentColumn
              : undefined
          }
          onChange={(value) => handleColumnChange(value || '__none__')}
          placeholder="Select column to sort"
          disabled={disabled}
          height="sm"
          includeNone
          noneLabel="None"
        />

        {/* Direction Selection */}
        <SimpleSelect
          options={DIRECTION_OPTIONS}
          value={currentSort ? currentDirection : 'asc'}
          onChange={(value) => handleDirectionChange(value || 'asc')}
          placeholder="Sort direction"
          disabled={disabled || !currentSort || currentColumn === '__none__'}
          height="sm"
        />
      </div>
    </div>
  );
}
