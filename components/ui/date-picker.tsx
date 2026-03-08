'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Pencil } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DatePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  maxDate?: Date;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled = false,
  maxDate,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  // Staged date: the date highlighted in the calendar before the user confirms
  const [stagedDate, setStagedDate] = React.useState<Date | undefined>(value);
  // Edit mode: user clicked pencil to type a date
  const [editMode, setEditMode] = React.useState(false);
  const [editText, setEditText] = React.useState('');

  // Sync staged date when the popover opens
  React.useEffect(() => {
    if (open) {
      setStagedDate(value);
      setEditMode(false);
    }
  }, [open, value]);

  const handleConfirm = () => {
    onChange(stagedDate);
    setOpen(false);
  };

  const handleCancel = () => {
    setStagedDate(value);
    setOpen(false);
  };

  const handleClear = () => {
    setStagedDate(undefined);
  };

  const handleEditSubmit = () => {
    const parsed = new Date(editText);
    if (!isNaN(parsed.getTime())) {
      setStagedDate(parsed);
    }
    setEditMode(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          <span>{value ? format(value, 'PPP') : placeholder}</span>
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
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEditSubmit();
                    if (e.key === 'Escape') setEditMode(false);
                  }}
                  onBlur={handleEditSubmit}
                  placeholder="MM/DD/YYYY"
                />
              ) : (
                <span className="text-2xl font-normal">
                  {stagedDate ? format(stagedDate, 'EEE, MMM d') : 'No date'}
                </span>
              )}
              {!editMode && (
                <button
                  type="button"
                  onClick={() => {
                    setEditText(stagedDate ? format(stagedDate, 'MM/dd/yyyy') : '');
                    setEditMode(true);
                  }}
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
            selected={stagedDate}
            onSelect={(date) => setStagedDate(date)}
            disabled={maxDate ? { after: maxDate } : undefined}
            captionLayout="dropdown"
          />

          <hr className="border-border" />

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-primary hover:underline"
            >
              Clear
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="text-sm font-medium uppercase text-red-500 hover:text-red-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="text-sm font-medium uppercase text-primary hover:text-primary/80"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
