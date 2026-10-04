'use client';

import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { buildDocsUrl } from '@/components/ui/docs-link';

/** "Update dashboard permissions?" — a dashboard grant change may change access to its charts and KPIs. */
export function CascadeConfirmDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-sm" data-testid="share-cascade-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Update dashboard permissions?
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Changing permissions on a dashboard may change access to its charts and KPIs.{' '}
          {buildDocsUrl('/dashboards/sharing#permission-levels') && (
            <a
              href={buildDocsUrl('/dashboards/sharing#permission-levels')!}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Know more
            </a>
          )}
        </p>
        <div className="flex justify-end gap-3 mt-2">
          <Button variant="outline" onClick={onCancel} data-testid="share-cascade-cancel-btn">
            CANCEL
          </Button>
          <Button variant="primary" onClick={onConfirm} data-testid="share-cascade-continue-btn">
            CONTINUE
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "Transfer ownership to …?" — the current owner keeps Edit. */
export function TransferOwnershipDialog({
  targetLabel,
  entityLabel,
  isTransferring,
  onCancel,
  onConfirm,
}: {
  targetLabel: string;
  entityLabel: string;
  isTransferring: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-sm" data-testid="share-transfer-dialog">
        <DialogHeader>
          <DialogTitle>Transfer ownership to {targetLabel}?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          You will lose owner status on &quot;{entityLabel}&quot;. You will retain Edit access.
        </p>
        <div className="flex justify-end gap-3 mt-2">
          <Button variant="outline" onClick={onCancel} data-testid="share-transfer-cancel-btn">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={isTransferring}
            data-testid="share-transfer-confirm-btn"
          >
            {isTransferring ? 'Transferring…' : 'Transfer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "Remove owner and take over?" — admin becomes the owner; the old owner loses direct access. */
export function AdminTakeoverDialog({
  ownerEmail,
  resourceNoun,
  isTakingOver,
  onCancel,
  onConfirm,
}: {
  ownerEmail: string;
  /** `rtype ?? entityLabelLower`, as today. */
  resourceNoun: string;
  isTakingOver: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-sm" data-testid="admin-takeover-dialog">
        <DialogHeader>
          <DialogTitle>Remove owner and take over?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          You will become the owner of this {resourceNoun}. <strong>{ownerEmail}</strong> will no
          longer have direct access.
        </p>
        <div className="flex justify-end gap-3 mt-2">
          <Button variant="outline" onClick={onCancel} data-testid="admin-takeover-cancel-btn">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={isTakingOver}
            data-testid="admin-takeover-confirm-btn"
          >
            {isTakingOver ? 'Transferring…' : 'Confirm'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
