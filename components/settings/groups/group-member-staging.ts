/**
 * Staging state for the Create-group dialog's member picker: a plain list
 * of picked-but-not-yet-added entries (users / groups / free-typed emails).
 * Split out of group-member-typeahead.tsx (the search UI) so neither file
 * balloons past the repo's ~300-lines-per-component guidance.
 *
 * Deliberately NOT ShareModal's `useShareStaging`: a group member has no
 * per-row permission, and there is no commit-to-backend step here — the
 * dialog itself flattens staged GROUP entries to their active members and
 * calls addGroupMember (see GroupFormDialog.resolveMembers).
 */

import { useCallback, useState } from 'react';
import {
  dedupeStage,
  roleTagLabel,
  EMAIL_REGEX,
  type PrincipalEntryKind,
} from '@/components/ui/principal-search-shared';
import type { InviteRoleSlug } from '@/hooks/api/useResourceAccess';
import type { OrgUser } from '@/stores/authStore';

export type GroupMemberEntryStatus = 'staged' | 'invalid';

export interface GroupMemberEntry {
  /** Stable identity: `user-{orguserId}` / `group-{groupId}` / `email-{email}`. */
  key: string;
  kind: PrincipalEntryKind;
  /** What the row shows: the person's email, the group's name, or the typed email. */
  label: string;
  /** Role label / "Group" / "New". */
  tag: string;
  principalId?: number;
  /** Lowercased. Set for user/email kinds. */
  email?: string;
  status: GroupMemberEntryStatus;
}

export interface GroupMemberStaging {
  staged: GroupMemberEntry[];
  stage: (entries: GroupMemberEntry[]) => void;
  remove: (key: string) => void;
  reset: () => void;
  /** Role every currently-staged unknown email invites at -- one choice
   * applies to the whole batch, mirroring ShareModal's single invite-role
   * picker. Member unless an admin picks higher (see
   * group-member-typeahead.tsx's InviteRoleBlock). */
  inviteRole: InviteRoleSlug;
  setInviteRole: (role: InviteRoleSlug) => void;
}

export function useGroupMemberStaging(): GroupMemberStaging {
  const [staged, setStaged] = useState<GroupMemberEntry[]>([]);
  const [inviteRole, setInviteRole] = useState<InviteRoleSlug>('member');

  const stage = useCallback((entries: GroupMemberEntry[]) => {
    setStaged((prev) => dedupeStage(prev, entries));
  }, []);

  const remove = useCallback((key: string) => {
    setStaged((prev) => prev.filter((entry) => entry.key !== key));
  }, []);

  const reset = useCallback(() => {
    setStaged([]);
    setInviteRole('member');
  }, []);

  return { staged, stage, remove, reset, inviteRole, setInviteRole };
}

/** Free-typed/pasted tokens → entries: an email matching an org member
 * becomes that member; anything else becomes an invite-candidate email
 * entry (invalid tokens stay visible inline, never sent). */
export function buildEmailEntries(
  tokens: string[],
  orgUsers: OrgUser[] | undefined
): GroupMemberEntry[] {
  const usersByEmail = new Map(
    (orgUsers || [])
      .filter((u) => typeof u.orguser_id === 'number')
      .map((u) => [u.email.toLowerCase(), u])
  );
  const entries: GroupMemberEntry[] = [];
  for (const raw of tokens) {
    const email = raw.toLowerCase();
    if (!email) continue;
    const member = usersByEmail.get(email);
    if (member) {
      entries.push({
        key: `user-${member.orguser_id}`,
        kind: 'user',
        label: email,
        tag: roleTagLabel(member.new_role_slug),
        principalId: member.orguser_id as number,
        email,
        status: 'staged',
      });
    } else {
      entries.push({
        key: `email-${email}`,
        kind: 'email',
        label: email,
        tag: 'New',
        email,
        status: EMAIL_REGEX.test(email) ? 'staged' : 'invalid',
      });
    }
  }
  return entries;
}
