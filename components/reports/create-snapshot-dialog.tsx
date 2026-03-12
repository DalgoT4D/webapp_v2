'use client';

import { useState, useCallback, useEffect } from 'react';
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

export function CreateSnapshotDialog({
  dashboardId: preselectedDashboardId,
  dashboardTitle: preselectedDashboardTitle,
  onCreated,
  trigger,
}: CreateSnapshotDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>(
    preselectedDashboardId?.toString() ?? ''
  );
  const [reportName, setReportName] = useState('');
  const [selectedDateColumn, setSelectedDateColumn] = useState<string>('');
  const [periodStart, setPeriodStart] = useState<Date | undefined>(undefined);
  const [periodEnd, setPeriodEnd] = useState<Date | undefined>(undefined);
  const [frequency, setFrequency] = useState<string>('onetime');

  const needsDashboardPicker = !preselectedDashboardId;
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
  useEffect(() => {
    if (columnsLoading || discoveredColumns.length === 0 || selectedDateColumn) return;

    const dashboardFilter = discoveredColumns.find((col) => col.is_dashboard_filter);
    const col = dashboardFilter ?? (discoveredColumns.length === 1 ? discoveredColumns[0] : null);
    if (col) {
      setSelectedDateColumn(`${col.schema_name}.${col.table_name}.${col.column_name}`);
    }
  }, [columnsLoading, discoveredColumns, selectedDateColumn]);

  const resetForm = useCallback(() => {
    if (!preselectedDashboardId) setSelectedDashboardId('');
    setReportName('');
    setSelectedDateColumn('');
    setPeriodStart(undefined);
    setPeriodEnd(undefined);
    setFrequency('onetime');
  }, [preselectedDashboardId]);

  const handleSubmit = useCallback(async () => {
    if (!effectiveDashboardId) {
      toastError.api('Please select a dashboard');
      return;
    }
    if (!reportName.trim()) {
      toastError.api('Please enter a report name');
      return;
    }
    if (!selectedDateColumn) {
      toastError.api('Please select a date-time column');
      return;
    }
    if (!periodEnd) {
      toastError.api('Please select an end date');
      return;
    }

    // Parse selected date column
    const [schema_name, table_name, column_name] = selectedDateColumn.split('.');
    const dateColumn: DateColumn = { schema_name, table_name, column_name };

    setIsSubmitting(true);
    try {
      await createSnapshot({
        title: reportName.trim(),
        dashboard_id: effectiveDashboardId,
        date_column: dateColumn,
        period_start: periodStart ? format(periodStart, 'yyyy-MM-dd') : undefined,
        period_end: format(periodEnd, 'yyyy-MM-dd'),
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
  }, [
    effectiveDashboardId,
    reportName,
    selectedDateColumn,
    periodEnd,
    periodStart,
    resetForm,
    onCreated,
  ]);

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
              <Combobox
                items={dashboardItems}
                value={selectedDashboardId}
                onValueChange={(val) => {
                  setSelectedDashboardId(val);
                  setSelectedDateColumn('');
                }}
                placeholder="Search for your Dashboard here"
                searchPlaceholder="Search for your Dashboard here"
              />
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
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
            />
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
              <Select
                value={selectedDateColumn}
                onValueChange={setSelectedDateColumn}
                disabled={!effectiveDashboardId || columnsLoading || discoveredColumns.length === 0}
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
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label className="font-semibold">
              Duration <span className="text-red-600 ml-1">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Start date</span>
                <DatePicker value={periodStart} onChange={setPeriodStart} maxDate={periodEnd} />
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">
                  End date <span className="text-red-600">*</span>
                </span>
                <DatePicker value={periodEnd} onChange={setPeriodEnd} />
              </div>
            </div>
          </div>

          {/* Reporting Frequency */}
          <div className="space-y-2">
            <Label className="font-semibold">Reporting Frequency</Label>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="snapshot-freq-onetime"
                onClick={() => setFrequency('onetime')}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                  frequency === 'onetime'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-foreground border border-input hover:bg-muted'
                }`}
              >
                One time
              </button>
              <button
                type="button"
                data-testid="snapshot-freq-schedule"
                onClick={() => setFrequency('schedule')}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                  frequency === 'schedule'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-foreground border border-input hover:bg-muted'
                }`}
              >
                Schedule
              </button>
            </div>
          </div>
        </div>

        {/* Buttons - left aligned */}
        <div className="flex gap-3 pt-2">
          <Button data-testid="snapshot-cancel-btn" variant="cancel" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button data-testid="snapshot-submit-btn" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Generating...' : 'Generate Report'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
