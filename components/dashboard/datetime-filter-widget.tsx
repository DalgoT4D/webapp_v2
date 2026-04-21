'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';

interface DateTimeFilterWidgetProps {
  filter: { id: string; name: string };
  value: { start_date?: string; end_date?: string } | null;
  onChange: (filterId: string, value: { start_date?: string; end_date?: string } | null) => void;
  isLocked?: boolean;
}

export function DateTimeFilterWidget({
  filter,
  value,
  onChange,
  isLocked = false,
}: DateTimeFilterWidgetProps) {
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  useEffect(() => {
    if (value?.start_date) {
      setStartDate(new Date(value.start_date + 'T00:00:00'));
    }
    if (value?.end_date) {
      setEndDate(new Date(value.end_date + 'T00:00:00'));
    }
  }, [value]);

  const handleDateChange = useCallback(
    (start?: Date, end?: Date) => {
      const newValue = {
        start_date: start ? format(start, 'yyyy-MM-dd') : undefined,
        end_date: end ? format(end, 'yyyy-MM-dd') : undefined,
      };

      if (newValue.start_date || newValue.end_date) {
        onChange(filter.id, newValue);
      } else {
        onChange(filter.id, null);
      }
    },
    [filter.id, onChange]
  );

  const handleStartDateSelect = useCallback(
    (date: Date | undefined) => {
      setStartDate(date);
      handleDateChange(date, endDate);
      setStartOpen(false);
    },
    [endDate, handleDateChange]
  );

  const handleEndDateSelect = useCallback(
    (date: Date | undefined) => {
      setEndDate(date);
      handleDateChange(startDate, date);
      setEndOpen(false);
    },
    [startDate, handleDateChange]
  );

  const hasValue = startDate || endDate;

  return (
    <div className="space-y-2 p-4 bg-card rounded-lg border">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{filter.name}</label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Start Date */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">From</label>
          <DatePicker
            value={startDate}
            placeholder="Start date"
            disabled={isLocked}
            open={startOpen}
            onOpenChange={setStartOpen}
            selected={startDate}
            onSelect={handleStartDateSelect}
            disabledDates={endDate ? (date: Date) => date > endDate : undefined}
          />
        </div>

        {/* End Date */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">To</label>
          <DatePicker
            value={endDate}
            placeholder="End date"
            disabled={isLocked}
            open={endOpen}
            onOpenChange={setEndOpen}
            selected={endDate}
            onSelect={handleEndDateSelect}
            disabledDates={startDate ? (date: Date) => date < startDate : undefined}
          />
        </div>
      </div>

      {/* Filter summary */}
      {hasValue && (
        <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
          {startDate && endDate
            ? `Filtering from ${format(startDate, 'MMM dd, yyyy')} to ${format(endDate, 'MMM dd, yyyy')}`
            : startDate
              ? `Filtering from ${format(startDate, 'MMM dd, yyyy')} onwards`
              : endDate
                ? `Filtering up to ${format(endDate, 'MMM dd, yyyy')}`
                : null}
        </div>
      )}
    </div>
  );
}
