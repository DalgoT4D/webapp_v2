'use client';

import { useCallback } from 'react';
import { ShareModal } from '@/components/ui/share-modal';
import { getReportSharingStatus, updateReportSharing } from '@/hooks/api/useReports';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS, REPORT_SHARE_SOURCES } from '@/constants/analytics';

interface ShareViaLinkDialogProps {
  snapshotId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareViaLinkDialog({ snapshotId, isOpen, onClose }: ShareViaLinkDialogProps) {
  // Copying the link is the share act itself. REPORT_MADE_PUBLIC (fired from
  // updateReportSharing) only means the link now exists — this means it was handed out.
  // Lives here because components/ui/share-modal is shared and stays analytics-free.
  const handleCopyLink = useCallback(() => {
    trackEvent(ANALYTICS_EVENTS.REPORT_SHARED, {
      report_id: snapshotId,
      source: REPORT_SHARE_SOURCES.COPY_LINK,
    });
  }, [snapshotId]);

  return (
    <ShareModal
      entityId={snapshotId}
      entityLabel="Report"
      isOpen={isOpen}
      onClose={onClose}
      onCopyLink={handleCopyLink}
      getShareStatus={getReportSharingStatus}
      updateSharing={updateReportSharing}
    />
  );
}
