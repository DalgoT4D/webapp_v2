'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  const [title, setTitle] = useState('');
  const [selectedDashboardId, setSelectedDashboardId] = useState<number | null>(
    preselectedDashboardId ?? null
  );
  const [selectedDateColumn, setSelectedDateColumn] = useState<string>('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const needsDashboardPicker = !preselectedDashboardId;
  const effectiveDashboardId = preselectedDashboardId ?? selectedDashboardId;

  // Only fetch dashboards when the picker is needed and dialog is open
  const { data: dashboards } = useDashboards(
    needsDashboardPicker && open ? { dashboard_type: 'native' } : undefined
  );

  // Fetch the selected dashboard to get its datetime filters
  const { data: dashboardData } = useDashboard(
    open && effectiveDashboardId ? effectiveDashboardId : 0
  );

  const effectiveDashboardTitle =
    preselectedDashboardTitle ?? dashboards?.find((d: any) => d.id === selectedDashboardId)?.title;

  // Extract datetime filters from the dashboard
  const datetimeFilters: DashboardFilter[] =
    dashboardData?.filters?.filter((f: DashboardFilter) => f.filter_type === 'datetime') || [];

  const handleSubmit = async () => {
    if (!effectiveDashboardId) {
      toast.error('Please select a dashboard');
      return;
    }
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!selectedDateColumn) {
      toast.error('Please select a date column');
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
        title: title.trim(),
        dashboard_id: effectiveDashboardId,
        date_column: dateColumn,
        period_start: periodStart || undefined,
        period_end: periodEnd,
      });
      toast.success('Snapshot created');
      setOpen(false);
      resetForm();
      onCreated?.();
    } catch {
      toast.error('Failed to create snapshot');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    if (!preselectedDashboardId) setSelectedDashboardId(null);
    setSelectedDateColumn('');
    setPeriodStart('');
    setPeriodEnd('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Camera className="h-4 w-4 mr-1" /> Create Snapshot
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Report Snapshot</DialogTitle>
          <DialogDescription>
            {effectiveDashboardTitle
              ? `Freeze the current state of "${effectiveDashboardTitle}" as an immutable report.`
              : 'Select a dashboard and freeze its current state as an immutable report.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {needsDashboardPicker && (
            <div className="space-y-2">
              <Label htmlFor="dashboard-select">Dashboard</Label>
              <Select
                value={selectedDashboardId?.toString() ?? ''}
                onValueChange={(val) => {
                  setSelectedDashboardId(Number(val));
                  setSelectedDateColumn('');
                }}
              >
                <SelectTrigger id="dashboard-select">
                  <SelectValue placeholder="Select a dashboard" />
                </SelectTrigger>
                <SelectContent>
                  {(dashboards || []).map((d: any) => (
                    <SelectItem key={d.id} value={d.id.toString()}>
                      {d.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="snapshot-title">Title</Label>
            <Input
              id="snapshot-title"
              placeholder="e.g., January 2025 Review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {effectiveDashboardId && (
            <div className="space-y-2">
              <Label htmlFor="date-column-select">Date Column</Label>
              {datetimeFilters.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No datetime filters on this dashboard.
                </p>
              ) : (
                <Select value={selectedDateColumn} onValueChange={setSelectedDateColumn}>
                  <SelectTrigger id="date-column-select">
                    <SelectValue placeholder="Select a datetime column" />
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
          )}

          <div className="space-y-2">
            <Label htmlFor="period-end">End Date</Label>
            <Input
              id="period-end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="period-start">
              Start Date <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="period-start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              max={periodEnd || undefined}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Snapshot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
