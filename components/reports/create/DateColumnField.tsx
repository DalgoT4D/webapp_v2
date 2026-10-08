'use client';

import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DiscoveredDatetimeColumn } from '@/types/reports';
import { toDateColumnValue, type SnapshotFormData } from '@/components/reports/logic/create-report';

interface DateColumnFieldProps {
  control: Control<SnapshotFormData>;
  errors: FieldErrors<SnapshotFormData>;
  columns: DiscoveredDatetimeColumn[];
  hasDatetimeColumns: boolean;
  effectiveDashboardId: number | null;
  columnsLoading: boolean;
  hasDashboardData: boolean;
}

/** "Filter by": the date-time column the report period applies to. */
export function DateColumnField({
  control,
  errors,
  columns,
  hasDatetimeColumns,
  effectiveDashboardId,
  columnsLoading,
  hasDashboardData,
}: DateColumnFieldProps) {
  return (
    <div className={!hasDatetimeColumns ? 'opacity-50' : ''}>
      <div className="space-y-2">
        <Label className="font-semibold">
          Filter by {hasDatetimeColumns && <span className="text-red-600 ml-1">*</span>}
        </Label>
        {!hasDatetimeColumns && effectiveDashboardId && !columnsLoading && hasDashboardData && (
          <p className="text-sm text-muted-foreground" data-testid="snapshot-no-datetime-hint">
            No datetime columns found — date filtering will be skipped.
          </p>
        )}
        <Controller
          name="selectedDateColumn"
          control={control}
          rules={hasDatetimeColumns ? { required: 'Please select a date-time column' } : {}}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={!hasDatetimeColumns || !effectiveDashboardId || columnsLoading}
            >
              <SelectTrigger data-testid="snapshot-date-column">
                <SelectValue
                  placeholder={
                    columnsLoading
                      ? 'Discovering date columns...'
                      : !hasDatetimeColumns
                        ? 'No date columns available'
                        : 'Pick the date-time column to filter by'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {columns.map((col) => {
                  const value = toDateColumnValue(col);
                  return (
                    <SelectItem
                      key={value}
                      value={value}
                      data-testid={`snapshot-date-column-option-${value}`}
                    >
                      {col.table_name}.{col.column_name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        />
        {errors.selectedDateColumn && (
          <p className="text-sm text-red-500" data-testid="snapshot-date-column-error">
            {errors.selectedDateColumn.message}
          </p>
        )}
      </div>
    </div>
  );
}
