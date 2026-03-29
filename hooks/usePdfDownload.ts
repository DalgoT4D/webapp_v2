'use client';

import { useState, useCallback } from 'react';
import { toastSuccess, toastError, toastInfo } from '@/lib/toast';
import { apiPostBinary } from '@/lib/api';

interface UsePdfDownloadOptions {
  /** API endpoint that returns PDF binary (e.g. `/api/reports/123/export/pdf/`) */
  endpoint: string;
  /** Title used for the downloaded filename */
  title: string;
  /** Label shown in toast messages (e.g. "Report", "Dashboard") */
  label?: string;
}

/**
 * Hook for downloading server-generated PDFs.
 * Calls a backend endpoint that returns a PDF blob, then triggers a browser download.
 * Reusable for reports, dashboards, or any entity with a PDF export endpoint.
 */
export function usePdfDownload({ endpoint, title, label = 'Report' }: UsePdfDownloadOptions) {
  const [isExporting, setIsExporting] = useState(false);

  const download = useCallback(async () => {
    setIsExporting(true);
    toastInfo.generic(`Generating ${label} PDF...`);

    try {
      const blob = await apiPostBinary(endpoint, {});

      const sanitizedTitle = (title || label.toLowerCase()).replace(/[^a-zA-Z0-9 \-_]/g, '').trim();

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sanitizedTitle || label.toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toastSuccess.exported(label, 'pdf');
    } catch (error) {
      console.error('PDF export failed:', error);
      toastError.export(error, 'pdf');
    } finally {
      setIsExporting(false);
    }
  }, [endpoint, title, label]);

  return { isExporting, download };
}
