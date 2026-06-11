'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DAYS_OF_WEEK, FREQUENCY_OPTIONS, type ScheduleSpec } from '@/types/alerts';

interface ScheduleFieldProps {
  value: ScheduleSpec;
  onChange: (value: ScheduleSpec) => void;
}

/**
 * Frequency + day + time-of-day controls. Values are in the browser's local
 * timezone — the parent converts to UTC cron at submit via
 * localScheduleToUtcCron().
 */
export function ScheduleField({ value, onChange }: ScheduleFieldProps) {
  const setFrequency = (frequency: ScheduleSpec['frequency']) => {
    if (frequency === 'weekly') {
      onChange({ ...value, frequency, dayOfWeek: value.dayOfWeek ?? 1 });
    } else if (frequency === 'monthly') {
      onChange({ ...value, frequency, dayOfMonth: value.dayOfMonth ?? 1 });
    } else {
      onChange({ ...value, frequency });
    }
  };

  const setHourMinute = (raw: string) => {
    const [h, m] = raw.split(':');
    const hour = Math.max(0, Math.min(23, parseInt(h, 10) || 0));
    const minute = Math.max(0, Math.min(59, parseInt(m, 10) || 0));
    onChange({ ...value, hour, minute });
  };

  const timeStr = `${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}`;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">
            Frequency <span className="text-destructive">*</span>
          </Label>
          <Select
            value={value.frequency}
            onValueChange={(v) => setFrequency(v as ScheduleSpec['frequency'])}
          >
            <SelectTrigger>
              <SelectValue placeholder="Frequency" />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">
            Time of day <span className="text-destructive">*</span>
          </Label>
          <Input type="time" value={timeStr} onChange={(e) => setHourMinute(e.target.value)} />
        </div>
      </div>

      {value.frequency === 'weekly' && (
        <div className="space-y-1">
          <Label className="text-xs">
            Day of week <span className="text-destructive">*</span>
          </Label>
          <Select
            value={String(value.dayOfWeek ?? 1)}
            onValueChange={(v) => onChange({ ...value, dayOfWeek: parseInt(v, 10) })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick a day" />
            </SelectTrigger>
            <SelectContent>
              {DAYS_OF_WEEK.map((d) => (
                <SelectItem key={d.value} value={String(d.value)}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {value.frequency === 'monthly' && (
        <div className="space-y-1">
          <Label className="text-xs">
            Day of month (1–28) <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            min={1}
            max={28}
            value={value.dayOfMonth ?? 1}
            onChange={(e) => {
              let n = parseInt(e.target.value, 10);
              if (Number.isNaN(n)) n = 1;
              n = Math.max(1, Math.min(28, n));
              onChange({ ...value, dayOfMonth: n });
            }}
            className="w-32"
          />
        </div>
      )}
    </div>
  );
}
