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
    // Create temporary container for regular chart rendering with proper sizing
    const container = document.createElement('div');
    container.style.width = '1200px'; // Increased width
    container.style.height = '800px'; // Increased height
    container.style.position = 'absolute';
    container.style.left = '-10000px'; // Move further off-screen
    container.style.top = '-10000px'; // Move further off-screen
    container.style.backgroundColor = '#ffffff'; // Ensure white background
    container.style.padding = '40px'; // Add padding for better chart spacing
    container.style.boxSizing = 'border-box';
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
      const chartInstance = echarts.init(container, null, {
        renderer: 'canvas', // Force canvas renderer for better export quality
        devicePixelRatio: 2, // Higher resolution for export
      });

      // Set the chart configuration with proper spacing and centering (no title for consistency)
      const config = {
        ...response.echarts_config,
        // Remove title to match chart detail view export behavior
        title: undefined,
        // Ensure proper grid/layout for all chart types
        grid: response.echarts_config.grid || {
          left: '10%',
          right: '10%',
          top: '15%',
          bottom: '10%',
          containLabel: true,
        },
        // For pie charts, ensure proper center positioning
        ...(response.echarts_config.series &&
          response.echarts_config.series[0]?.type === 'pie' && {
            series: response.echarts_config.series.map((series: any) => ({
              ...series,
              center: ['50%', '55%'], // Center the pie chart properly
              radius: series.radius || ['40%', '70%'], // Ensure reasonable radius
            })),
          }),
      };

      chartInstance.setOption(config, true); // Force refresh

      // Wait for rendering with longer timeout for complex charts
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Trigger resize to ensure proper layout
      chartInstance.resize();

      // Wait a bit more after resize
      await new Promise((resolve) => setTimeout(resolve, 300));

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
      // Import chart data fetching and API functions
      const { apiGet, apiPost } = await import('@/lib/api');

      // First get the chart configuration to build the payload
      const chart = await apiGet(`/api/charts/${chartId}/`);

      if (!chart) {
        throw new Error('Chart not found');
      }

      // Build chart data payload similar to how it's done in the chart detail view
      const chartDataPayload = {
        chart_type: chart.chart_type,
        computation_type: chart.computation_type,
        schema_name: chart.schema_name,
        table_name: chart.table_name,
        ...(chart.extra_config?.dimension_column && {
          dimension_col: chart.extra_config.dimension_column,
        }),
        ...(chart.extra_config?.aggregate_column && {
          aggregate_col: chart.extra_config.aggregate_column,
        }),
        ...(chart.extra_config?.aggregate_function && {
          aggregate_func: chart.extra_config.aggregate_function,
        }),
        ...(chart.extra_config?.extra_dimension_column && {
          extra_dimension: chart.extra_config.extra_dimension_column,
        }),
        ...(chart.extra_config?.metrics &&
          chart.extra_config.metrics.length > 0 && { metrics: chart.extra_config.metrics }),
        customizations: chart.extra_config?.customizations || {},
        extra_config: {
          filters: chart.extra_config?.filters || [],
          pagination: { enabled: false, page_size: 10000 }, // Get all data for export
          sort: chart.extra_config?.sort || [],
        },
      };

      // Use the same API endpoint as the working chart detail view
      const response = await apiPost('/api/charts/chart-data-preview/', {
        ...chartDataPayload,
        offset: 0,
        limit: 10000,
      });

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
