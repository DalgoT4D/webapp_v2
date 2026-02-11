'use client';

import React from 'react';
import { useAllSchemaTables } from '@/hooks/api/useChart';
import { Combobox, highlightText } from '@/components/ui/combobox';
import type { ComboboxItem } from '@/components/ui/combobox';

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
  const { data: allTables, isLoading, error } = useAllSchemaTables();

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
