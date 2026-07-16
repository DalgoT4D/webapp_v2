'use client';

import { useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { useWatch, type Control, type FieldValues, type UseFormSetValue } from 'react-hook-form';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import type { FieldNode } from '@/components/connectors/types';
import { KOBO_START_TIME_SUFFIX } from './constants';

interface StartTimeFieldProps {
  field: FieldNode;
  control: Control<FieldValues>;
  setValue: UseFormSetValue<FieldValues>;
  disabled?: boolean;
}

/**
 * Date control for Kobo's `start_time`. The spec stores a `YYYY-MM-DDTHH:mm:ss`
 * string; we surface a day picker and re-serialize the chosen day with a fixed
 * `T00:00:00` so the emitted value matches the spec pattern and the backend
 * format exactly.
 */
export function StartTimeField({ field, control, setValue, disabled }: StartTimeFieldProps) {
  const name = field.path.join('.');
  const raw = useWatch({ control, name }) as string | undefined;

  const [open, setOpen] = useState(false);

  const parsed = raw ? parseISO(raw) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;

  const handleSelect = (date: Date | undefined) => {
    if (date) setValue(name, `${format(date, 'yyyy-MM-dd')}${KOBO_START_TIME_SUFFIX}`);
    setOpen(false);
  };

  return (
    <div data-testid="start-time-field">
      <Label htmlFor="kobo-start-time">{field.title}</Label>
      {field.description && (
        <p className="mt-0.5 text-xs text-muted-foreground">{field.description}</p>
      )}
      <div className="mt-1.5" data-testid="start-time-trigger" id="kobo-start-time">
        <DatePicker
          value={selected}
          selected={selected}
          onSelect={handleSelect}
          open={open}
          onOpenChange={setOpen}
          disabled={disabled}
          placeholder="Pick a start date"
        />
      </div>
    </div>
  );
}
