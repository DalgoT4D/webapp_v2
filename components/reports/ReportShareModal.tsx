'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toastSuccess, toastError } from '@/lib/toast';
import { copyUrlToClipboard } from '@/lib/clipboard';
import { Share2, Copy, Shield, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { updateReportSharing, getReportSharingStatus } from '@/hooks/api/useReports';
import type { ShareStatus } from '@/types/reports';

interface ReportShareModalProps {
  snapshotId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ReportShareModal({ snapshotId, isOpen, onClose }: ReportShareModalProps) {
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
      console.error('Failed to fetch share status:', error);
      toastError.load(error, 'sharing status');
    }
  }, [snapshotId]);

  // Fetch current share status when modal opens
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
          await copyUrlToClipboard(response.public_url);
        } else {
          toastSuccess.generic('Report sharing disabled');
        }
      } catch (error) {
        console.error('Failed to toggle sharing:', error);
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
      <DialogContent data-testid="report-share-modal" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Organization Access (Default) */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <div>
                    <Label className="text-sm font-medium">Organization Access</Label>
                    <p className="text-xs text-muted-foreground">
                      Users in your organization with proper permissions can access this report
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">Default</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Public Sharing Toggle */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Share2 className="h-5 w-5 text-green-600" />
                    <div className="flex-1">
                      <Label className="text-sm font-medium">Public Access</Label>
                      <p className="text-xs text-muted-foreground">
                        Anyone with the link can view this report
                      </p>
                    </div>
                  </div>
                  <Switch
                    data-testid="report-share-toggle"
                    checked={shareStatus.is_public}
                    onCheckedChange={handleToggleSharing}
                    disabled={isLoading}
                  />
                </div>

                {/* Security Warning */}
                {shareStatus.is_public && (
                  <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
                    <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-orange-800">
                      <strong>Security Notice:</strong> Your data is now exposed to the internet.
                      Anyone with this link can access your report data without authentication.
                    </div>
                  </div>
                )}

                {/* Copy URL Button */}
                {shareStatus.is_public && shareStatus.public_url && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Share this report:</Label>
                    <Button
                      data-testid="report-copy-link-btn"
                      variant="outline"
                      onClick={handleCopyUrl}
                      className="w-full"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Public Link
                    </Button>
                  </div>
                )}

                {/* Analytics */}
                {shareStatus.is_public && shareStatus.public_access_count > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <p>Public access count: {shareStatus.public_access_count}</p>
                    {shareStatus.last_public_accessed && (
                      <p>
                        Last accessed: {new Date(shareStatus.last_public_accessed).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button data-testid="report-share-close-btn" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
