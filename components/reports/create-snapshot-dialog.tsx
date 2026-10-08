'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import { Camera } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { createSnapshot, useDashboardDatetimeColumns } from '@/hooks/api/useReports';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { useDashboards, useDashboard, type Dashboard } from '@/hooks/api/useDashboards';
import {
  buildCreateReportPayload,
  getStartMaxDate,
  pickDefaultDateColumn,
  toDateColumnValue,
  type SnapshotFormData,
} from '@/components/reports/logic/create-report';
import { DateColumnField } from '@/components/reports/create/DateColumnField';
import { ReportDurationFields } from '@/components/reports/create/ReportDurationFields';

interface CreateSnapshotDialogProps {
  dashboardId?: number;
  dashboardTitle?: string;
  onCreated?: () => void;
  trigger?: React.ReactNode;
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
    clearErrors,
    formState: { errors },
  } = useForm<SnapshotFormData>({
    defaultValues: {
      selectedDashboardId: preselectedDashboardId?.toString() ?? '',
      reportName: '',
      selectedDateColumn: '',
      periodStart: undefined,
      periodEnd: undefined,
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

    const col = pickDefaultDateColumn(discoveredColumns);
    if (col) {
      setValue('selectedDateColumn', toDateColumnValue(col));
    }
  }, [columnsLoading, discoveredColumns, selectedDateColumn, setValue]);

  const resetForm = () => {
    reset({
      selectedDashboardId: preselectedDashboardId?.toString() ?? '',
      reportName: '',
      selectedDateColumn: '',
      periodStart: undefined,
      periodEnd: undefined,
    });
  };

  const hasDatetimeColumns = discoveredColumns.length > 0;

  // Clear date field validation errors when no datetime columns are available
  useEffect(() => {
    if (!hasDatetimeColumns) {
      clearErrors(['selectedDateColumn', 'periodEnd']);
    }
  }, [hasDatetimeColumns, clearErrors]);

  const onSubmit = async (data: SnapshotFormData) => {
    setIsSubmitting(true);
    try {
      const payload = buildCreateReportPayload(data, effectiveDashboardId!, hasDatetimeColumns);

      const snapshot = await createSnapshot(payload);
      // GENERATE REPORT is the only way a report is born, and this is its success path.
      // dashboard_id ties the report back to the dashboard it snapshots.
      trackEvent(ANALYTICS_EVENTS.REPORT_CREATED, {
        report_id: snapshot.id,
        dashboard_id: payload.dashboard_id,
        has_date_filter: !!payload.date_column,
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
  const startMaxDate = getStartMaxDate(periodEnd, today);

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
                      id="snapshot-dashboard-select"
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
                  <p className="text-sm text-red-500" data-testid="snapshot-dashboard-error">
                    {errors.selectedDashboardId.message}
                  </p>
                )}
              </>
            ) : (
              <p
                className="text-sm text-muted-foreground"
                data-testid="snapshot-preselected-dashboard"
              >
                {preselectedDashboardTitle}
              </p>
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
              <p className="text-sm text-red-500" data-testid="snapshot-report-name-error">
                {errors.reportName.message}
              </p>
            )}
          </div>

          {/* Filter by */}
          <DateColumnField
            control={control}
            errors={errors}
            columns={discoveredColumns}
            hasDatetimeColumns={hasDatetimeColumns}
            effectiveDashboardId={effectiveDashboardId}
            columnsLoading={columnsLoading}
            hasDashboardData={!!dashboardData}
          />

          {/* Duration */}
          <ReportDurationFields
            control={control}
            errors={errors}
            hasDatetimeColumns={hasDatetimeColumns}
            startMaxDate={startMaxDate}
            today={today}
          />
        </div>

        {/* Buttons - left aligned */}
        <div className="flex gap-3 pt-2">
          {/* PINNED-BUGS: "Cancel doesn't reset create form (old name/date column shown, picker input empty)" — closes only; resetForm runs after a successful create */}
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
