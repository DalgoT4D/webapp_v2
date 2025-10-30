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

      if (chartType === 'table') {
        // Handle table exports
        if (format === 'csv') {
          if (!tableData) {
            throw new Error('Table data is not available for export');
          }
          await ChartExporter.exportTableAsCSV(tableData, exportOptions);
          toast.success(`Table exported as CSV`, {
            description: 'Comma-separated values file',
          });
        } else if (format === 'png') {
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
          // Other charts show PNG/PDF export
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
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
