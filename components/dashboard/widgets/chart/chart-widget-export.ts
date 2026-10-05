'use client';

import type { RefObject } from 'react';
import type { ECharts } from 'echarts/core';
import { toast } from 'sonner';
import { apiPostBinary } from '@/lib/api';
import { ChartExporter, generateFilename, type BrandingOptions } from '@/lib/chart-export';
import { ChartTypes, type Chart, type ChartDataPayload } from '@/types/charts';
import type { FrozenChartConfig } from '@/types/reports';
import type { PivotTableResponse } from '@/types/pivot-table';

export interface ChartWidgetExportOptions {
  chartId: number;
  effectiveChart:
    | { title?: string; chart_type?: string; extra_config?: Chart['extra_config'] }
    | undefined;
  /** Private-page chart metadata (undefined on public pages — see the CSV filename pin). */
  chartMetadata: { title?: string } | undefined;
  frozenChartConfig: FrozenChartConfig | undefined;
  chartData: { data?: unknown } | undefined;
  chartDataPayload: ChartDataPayload | null;
  dashboardFilters: Record<string, unknown>;
  isPublicMode: boolean;
  publicToken?: string;
  isTableChart: boolean;
  isPivotTableChart: boolean;
  isMapChart: boolean;
  orgLogoUrl?: string | null;
  tableRef: RefObject<HTMLDivElement | null>;
  chartInstance: RefObject<ECharts | null>;
  mapChartInstance: RefObject<ECharts | null>;
}

/** PNG and CSV export of a dashboard chart widget (view). */
export function buildChartWidgetExportHandlers({
  chartId,
  effectiveChart,
  chartMetadata,
  frozenChartConfig,
  chartData,
  chartDataPayload,
  dashboardFilters,
  isPublicMode,
  publicToken,
  isTableChart,
  isPivotTableChart,
  isMapChart,
  orgLogoUrl,
  tableRef,
  chartInstance,
  mapChartInstance,
}: ChartWidgetExportOptions) {
  // Download PNG with org branding (logo top-left, title top-center, powered-by bottom-right)
  const handleDownloadImage = async () => {
    const branding: BrandingOptions = {
      orgLogoUrl,
      chartTitle: effectiveChart?.title,
    };

    try {
      // Handle table/pivot chart export
      if ((isTableChart || isPivotTableChart) && tableRef.current) {
        const filename = generateFilename(
          chartMetadata?.title || frozenChartConfig?.title || `table-${chartId}`,
          'png'
        );
        await ChartExporter.exportTableWithBranding(tableRef.current, { filename, ...branding });
        toast.success('Table downloaded successfully');
        return;
      }

      const activeChartInstance = isMapChart ? mapChartInstance.current : chartInstance.current;
      if (activeChartInstance) {
        const filename = generateFilename(
          effectiveChart?.title || `${isMapChart ? 'map' : 'chart'}-${chartId}`,
          'png'
        );
        await ChartExporter.exportEChartsWithBranding(activeChartInstance, {
          filename,
          ...branding,
        });
        toast.success('Chart downloaded successfully');
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download. Please try again.');
    }
  };

  // New CSV export function
  const handleDownloadCSV = async () => {
    try {
      // Pivot tables generate the cross-tab CSV client-side from the already
      // rendered response — the backend stream only emits flat table shapes.
      if (isPivotTableChart) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        const sanitizedTitle = (
          chartMetadata?.title ||
          frozenChartConfig?.title ||
          `chart-${chartId}`
        )
          .replace(/[^a-z0-9]/gi, '_')
          .replace(/_+/g, '_')
          .toLowerCase();
        await ChartExporter.exportPivotAsCSV(
          chartData?.data as unknown as PivotTableResponse | undefined,
          effectiveChart?.extra_config,
          { filename: `${sanitizedTitle}-${timestamp}` }
        );
        toast.success('CSV downloaded successfully');
        return;
      }

      if (!chartDataPayload) {
        toast.error('Chart data is not available for CSV export');
        console.error('chartDataPayload is null');
        return;
      }

      // Skip CSV export for number charts (no meaningful data)
      if (effectiveChart?.chart_type === ChartTypes.NUMBER) {
        toast.error('Number charts cannot be exported as CSV');
        return;
      }

      // Debug logging for maps
      if (effectiveChart?.chart_type === ChartTypes.MAP) {
        console.log('Map CSV Export - Payload:', {
          chart_type: chartDataPayload.chart_type,
          dimension_col: chartDataPayload.dimension_col,
          aggregate_col: chartDataPayload.aggregate_col,
          aggregate_func: chartDataPayload.aggregate_func,
          geographic_column: chartDataPayload.geographic_column,
          value_column: chartDataPayload.value_column,
        });
      }

      toast.info('Preparing CSV download...', {
        description: 'Fetching chart data from server',
      });

      // Pass dashboard filters as query string so the backend can resolve them
      // against the chart's table (mirrors the chart-data-preview pattern).
      const csvQueryString =
        !frozenChartConfig && Object.keys(dashboardFilters).length > 0
          ? `?dashboard_filters=${encodeURIComponent(JSON.stringify(dashboardFilters))}`
          : '';

      let blob: Blob;
      if (isPublicMode && publicToken) {
        const publicUrl = `/api/v1/public/dashboards/${publicToken}/charts/${chartId}/download-csv/${csvQueryString}`;
        blob = await apiPostBinary(publicUrl, chartDataPayload);
      } else {
        blob = await apiPostBinary(`/api/charts/download-csv/${csvQueryString}`, chartDataPayload);
      }

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      // PINNED-BUGS: "Public CSV filename `chart_<id>-<ts>.csv` instead of title (reads private metadata)"
      const sanitizedTitle = (
        chartMetadata?.title ||
        frozenChartConfig?.title ||
        `chart-${chartId}`
      )
        .replace(/[^a-z0-9]/gi, '_')
        .replace(/_+/g, '_')
        .toLowerCase();
      const csvFilename = `${sanitizedTitle}-${timestamp}.csv`;

      // Download using file-saver
      const fileSaver = await import('file-saver');
      const saveAs = fileSaver.default?.saveAs || fileSaver.saveAs || fileSaver.default;
      if (typeof saveAs !== 'function') {
        throw new Error('Failed to load file-saver library');
      }
      saveAs(blob, csvFilename);

      toast.success('CSV downloaded successfully', {
        description: `File: ${csvFilename}`,
      });
    } catch (error: unknown) {
      console.error('CSV download failed for chart type:', effectiveChart?.chart_type, error);
      console.error('chartDataPayload was:', chartDataPayload);
      toast.error('CSV Export Failed', {
        description: (error as Error).message || 'Failed to export chart data. Please try again.',
      });
    }
  };

  return { handleDownloadImage, handleDownloadCSV };
}
