'use client';

import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { useDatePickerWithConfirm } from '@/hooks/useDatePickerWithConfirm';
import type { SnapshotFormData } from '@/components/reports/logic/create-report';

/** Wrapper that pairs the stateless DatePicker with confirm/cancel staging logic. */
function ConfirmDatePicker({
  value,
  onChange,
  maxDate,
  testId,
}: {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  maxDate?: Date;
  testId?: string;
}) {
  const pickerProps = useDatePickerWithConfirm(value, onChange);
  return <DatePicker value={value} {...pickerProps} maxDate={maxDate} testId={testId} />;
}

interface ReportDurationFieldsProps {
  control: Control<SnapshotFormData>;
  errors: FieldErrors<SnapshotFormData>;
  hasDatetimeColumns: boolean;
  startMaxDate: Date;
  today: Date;
}

/** "Duration": start date (optional) and end date (required when there is a date column). */
export function ReportDurationFields({
  control,
  errors,
  hasDatetimeColumns,
  startMaxDate,
  today,
}: ReportDurationFieldsProps) {
  return (
    <div className={!hasDatetimeColumns ? 'opacity-50 pointer-events-none' : ''}>
      <div className="space-y-2">
        <Label className="font-semibold">
          Duration {hasDatetimeColumns && <span className="text-red-600 ml-1">*</span>}
        </Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">Start date</span>
            <Controller
              name="periodStart"
              control={control}
              render={({ field }) => (
                // PINNED-BUGS: "Typed start date bypasses the max-date limit (only the calendar enforces it)"
                <ConfirmDatePicker
                  value={field.value}
                  onChange={field.onChange}
                  maxDate={startMaxDate}
                  testId="snapshot-start-date"
                />
              )}
            />
          </div>
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">
              End date {hasDatetimeColumns && <span className="text-red-600">*</span>}
            </span>
            <Controller
              name="periodEnd"
              control={control}
              rules={hasDatetimeColumns ? { required: 'Please select an end date' } : {}}
              render={({ field }) => (
                <ConfirmDatePicker
                  value={field.value}
                  onChange={field.onChange}
                  maxDate={today}
                  testId="snapshot-end-date"
                />
              )}
            />
            {errors.periodEnd && (
              <p className="text-sm text-red-500" data-testid="snapshot-end-date-error">
                {errors.periodEnd.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
