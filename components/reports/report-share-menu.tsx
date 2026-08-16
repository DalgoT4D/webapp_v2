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
import { ShareModal } from '@/components/ui/share-modal';
import { ShareViaEmailDialog } from '@/components/reports/share-via-email-dialog';
import { useOpenShareDeepLink } from '@/hooks/useOpenShareDeepLink';

interface ReportShareMenuProps {
  snapshotId: number;
  reportTitle?: string;
}

export function ReportShareMenu({ snapshotId, reportTitle }: ReportShareMenuProps) {
  const { initialOpen: shouldAutoOpenShare, clearParam: clearShareDeepLink } =
    useOpenShareDeepLink();
  const [linkDialogOpen, setLinkDialogOpen] = useState(shouldAutoOpenShare);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const handleOpenLinkDialog = useCallback(() => setLinkDialogOpen(true), []);
  const handleOpenEmailDialog = useCallback(() => setEmailDialogOpen(true), []);

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

      <ShareModal
        rtype="report"
        entityId={snapshotId}
        entityLabel={reportTitle || 'Report'}
        isOpen={linkDialogOpen}
        onClose={() => {
          setLinkDialogOpen(false);
          clearShareDeepLink();
        }}
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
