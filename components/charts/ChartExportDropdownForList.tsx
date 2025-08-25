'use client';

import { useState } from 'react';
import { Download, FileImage, FileText } from 'lucide-react';
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { ChartExporter, generateFilename } from '@/lib/chart-export';
import { MapExportHandler } from '@/lib/map-export-handler';

interface ChartExportDropdownForListProps {
  chartId: number;
  chartTitle: string;
  chartType: string;
  onExportStart?: () => void;
  onExportComplete?: () => void;
  onExportError?: (error: string) => void;
}

export function ChartExportDropdownForList({
  chartId,
  chartTitle,
  chartType,
  onExportStart,
  onExportComplete,
  onExportError,
}: ChartExportDropdownForListProps) {
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

      if (chartType === 'map') {
        // Handle map export with geojson fetching
        const mapChartInstance = await MapExportHandler.exportMapChart(chartId, chartTitle, format);

        try {
          // Export the map using the temporary instance
          await ChartExporter.exportEChartsInstance(mapChartInstance, exportOptions);
        } finally {
          // Always clean up the temporary chart
          MapExportHandler.cleanupMapChart(mapChartInstance);
        }
      } else {
        // For non-map charts, we need to temporarily render the chart
        // This is similar to map handling but without geojson complexity
        await handleRegularChartExport(chartId, chartTitle, exportOptions);
      }

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

  const handleRegularChartExport = async (chartId: number, title: string, exportOptions: any) => {
    // Create temporary container for regular chart rendering
    const container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    document.body.appendChild(container);

    try {
      // Import chart data fetching
      const { apiGet } = await import('@/lib/api');
      const response = await apiGet(`/api/charts/${chartId}/data/`);

      if (!response?.echarts_config) {
        throw new Error('No chart configuration available');
      }

      // Create chart instance
      const echarts = await import('echarts');
      const chartInstance = echarts.init(container);

      // Set the chart configuration
      const config = {
        ...response.echarts_config,
        title: {
          text: title,
          left: 'center',
          textStyle: {
            fontSize: 18,
            fontWeight: 'bold',
          },
        },
      };

      chartInstance.setOption(config);

      // Wait for rendering
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Export the chart
      await ChartExporter.exportEChartsInstance(chartInstance, exportOptions);

      // Cleanup
      chartInstance.dispose();
      document.body.removeChild(container);
    } catch (error) {
      // Cleanup on error
      if (container.parentNode) {
        document.body.removeChild(container);
      }
      throw error;
    }
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="cursor-pointer">
        {isExporting ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        ) : (
          <Download className="w-4 h-4 mr-2" />
        )}
        {isExporting ? 'Exporting...' : 'Export'}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
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
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
