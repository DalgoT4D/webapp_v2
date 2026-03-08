'use client';

import { useState } from 'react';
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
import { toast } from 'sonner';
import { createSnapshot, type DateColumn } from '@/hooks/api/useReports';
import { useDashboards, useDashboard, type DashboardFilter } from '@/hooks/api/useDashboards';

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

  // Fetch the selected dashboard to get its datetime filters
  const { data: dashboardData } = useDashboard(
    open && effectiveDashboardId ? effectiveDashboardId : 0
  );

  // Extract datetime filters from the dashboard
  const datetimeFilters: DashboardFilter[] =
    dashboardData?.filters?.filter((f: DashboardFilter) => f.filter_type === 'datetime') || [];

  // Map dashboards to combobox items
  const dashboardItems: ComboboxItem[] = (dashboards || []).map((d: any) => ({
    value: d.id.toString(),
    label: d.title,
  }));

  const handleSubmit = async () => {
    if (!effectiveDashboardId) {
      toast.error('Please select a dashboard');
      return;
    }
    if (!reportName.trim()) {
      toast.error('Please enter a report name');
      return;
    }
    if (!selectedDateColumn) {
      toast.error('Please select a date-time column');
      return;
    }
    if (!periodEnd) {
      toast.error('Please select an end date');
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
      toast.success('Report created');
      setOpen(false);
      resetForm();
      onCreated?.();
    } catch {
      toast.error('Failed to create report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    if (!preselectedDashboardId) setSelectedDashboardId('');
    setReportName('');
    setSelectedDateColumn('');
    setPeriodStart(undefined);
    setPeriodEnd(undefined);
    setFrequency('onetime');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Camera className="h-4 w-4 mr-1" /> Create Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
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
            {effectiveDashboardId && datetimeFilters.length === 0 && dashboardData ? (
              <p className="text-sm text-muted-foreground">
                No datetime filters on this dashboard.
              </p>
            ) : (
              <Select
                value={selectedDateColumn}
                onValueChange={setSelectedDateColumn}
                disabled={!effectiveDashboardId || datetimeFilters.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick the date-time column to filter by" />
                </SelectTrigger>
                <SelectContent>
                  {datetimeFilters.map((f) => {
                    const value = `${f.schema_name}.${f.table_name}.${f.column_name}`;
                    return (
                      <SelectItem key={f.id} value={value}>
                        {f.name || `${f.table_name}.${f.column_name}`}
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
                onClick={() => setFrequency('onetime')}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                  frequency === 'onetime'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white text-foreground border border-input hover:bg-muted'
                }`}
              >
                One time
              </button>
              <button
                type="button"
                onClick={() => setFrequency('schedule')}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                  frequency === 'schedule'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white text-foreground border border-input hover:bg-muted'
                }`}
              >
                Schedule
              </button>
            </div>
          </div>
        </div>

        {/* Buttons - left aligned */}
        <div className="flex gap-3 pt-2">
          <Button variant="cancel" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Generating...' : 'Generate Report'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
