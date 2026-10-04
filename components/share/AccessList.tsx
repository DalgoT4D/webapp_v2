'use client';

import { User as UserIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { OwnerInfo } from '@/hooks/api/useAccess';
import type { AccessLevel, ShareRow } from '@/types/access';
import {
  canOfferTransfer,
  isOwnShare,
  isShareRowBusy,
} from '@/components/share/logic/share-grants';
import { ShareGrantRow } from '@/components/share/ShareGrantRow';

interface AccessListProps {
  owner: OwnerInfo | null;
  canAdminTakeover: boolean;
  onTakeoverClick: () => void;
  shares: ShareRow[] | undefined;
  sortedShares: ShareRow[];
  currentUserEmail: string | undefined;
  rowBusyId: number | null;
  isOwnerOrAdmin: boolean;
  onLevelChange: (share: ShareRow, level: AccessLevel) => void;
  onTransfer: (share: ShareRow) => void;
  onRemove: (share: ShareRow) => void;
}

/** "People with access": the owner (admins may take over), then every share — inherited rows included. */
export function AccessList({
  owner,
  canAdminTakeover,
  onTakeoverClick,
  shares,
  sortedShares,
  currentUserEmail,
  rowBusyId,
  isOwnerOrAdmin,
  onLevelChange,
  onTransfer,
  onRemove,
}: AccessListProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-gray-900">People with access</Label>
      <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
        {owner && (
          <div className="flex items-center gap-3" data-testid="share-owner-row">
            <span className="inline-flex items-center justify-center h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary">
              <UserIcon className="h-4 w-4" />
            </span>
            <span className="text-sm text-gray-900 truncate">{owner.email}</span>
            {owner.role_name && (
              <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {owner.role_name}
              </span>
            )}
            <div className="ml-auto flex items-center gap-1">
              <span className="text-sm text-gray-500">Owner</span>
              {canAdminTakeover && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700"
                  onClick={onTakeoverClick}
                  aria-label={`Take ownership from ${owner.email}`}
                  data-testid="admin-takeover-btn"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}
        {(shares ?? []).length === 0 && !owner && (
          <div className="text-sm text-muted-foreground" data-testid="share-owner-only-text">
            Only the owner has access right now.
          </div>
        )}
        {sortedShares.map((share, idx) => (
          <ShareGrantRow
            // Kept from the original: cascade rows have no share_id, so they fall back to the index.
            key={share.share_id ?? `cascade-${idx}`}
            share={share}
            isCurrentUser={isOwnShare(share, currentUserEmail)}
            isBusy={isShareRowBusy(share, rowBusyId)}
            isRemoveDisabled={rowBusyId === share.share_id || share.share_id === null}
            canTransfer={canOfferTransfer(share, isOwnerOrAdmin)}
            onLevelChange={onLevelChange}
            onTransfer={onTransfer}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}
