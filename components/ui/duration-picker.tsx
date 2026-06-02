'use client';

import { useState, useEffect } from 'react';
import { format as formatDate } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DurationPickerProps {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  onApply: (from: Date | undefined, to: Date | undefined) => void;
  align?: 'start' | 'center' | 'end';
}

export function DurationPicker({ dateFrom, dateTo, onApply, align = 'end' }: DurationPickerProps) {
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState<'from' | 'to'>('from');
  const [localFrom, setLocalFrom] = useState<Date | undefined>(dateFrom);
  const [localTo, setLocalTo] = useState<Date | undefined>(dateTo);

  useEffect(() => {
    if (!open) {
      setLocalFrom(dateFrom);
      setLocalTo(dateTo);
      setSelecting('from');
    }
  }, [open, dateFrom, dateTo]);

  const label =
    dateFrom && dateTo
      ? `${formatDate(dateFrom, 'd MMM yyyy')} – ${formatDate(dateTo, 'd MMM yyyy')}`
      : 'Select duration';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-8 text-xs gap-1.5', !dateFrom && !dateTo && 'text-muted-foreground')}
        >
          <CalendarIcon className="h-3 w-3" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <div className="p-4 space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Select duration</p>
          <div className="flex items-center gap-6">
            <button
              className={cn(
                'text-lg font-semibold',
                selecting === 'from'
                  ? 'text-foreground underline underline-offset-4'
                  : 'text-muted-foreground'
              )}
              style={selecting === 'from' ? { textDecorationColor: 'var(--primary)' } : undefined}
              onClick={() => setSelecting('from')}
            >
              {localFrom ? formatDate(localFrom, 'd MMM yyyy') : 'Start date'}
            </button>
            <button
              className={cn(
                'text-lg font-semibold',
                selecting === 'to'
                  ? 'text-foreground underline underline-offset-4'
                  : 'text-muted-foreground'
              )}
              style={selecting === 'to' ? { textDecorationColor: 'var(--primary)' } : undefined}
              onClick={() => setSelecting('to')}
            >
              {localTo ? formatDate(localTo, 'd MMM yyyy') : 'End date'}
            </button>
          </div>
          <Calendar
            mode="single"
            selected={selecting === 'from' ? localFrom : localTo}
            onSelect={(d) => {
              if (selecting === 'from') {
                setLocalFrom(d);
                setSelecting('to');
              } else {
                setLocalTo(d);
              }
            }}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                onApply(undefined, undefined);
                setOpen(false);
              }}
            >
              Clear
            </Button>
            <Button
              size="sm"
              className="text-xs text-white"
              style={{ backgroundColor: 'var(--primary)' }}
              disabled={!localFrom || !localTo}
              onClick={() => {
                onApply(localFrom, localTo);
                setOpen(false);
              }}
            >
              OK
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
