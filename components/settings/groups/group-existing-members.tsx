'use client';

/**
 * "Existing Members" section of the unified group edit modal (design:
 * 'edit group.jpg') -- person icon · email · role tag · remove, scrollable
 * when long. A pending member keeps the "(invite pending)" treatment with
 * the Mail icon, same as the old detail-drawer copy.
 *
 * Removal is STAGED, not immediate: clicking remove hides the row and adds
 * the member id to `pendingRemoveIds`; GroupFormDialog only calls
 * removeGroupMember for real when Save is clicked (batched alongside the
 * name change and new-member adds), so Cancel discards a removal exactly
 * like it discards an unsent chip. This deliberately differs from
 * GroupDetailDrawer's immediate remove-on-click — see this dialog's Save
 * handler and the task report for why a single batched action reads truer
 * to a Cancel/Save modal than an immediate per-row mutation would.
 *
 * Split out of GroupFormDialog.tsx per the repo's ~300-lines guidance.
 */

import { Mail, User, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import type { GroupMember } from '@/hooks/api/useUserGroups';
import { formatRoleLabel } from '@/lib/access-labels';

interface GroupExistingMembersProps {
  members: GroupMember[];
  pendingRemoveIds: Set<number>;
  onToggleRemove: (memberId: number) => void;
  disabled?: boolean;
}

export function GroupExistingMembers({
  members,
  pendingRemoveIds,
  onToggleRemove,
  disabled,
}: GroupExistingMembersProps) {
  const visible = members.filter((m) => !pendingRemoveIds.has(m.id));

  return (
    <div className="space-y-2">
      <Label>Existing Members</Label>
      <div
        data-testid="group-existing-members"
        className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2"
      >
        {visible.length === 0 && (
          <p className="px-2 py-1 text-xs text-muted-foreground">No members yet.</p>
        )}
        {visible.map((member) => {
          // Design ('edit group.jpg'): the row shows the EMAIL, not the
          // display name — matches every other principal row in this
          // dialog (chips, dropdown) which are keyed by email too.
          const displayName = member.email || member.pending_email || member.name || '';
          return (
            <div
              key={member.id}
              data-testid={`group-existing-member-${member.id}`}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
                {member.status === 'pending' ? (
                  <Mail className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <User className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{displayName}</span>
                {member.status === 'pending' ? (
                  <span className="flex-shrink-0 text-xs text-muted-foreground">
                    (invite pending)
                  </span>
                ) : (
                  member.role && (
                    <Badge
                      variant="outline"
                      data-testid={`group-existing-member-role-${member.id}`}
                      className="flex-shrink-0"
                    >
                      {formatRoleLabel(member.role)}
                    </Badge>
                  )
                )}
              </span>
              <button
                type="button"
                data-testid={`group-existing-member-remove-${member.id}`}
                aria-label={`Remove ${displayName}`}
                onClick={() => onToggleRemove(member.id)}
                disabled={disabled}
                className="flex-shrink-0 p-1 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
