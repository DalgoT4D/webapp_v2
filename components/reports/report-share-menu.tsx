'use client';

import { useState, useCallback } from 'react';
import { Share2, Link2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ShareViaLinkDialog } from '@/components/reports/share-via-link-dialog';
import { ShareViaEmailDialog } from '@/components/reports/share-via-email-dialog';
import { getReportSharingStatus } from '@/hooks/api/useReports';
import { toastError } from '@/lib/toast';

interface ReportShareMenuProps {
  snapshotId: number;
  reportTitle?: string;
}

export function ReportShareMenu({ snapshotId, reportTitle }: ReportShareMenuProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const checkShareAccess = useCallback(async (): Promise<boolean> => {
    try {
      await getReportSharingStatus(snapshotId);
      return true;
    } catch (error) {
      toastError.load(error, 'sharing status');
      return false;
    }
  }, [snapshotId]);

  const handleOpenLinkDialog = useCallback(async () => {
    const hasAccess = await checkShareAccess();
    if (hasAccess) {
      setLinkDialogOpen(true);
    }
  }, [checkShareAccess]);

  const handleOpenEmailDialog = useCallback(async () => {
    const hasAccess = await checkShareAccess();
    if (hasAccess) {
      setEmailDialogOpen(true);
    }
  }, [checkShareAccess]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            data-testid="report-share-btn"
            variant="outline"
            size="sm"
            aria-label="Share report"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem data-testid="share-via-link-item" onClick={handleOpenLinkDialog}>
            <Link2 className="h-4 w-4" />
            Share via link
          </DropdownMenuItem>
          <DropdownMenuItem data-testid="share-via-email-item" onClick={handleOpenEmailDialog}>
            <Mail className="h-4 w-4" />
            Embed in email
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareViaLinkDialog
        snapshotId={snapshotId}
        isOpen={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
      />
      <ShareViaEmailDialog
        snapshotId={snapshotId}
        reportTitle={reportTitle}
        isOpen={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
      />
    </>
  );
}
