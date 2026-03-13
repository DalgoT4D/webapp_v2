'use client';

import { useState, useCallback, type RefObject } from 'react';
import { toastSuccess, toastError, toastInfo } from '@/lib/toast';
import {
  PDF_CLONE_WIDTH_PX,
  PDF_CLONE_PADDING_PX,
  PDF_HEADER_MARGIN_BOTTOM_PX,
  PDF_RENDER_DELAY_MS,
  PDF_CANVAS_SCALE,
  PDF_PAGE_MARGIN_PT,
  PDF_A4_WIDTH_PT,
  PDF_JPEG_QUALITY,
} from '@/constants/reports';

interface UsePdfDownloadOptions {
  title: string;
  headerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLDivElement | null>;
}

export function usePdfDownload({ title, headerRef, canvasRef }: UsePdfDownloadOptions) {
  const [isExporting, setIsExporting] = useState(false);

  const download = useCallback(async () => {
    setIsExporting(true);
    toastInfo.generic('Generating PDF...');

    try {
      const { default: html2canvas } = await import('html2canvas-pro');
      const { default: jsPDF } = await import('jspdf');
      const { default: saveAs } = await import('file-saver');

      // Create an off-screen wrapper to render the combined content
      const wrapper = document.createElement('div');
      wrapper.style.position = 'absolute';
      wrapper.style.left = '-9999px';
      wrapper.style.top = '0';
      wrapper.style.width = `${PDF_CLONE_WIDTH_PX}px`;
      wrapper.style.backgroundColor = '#ffffff';
      wrapper.style.padding = `${PDF_CLONE_PADDING_PX}px`;

      // Clone the header
      if (headerRef.current) {
        const headerClone = headerRef.current.cloneNode(true) as HTMLElement;
        headerClone.style.marginBottom = `${PDF_HEADER_MARGIN_BOTTOM_PX}px`;
        wrapper.appendChild(headerClone);
      }

      // Clone the dashboard canvas (contains executive summary + charts, no filters)
      if (canvasRef.current) {
        const canvasClone = canvasRef.current.cloneNode(true) as HTMLElement;
        canvasClone.style.width = '100%';

        // Copy canvas pixel data — cloneNode doesn't preserve drawn content
        // on <canvas> elements (ECharts renders charts to canvas)
        const originalCanvases = canvasRef.current.querySelectorAll('canvas');
        const clonedCanvases = canvasClone.querySelectorAll('canvas');
        originalCanvases.forEach((orig, i) => {
          const clone = clonedCanvases[i];
          if (clone) {
            clone.width = orig.width;
            clone.height = orig.height;
            const ctx = clone.getContext('2d');
            if (ctx) {
              ctx.drawImage(orig, 0, 0);
            }
          }
        });

        wrapper.appendChild(canvasClone);
      }

      document.body.appendChild(wrapper);

      // Wait for cloned content to render
      await new Promise((resolve) => setTimeout(resolve, PDF_RENDER_DELAY_MS));

      const canvas = await html2canvas(wrapper, {
        scale: PDF_CANVAS_SCALE,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        windowWidth: PDF_CLONE_WIDTH_PX,
        logging: false,
        imageTimeout: 0,
        removeContainer: false,
        foreignObjectRendering: false,
      });

      document.body.removeChild(wrapper);

      // Create single-page PDF with custom dimensions to fit all content
      const contentWidth = PDF_A4_WIDTH_PT - PDF_PAGE_MARGIN_PT * 2;
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;
      const pageHeight = imgHeight + PDF_PAGE_MARGIN_PT * 2;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: [PDF_A4_WIDTH_PT, pageHeight],
        compress: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', PDF_JPEG_QUALITY);
      pdf.addImage(
        imgData,
        'JPEG',
        PDF_PAGE_MARGIN_PT,
        PDF_PAGE_MARGIN_PT,
        imgWidth,
        imgHeight,
        undefined,
        'FAST'
      );

      const sanitizedTitle = (title || 'report')
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase();
      saveAs(pdf.output('blob'), `${sanitizedTitle}.pdf`);
      toastSuccess.exported('Report', 'pdf');
    } catch (error) {
      console.error('PDF export failed:', error);
      toastError.export(error, 'pdf');
    } finally {
      setIsExporting(false);
    }
  }, [title, headerRef, canvasRef]);

  return { isExporting, download };
}
