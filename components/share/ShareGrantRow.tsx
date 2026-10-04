'use client';

import { Mail, User as UserIcon, Users as UsersIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AccessLevel, ShareRow } from '@/types/access';
import {
  cascadeBlockMessage,
  getShareRowKey,
  isCascadeDowngrade,
} from '@/components/share/logic/share-grants';

interface ShareGrantRowProps {
  share: ShareRow;
  isCurrentUser: boolean;
  isBusy: boolean;
  isRemoveDisabled: boolean;
  canTransfer: boolean;
  onLevelChange: (share: ShareRow, level: AccessLevel) => void;
  onTransfer: (share: ShareRow) => void;
  onRemove: (share: ShareRow) => void;
}

/** One "People with access" row: who, You/role/Pending pills, View/Edit(/Transfer) select, remove. */
export function ShareGrantRow({
  share,
  isCurrentUser,
  isBusy,
  isRemoveDisabled,
  canTransfer,
  onLevelChange,
  onTransfer,
  onRemove,
}: ShareGrantRowProps) {
  const rowKey = getShareRowKey(share);

  return (
    <div className="flex items-center gap-3" data-testid={`share-grant-row-${rowKey}`}>
      <span className="inline-flex items-center justify-center h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary">
        {share.principal_type === 'group' ? (
          <UsersIcon className="h-4 w-4" />
        ) : share.status === 'pending' ? (
          <Mail className="h-4 w-4" />
        ) : (
          <UserIcon className="h-4 w-4" />
        )}
      </span>
      <span className="text-sm text-gray-900 truncate">{share.label}</span>
      {isCurrentUser && (
        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary font-medium">
          You
        </span>
      )}
      {share.role_or_group && (
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
          {share.role_or_group}
        </span>
      )}
      {share.status === 'pending' && (
        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
          Pending
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Select
                  value={share.access_level}
                  onValueChange={(v) => {
                    if (v === 'transfer') {
                      onTransfer(share);
                      return;
                    }
                    onLevelChange(share, v as AccessLevel);
                  }}
                  disabled={isBusy}
                >
                  <SelectTrigger
                    className="h-8 w-auto gap-1 border-0 bg-transparent px-2 text-sm text-gray-700 shadow-none hover:bg-gray-50 focus:ring-0 focus-visible:ring-0"
                    data-testid={`share-grant-level-${rowKey}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="view"
                      data-testid={`share-grant-level-${rowKey}-option-view`}
                      disabled={isCascadeDowngrade(share, 'view')}
                    >
                      View
                    </SelectItem>
                    <SelectItem
                      value="edit"
                      data-testid={`share-grant-level-${rowKey}-option-edit`}
                      disabled={isCascadeDowngrade(share, 'edit')}
                    >
                      Edit
                    </SelectItem>
                    {canTransfer && (
                      <>
                        <SelectSeparator />
                        <SelectItem
                          value="transfer"
                          data-testid={`share-grant-level-${rowKey}-option-transfer`}
                        >
                          Transfer ownership
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            {share.share_id === null && (
              <TooltipContent className="max-w-xs">
                {share.access_level === 'edit'
                  ? cascadeBlockMessage(share)
                  : `Access inherited from a dashboard. You can upgrade to a higher level.`}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700"
          onClick={() => onRemove(share)}
          disabled={isRemoveDisabled}
          aria-label={`Remove ${share.label}`}
          data-testid={`share-grant-remove-${rowKey}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
