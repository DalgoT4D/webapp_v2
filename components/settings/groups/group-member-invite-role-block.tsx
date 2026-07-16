'use client';

/**
 * Unknown-email notice for the Create-group typeahead, gated like
 * ShareModal's InviteRoleBlock: admins get an invite-role picker; anyone
 * else can only invite at Member (the backend 403s an escalation).
 */

import { AlertTriangle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { INVITE_ROLE_OPTIONS } from '@/components/ui/principal-search-shared';
import type {
  GroupMemberEntry,
  GroupMemberStaging,
} from '@/components/settings/groups/group-member-staging';
import type { InviteRoleSlug } from '@/hooks/api/useResourceAccess';

interface InviteRoleBlockProps {
  stagedEmailEntries: GroupMemberEntry[];
  staging: GroupMemberStaging;
  isAdmin: boolean;
  disabled?: boolean;
}

export function InviteRoleBlock({
  stagedEmailEntries,
  staging,
  isAdmin,
  disabled,
}: InviteRoleBlockProps) {
  return (
    <div
      data-testid="group-member-invite-role-block"
      className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-xs"
    >
      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-orange-600" />
      <div className="flex-1 space-y-2 text-orange-800">
        <p data-testid="group-member-invite-role-copy" className="font-medium">
          {stagedEmailEntries.length === 1
            ? `${stagedEmailEntries[0].label} isn't on Dalgo yet.`
            : `${stagedEmailEntries.length} people aren't on Dalgo yet.`}
        </p>
        {isAdmin ? (
          <>
            <p>Assign new invites role before adding to group.</p>
            <div className="flex items-center gap-2">
              <Label htmlFor="group-member-invite-role">Invite new users as</Label>
              <Select
                value={staging.inviteRole}
                onValueChange={(value) => staging.setInviteRole(value as InviteRoleSlug)}
              >
                <SelectTrigger
                  id="group-member-invite-role"
                  data-testid="group-member-invite-role"
                  size="sm"
                  className="w-28"
                  disabled={disabled}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITE_ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <p>
            {stagedEmailEntries.length === 1
              ? 'New member will be invited as member.'
              : 'New members will be invited as members.'}
          </p>
        )}
      </div>
    </div>
  );
}
