'use client';

import { useState, useEffect, useCallback } from 'react';
import { Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toastSuccess, toastError } from '@/lib/toast';
import { copyUrlToClipboard } from '@/lib/clipboard';
import { getReportSharingStatus, updateReportSharing } from '@/hooks/api/useReports';
import type { ShareStatus } from '@/types/reports';

interface ShareViaLinkDialogProps {
  snapshotId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareViaLinkDialog({ snapshotId, isOpen, onClose }: ShareViaLinkDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [shareStatus, setShareStatus] = useState<ShareStatus>({
    is_public: false,
    public_access_count: 0,
  });

  const fetchShareStatus = useCallback(async () => {
    try {
      const status = await getReportSharingStatus(snapshotId);
      setShareStatus(status);
    } catch (error) {
      toastError.load(error, 'sharing status');
    }
  }, [snapshotId]);

  useEffect(() => {
    if (isOpen && snapshotId) {
      fetchShareStatus();
    }
  }, [isOpen, snapshotId, fetchShareStatus]);

  const handleToggleSharing = useCallback(
    async (isPublic: boolean) => {
      setIsLoading(true);
      try {
        const response = await updateReportSharing(snapshotId, { is_public: isPublic });
        setShareStatus((prev) => ({
          ...prev,
          is_public: response.is_public,
          public_url: response.public_url,
        }));

        if (isPublic && response.public_url) {
          toastSuccess.generic('Report is now public');
        } else {
          toastSuccess.generic('Report sharing disabled');
        }
      } catch (error) {
        toastError.share(error);
      } finally {
        setIsLoading(false);
      }
    },
    [snapshotId]
  );

  const handleCopyUrl = useCallback(async () => {
    if (shareStatus.public_url) {
      await copyUrlToClipboard(shareStatus.public_url);
    }
  }, [shareStatus.public_url]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        data-testid="share-via-link-dialog"
        className="sm:max-w-md"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Organisational Access */}
          <div>
            <Label className="text-sm font-medium">Organisational Access</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Users in your organization with proper permissions can access this report
            </p>
          </div>

          {/* Public Access */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Public Access</Label>
              <Switch
                data-testid="share-link-toggle"
                checked={shareStatus.is_public}
                onCheckedChange={handleToggleSharing}
                disabled={isLoading}
              />
            </div>

            {/* Warning */}
            {shareStatus.is_public && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                <p className="text-xs text-orange-800">
                  This will allow anyone with the link to access your reports
                </p>
              </div>
            )}
          </div>

          {/* Copy Public Link */}
          {shareStatus.is_public && shareStatus.public_url && (
            <Button
              data-testid="copy-public-link-btn"
              variant="outline"
              onClick={handleCopyUrl}
              className="w-full"
            >
              COPY PUBLIC LINK
            </Button>
          )}

          {/* Close */}
          <Button
            data-testid="share-link-close-btn"
            variant="outline"
            onClick={onClose}
            className="w-full"
          >
            CLOSE
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
