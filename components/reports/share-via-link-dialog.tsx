'use client';

import { ShareModal } from '@/components/ui/share-modal';
import { getReportSharingStatus, updateReportSharing } from '@/hooks/api/useReports';

interface ShareViaLinkDialogProps {
  snapshotId: number;
  reportTitle?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareViaLinkDialog({
  snapshotId,
  reportTitle,
  isOpen,
  onClose,
}: ShareViaLinkDialogProps) {
  return (
    <ShareModal
      rtype="report"
      entityId={snapshotId}
      entityLabel={reportTitle || 'Report'}
      isOpen={isOpen}
      onClose={onClose}
      getShareStatus={getReportSharingStatus}
      updateSharing={updateReportSharing}
    />
  );
}
