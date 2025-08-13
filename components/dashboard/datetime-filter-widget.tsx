'use client';

import { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DateTimeFilterWidgetProps {
  filter: any;
  value: { start_date?: string; end_date?: string } | null;
  onChange: (filterId: string, value: { start_date?: string; end_date?: string } | null) => void;
}

export function DateTimeFilterWidget({ filter, value, onChange }: DateTimeFilterWidgetProps) {
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  useEffect(() => {
    if (value?.start_date) {
      setStartDate(new Date(value.start_date));
    }
    if (value?.end_date) {
      setEndDate(new Date(value.end_date));
    }
  }, [value]);

  const handleDateChange = (start?: Date, end?: Date) => {
    const newValue = {
      start_date: start ? start.toISOString().split('T')[0] : undefined,
      end_date: end ? end.toISOString().split('T')[0] : undefined,
    };

    if (newValue.start_date || newValue.end_date) {
      onChange(filter.id, newValue);
    } else {
      onChange(filter.id, null);
    }
  };

  const handleStartDateSelect = (date: Date | undefined) => {
    setStartDate(date);
    handleDateChange(date, endDate);
    setStartOpen(false);
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    setEndDate(date);
    handleDateChange(startDate, date);
    setEndOpen(false);
  };

  const clearFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    onChange(filter.id, null);
  };

  const hasValue = startDate || endDate;

  return (
    <div className="space-y-2 p-4 bg-white rounded-lg border">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{filter.name}</label>
        {hasValue && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilter}
            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Start Date */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">From</label>
          <Popover open={startOpen} onOpenChange={setStartOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !startDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, 'MMM dd, yyyy') : 'Start date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={handleStartDateSelect}
                disabled={(date) => {
                  // Disable dates after end date if end date is selected
                  return endDate ? date > endDate : false;
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* End Date */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">To</label>
          <Popover open={endOpen} onOpenChange={setEndOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !endDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, 'MMM dd, yyyy') : 'End date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={handleEndDateSelect}
                disabled={(date) => {
                  // Disable dates before start date if start date is selected
                  return startDate ? date < startDate : false;
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Filter summary */}
      {hasValue && (
        <div className="text-xs text-gray-500 mt-2 p-2 bg-gray-50 rounded">
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
