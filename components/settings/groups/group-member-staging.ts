/**
 * Staging state for the Create-group member picker. Deliberately not
 * ShareModal's useShareStaging: group members have no per-row permission and
 * no commit step here — GroupFormDialog flattens and submits the entries.
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
  /** Role every staged unknown email invites at — one choice for the whole
   * batch. Member unless an admin picks higher. */
  inviteRole: InviteRoleSlug;
  setInviteRole: (role: InviteRoleSlug) => void;
}

/** Chip color: internal principals teal, unknown emails amber ("will be
 * invited"), malformed tokens destructive ("won't be sent at all"). */
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

/** Dup-guard identity sets: staged chips merged with (in edit mode) existing
 * members, plus the existing members alone so hints can name the right reason. */
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

/** Splits candidates into fresh-to-stage vs already-present so the typeahead
 * can show an "already added" hint instead of a silent swallow. Also tracks
 * repeats within the same batch (e.g. "dup@x.org, dup@x.org" in one paste),
 * which the pre-call snapshot alone would miss. */
export function partitionAgainstStaged(
  entries: GroupMemberEntry[],
  presentKeys: Set<string>,
  presentEmails: Set<string | undefined>
): { fresh: GroupMemberEntry[]; dupes: GroupMemberEntry[] } {
  const fresh: GroupMemberEntry[] = [];
  const dupes: GroupMemberEntry[] = [];
  const seenKeys = new Set<string>();
  const seenEmails = new Set<string>();
  for (const entry of entries) {
    const alreadyPresent =
      presentKeys.has(entry.key) || (entry.email && presentEmails.has(entry.email));
    const alreadySeenThisBatch =
      seenKeys.has(entry.key) || (entry.email ? seenEmails.has(entry.email) : false);
    if (alreadyPresent || alreadySeenThisBatch) {
      dupes.push(entry);
    } else {
      fresh.push(entry);
      seenKeys.add(entry.key);
      if (entry.email) seenEmails.add(entry.email);
    }
  }
  return { fresh, dupes };
}

/** Inline hint for a re-added principal. Distinguishes "already added"
 * (staged this session) from "already in this group" (existing member),
 * bucketing mixed batches by reason. */
export function duplicateNotice(
  dupes: { key: string; label: string; email?: string }[],
  existingKeys: Set<string>,
  existingEmails: Set<string | undefined>
): string {
  const inGroup = (d: { key: string; email?: string }) =>
    existingKeys.has(d.key) || (d.email ? existingEmails.has(d.email) : false);
  if (dupes.length === 1) {
    const d = dupes[0];
    return inGroup(d) ? `${d.label} is already in this group` : `${d.label} is already added`;
  }
  const alreadyAdded = dupes.filter((d) => !inGroup(d));
  const alreadyInGroup = dupes.filter(inGroup);
  const parts: string[] = [];
  if (alreadyAdded.length > 0) {
    parts.push(`Already added: ${alreadyAdded.map((d) => d.label).join(', ')}`);
  }
  if (alreadyInGroup.length > 0) {
    parts.push(`Already in this group: ${alreadyInGroup.map((d) => d.label).join(', ')}`);
  }
  return parts.join(' · ');
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
