'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Pencil } from 'lucide-react';
import type { Matcher } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DatePickerProps {
  /** Date shown in the trigger button */
  value: Date | undefined;
  placeholder?: string;
  disabled?: boolean;

  /** Popover control */
  open: boolean;
  onOpenChange: (open: boolean) => void;

  /** Calendar state — may differ from value during staging */
  selected: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  /** Convenience prop: disables dates after this date */
  maxDate?: Date;
  /** Flexible date disabling — passed to Calendar's disabled prop */
  disabledDates?: Matcher | Matcher[];

  /** Footer with OK/Cancel/Clear (default: false) */
  showFooter?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  onClear?: () => void;

  /** Manual text-edit mode (default: false) */
  showEditButton?: boolean;
  editMode?: boolean;
  editText?: string;
  onEditModeChange?: (editing: boolean) => void;
  onEditTextChange?: (text: string) => void;
  onEditSubmit?: () => void;
}

export function DatePicker({
  value,
  placeholder = 'Pick a date',
  disabled = false,
  open,
  onOpenChange,
  selected,
  onSelect,
  maxDate,
  disabledDates,
  showFooter = false,
  onConfirm,
  onCancel,
  onClear,
  showEditButton = false,
  editMode = false,
  editText = '',
  onEditModeChange,
  onEditTextChange,
  onEditSubmit,
}: DatePickerProps) {
  // Build the disabled matcher for Calendar
  const calendarDisabled = React.useMemo(() => {
    const matchers: Matcher[] = [];
    if (maxDate) matchers.push({ after: maxDate });
    if (disabledDates) {
      if (Array.isArray(disabledDates)) {
        matchers.push(...disabledDates);
      } else {
        matchers.push(disabledDates);
      }
    }
    if (matchers.length === 0) return undefined;
    if (matchers.length === 1) return matchers[0];
    return matchers;
  }, [maxDate, disabledDates]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            value ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          <span className="truncate">{value ? format(value, 'MMM do, yyyy') : placeholder}</span>
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col">
          {/* Header */}
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs text-muted-foreground">Select date</p>
            <div className="flex items-center justify-between mt-1">
              {editMode ? (
                <Input
                  autoFocus
                  className="h-8 text-lg font-normal"
                  value={editText}
                  onChange={(e) => onEditTextChange?.(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onEditSubmit?.();
                    if (e.key === 'Escape') onEditModeChange?.(false);
                  }}
                  onBlur={() => onEditSubmit?.()}
                  placeholder="MM/DD/YYYY"
                />
              ) : (
                <span className="text-2xl font-normal">
                  {selected ? format(selected, 'EEE, MMM d') : 'No date'}
                </span>
              )}
              {showEditButton && !editMode && (
                <button
                  type="button"
                  onClick={() => onEditModeChange?.(true)}
                  className="p-1 rounded-full hover:bg-muted"
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          <hr className="border-border" />

          {/* Calendar */}
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => onSelect(date)}
            disabled={calendarDisabled}
            captionLayout="dropdown"
            fixedWeeks
          />

          {showFooter && (
            <>
              <hr className="border-border" />

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  type="button"
                  onClick={onClear}
                  className="text-sm text-primary hover:underline"
                >
                  Clear
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="text-sm font-medium uppercase text-red-500 hover:text-red-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    className="text-sm font-medium uppercase text-primary hover:text-primary/80"
                  >
                    OK
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
