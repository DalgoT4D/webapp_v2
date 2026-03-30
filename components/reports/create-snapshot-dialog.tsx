'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { useDatePickerWithConfirm } from '@/hooks/useDatePickerWithConfirm';
import { Camera } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { createSnapshot, useDashboardDatetimeColumns } from '@/hooks/api/useReports';
import type { DateColumn } from '@/types/reports';
import { useDashboards, useDashboard, type Dashboard } from '@/hooks/api/useDashboards';

interface CreateSnapshotDialogProps {
  dashboardId?: number;
  dashboardTitle?: string;
  onCreated?: () => void;
  trigger?: React.ReactNode;
}

interface SnapshotFormData {
  selectedDashboardId: string;
  reportName: string;
  selectedDateColumn: string;
  periodStart: Date | undefined;
  periodEnd: Date | undefined;
  frequency: string;
}

/** Wrapper that pairs the stateless DatePicker with confirm/cancel staging logic. */
function ConfirmDatePicker({
  value,
  onChange,
  maxDate,
}: {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  maxDate?: Date;
}) {
  const pickerProps = useDatePickerWithConfirm(value, onChange);
  return <DatePicker value={value} {...pickerProps} maxDate={maxDate} />;
}

export function CreateSnapshotDialog({
  dashboardId: preselectedDashboardId,
  dashboardTitle: preselectedDashboardTitle,
  onCreated,
  trigger,
}: CreateSnapshotDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<SnapshotFormData>({
    defaultValues: {
      selectedDashboardId: preselectedDashboardId?.toString() ?? '',
      reportName: '',
      selectedDateColumn: '',
      periodStart: undefined,
      periodEnd: undefined,
      frequency: 'onetime',
    },
  });

  const needsDashboardPicker = !preselectedDashboardId;
  const selectedDashboardId = watch('selectedDashboardId');
  const effectiveDashboardId =
    preselectedDashboardId ?? (selectedDashboardId ? Number(selectedDashboardId) : null);

  // Only fetch dashboards when the picker is needed and dialog is open
  const { data: dashboards } = useDashboards(
    needsDashboardPicker && open ? { dashboard_type: 'native' } : undefined
  );

  // Fetch the selected dashboard (for display purposes)
  const { data: dashboardData } = useDashboard(
    open && effectiveDashboardId ? effectiveDashboardId : 0
  );

  // Discover datetime columns from the dashboard's chart tables via warehouse introspection
  const { columns: discoveredColumns, isLoading: columnsLoading } = useDashboardDatetimeColumns(
    open && effectiveDashboardId ? effectiveDashboardId : null
  );

  // Map dashboards to combobox items
  const dashboardItems: ComboboxItem[] = (dashboards || []).map((d: Dashboard) => ({
    value: d.id.toString(),
    label: d.title,
  }));

  // Auto-select the dashboard's existing datetime filter, or the only available column
  const selectedDateColumn = watch('selectedDateColumn');
  useEffect(() => {
    if (columnsLoading || discoveredColumns.length === 0 || selectedDateColumn) return;

    const dashboardFilter = discoveredColumns.find((col) => col.is_dashboard_filter);
    const col = dashboardFilter ?? (discoveredColumns.length === 1 ? discoveredColumns[0] : null);
    if (col) {
      setValue('selectedDateColumn', `${col.schema_name}.${col.table_name}.${col.column_name}`);
    }
  }, [columnsLoading, discoveredColumns, selectedDateColumn, setValue]);

  const resetForm = () => {
    reset({
      selectedDashboardId: preselectedDashboardId?.toString() ?? '',
      reportName: '',
      selectedDateColumn: '',
      periodStart: undefined,
      periodEnd: undefined,
      frequency: 'onetime',
    });
  };

  const onSubmit = async (data: SnapshotFormData) => {
    // Parse selected date column
    const [schema_name, table_name, column_name] = data.selectedDateColumn.split('.');
    const dateColumn: DateColumn = { schema_name, table_name, column_name };

    setIsSubmitting(true);
    try {
      await createSnapshot({
        title: data.reportName.trim(),
        dashboard_id: effectiveDashboardId!,
        date_column: dateColumn,
        period_start: data.periodStart ? format(data.periodStart, 'yyyy-MM-dd') : undefined,
        period_end: format(data.periodEnd!, 'yyyy-MM-dd'),
      });
      toastSuccess.created('Report');
      setOpen(false);
      resetForm();
      onCreated?.();
    } catch (error) {
      toastError.create(error, 'report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const periodEnd = watch('periodEnd');
  const today = new Date();

  // Start date cannot exceed the earlier of periodEnd or today
  const startMaxDate = periodEnd && periodEnd < today ? periodEnd : today;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button data-testid="create-snapshot-trigger" variant="outline" size="sm">
            <Camera className="h-4 w-4 mr-1" /> Create Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent data-testid="create-snapshot-dialog" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Create a report</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Select Dashboard */}
          <div className="space-y-2">
            <Label className="font-semibold">
              Select Dashboard <span className="text-red-600">*</span>
            </Label>
            {needsDashboardPicker ? (
              <>
                <Controller
                  name="selectedDashboardId"
                  control={control}
                  rules={{ required: 'Please select a dashboard' }}
                  render={({ field }) => (
                    <Combobox
                      items={dashboardItems}
                      value={field.value}
                      onValueChange={(val) => {
                        field.onChange(val);
                        setValue('selectedDateColumn', '');
                      }}
                      placeholder="Search for your Dashboard here"
                      searchPlaceholder="Search for your Dashboard here"
                    />
                  )}
                />
                {errors.selectedDashboardId && (
                  <p className="text-sm text-red-500">{errors.selectedDashboardId.message}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{preselectedDashboardTitle}</p>
            )}
          </div>

          {/* Report Name */}
          <div className="space-y-2">
            <Label className="font-semibold">
              Report Name <span className="text-red-600">*</span>
            </Label>
            <Input
              data-testid="snapshot-report-name"
              placeholder="Pick a unique name"
              {...register('reportName', {
                required: 'Please enter a report name',
                validate: (v) => v.trim() !== '' || 'Please enter a report name',
              })}
            />
            {errors.reportName && (
              <p className="text-sm text-red-500">{errors.reportName.message}</p>
            )}
          </div>

          {/* Filter by */}
          <div className="space-y-2">
            <Label className="font-semibold">
              Filter by <span className="text-red-600 ml-1">*</span>
            </Label>
            {effectiveDashboardId &&
            !columnsLoading &&
            discoveredColumns.length === 0 &&
            dashboardData ? (
              <p className="text-sm text-muted-foreground">
                No datetime columns found in this dashboard&apos;s data sources.
              </p>
            ) : (
              <>
                <Controller
                  name="selectedDateColumn"
                  control={control}
                  rules={{ required: 'Please select a date-time column' }}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={
                        !effectiveDashboardId || columnsLoading || discoveredColumns.length === 0
                      }
                    >
                      <SelectTrigger data-testid="snapshot-date-column">
                        <SelectValue
                          placeholder={
                            columnsLoading
                              ? 'Discovering date columns...'
                              : 'Pick the date-time column to filter by'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {discoveredColumns.map((col) => {
                          const value = `${col.schema_name}.${col.table_name}.${col.column_name}`;
                          return (
                            <SelectItem key={value} value={value}>
                              {col.table_name}.{col.column_name}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.selectedDateColumn && (
                  <p className="text-sm text-red-500">{errors.selectedDateColumn.message}</p>
                )}
              </>
            )}
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label className="font-semibold">
              Duration <span className="text-red-600 ml-1">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Start date</span>
                <Controller
                  name="periodStart"
                  control={control}
                  render={({ field }) => (
                    <ConfirmDatePicker
                      value={field.value}
                      onChange={field.onChange}
                      maxDate={startMaxDate}
                    />
                  )}
                />
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">
                  End date <span className="text-red-600">*</span>
                </span>
                <Controller
                  name="periodEnd"
                  control={control}
                  rules={{ required: 'Please select an end date' }}
                  render={({ field }) => (
                    <ConfirmDatePicker
                      value={field.value}
                      onChange={field.onChange}
                      maxDate={today}
                    />
                  )}
                />
                {errors.periodEnd && (
                  <p className="text-sm text-red-500">{errors.periodEnd.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Reporting Frequency */}
          <div className="space-y-2">
            <Label className="font-semibold">Reporting Frequency</Label>
            <Controller
              name="frequency"
              control={control}
              render={({ field }) => (
                <div className="flex gap-2">
                  <button
                    type="button"
                    data-testid="snapshot-freq-onetime"
                    onClick={() => field.onChange('onetime')}
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                      field.value === 'onetime'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-foreground border border-input hover:bg-muted'
                    }`}
                  >
                    One time
                  </button>
                  <button
                    type="button"
                    data-testid="snapshot-freq-schedule"
                    onClick={() => field.onChange('schedule')}
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                      field.value === 'schedule'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-foreground border border-input hover:bg-muted'
                    }`}
                  >
                    Schedule
                  </button>
                </div>
              )}
            />
          </div>
        </div>

        {/* Buttons - left aligned */}
        <div className="flex gap-3 pt-2">
          <Button data-testid="snapshot-cancel-btn" variant="cancel" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            data-testid="snapshot-submit-btn"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Generating...' : 'Generate Report'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
