'use client';

import { useState } from 'react';
import { Download, FileImage, FileText } from 'lucide-react';
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
}: ChartExportDropdownProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'png' | 'pdf') => {
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

      await ChartExporter.exportChart(chartElement, chartInstance, exportOptions);

      const formatName = format.toUpperCase();
      toast.success(`Chart exported as ${formatName}`, {
        description: format === 'pdf' ? 'Professional document format' : 'High resolution image',
      });
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
