import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import * as echarts from 'echarts';
import html2canvas from 'html2canvas-pro';

export interface ExportOptions {
  filename?: string;
  format?: 'png' | 'pdf' | 'csv' | 'jpeg';
  backgroundColor?: string;
}

export interface TableData {
  data: Record<string, any>[];
  columns: string[];
}

/**
 * Simple and reliable chart export using ECharts built-in capabilities
 */
export class ChartExporter {
  /**
   * Export ECharts instance directly using built-in getDataURL
   */
  static async exportEChartsInstance(
    chartInstance: echarts.ECharts,
    options: ExportOptions = {}
  ): Promise<void> {
    const { filename = 'chart-export', format = 'png', backgroundColor = '#ffffff' } = options;

    if (!chartInstance || typeof chartInstance.getDataURL !== 'function') {
      throw new Error('Invalid ECharts instance provided');
    }

    try {
      // Use ECharts built-in high-quality export
      const dataURL = chartInstance.getDataURL({
        type: 'png',
        pixelRatio: 2, // High resolution
        backgroundColor,
        excludeComponents: ['toolbox'],
      });

      if (!dataURL || dataURL === 'data:,' || dataURL === 'data:image/png;base64,') {
        throw new Error('Chart export produced empty result');
      }

      if (format === 'png') {
        // Convert to blob and download
        const response = await fetch(dataURL);
        if (!response.ok) {
          throw new Error('Failed to process chart image');
        }
        const blob = await response.blob();
        saveAs(blob, `${filename}.png`);
      } else if (format === 'pdf') {
        // Create PDF with the chart image
        await this.convertToPDF(dataURL, filename);
      }
    } catch (error) {
      console.error('ECharts export failed:', error);
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Main export function - tries to find ECharts instance and export
   */
  static async exportChart(
    element: HTMLElement | null,
    chartInstance?: echarts.ECharts | null,
    options: ExportOptions = {}
  ): Promise<void> {
    // Use provided instance first
    if (chartInstance) {
      await this.exportEChartsInstance(chartInstance, options);
      return;
    }

    // Try to find ECharts instance in DOM
    if (element) {
      const instance = this.findEChartsInstance(element);
      if (instance) {
        await this.exportEChartsInstance(instance, options);
        return;
      }
    }

    throw new Error('No ECharts instance found for export');
  }

  /**
   * Find ECharts instance from DOM element
   */
  private static findEChartsInstance(element: HTMLElement): echarts.ECharts | null {
    // Check if the element itself has an ECharts instance
    const directInstance = echarts.getInstanceByDom(element);
    if (directInstance) {
      return directInstance;
    }

    // Search in child elements
    const echartsElements = element.querySelectorAll('div');
    for (const el of echartsElements) {
      const instance = echarts.getInstanceByDom(el as HTMLElement);
      if (instance) {
        return instance;
      }
    }

    return null;
  }

  /**
   * Convert data URL to PDF
   */
  private static async convertToPDF(dataURL: string, filename: string): Promise<void> {
    const img = new Image();

    return new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          canvas.width = img.width;
          canvas.height = img.height;

          if (ctx) {
            ctx.drawImage(img, 0, 0);

            const pdf = new jsPDF({
              orientation: img.width > img.height ? 'landscape' : 'portrait',
              unit: 'px',
              format: [img.width, img.height],
            });

            pdf.addImage(dataURL, 'PNG', 0, 0, img.width, img.height);
            const pdfBlob = pdf.output('blob');
            saveAs(pdfBlob, `${filename}.pdf`);
            resolve();
          } else {
            reject(new Error('Could not get canvas context'));
          }
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load chart image'));
      };

      img.src = dataURL;
    });
  }

  /**
   * Export table data as CSV
   */
  static async exportTableAsCSV(tableData: TableData, options: ExportOptions = {}): Promise<void> {
    const { filename = 'table-export' } = options;
    const { data, columns } = tableData;
    if (!data || data.length === 0 || !columns || columns.length === 0) {
      throw new Error('No table data available for export');
    }
    try {
      // Create CSV content
      const escapeCSVValue = (value: string): string => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };
      const csvHeaders = columns.map(escapeCSVValue).join(',');
      const csvRows = data.map((row) =>
        columns
          .map((column) => {
            const value = row[column];
            // Handle values with commas or quotes by wrapping in quotes
            if (value === null || value === undefined) {
              return '';
            }
            const stringValue = String(value);
            return escapeCSVValue(stringValue);
          })
          .join(',')
      );
      const csvContent = [csvHeaders, ...csvRows].join('\n');
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `${filename}.csv`);
    } catch (error) {
      throw new Error(
        `Failed to export CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Export HTML table element as image (PNG/JPEG) using html2canvas
   */
  static async exportTableAsImage(
    tableElement: HTMLElement,
    options: ExportOptions = {}
  ): Promise<void> {
    const { filename = 'table-export', format = 'png', backgroundColor = '#ffffff' } = options;

    if (!tableElement) {
      throw new Error('No table element provided for export');
    }

    try {
      // Convert HTML element to canvas using html2canvas-pro (supports oklch colors)
      const canvas = await html2canvas(tableElement, {
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
        backgroundColor: backgroundColor || '#ffffff',
      });

      // Convert canvas to blob based on format
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const quality = format === 'jpeg' ? 0.95 : undefined;

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            throw new Error('Failed to create image blob');
          }
          // Download the image
          saveAs(blob, `${filename}.${format}`);
        },
        mimeType,
        quality
      );
    } catch (error) {
      console.error('Table export failed:', error);
      throw new Error(
        `Failed to export table as image: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Generate clean filename with timestamp
 * Note: format parameter is kept for API compatibility but extension is added by caller
 */
export function generateFilename(chartTitle: string, _format: string): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  const sanitizedTitle = chartTitle
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
  return `${sanitizedTitle || 'chart'}-${timestamp}`;
}
