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

import { useCallback, useMemo, useState } from 'react';
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

/** Chip color per the design (Analyst-group new user added.jpg): internal
 * principals (existing org users AND groups) render teal; an
 * outside/unknown email renders amber; a malformed pasted token renders as
 * an explicit invalid/destructive chip (never amber -- amber means "will be
 * invited", invalid means "won't be sent at all"). */
export type GroupMemberChipVariant = 'internal' | 'external' | 'invalid';

export function chipVariant(entry: GroupMemberEntry): GroupMemberChipVariant {
  if (entry.kind === 'email') {
    return entry.status === 'invalid' ? 'invalid' : 'external';
  }
  return 'internal';
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

/** The dup guard's identity sets: keys/emails of everything already picked
 * this session (staged chips) merged with — in edit mode — the group's
 * existing members, plus the existing members alone (so hints can say
 * "already in this group" rather than "already added" when that's the
 * reason). One memoized place instead of four inline memos in the
 * typeahead component. */
export function useStagedIdentitySets(
  staged: GroupMemberEntry[],
  existingMemberRefs?: { key: string; email?: string }[]
) {
  return useMemo(() => {
    const existingKeys = new Set((existingMemberRefs ?? []).map((e) => e.key));
    const existingEmails = new Set((existingMemberRefs ?? []).map((e) => e.email).filter(Boolean));
    return {
      stagedKeys: new Set([...staged.map((e) => e.key), ...existingKeys]),
      stagedEmails: new Set([...staged.map((e) => e.email).filter(Boolean), ...existingEmails]),
      existingKeys,
      existingEmails,
    };
  }, [staged, existingMemberRefs]);
}

/** Splits candidate entries into fresh-to-stage vs already-present (an
 * existing chip, or — in edit mode — an existing group member). `dedupeStage`
 * alone would swallow the repeat silently; the typeahead uses the `dupes`
 * bucket to show an inline "already added" hint instead (manual-testing
 * report: repeat Enter looked like a no-op bug). */
export function partitionAgainstStaged(
  entries: GroupMemberEntry[],
  presentKeys: Set<string>,
  presentEmails: Set<string | undefined>
): { fresh: GroupMemberEntry[]; dupes: GroupMemberEntry[] } {
  const fresh: GroupMemberEntry[] = [];
  const dupes: GroupMemberEntry[] = [];
  for (const entry of entries) {
    if (presentKeys.has(entry.key) || (entry.email && presentEmails.has(entry.email))) {
      dupes.push(entry);
    } else {
      fresh.push(entry);
    }
  }
  return { fresh, dupes };
}

/** The inline hint for a re-added principal. Distinguishes "already added"
 * (staged chip in this session) from "already in this group" (edit mode's
 * existing members) so the message matches what the user can actually see. */
export function duplicateNotice(
  dupes: { key: string; label: string; email?: string }[],
  existingKeys: Set<string>,
  existingEmails: Set<string | undefined>
): string {
  if (dupes.length === 1) {
    const d = dupes[0];
    const inGroup = existingKeys.has(d.key) || (d.email ? existingEmails.has(d.email) : false);
    return inGroup ? `${d.label} is already in this group` : `${d.label} is already added`;
  }
  return `Already added: ${dupes.map((d) => d.label).join(', ')}`;
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
