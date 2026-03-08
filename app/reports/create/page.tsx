'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { createSnapshot, type DateColumn } from '@/hooks/api/useReports';
import { useDashboards, useDashboard, type DashboardFilter } from '@/hooks/api/useDashboards';

function StepBadge({ step }: { step: number }) {
  return (
    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">
      {step}
    </div>
  );
}

export default function CreateReportPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDashboardId, setSelectedDashboardId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDateColumn, setSelectedDateColumn] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [periodStart, setPeriodStart] = useState('');

  const { data: dashboards } = useDashboards({ dashboard_type: 'native' });
  const { data: dashboardData } = useDashboard(selectedDashboardId ?? 0);

  const datetimeFilters: DashboardFilter[] =
    dashboardData?.filters?.filter((f: DashboardFilter) => f.filter_type === 'datetime') || [];

  const canSubmit =
    selectedDashboardId && title.trim() && selectedDateColumn && periodEnd && !isSubmitting;

  const handleSubmit = async () => {
    if (!selectedDashboardId) {
      toast.error('Please select a dashboard');
      return;
    }
    if (!title.trim()) {
      toast.error('Please enter a name');
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

    const [schema_name, table_name, column_name] = selectedDateColumn.split('.');
    const dateColumn: DateColumn = { schema_name, table_name, column_name };

    setIsSubmitting(true);
    try {
      await createSnapshot({
        title: title.trim(),
        dashboard_id: selectedDashboardId,
        date_column: dateColumn,
        period_start: periodStart || undefined,
        period_end: periodEnd,
        description: description.trim() || undefined,
      });
      toast.success('Report created');
      router.push('/reports');
    } catch {
      toast.error('Failed to create report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="px-8 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/reports">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Create a report</h1>
      </div>

      <div className="max-w-2xl space-y-8">
        {/* Step 1: Select Dashboard */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <StepBadge step={1} />
            <h2 className="text-xl font-semibold">Select a dashboard</h2>
          </div>
          <div className="ml-11">
            <Select
              value={selectedDashboardId?.toString() ?? ''}
              onValueChange={(val) => {
                setSelectedDashboardId(Number(val));
                setSelectedDateColumn('');
              }}
            >
              <SelectTrigger className="max-w-lg">
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
        </div>

        {/* Step 2: Name */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <StepBadge step={2} />
            <h2 className="text-xl font-semibold">Name your Report</h2>
          </div>
          <div className="ml-11">
            <Input
              placeholder="Pick a unique name for this report"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="max-w-lg"
            />
          </div>
        </div>

        {/* Step 3: Description (Optional) */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <StepBadge step={3} />
            <h2 className="text-xl font-semibold">
              Description{' '}
              <span className="text-muted-foreground font-normal text-base">(Optional)</span>
            </h2>
          </div>
          <div className="ml-11">
            <Textarea
              placeholder="Enter a brief explainer for this report"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="max-w-lg resize-y"
              rows={3}
            />
          </div>
        </div>

        {/* Step 4: Date Column (visible after dashboard selected) */}
        {selectedDashboardId && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <StepBadge step={4} />
              <h2 className="text-xl font-semibold">Date Column</h2>
            </div>
            <div className="ml-11">
              {datetimeFilters.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No datetime filters on this dashboard.
                </p>
              ) : (
                <Select value={selectedDateColumn} onValueChange={setSelectedDateColumn}>
                  <SelectTrigger className="max-w-lg">
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
          </div>
        )}

        {/* Step 5: Reporting Period (visible after date column selected) */}
        {selectedDateColumn && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <StepBadge step={5} />
              <h2 className="text-xl font-semibold">Reporting Period</h2>
            </div>
            <div className="ml-11 space-y-4 max-w-lg">
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Start Date <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  max={periodEnd || undefined}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <Separator className="my-8" />
      <div className="flex items-center gap-3">
        <Button variant="cancel" onClick={() => router.push('/reports')}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {isSubmitting ? 'Creating...' : 'Create Report'}
        </Button>
      </div>
    </div>
  );
}
