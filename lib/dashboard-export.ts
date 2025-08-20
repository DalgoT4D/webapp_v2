/**
 * Dashboard export utilities for PDF and JPEG export functionality
 */
import jsPDF from 'jspdf';

export type ExportFormat = 'pdf' | 'jpeg';

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  quality?: number; // 0.1 to 1.0 for JPEG quality
  scale?: number; // Scale factor for high-resolution exports
}

/**
 * Captures the dashboard canvas as an image
 * @param element - The DOM element to capture
 * @param options - Export options
 * @returns Promise<string> - Base64 data URL of the captured image
 */
async function captureCanvas(element: HTMLElement, options: ExportOptions): Promise<string> {
  if (element.offsetWidth === 0 || element.offsetHeight === 0) {
    throw new Error('Cannot capture element with zero dimensions');
  }

  console.log('Capturing element:', element);
  console.log('Element dimensions:', element.offsetWidth, 'x', element.offsetHeight);
  console.log('Element children:', element.children.length);

  // Use dom-to-image-more which works well with ECharts
  const domtoimage = await import('dom-to-image-more');

  const dataUrl = await domtoimage.default.toPng(element, {
    width: element.offsetWidth,
    height: element.offsetHeight,
    quality: options.quality || 0.9,
    style: {
      // Remove gray borders and ensure clean background
      border: 'none',
      borderRadius: '0',
      boxShadow: 'none',
      backgroundColor: '#ffffff',
      // Remove any margin/padding that might cause spacing
      margin: '0',
      padding: '0',
      // Ensure exact dimensions and clean layout
      boxSizing: 'border-box',
      overflow: 'hidden',
      position: 'relative',
    },
    filter: (node: any) => {
      // Skip filter elements and elements that might cause borders
      if (
        node.classList?.contains('dashboard-filters') ||
        node.classList?.contains('filter-sidebar') ||
        node.classList?.contains('export-exclude')
      ) {
        return false;
      }
      return true;
    },
  });

  console.log('Generated dataUrl length:', dataUrl.length);
  return dataUrl;
}

/**
 * Downloads a file with the given data URL and filename
 */
function downloadFile(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates a default filename with timestamp
 */
function generateFilename(dashboardTitle: string, format: ExportFormat): string {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const sanitizedTitle = dashboardTitle.replace(/[^a-zA-Z0-9]/g, '_');
  return `${sanitizedTitle}_${timestamp}.${format}`;
}

/**
 * Exports dashboard canvas as JPEG
 */
async function exportAsJPEG(element: HTMLElement, options: ExportOptions): Promise<void> {
  const imageDataUrl = await captureCanvas(element, options);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();

  return new Promise((resolve, reject) => {
    img.onload = () => {
      const scale = options.scale || 2;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      // Enable image smoothing for better quality
      ctx!.imageSmoothingEnabled = true;
      ctx!.imageSmoothingQuality = 'high';

      // Fill with white background
      ctx!.fillStyle = '#ffffff';
      ctx!.fillRect(0, 0, canvas.width, canvas.height);

      // Draw the image with scaling
      ctx!.drawImage(img, 0, 0, canvas.width, canvas.height);

      const jpegDataUrl = canvas.toDataURL('image/jpeg', options.quality || 0.9);
      downloadFile(jpegDataUrl, options.filename!);
      resolve();
    };

    img.onerror = reject;
    img.src = imageDataUrl;
  });
}

/**
 * Exports dashboard canvas as PDF
 */
async function exportAsPDF(element: HTMLElement, options: ExportOptions): Promise<void> {
  const imageDataUrl = await captureCanvas(element, options);
  const img = new Image();

  return new Promise((resolve, reject) => {
    img.onload = () => {
      const scale = options.scale || 2;
      const imgWidth = img.width * scale;
      const imgHeight = img.height * scale;

      // Calculate PDF dimensions (A4 landscape or portrait based on aspect ratio)
      const aspectRatio = imgWidth / imgHeight;
      let pdfWidth: number, pdfHeight: number;

      if (aspectRatio > 1.4) {
        // Landscape orientation for wide dashboards
        pdfWidth = 297; // A4 landscape width in mm
        pdfHeight = 210; // A4 landscape height in mm
      } else {
        // Portrait orientation
        pdfWidth = 210; // A4 portrait width in mm
        pdfHeight = 297; // A4 portrait height in mm
      }

      // Calculate image dimensions to fit PDF while maintaining aspect ratio
      const pdfAspectRatio = pdfWidth / pdfHeight;
      let finalWidth: number, finalHeight: number;

      if (aspectRatio > pdfAspectRatio) {
        // Image is wider than PDF
        finalWidth = pdfWidth;
        finalHeight = pdfWidth / aspectRatio;
      } else {
        // Image is taller than PDF
        finalHeight = pdfHeight;
        finalWidth = pdfHeight * aspectRatio;
      }

      // Center the image on the page
      const xOffset = (pdfWidth - finalWidth) / 2;
      const yOffset = (pdfHeight - finalHeight) / 2;

      // Create PDF
      const pdf = new jsPDF({
        orientation: aspectRatio > 1.4 ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      pdf.addImage(imageDataUrl, 'PNG', xOffset, yOffset, finalWidth, finalHeight);

      pdf.save(options.filename!);
      resolve();
    };

    img.onerror = reject;
    img.src = imageDataUrl;
  });
}

/**
 * Main export function
 * @param element - The dashboard canvas element to export
 * @param dashboardTitle - Title of the dashboard for filename generation
 * @param options - Export options
 */
export async function exportDashboard(
  element: HTMLElement,
  dashboardTitle: string,
  options: Partial<ExportOptions> = {}
): Promise<void> {
  const exportOptions: ExportOptions = {
    format: options.format || 'pdf',
    filename: options.filename || generateFilename(dashboardTitle, options.format || 'pdf'),
    quality: options.quality || 0.9,
    scale: options.scale || 2,
  };

  try {
    if (exportOptions.format === 'pdf') {
      await exportAsPDF(element, exportOptions);
    } else {
      await exportAsJPEG(element, exportOptions);
    }
  } catch (error) {
    throw new Error(
      `Failed to export dashboard as ${exportOptions.format.toUpperCase()}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Utility to check if export is supported in the current environment
 */
export function isExportSupported(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}
