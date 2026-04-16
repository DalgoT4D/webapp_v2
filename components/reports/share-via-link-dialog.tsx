'use client';

import { ShareModal } from '@/components/ui/share-modal';
import { getReportSharingStatus, updateReportSharing } from '@/hooks/api/useReports';

interface ShareViaLinkDialogProps {
  snapshotId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareViaLinkDialog({ snapshotId, isOpen, onClose }: ShareViaLinkDialogProps) {
  return (
    <ShareModal
      entityId={snapshotId}
      entityLabel="Report"
      isOpen={isOpen}
      onClose={onClose}
      getShareStatus={getReportSharingStatus}
      updateSharing={updateReportSharing}
    />
  );
}
