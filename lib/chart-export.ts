import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import * as echarts from 'echarts';
import html2canvas from 'html2canvas-pro';
import { apiGetBinary } from '@/lib/api';

export interface ExportOptions {
  filename?: string;
  format?: 'png' | 'pdf' | 'csv' | 'jpeg';
  backgroundColor?: string;
}

export interface TableData {
  data: Record<string, any>[];
  columns: string[];
}

export interface BrandingOptions {
  orgLogoUrl?: string | null;
  chartTitle?: string | null;
}

// Dimensions at 2× scale — matches pixelRatio:2 used in ECharts getDataURL
const BRAND_SCALE = 2;
const HEADER_H = 56 * BRAND_SCALE;
const PAD_X = 16 * BRAND_SCALE;
const LOGO_MAX_H = 32 * BRAND_SCALE; // same as powered-by height
const POWERED_MAX_W = 120 * BRAND_SCALE;
const POWERED_MAX_H = 32 * BRAND_SCALE; // keep in sync with LOGO_MAX_H

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

  // ctx.font must be set before calling — measureText depends on the current font
  private static truncateText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string {
    if (ctx.measureText(text).width <= maxWidth) return text;
    const ellipsis = '…';
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + ellipsis).width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + ellipsis;
  }

  private static loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }

  // Proxy through backend so the browser receives a same-origin blob — avoids S3/external CORS on canvas
  private static async fetchLogoAsObjectUrl(): Promise<string | null> {
    try {
      const blob = await apiGetBinary('/api/org/logo/');
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }

  private static async compositeWithBranding(
    chartDataUrl: string,
    { orgLogoUrl, chartTitle }: BrandingOptions
  ): Promise<string> {
    const chartImg = await this.loadImage(chartDataUrl);
    const canvasW = chartImg.naturalWidth;
    const canvasH = chartImg.naturalHeight + HEADER_H;

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, HEADER_H - 1, canvasW, 1);

    // Draw logo top-left
    let logoDrawnW = 0;
    if (orgLogoUrl) {
      const blobUrl = await this.fetchLogoAsObjectUrl();
      if (blobUrl) {
        try {
          const logo = await this.loadImage(blobUrl);
          const logoH = logo.naturalHeight || LOGO_MAX_H;
          const scale = Math.min(1, LOGO_MAX_H / logoH);
          const lw = (logo.naturalWidth || LOGO_MAX_H) * scale;
          const lh = logoH * scale;
          ctx.drawImage(logo, PAD_X, (HEADER_H - lh) / 2, lw, lh);
          logoDrawnW = lw;
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      }
    }

    // Draw powered-by top-right
    let poweredDrawnW = 0;
    try {
      const poweredBy = await this.loadImage(
        `${typeof window !== 'undefined' ? window.location.origin : ''}/powered-by-dalgo.png`
      );
      const scale = Math.min(
        1,
        POWERED_MAX_H / poweredBy.naturalHeight,
        POWERED_MAX_W / poweredBy.naturalWidth
      );
      const pw = poweredBy.naturalWidth * scale;
      const ph = poweredBy.naturalHeight * scale;
      ctx.drawImage(poweredBy, canvasW - PAD_X - pw, (HEADER_H - ph) / 2, pw, ph);
      poweredDrawnW = pw;
    } catch {
      // Powered-by image failed — skip silently
    }

    // Title centered between logo zone and powered-by zone
    if (chartTitle) {
      const logoZoneEnd = PAD_X + logoDrawnW + PAD_X;
      const poweredZoneStart =
        poweredDrawnW > 0 ? canvasW - PAD_X - poweredDrawnW - PAD_X : canvasW - PAD_X;
      const titleAvailW = poweredZoneStart - logoZoneEnd;
      const titleCenterX = logoZoneEnd + titleAvailW / 2;
      ctx.fillStyle = '#1f2937';
      ctx.font = `bold ${14 * BRAND_SCALE}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.truncateText(ctx, chartTitle, titleAvailW), titleCenterX, HEADER_H / 2);
    }

    ctx.drawImage(chartImg, 0, HEADER_H);

    return canvas.toDataURL('image/png');
  }

  /**
   * Export an ECharts instance as PNG with org branding (logo, title, powered-by).
   */
  static async exportEChartsWithBranding(
    chartInstance: echarts.ECharts,
    options: ExportOptions & BrandingOptions
  ): Promise<void> {
    const { filename = 'chart', orgLogoUrl, chartTitle } = options;

    const chartDataUrl = chartInstance.getDataURL({
      type: 'png',
      pixelRatio: BRAND_SCALE,
      backgroundColor: '#ffffff',
      excludeComponents: ['toolbox'],
    });

    const brandedDataUrl = await this.compositeWithBranding(chartDataUrl, {
      orgLogoUrl,
      chartTitle,
    });

    const response = await fetch(brandedDataUrl);
    const blob = await response.blob();
    saveAs(blob, `${filename}.png`);
  }

  /**
   * Export an HTML table element as PNG with org branding (logo, title, powered-by).
   * Builds a temporary off-screen wrapper, runs html2canvas, then removes it.
   */
  static async exportTableWithBranding(
    tableElement: HTMLElement,
    options: ExportOptions & BrandingOptions
  ): Promise<void> {
    const { filename = 'table', orgLogoUrl, chartTitle } = options;

    // Off-screen container
    const wrapper = document.createElement('div');
    wrapper.style.cssText =
      'position:fixed;top:-9999px;left:-9999px;background:#ffffff;display:inline-block;';

    // Header
    const header = document.createElement('div');
    header.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:1px solid #e5e7eb;background:#ffffff;min-height:56px;';

    // Logo loaded via backend proxy — avoids CORS issues with S3/external URLs
    const logoBlobUrl = orgLogoUrl ? await this.fetchLogoAsObjectUrl() : null;
    if (logoBlobUrl) {
      const logo = document.createElement('img');
      logo.src = logoBlobUrl;
      logo.style.cssText = 'max-height:40px;width:auto;object-fit:contain;flex-shrink:0;';
      header.appendChild(logo);
    } else {
      header.appendChild(document.createElement('div'));
    }

    if (chartTitle) {
      const title = document.createElement('span');
      title.textContent = chartTitle;
      title.style.cssText =
        'font-size:14px;font-weight:600;color:#1f2937;text-align:center;flex:1;padding:0 12px;';
      header.appendChild(title);
    }

    // Right: powered-by top-right in header
    const poweredByImg = document.createElement('img');
    poweredByImg.src = `${typeof window !== 'undefined' ? window.location.origin : ''}/powered-by-dalgo.png`;
    poweredByImg.style.cssText = 'max-height:32px;width:auto;object-fit:contain;flex-shrink:0;';
    header.appendChild(poweredByImg);

    wrapper.appendChild(header);
    wrapper.appendChild(tableElement.cloneNode(true) as HTMLElement);
    document.body.appendChild(wrapper);

    try {
      const canvas = await html2canvas(wrapper, {
        scale: BRAND_SCALE,
        logging: false,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error('Failed to create blob'))),
          'image/png'
        );
      });

      saveAs(blob, `${filename}.png`);
    } finally {
      document.body.removeChild(wrapper);
      if (logoBlobUrl) URL.revokeObjectURL(logoBlobUrl);
    }
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

    // Validate format
    if (format !== 'png' && format !== 'jpeg') {
      throw new Error(`Unsupported image format: ${format}. Only 'png' and 'jpeg' are supported.`);
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

      // Wrap canvas.toBlob in a Promise to properly handle errors
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (!result) {
              reject(new Error('Failed to create image blob'));
            } else {
              resolve(result);
            }
          },
          mimeType,
          quality
        );
      });

      // Download the image only after blob is successfully created
      saveAs(blob, `${filename}.${format}`);
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
