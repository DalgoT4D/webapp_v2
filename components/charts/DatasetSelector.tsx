'use client';

import React from 'react';
import { useAllSchemaTables } from '@/hooks/api/useChart';
import { Combobox, highlightText, type ComboboxItem } from '@/components/ui/combobox';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { trackEvent } from '@/lib/analytics';

interface DatasetSelectorProps {
  schema_name?: string;
  table_name?: string;
  onDatasetChange: (schema_name: string, table_name: string) => void;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export function DatasetSelector({
  schema_name,
  table_name,
  onDatasetChange,
  disabled,
  className,
  autoFocus = false,
}: DatasetSelectorProps) {
  const { data: allTables, isLoading, error, noWarehouse } = useAllSchemaTables();

  React.useEffect(() => {
    if (noWarehouse) {
      trackEvent(ANALYTICS_EVENTS.CHART_DATASET_SELECTOR_STATE_VIEWED, {
        state: 'no_warehouse',
      });
    }
  }, [noWarehouse]);

  // Map API data to Combobox items
  const items: ComboboxItem[] = React.useMemo(
    () =>
      (allTables || []).map((t) => ({
        value: t.full_name,
        label: t.full_name,
        schema_name: t.schema_name,
        table_name: t.table_name,
      })),
    [allTables]
  );

  // Current selected value as "schema.table"
  const selectedValue = schema_name && table_name ? `${schema_name}.${table_name}` : '';

  const handleValueChange = (value: string) => {
    const item = items.find((i) => i.value === value);
    if (item && item.schema_name && item.table_name) {
      onDatasetChange(item.schema_name, item.table_name);
    }
  };

  if (error) {
    return (
      <div className={className}>
        <div className="p-3 bg-red-50 rounded border border-red-200 text-sm text-red-600">
          Failed to load datasets. Please try refreshing.
        </div>
      </div>
    );
  }

  if (noWarehouse) {
    return (
      <div className={className}>
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Set up a warehouse before selecting a dataset.
        </div>
      </div>
    );
  }

  return (
    <Combobox
      items={items}
      value={selectedValue}
      onValueChange={handleValueChange}
      searchPlaceholder="Search datasets..."
      emptyMessage="No datasets found"
      noItemsMessage="No datasets available"
      loading={isLoading}
      disabled={disabled}
      className={className}
      autoFocus={autoFocus}
      renderItem={(item, _isSelected, searchQuery) => (
        <div className="font-mono font-medium">{highlightText(item.label, searchQuery)}</div>
      )}
    />
  );
}
