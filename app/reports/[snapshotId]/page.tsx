'use client';

import { useState, useRef, useCallback } from 'react';
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
  Loader2,
  MessageSquare,
  Share2,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSnapshotView, updateSnapshot } from '@/hooks/api/useReports';
import { DashboardNativeView } from '@/components/dashboard/dashboard-native-view';
import { ReportShareModal } from '@/components/reports/ReportShareModal';

export default function SnapshotViewerPage() {
  const params = useParams();
  const router = useRouter();
  const snapshotId = Number(params.snapshotId);

  const { viewData, isLoading, isError, mutate } = useSnapshotView(snapshotId);

  const [summaryDraft, setSummaryDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [summaryTouched, setSummaryTouched] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const headerRef = useRef<HTMLDivElement>(null);
  const dashboardCanvasRef = useRef<HTMLDivElement | null>(null);

  const onContainerRef = useCallback((el: HTMLDivElement | null) => {
    dashboardCanvasRef.current = el;
  }, []);

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

  const handleDownload = async () => {
    setIsExporting(true);
    toast.info('Generating PDF...');

    try {
      const { default: html2canvas } = await import('html2canvas-pro');
      const { default: jsPDF } = await import('jspdf');
      const { saveAs } = await import('file-saver');

      // Create an off-screen wrapper to render the combined content
      const wrapper = document.createElement('div');
      wrapper.style.position = 'absolute';
      wrapper.style.left = '-9999px';
      wrapper.style.top = '0';
      wrapper.style.width = '1200px';
      wrapper.style.backgroundColor = '#ffffff';
      wrapper.style.padding = '32px';

      // Clone the header
      if (headerRef.current) {
        const headerClone = headerRef.current.cloneNode(true) as HTMLElement;
        headerClone.style.marginBottom = '16px';
        wrapper.appendChild(headerClone);
      }

      // Clone the dashboard canvas (contains executive summary + charts, no filters)
      if (dashboardCanvasRef.current) {
        const canvasClone = dashboardCanvasRef.current.cloneNode(true) as HTMLElement;
        canvasClone.style.width = '100%';

        // Copy canvas pixel data — cloneNode doesn't preserve drawn content
        // on <canvas> elements (ECharts renders charts to canvas)
        const originalCanvases = dashboardCanvasRef.current.querySelectorAll('canvas');
        const clonedCanvases = canvasClone.querySelectorAll('canvas');
        originalCanvases.forEach((orig, i) => {
          const clone = clonedCanvases[i];
          if (clone) {
            clone.width = orig.width;
            clone.height = orig.height;
            const ctx = clone.getContext('2d');
            if (ctx) {
              ctx.drawImage(orig, 0, 0);
            }
          }
        });

        wrapper.appendChild(canvasClone);
      }

      document.body.appendChild(wrapper);

      // Wait for cloned content to render
      await new Promise((resolve) => setTimeout(resolve, 500));

      const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
      });

      document.body.removeChild(wrapper);

      // A4 dimensions in points
      const a4Width = 595.28;
      const a4Height = 841.89;
      const margin = 20;
      const contentWidth = a4Width - margin * 2;
      const contentHeight = a4Height - margin * 2;

      // Scale canvas to fit A4 width
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;
      const totalPages = Math.ceil(imgHeight / contentHeight);

      const pdf = new jsPDF('p', 'pt', 'a4');

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();

        const srcY = (page * contentHeight * canvas.width) / contentWidth;
        const srcHeight = Math.min(
          (contentHeight * canvas.width) / contentWidth,
          canvas.height - srcY
        );

        // Create a page-sized canvas slice
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = srcHeight;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(canvas, 0, srcY, canvas.width, srcHeight, 0, 0, canvas.width, srcHeight);
        }

        const pageImgData = pageCanvas.toDataURL('image/png');
        const drawHeight = (srcHeight * contentWidth) / canvas.width;
        pdf.addImage(pageImgData, 'PNG', margin, margin, imgWidth, drawHeight);
      }

      const sanitizedTitle = (report_metadata.title || 'report')
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase();
      saveAs(pdf.output('blob'), `${sanitizedTitle}.pdf`);
      toast.success('PDF downloaded');
    } catch (error) {
      console.error('PDF export failed:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div ref={headerRef} className="px-6 pt-4 pb-3">
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
            <Button
              variant="ghost"
              size="icon"
              title="Download"
              onClick={handleDownload}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Share"
              onClick={() => setShareModalOpen(true)}
            >
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
          onContainerRef={onContainerRef}
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

      <ReportShareModal
        snapshotId={snapshotId}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
    </div>
  );
}
