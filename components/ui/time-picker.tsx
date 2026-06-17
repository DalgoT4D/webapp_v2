'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface TimePickerProps {
  /** "HH:MM" in 24-hour format. Empty allowed for placeholder state. */
  value: string;
  /** Emits "HH:MM" in 24-hour format (consistent with cron + backend). */
  onChange: (value: string) => void;
  /** Visual format — internal storage is always 24h. Default 12h. */
  format?: '12h' | '24h';
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'data-testid'?: string;
}

type Meridiem = 'AM' | 'PM';

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i); // 0..23
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0..59
const MERIDIEMS: Meridiem[] = ['AM', 'PM'];

function to12h(hour24: number): { h12: number; meridiem: Meridiem } {
  return { h12: hour24 % 12 || 12, meridiem: hour24 < 12 ? 'AM' : 'PM' };
}

function to24h(h12: number, meridiem: Meridiem): number {
  if (meridiem === 'AM') return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
}

function parseValue(value: string): { hour24: number; minute: number } {
  const [h, m] = (value || '').split(':');
  const rawHour = parseInt(h, 10);
  const rawMinute = parseInt(m, 10);
  return {
    hour24: Number.isFinite(rawHour) ? Math.max(0, Math.min(23, rawHour)) : 9,
    minute: Number.isFinite(rawMinute) ? Math.max(0, Math.min(59, rawMinute)) : 0,
  };
}

function emit24h(hour24: number, minute: number): string {
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function displayTime(hour24: number, minute: number, format: '12h' | '24h'): string {
  if (format === '24h') return emit24h(hour24, minute);
  const { h12, meridiem } = to12h(hour24);
  return `${String(h12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

function defaultPlaceholder(format: '12h' | '24h'): string {
  return format === '24h' ? 'HH:MM' : 'HH:MM AM';
}

export function TimePicker({
  value,
  onChange,
  format = '12h',
  placeholder,
  disabled = false,
  className,
  'data-testid': testId,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const initial = parseValue(value);
  const [draftHour24, setDraftHour24] = useState(initial.hour24);
  const [draftMinute, setDraftMinute] = useState(initial.minute);

  // Reset draft on open so Cancel truly discards.
  useEffect(() => {
    if (!open) return;
    const p = parseValue(value);
    setDraftHour24(p.hour24);
    setDraftMinute(p.minute);
  }, [open, value]);

  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  // Scroll the selected cells into view on open.
  useEffect(() => {
    if (!open) return undefined;
    const id = requestAnimationFrame(() => {
      const h = format === '24h' ? draftHour24 : to12h(draftHour24).h12;
      hourRef.current
        ?.querySelector<HTMLButtonElement>(`[data-hour="${h}"]`)
        ?.scrollIntoView({ block: 'center' });
      minuteRef.current
        ?.querySelector<HTMLButtonElement>(`[data-minute="${draftMinute}"]`)
        ?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(id);
    // Only on open — click handlers scroll thereafter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isPlaceholder = !value;
  const display = isPlaceholder
    ? (placeholder ?? defaultPlaceholder(format))
    : displayTime(parseValue(value).hour24, parseValue(value).minute, format);
  const draftMeridiem: Meridiem = to12h(draftHour24).meridiem;
  const draftH12 = to12h(draftHour24).h12;

  const setHourFromWheel = (n: number) => {
    if (format === '24h') {
      setDraftHour24(n);
      return;
    }
    // Preserve current AM/PM when switching the 12h slot.
    setDraftHour24(to24h(n, draftMeridiem));
  };

  const setMeridiem = (m: Meridiem) => {
    setDraftHour24(to24h(draftH12, m));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          data-testid={testId}
          className={cn(
            'flex h-9 w-40 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            isPlaceholder ? 'text-muted-foreground' : 'text-foreground',
            className
          )}
        >
          <span>{display}</span>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" onWheel={(e) => e.stopPropagation()}>
        <div className="flex flex-col">
          {/* Header — mirrors DatePicker */}
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs text-muted-foreground">Select time</p>
            <span className="mt-1 block text-2xl font-normal tabular-nums">
              {displayTime(draftHour24, draftMinute, format)}
            </span>
          </div>

          <hr className="border-border" />

          {/* Wheels */}
          <div className="flex">
            <Column
              ref={hourRef}
              label="Hour"
              items={format === '24h' ? HOURS_24 : HOURS_12}
              selected={format === '24h' ? draftHour24 : draftH12}
              dataAttr="hour"
              onSelect={(n) => {
                setHourFromWheel(n);
                hourRef.current
                  ?.querySelector<HTMLButtonElement>(`[data-hour="${n}"]`)
                  ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }}
            />
            <Column
              ref={minuteRef}
              label="Minute"
              items={MINUTES}
              selected={draftMinute}
              dataAttr="minute"
              onSelect={(n) => {
                setDraftMinute(n);
                minuteRef.current
                  ?.querySelector<HTMLButtonElement>(`[data-minute="${n}"]`)
                  ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }}
            />
            {format === '12h' && <MeridiemColumn selected={draftMeridiem} onSelect={setMeridiem} />}
          </div>

          <hr className="border-border" />

          {/* Footer — mirrors DatePicker's OK/Cancel styling */}
          <div className="flex items-center justify-end gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              data-testid="time-picker-cancel"
              className="text-sm font-medium uppercase text-red-500 hover:text-red-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(emit24h(draftHour24, draftMinute));
                setOpen(false);
              }}
              data-testid="time-picker-ok"
              className="text-sm font-medium uppercase text-primary hover:text-primary/80"
            >
              OK
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ColumnProps {
  label: string;
  items: number[];
  selected: number;
  dataAttr: 'hour' | 'minute';
  onSelect: (n: number) => void;
}

const Column = forwardRef<HTMLDivElement, ColumnProps>(function Column(
  { label, items, selected, dataAttr, onSelect },
  ref
) {
  return (
    <div className="flex w-20 flex-col border-r last:border-r-0">
      <div className="border-b px-3 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div ref={ref} className="h-56 overflow-y-auto overscroll-contain py-1">
        {items.map((n) => {
          const isActive = n === selected;
          return (
            <button
              key={n}
              type="button"
              {...{ [`data-${dataAttr}`]: n }}
              onClick={() => onSelect(n)}
              className={cn(
                'flex h-8 w-full items-center justify-center text-sm tabular-nums transition-colors',
                isActive
                  ? 'bg-primary font-medium text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              )}
            >
              {String(n).padStart(2, '0')}
            </button>
          );
        })}
      </div>
    </div>
  );
});

interface MeridiemColumnProps {
  selected: Meridiem;
  onSelect: (m: Meridiem) => void;
}

function MeridiemColumn({ selected, onSelect }: MeridiemColumnProps) {
  return (
    <div className="flex w-16 flex-col">
      <div className="border-b px-2 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        AM/PM
      </div>
      <div className="flex h-56 flex-col py-1">
        {MERIDIEMS.map((m) => {
          const isActive = m === selected;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onSelect(m)}
              className={cn(
                'flex h-8 w-full items-center justify-center text-sm font-medium transition-colors',
                isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
              )}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}
