'use client';

/**
 * The Create-group dialog's member picker: ONE search input mixing org
 * users, groups, and free-typed/pasted emails — the same unified typeahead
 * pattern as ShareModal's (design: 'group creation-1.jpg' — label "Add
 * people, groups, or paste emails", placeholder "Type or paste emails…").
 * Reuses ShareModal's generic parsing/dropdown-row pieces
 * (principal-search-shared.tsx); staging state lives in
 * group-member-staging.ts, the dropdown in group-member-search-dropdown.tsx,
 * the staged-row list in group-member-staged-rows.tsx, and the invite-role
 * notice in group-member-invite-role-block.tsx (all split out per the
 * repo's ~300-lines guidance). Staging a GROUP here means "add its current
 * active members" (flattened at submit time by GroupFormDialog), not a
 * group grant — group members have no per-row permission control.
 *
 * Dropdown ordering deliberately differs from ShareModal's (which buckets
 * groups-then-users): the design shows users and groups interleaved
 * alphabetically, so this list is one alphabetically-sorted merge instead.
 *
 * Unknown emails stage as an invite entry, gated the same way the share
 * modal's is: an admin/super-admin sees an "Invite new users as [role]"
 * picker (Member/Analyst/Admin); anyone else sees the locked "invited as
 * Member" sentence, no dropdown (design: the Analyst screen showing a
 * staged unknown email carries "Assign new invites role before adding to
 * group" -- the share modal's admin-picker copy, not its non-admin
 * variant). One choice applies to the whole batch of staged emails, not
 * per-row (`GroupMemberStaging.inviteRole`).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  EMAIL_REGEX,
  splitEmailTokens,
  roleTagLabel,
} from '@/components/ui/principal-search-shared';
import {
  buildEmailEntries,
  type GroupMemberStaging,
} from '@/components/settings/groups/group-member-staging';
import {
  GroupMemberSearchDropdown,
  type GroupMemberSearchRow,
} from '@/components/settings/groups/group-member-search-dropdown';
import { GroupMemberStagedRows } from '@/components/settings/groups/group-member-staged-rows';
import { InviteRoleBlock } from '@/components/settings/groups/group-member-invite-role-block';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useUserGroups } from '@/hooks/api/useUserGroups';
import { ADMIN_ROLES, useRbac } from '@/lib/rbac';

interface GroupMemberSearchProps {
  staging: GroupMemberStaging;
  disabled?: boolean;
}

export function GroupMemberSearch({ staging, disabled }: GroupMemberSearchProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const { users: orgUsers } = useUsers();
  const { data: groups } = useUserGroups(true);
  const { hasRole } = useRbac();
  const isAdmin = hasRole(ADMIN_ROLES);

  const stagedKeys = useMemo(() => new Set(staging.staged.map((e) => e.key)), [staging.staged]);
  const stagedEmails = useMemo(
    () => new Set(staging.staged.map((e) => e.email).filter(Boolean)),
    [staging.staged]
  );

  const trimmed = query.trim();
  const q = trimmed.toLowerCase();

  const userMatches = useMemo(
    () =>
      (orgUsers || []).filter(
        (u) => typeof u.orguser_id === 'number' && (!q || u.email.toLowerCase().includes(q))
      ),
    [orgUsers, q]
  );

  const groupMatches = useMemo(
    () => (groups || []).filter((g) => !q || g.name.toLowerCase().includes(q)),
    [groups, q]
  );

  // Design ordering ('group creation-1.jpg'): users and groups interleaved
  // alphabetically -- NOT ShareModal's groups-first bucketing.
  const combinedMatches: GroupMemberSearchRow[] = useMemo(() => {
    const rows: GroupMemberSearchRow[] = [
      ...userMatches.map(
        (user): GroupMemberSearchRow => ({ kind: 'user', sortKey: user.email.toLowerCase(), user })
      ),
      ...groupMatches.map(
        (group): GroupMemberSearchRow => ({
          kind: 'group',
          sortKey: group.name.toLowerCase(),
          group,
        })
      ),
    ];
    return rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [userMatches, groupMatches]);

  const emailCandidate =
    q && EMAIL_REGEX.test(q) && !(orgUsers || []).some((u) => u.email.toLowerCase() === q)
      ? q
      : null;

  const stageUser = useCallback(
    (orguserId: number, email: string, roleSlug: string | undefined) => {
      staging.stage([
        {
          key: `user-${orguserId}`,
          kind: 'user',
          label: email.toLowerCase(),
          tag: roleTagLabel(roleSlug),
          principalId: orguserId,
          email: email.toLowerCase(),
          status: 'staged',
        },
      ]);
      setQuery('');
    },
    [staging]
  );

  const stageGroup = useCallback(
    (groupId: number, name: string) => {
      staging.stage([
        {
          key: `group-${groupId}`,
          kind: 'group',
          label: name,
          tag: 'Group',
          principalId: groupId,
          status: 'staged',
        },
      ]);
      setQuery('');
    },
    [staging]
  );

  const stageEmailTokens = useCallback(
    (tokens: string[]) => {
      staging.stage(buildEmailEntries(tokens, orgUsers));
      setQuery('');
    },
    [orgUsers, staging]
  );

  const handleContainerBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      setIsFocused(false);
      if (trimmed.includes('@')) {
        stageEmailTokens(splitEmailTokens(trimmed));
      }
    },
    [trimmed, stageEmailTokens]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData('text');
      if (!text || !/[@,;\n]/.test(text)) return;
      e.preventDefault();
      stageEmailTokens(splitEmailTokens(text));
    },
    [stageEmailTokens]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === ',' && trimmed) {
        e.preventDefault();
        stageEmailTokens(splitEmailTokens(trimmed));
        return;
      }
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (!trimmed) return;
      if (trimmed.includes('@')) {
        stageEmailTokens(splitEmailTokens(trimmed));
        return;
      }
      if (combinedMatches.length === 1) {
        const only = combinedMatches[0];
        if (only.kind === 'user')
          stageUser(only.user.orguser_id as number, only.user.email, only.user.new_role_slug);
        else stageGroup(only.group.id, only.group.name);
      }
    },
    [trimmed, stageEmailTokens, combinedMatches, stageUser, stageGroup]
  );

  const stagedEmailEntries = staging.staged.filter(
    (e) => e.kind === 'email' && e.status === 'staged'
  );

  return (
    <div className="space-y-2" data-testid="group-member-staging-area">
      {/* Focus/blur on the wrapper (not the input) keeps the dropdown open
          while focus moves onto one of its options. */}
      <div className="relative" onFocus={() => setIsFocused(true)} onBlur={handleContainerBlur}>
        <Input
          id="group-member-search-input"
          data-testid="group-member-search-input"
          type="text"
          placeholder="Type or paste emails…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
        />

        {isFocused && (
          <GroupMemberSearchDropdown
            combinedMatches={combinedMatches}
            emailCandidate={emailCandidate}
            stagedKeys={stagedKeys}
            stagedEmails={stagedEmails}
            onPickUser={stageUser}
            onPickGroup={stageGroup}
            onPickEmail={(email) => stageEmailTokens([email])}
          />
        )}
      </div>

      <GroupMemberStagedRows staging={staging} disabled={disabled} />

      {stagedEmailEntries.length > 0 && (
        <InviteRoleBlock
          stagedEmailEntries={stagedEmailEntries}
          staging={staging}
          isAdmin={isAdmin}
          disabled={disabled}
        />
      )}
    </div>
  );
}
