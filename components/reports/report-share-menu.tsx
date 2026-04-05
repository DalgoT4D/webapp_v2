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

interface ReportShareMenuProps {
  snapshotId: number;
}

export function ReportShareMenu({ snapshotId }: ReportShareMenuProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const handleOpenLinkDialog = useCallback(() => {
    setLinkDialogOpen(true);
  }, []);

  const handleOpenEmailDialog = useCallback(() => {
    setEmailDialogOpen(true);
  }, []);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            data-testid="report-share-btn"
            variant="ghost"
            size="icon"
            aria-label="Share report"
          >
            <Share2 className="h-4 w-4" />
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
        isOpen={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
      />
    </>
  );
}
