'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Calendar, Clock, Edit, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useSnapshotView, updateSnapshot } from '@/hooks/api/useReports';
import { DashboardNativeView } from '@/components/dashboard/dashboard-native-view';

export default function SnapshotViewerPage() {
  const params = useParams();
  const router = useRouter();
  const snapshotId = Number(params.snapshotId);

  const { viewData, isLoading, isError, mutate } = useSnapshotView(snapshotId);

  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [isSavingSummary, setIsSavingSummary] = useState(false);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (isError || !viewData) {
    return (
      <div className="p-6">
        <p className="text-red-500">Failed to load snapshot.</p>
        <Button variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  const { dashboard_data, report_metadata, frozen_chart_configs } = viewData;

  const handleSaveSummary = async () => {
    setIsSavingSummary(true);
    try {
      await updateSnapshot(snapshotId, { summary: summaryDraft });
      mutate();
      setIsEditingSummary(false);
      toast.success('Summary saved');
    } catch {
      toast.error('Failed to save summary');
    } finally {
      setIsSavingSummary(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/reports')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{report_metadata.title}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>
                {formatDate(report_metadata.period_start)} —{' '}
                {formatDate(report_metadata.period_end)}
                {report_metadata.is_rolling_end && ' (till today)'}
              </span>
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(report_metadata.created_at).toLocaleDateString()}
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 border-b bg-background">
        {isEditingSummary ? (
          <div className="space-y-2">
            <Textarea
              value={summaryDraft}
              onChange={(e) => setSummaryDraft(e.target.value)}
              placeholder="Write observations, key findings, or action items..."
              rows={4}
              className="resize-y"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveSummary} disabled={isSavingSummary}>
                <Save className="h-3 w-3 mr-1" /> {isSavingSummary ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditingSummary(false)}>
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {report_metadata.summary ? (
                <p className="text-sm whitespace-pre-wrap">{report_metadata.summary}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No summary yet.</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSummaryDraft(report_metadata.summary || '');
                setIsEditingSummary(true);
              }}
              className="ml-2 shrink-0"
            >
              <Edit className="h-3 w-3 mr-1" />
              {report_metadata.summary ? 'Edit' : 'Add Summary'}
            </Button>
          </div>
        )}
      </div>

      {/* Dashboard - reused component */}
      <div className="flex-1">
        <DashboardNativeView
          dashboardId={dashboard_data.id}
          dashboardData={dashboard_data}
          isReportMode={true}
          frozenChartConfigs={frozen_chart_configs}
          hideHeader={true}
        />
      </div>
    </div>
  );
}
