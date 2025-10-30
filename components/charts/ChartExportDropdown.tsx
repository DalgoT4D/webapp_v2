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
import { ChartExporter, generateFilename, type TableData } from '@/lib/chart-export';
import type * as echarts from 'echarts';
import type { ChartDataPayload } from '@/types/charts';
import { apiPostBinary } from '@/lib/api';

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
  tableData?: TableData;
  tableElement?: HTMLElement | null;
  // Chart data payload for CSV export
  chartDataPayload?: ChartDataPayload | null;
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
  tableData,
  tableElement,
  chartDataPayload,
}: ChartExportDropdownProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'png' | 'pdf' | 'csv') => {
    if (isExporting) return;

    setIsExporting(true);
    onExportStart?.();

    try {
      const filename = generateFilename(chartTitle, format);
      const exportOptions = {
        filename,
        format,
        backgroundColor: '#ffffff',
      };

      // Handle CSV export for all chart types using streaming endpoint
      if (format === 'csv') {
        if (!chartDataPayload) {
          throw new Error('Chart data configuration is not available for CSV export');
        }

        toast.info('Preparing CSV download...', {
          description: 'Fetching chart data from server',
        });

        // Use API helper with cookie-based auth
        const blob = await apiPostBinary('/api/charts/download-csv/', chartDataPayload);

        // Generate filename
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        const csvFilename = `${filename}-${timestamp}.csv`;

        // Download the blob
        const { saveAs } = await import('file-saver');
        saveAs(blob, csvFilename);

        toast.success('CSV downloaded successfully', {
          description: `File: ${csvFilename}`,
        });
      } else if (chartType === 'table') {
        // Handle table image exports (PNG)
        if (format === 'png') {
          if (!tableElement) {
            throw new Error('Table element is not available for export');
          }
          await ChartExporter.exportTableAsImage(tableElement, exportOptions);
          toast.success(`Table exported as PNG`, {
            description: 'High resolution image',
          });
        }
      } else {
        // Export chart as PNG/PDF
        await ChartExporter.exportChart(chartElement, chartInstance, exportOptions);
        const formatName = format.toUpperCase();
        toast.success(`Chart exported as ${formatName}`, {
          description: format === 'pdf' ? 'Portable Document Format' : 'High resolution image',
        });
      }

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
          {showText && (isExporting ? 'Exporting...' : 'Export')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {chartType === 'table' ? (
          // Table charts show PNG and CSV export
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
