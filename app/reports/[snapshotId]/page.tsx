'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
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
  Share2,
  User,
} from 'lucide-react';
import { toastSuccess, toastError, toastInfo } from '@/lib/toast';
import { useSnapshotView, updateSnapshot } from '@/hooks/api/useReports';
import { DashboardNativeView } from '@/components/dashboard/dashboard-native-view';
import { ReportShareModal } from '@/components/reports/ReportShareModal';
import { formatDateShort } from '@/components/reports/utils';
import {
  PDF_CLONE_WIDTH_PX,
  PDF_CLONE_PADDING_PX,
  PDF_HEADER_MARGIN_BOTTOM_PX,
  PDF_RENDER_DELAY_MS,
  PDF_CANVAS_SCALE,
  PDF_PAGE_MARGIN_PT,
  PDF_A4_WIDTH_PT,
  PDF_JPEG_QUALITY,
} from '@/constants/reports';

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

  // Initialize summary draft when viewData loads (replaces state-during-render pattern)
  useEffect(() => {
    if (!summaryTouched && viewData?.report_metadata.summary) {
      setSummaryDraft(viewData.report_metadata.summary);
    }
  }, [viewData?.report_metadata.summary, summaryTouched]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSnapshot(snapshotId, { summary: summaryDraft });
      mutate();
      toastSuccess.saved('Report');
    } catch (error) {
      toastError.save(error, 'report');
    } finally {
      setIsSaving(false);
    }
  }, [snapshotId, summaryDraft, mutate]);

  const handleDownload = useCallback(async () => {
    if (!viewData) return;

    setIsExporting(true);
    toastInfo.generic('Generating PDF...');

    try {
      const { default: html2canvas } = await import('html2canvas-pro');
      const { default: jsPDF } = await import('jspdf');
      const { default: saveAs } = await import('file-saver');

      // Create an off-screen wrapper to render the combined content
      const wrapper = document.createElement('div');
      wrapper.style.position = 'absolute';
      wrapper.style.left = '-9999px';
      wrapper.style.top = '0';
      wrapper.style.width = `${PDF_CLONE_WIDTH_PX}px`;
      wrapper.style.backgroundColor = '#ffffff';
      wrapper.style.padding = `${PDF_CLONE_PADDING_PX}px`;

      // Clone the header
      if (headerRef.current) {
        const headerClone = headerRef.current.cloneNode(true) as HTMLElement;
        headerClone.style.marginBottom = `${PDF_HEADER_MARGIN_BOTTOM_PX}px`;
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
      await new Promise((resolve) => setTimeout(resolve, PDF_RENDER_DELAY_MS));

      const canvas = await html2canvas(wrapper, {
        scale: PDF_CANVAS_SCALE,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        windowWidth: PDF_CLONE_WIDTH_PX,
        logging: false,
        imageTimeout: 0,
        removeContainer: false,
        foreignObjectRendering: false,
      });

      document.body.removeChild(wrapper);

      // Create single-page PDF with custom dimensions to fit all content
      const contentWidth = PDF_A4_WIDTH_PT - PDF_PAGE_MARGIN_PT * 2;
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;
      const pageHeight = imgHeight + PDF_PAGE_MARGIN_PT * 2;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: [PDF_A4_WIDTH_PT, pageHeight],
        compress: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', PDF_JPEG_QUALITY);
      pdf.addImage(
        imgData,
        'JPEG',
        PDF_PAGE_MARGIN_PT,
        PDF_PAGE_MARGIN_PT,
        imgWidth,
        imgHeight,
        undefined,
        'FAST'
      );

      const sanitizedTitle = (viewData.report_metadata.title || 'report')
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase();
      saveAs(pdf.output('blob'), `${sanitizedTitle}.pdf`);
      toastSuccess.exported('Report', 'pdf');
    } catch (error) {
      console.error('PDF export failed:', error);
      toastError.export(error, 'pdf');
    } finally {
      setIsExporting(false);
    }
  }, [viewData]);

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
        <Button data-testid="report-go-back-btn" variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  const { dashboard_data, report_metadata, frozen_chart_configs } = viewData;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div ref={headerRef} className="flex-shrink-0 border-b bg-background px-6 pt-4 pb-3">
        {/* Top row: Back + Title + Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid="report-back-btn"
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
              data-testid="report-download-btn"
              variant="ghost"
              size="icon"
              aria-label="Download report as PDF"
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
              data-testid="report-share-btn"
              variant="ghost"
              size="icon"
              aria-label="Share report"
              onClick={() => setShareModalOpen(true)}
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <Button data-testid="report-save-btn" onClick={handleSave} disabled={isSaving}>
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
                data-testid="report-summary-textarea"
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
