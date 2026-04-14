'use client';

import { useState, useCallback, RefObject } from 'react';
import { toastSuccess, toastError, toastInfo } from '@/lib/toast';

interface UseClientPdfDownloadOptions {
  /** Ref to the DOM element to capture */
  containerRef: RefObject<HTMLElement | null>;
  /** Title used for the downloaded filename */
  title: string;
}

/**
 * Client-side PDF download using html2canvas-pro + jsPDF.
 * Captures a DOM element as an image, then generates a paginated A4 PDF.
 * No server round-trip — runs entirely in the browser.
 */
export function useClientPdfDownload({ containerRef, title }: UseClientPdfDownloadOptions) {
  const [isExporting, setIsExporting] = useState(false);

  const download = useCallback(async () => {
    const element = containerRef.current;
    if (!element) {
      toastError.export('No content to export', 'pdf');
      return;
    }

    setIsExporting(true);
    toastInfo.generic('Generating PDF...');

    try {
      // Dynamic imports to avoid loading these heavy libraries upfront
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ]);

      // Temporarily expand all overflow-hidden ancestors so html2canvas
      // can see the full scrollable content, not just the viewport slice.
      const overflowOverrides: { el: HTMLElement; prev: string }[] = [];
      const heightOverrides: { el: HTMLElement; prevH: string; prevMH: string }[] = [];

      // Walk up from the element and also through its children to find
      // any container that clips content via overflow.
      const allElements = [element, ...Array.from(element.querySelectorAll<HTMLElement>('*'))];
      for (const el of allElements) {
        const style = window.getComputedStyle(el);
        if (
          style.overflow === 'hidden' ||
          style.overflowY === 'hidden' ||
          style.overflowX === 'hidden'
        ) {
          overflowOverrides.push({ el, prev: el.style.overflow });
          el.style.overflow = 'visible';
        }
        // Also expand any fixed-height containers (h-full, h-screen, etc.)
        if (el.scrollHeight > el.clientHeight + 2) {
          heightOverrides.push({ el, prevH: el.style.height, prevMH: el.style.maxHeight });
          el.style.height = 'auto';
          el.style.maxHeight = 'none';
        }
      }

      // Give the browser a frame to reflow with the expanded layout
      await new Promise((r) => requestAnimationFrame(r));

      // Capture the DOM element as a high-res canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: element.scrollWidth,
        height: element.scrollHeight,
      });

      // Restore original overflow and height styles
      for (const { el, prev } of overflowOverrides) {
        el.style.overflow = prev;
      }
      for (const { el, prevH, prevMH } of heightOverrides) {
        el.style.height = prevH;
        el.style.maxHeight = prevMH;
      }

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // A4 dimensions in points (72 dpi)
      const a4Width = 595.28;
      const a4Height = 841.89;
      const margin = 20;

      const contentWidth = a4Width - margin * 2;
      // Scale image to fit A4 width
      const scaledHeight = (imgHeight * contentWidth) / imgWidth;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      // If content fits on one page
      if (scaledHeight <= a4Height - margin * 2) {
        pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, scaledHeight);
      } else {
        // Paginate: slice the canvas into page-sized chunks
        const pageContentHeight = a4Height - margin * 2;
        // How many pixels of the original image fit per page
        const srcPixelsPerPage = (pageContentHeight / scaledHeight) * imgHeight;
        const totalPages = Math.ceil(imgHeight / srcPixelsPerPage);

        for (let page = 0; page < totalPages; page++) {
          if (page > 0) pdf.addPage();

          // Create a temporary canvas for this page slice
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = imgWidth;
          const sliceHeight = Math.min(srcPixelsPerPage, imgHeight - page * srcPixelsPerPage);
          pageCanvas.height = sliceHeight;

          const ctx = pageCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(
              canvas,
              0,
              page * srcPixelsPerPage, // source Y
              imgWidth,
              sliceHeight, // source dimensions
              0,
              0, // dest position
              imgWidth,
              sliceHeight // dest dimensions
            );
          }

          const pageImgData = pageCanvas.toDataURL('image/png');
          const pageScaledHeight = (sliceHeight * contentWidth) / imgWidth;
          pdf.addImage(pageImgData, 'PNG', margin, margin, contentWidth, pageScaledHeight);
        }
      }

      const sanitizedTitle = (title || 'report').replace(/[^a-zA-Z0-9 \-_]/g, '').trim();
      pdf.save(`${sanitizedTitle || 'report'}.pdf`);

      toastSuccess.exported('Report', 'pdf');
    } catch (error) {
      console.error('Client-side PDF export failed:', error);
      toastError.export(error, 'pdf');
    } finally {
      setIsExporting(false);
    }
  }, [containerRef, title]);

  return { isExporting, download };
}
