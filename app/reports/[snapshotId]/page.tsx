'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Download,
  LayoutGrid,
  MessageSquare,
  Share2,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSnapshotView, updateSnapshot } from '@/hooks/api/useReports';
import { DashboardNativeView } from '@/components/dashboard/dashboard-native-view';

export default function SnapshotViewerPage() {
  const params = useParams();
  const router = useRouter();
  const snapshotId = Number(params.snapshotId);

  const { viewData, isLoading, isError, mutate } = useSnapshotView(snapshotId);

  const [summaryDraft, setSummaryDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [summaryTouched, setSummaryTouched] = useState(false);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-5 w-96" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (isError || !viewData) {
    return (
      <div className="p-6">
        <p className="text-red-500">Failed to load report.</p>
        <Button variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  const { dashboard_data, report_metadata, frozen_chart_configs } = viewData;

  // Initialize summary draft on first render if not touched
  if (!summaryTouched && report_metadata.summary && !summaryDraft) {
    setSummaryDraft(report_metadata.summary);
  }

  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSnapshot(snapshotId, { summary: summaryDraft });
      mutate();
      toast.success('Report saved');
    } catch {
      toast.error('Failed to save report');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-4 pb-3">
        {/* Top row: Back + Title + Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/reports')}
              className="flex items-center gap-1 text-sm text-foreground hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="flex items-center gap-1">
              <h1 className="text-2xl font-bold">{report_metadata.title}</h1>
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" title="Download">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Share">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Comments">
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {report_metadata.period_start
              ? formatDateShort(report_metadata.period_start)
              : 'All'} - {formatDateShort(report_metadata.period_end)}
          </span>
          {report_metadata.created_by && (
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Created by: {report_metadata.created_by}
            </span>
          )}
          {report_metadata.dashboard_title && (
            <span className="flex items-center gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5" />
              {report_metadata.dashboard_title}
            </span>
          )}
        </div>
      </div>

      {/* Dashboard with executive summary inside the canvas */}
      <div className="flex-1 overflow-hidden min-h-0">
        <DashboardNativeView
          dashboardId={dashboard_data.id}
          dashboardData={dashboard_data}
          isReportMode={true}
          frozenChartConfigs={frozen_chart_configs}
          hideHeader={true}
          beforeContent={
            <div className="border rounded-lg p-5 mb-2 bg-background">
              <h2 className="text-lg font-semibold mb-2">Executive Summary</h2>
              <Textarea
                value={summaryDraft}
                onChange={(e) => {
                  setSummaryDraft(e.target.value);
                  setSummaryTouched(true);
                }}
                placeholder="Add your notes here"
                rows={2}
                className="resize-y border-none shadow-none p-0 focus-visible:ring-0 text-sm text-muted-foreground placeholder:text-muted-foreground"
              />
            </div>
          }
        />
      </div>
    </div>
  );
}
