'use client';

/**
 * The unknown-email notice for the Create-group dialog's typeahead, gated
 * exactly like ShareModal's InviteRoleBlock (components/ui/share-modal-staging.tsx):
 * an admin/super-admin gets an "Invite new users as [Member ▾]" role picker
 * (Member/Analyst/Admin); anyone else gets a plain locked sentence and no
 * dropdown -- they can only ever invite at Member, mirroring the backend's
 * 403 on a non-admin invite_role escalation (see
 * ddpui/core/sharing/sharing_actions.py's `_resolve_invite_role`, reused
 * as-is by the group-members email path).
 *
 * Split into its own file (rather than living in group-member-typeahead.tsx)
 * per the repo's ~300-lines-per-component guidance.
 */

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
      className="space-y-2 rounded-md border p-3 text-xs"
    >
      <p data-testid="group-member-invite-role-copy" className="font-medium">
        {stagedEmailEntries.length === 1
          ? `${stagedEmailEntries[0].label} isn't on Dalgo yet.`
          : `${stagedEmailEntries.length} people aren't on Dalgo yet.`}
      </p>
      {isAdmin ? (
        <>
          <p className="text-muted-foreground">Assign new invites role before adding to group.</p>
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
        <p className="text-muted-foreground">
          {stagedEmailEntries.length === 1
            ? 'New member will be invited as member.'
            : 'New members will be invited as members.'}
        </p>
      )}
    </div>
  );
}
