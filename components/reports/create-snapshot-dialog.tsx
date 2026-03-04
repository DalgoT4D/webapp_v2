'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { createSnapshot } from '@/hooks/api/useReports';
import { useDashboards } from '@/hooks/api/useDashboards';

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
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [isTillToday, setIsTillToday] = useState(false);

  const needsDashboardPicker = !preselectedDashboardId;

  // Only fetch dashboards when the picker is needed and dialog is open
  const { data: dashboards } = useDashboards(
    needsDashboardPicker && open ? { dashboard_type: 'native' } : undefined
  );

  const effectiveDashboardId = preselectedDashboardId ?? selectedDashboardId;
  const effectiveDashboardTitle =
    preselectedDashboardTitle ?? dashboards?.find((d: any) => d.id === selectedDashboardId)?.title;

  const handleSubmit = async () => {
    if (!effectiveDashboardId) {
      toast.error('Please select a dashboard');
      return;
    }
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!periodStart) {
      toast.error('Please select a start date');
      return;
    }
    if (!isTillToday && !periodEnd) {
      toast.error('Please select an end date or choose "Till today"');
      return;
    }

    setIsSubmitting(true);
    try {
      await createSnapshot({
        title: title.trim(),
        dashboard_id: effectiveDashboardId,
        period_start: periodStart,
        period_end: isTillToday ? null : periodEnd,
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
    setPeriodStart('');
    setPeriodEnd('');
    setIsTillToday(false);
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
                onValueChange={(val) => setSelectedDashboardId(Number(val))}
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

          <div className="space-y-2">
            <Label htmlFor="period-start">Start Date</Label>
            <Input
              id="period-start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch id="till-today" checked={isTillToday} onCheckedChange={setIsTillToday} />
            <Label htmlFor="till-today" className="text-sm cursor-pointer">
              Till today (rolling end date)
            </Label>
          </div>

          {!isTillToday && (
            <div className="space-y-2">
              <Label htmlFor="period-end">End Date</Label>
              <Input
                id="period-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                min={periodStart || undefined}
              />
            </div>
          )}
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
