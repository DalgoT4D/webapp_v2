'use client';

import { useState } from 'react';
import { Download, FileImage, FileText, Table } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { ChartExporter, generateFilename } from '@/lib/chart-export';
import type * as echarts from 'echarts';
import type { ChartDataPayload } from '@/types/charts';
import type { PivotTableResponse } from '@/types/pivot-table';
import { apiPostBinary } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { useAuthStore } from '@/stores/authStore';

interface ChartExportDropdownProps {
  chartTitle: string;
  chartElement?: HTMLElement | null;
  chartInstance?: echarts.ECharts | null;
  onExportStart?: () => void;
  onExportComplete?: () => void;
  onExportError?: (error: string) => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showText?: boolean;
  // Table-specific props
  chartType?: string;
  tableElement?: HTMLElement | null;
  // Chart data payload for CSV export
  chartDataPayload?: ChartDataPayload | null;
  // Pivot CSV is generated client-side from the already-fetched cross-tab
  // response (the backend stream can't represent pivot column dims/subtotals).
  pivotData?: PivotTableResponse;
  pivotExtraConfig?: Record<string, unknown>;
  // Public mode props
  isPublicMode?: boolean;
  publicToken?: string;
  chartId?: number;
  // T12: drill-down filter context — when set, appended to filename and label changes
  drillFilters?: Record<string, string>;
}

export function ChartExportDropdown({
  chartTitle,
  chartElement,
  chartInstance,
  onExportStart,
  onExportComplete,
  onExportError,
  variant = 'outline',
  size = 'default',
  showText = true,
  chartType,
  tableElement,
  chartDataPayload,
  pivotData,
  pivotExtraConfig,
  isPublicMode = false,
  publicToken,
  chartId,
  drillFilters,
}: ChartExportDropdownProps) {
  const [isExporting, setIsExporting] = useState(false);
  const currentOrg = useAuthStore((state) => state.currentOrg);
  const orgLogoUrl = currentOrg?.logo_url ?? null;

  // T12: when drill-down filters are active, append them to the export title
  const effectiveTitle =
    drillFilters && Object.keys(drillFilters).length > 0
      ? `${chartTitle} - ${Object.values(drillFilters).join(' - ')}`
      : chartTitle;

  const handleExport = async (format: 'png' | 'pdf' | 'csv') => {
    if (isExporting) return;

    setIsExporting(true);
    onExportStart?.();

    try {
      const filename = generateFilename(effectiveTitle, format);
      const exportOptions = {
        filename,
        format,
        backgroundColor: '#ffffff',
      };

      // Pivot tables generate the cross-tab CSV client-side from the already
      // rendered response — the backend stream only emits flat table shapes.
      if (format === 'csv' && chartType === 'pivot_table') {
        await ChartExporter.exportPivotAsCSV(pivotData, pivotExtraConfig, { filename });
        trackEvent(ANALYTICS_EVENTS.CHART_EXPORTED, { format, chart_type: chartType });
        toast.success('CSV downloaded successfully');
        onExportComplete?.();
        return;
      }

      // Handle CSV export for all chart types using streaming endpoint
      if (format === 'csv') {
        if (!chartDataPayload) {
          throw new Error('Chart data configuration is not available for CSV export');
        }

        toast.info('Preparing CSV download...', {
          description: 'Fetching chart data from server',
        });

        // Use appropriate endpoint based on public mode
        let blob: Blob;
        if (isPublicMode && publicToken && chartId) {
          // Public dashboard - use unauthenticated endpoint
          const publicUrl = `/api/v1/public/dashboards/${publicToken}/charts/${chartId}/download-csv/`;
          blob = await apiPostBinary(publicUrl, chartDataPayload);
        } else {
          // Authenticated dashboard - use authenticated endpoint
          blob = await apiPostBinary('/api/charts/download-csv/', chartDataPayload);
        }

        // Generate filename
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        const csvFilename = `${filename}-${timestamp}.csv`;

        // Download the blob - handle both default and named exports for production builds
        const fileSaver = await import('file-saver');
        const saveAs = fileSaver.default?.saveAs || fileSaver.saveAs || fileSaver.default;
        if (typeof saveAs !== 'function') {
          throw new Error('Failed to load file-saver library');
        }
        saveAs(blob, csvFilename);

        toast.success('CSV downloaded successfully', {
          description: `File: ${csvFilename}`,
        });
      } else if (chartType === 'table' || chartType === 'pivot_table') {
        // Handle table/pivot image exports (PNG)
        if (format === 'png') {
          if (!tableElement) {
            throw new Error('Table element is not available for export');
          }
          await ChartExporter.exportTableWithBranding(tableElement, {
            ...exportOptions,
            orgLogoUrl,
            chartTitle,
          });
          toast.success(`Table exported as PNG`, {
            description: 'High resolution image',
          });
        }
      } else {
        // PNG and PDF both get org logo + powered-by branding when a live chart instance is available
        if ((format === 'png' || format === 'pdf') && chartInstance) {
          await ChartExporter.exportEChartsWithBranding(chartInstance, {
            ...exportOptions,
            orgLogoUrl,
            chartTitle,
          });
        } else {
          await ChartExporter.exportChart(chartElement, chartInstance, exportOptions);
        }
        const formatName = format.toUpperCase();
        toast.success(`Chart exported as ${formatName}`, {
          description: format === 'pdf' ? 'Portable Document Format' : 'High resolution image',
        });
      }

      trackEvent(ANALYTICS_EVENTS.CHART_EXPORTED, { format, chart_type: chartType });
      onExportComplete?.();
    } catch (error: any) {
      console.error('Export error:', error);
      const errorMessage = error.message || 'Failed to export chart';
      toast.error('Export Failed', {
        description: errorMessage,
      });
      onExportError?.(errorMessage);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={isExporting}>
          {isExporting ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
          ) : (
            <Download className={`w-4 h-4 ${showText ? 'mr-2' : ''}`} />
          )}
          {showText &&
            (isExporting
              ? 'Exporting...'
              : drillFilters && Object.keys(drillFilters).length > 0
                ? 'Export current view'
                : 'Export')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {chartType === 'table' || chartType === 'pivot_table' ? (
          // Table/pivot charts show PNG and CSV export
          <>
            <DropdownMenuItem
              onClick={() => handleExport('png')}
              className="cursor-pointer"
              disabled={isExporting}
            >
              <FileImage className="w-4 h-4 mr-2" />
              <span>Export as PNG</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => handleExport('csv')}
              className="cursor-pointer"
              disabled={isExporting}
            >
              <Table className="w-4 h-4 mr-2" />
              <span>Export to CSV</span>
            </DropdownMenuItem>
          </>
        ) : (
          // Other charts show PNG/PDF/CSV export
          <>
            <DropdownMenuItem
              onClick={() => handleExport('png')}
              className="cursor-pointer"
              disabled={isExporting}
            >
              <FileImage className="w-4 h-4 mr-2" />
              <span>Export as PNG</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => handleExport('pdf')}
              className="cursor-pointer"
              disabled={isExporting}
            >
              <FileText className="w-4 h-4 mr-2" />
              <span>Export as PDF</span>
            </DropdownMenuItem>

            {chartDataPayload && (
              <DropdownMenuItem
                onClick={() => handleExport('csv')}
                className="cursor-pointer"
                disabled={isExporting}
              >
                <Table className="w-4 h-4 mr-2" />
                <span>Export Data as CSV</span>
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
