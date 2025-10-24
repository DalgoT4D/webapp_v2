'use client';

import { useState } from 'react';
import { Download, FileImage, FileText, Table } from 'lucide-react';
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { toastSuccess, toastError } from '@/lib/toast';
import { ChartExporter, generateFilename, type TableData } from '@/lib/chart-export';
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

      if (format === 'csv' && chartType === 'table') {
        // Handle table CSV export
        await handleTableCSVExport(chartId, chartTitle, exportOptions);
      } else if (chartType === 'map') {
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
      toastSuccess.exported(chartTitle, format);
      onExportComplete?.();
    } catch (error: any) {
      console.error('Export error:', error);
      const errorMessage = error.message || 'Failed to export chart';
      toastError.export(error, format);
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

  const handleTableCSVExport = async (chartId: number, title: string, exportOptions: any) => {
    try {
      // Import chart data fetching (similar to other chart handlers)
      const { apiGet } = await import('@/lib/api');

      // Fetch table data using data preview API
      const response = await apiGet(`/api/charts/${chartId}/data-preview/?page=1&pageSize=10000`);

      if (!response?.data || !response?.columns) {
        throw new Error('No table data available for export');
      }

      const tableData: TableData = {
        data: response.data,
        columns: response.columns,
      };

      // Export as CSV
      await ChartExporter.exportTableAsCSV(tableData, exportOptions);
    } catch (error) {
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
        {chartType === 'table' ? (
          // Table charts show CSV export only
          <DropdownMenuItem
            onClick={() => handleExport('csv')}
            className="cursor-pointer"
            disabled={isExporting}
          >
            <Table className="w-4 h-4 mr-2" />
            <span>Export to CSV</span>
          </DropdownMenuItem>
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
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
