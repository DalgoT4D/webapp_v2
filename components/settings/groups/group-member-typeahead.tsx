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
 *
 * Staged entries render as CHIPS INSIDE the input container itself (design:
 * 'Analyst-group new user added.jpg') -- the bordered box grows and wraps
 * to multiple lines as chips are added; the text caret always sits after
 * the last chip. Backspace on an empty query removes the most recently
 * staged chip, the standard chip-input convention.
 */

import React, { useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  EMAIL_REGEX,
  splitEmailTokens,
  roleTagLabel,
} from '@/components/ui/principal-search-shared';
import {
  buildEmailEntries,
  duplicateNotice,
  partitionAgainstStaged,
  useStagedIdentitySets,
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

/** A principal already on the group (edit mode only) -- fed into the
 * dropdown's dup guard so an existing member shows "Added" instead of
 * being offered again (re-adding would just 400/no-op on the backend). */
export interface ExistingMemberRef {
  key: string;
  email?: string;
}

/** Escape layering (GroupFormDialog wires this into DialogContent's
 * onEscapeKeyDown): Radix listens for Escape on the document in the CAPTURE
 * phase, so an input-level keydown handler can never intercept it — the
 * dialog must ask the typeahead first. Returns true when the dropdown was
 * open and consumed the Escape (caller must then preventDefault so the
 * dialog survives); false lets the dialog close as usual. */
export interface GroupMemberSearchHandle {
  closeDropdownIfOpen: () => boolean;
}

interface GroupMemberSearchProps {
  staging: GroupMemberStaging;
  disabled?: boolean;
  existingMemberRefs?: ExistingMemberRef[];
  /** Edit mode only: the group being edited can't be added to itself. */
  excludeGroupId?: number;
  ref?: React.Ref<GroupMemberSearchHandle>;
}

export function GroupMemberSearch({
  staging,
  disabled,
  existingMemberRefs,
  excludeGroupId,
  ref,
}: GroupMemberSearchProps) {
  const [query, setQuery] = useState('');
  // Dropdown visibility. Opened by focus/click/typing in the chip input,
  // closed by outside blur, Escape (via closeDropdownIfOpen), or staging an
  // email (the intent is complete, and the open browse list would otherwise
  // sit over the invite-role block and the dialog's footer buttons).
  const [isFocused, setIsFocused] = useState(false);
  // Inline "already added" hint — replaces the silent dedupe swallow when a
  // typed/pasted email (or repeat Enter) targets an already-staged principal.
  const [dupNotice, setDupNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { users: orgUsers } = useUsers();
  const { data: groups } = useUserGroups(true);
  const { hasRole } = useRbac();
  const isAdmin = hasRole(ADMIN_ROLES);

  const { stagedKeys, stagedEmails, existingKeys, existingEmails } = useStagedIdentitySets(
    staging.staged,
    existingMemberRefs
  );

  useImperativeHandle(
    ref,
    () => ({
      closeDropdownIfOpen: () => {
        if (!isFocused) return false;
        setIsFocused(false);
        return true;
      },
    }),
    [isFocused]
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
    () =>
      (groups || []).filter(
        (g) => g.id !== excludeGroupId && (!q || g.name.toLowerCase().includes(q))
      ),
    [groups, q, excludeGroupId]
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
      setDupNotice(null);
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
      setDupNotice(null);
    },
    [staging]
  );

  const stageEmailTokens = useCallback(
    (tokens: string[]) => {
      const { fresh, dupes } = partitionAgainstStaged(
        buildEmailEntries(tokens, orgUsers),
        stagedKeys,
        stagedEmails
      );
      if (fresh.length > 0) staging.stage(fresh);
      // A repeat of an already-staged chip (or an existing member, in edit
      // mode) gets an inline hint — never a silent swallow, never a dup chip.
      setDupNotice(dupes.length > 0 ? duplicateNotice(dupes, existingKeys, existingEmails) : null);
      setQuery('');
      // The address is dealt with — collapse the browse dropdown so it stops
      // covering the invite-role block and the dialog's Cancel/Create buttons
      // (typing or clicking the input reopens it).
      setIsFocused(false);
    },
    [orgUsers, staging, stagedKeys, stagedEmails, existingKeys, existingEmails]
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
      // Standard chip-input convention: Backspace on an empty query pops
      // the most recently staged chip instead of doing nothing.
      if (e.key === 'Backspace' && !trimmed && staging.staged.length > 0) {
        staging.remove(staging.staged[staging.staged.length - 1].key);
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
        const key =
          only.kind === 'user' ? `user-${only.user.orguser_id}` : `group-${only.group.id}`;
        const label = only.kind === 'user' ? only.user.email.toLowerCase() : only.group.name;
        const email = only.kind === 'user' ? label : undefined;
        // The single match may already be staged (its dropdown row is
        // disabled, but Enter bypasses the row) — hint instead of silence.
        if (stagedKeys.has(key) || (email && stagedEmails.has(email))) {
          setDupNotice(duplicateNotice([{ key, label, email }], existingKeys, existingEmails));
          return;
        }
        if (only.kind === 'user')
          stageUser(only.user.orguser_id as number, only.user.email, only.user.new_role_slug);
        else stageGroup(only.group.id, only.group.name);
      }
    },
    [
      trimmed,
      stageEmailTokens,
      combinedMatches,
      stageUser,
      stageGroup,
      staging,
      stagedKeys,
      stagedEmails,
      existingKeys,
      existingEmails,
    ]
  );

  const stagedEmailEntries = staging.staged.filter(
    (e) => e.kind === 'email' && e.status === 'staged'
  );

  return (
    <div className="space-y-2" data-testid="group-member-staging-area">
      {/* Focus/blur on the wrapper (not the input) keeps the dropdown open
          while focus moves onto one of its options. */}
      <div className="relative" onFocus={() => setIsFocused(true)} onBlur={handleContainerBlur}>
        {/* The bordered "input" is this div -- chips and the real <input>
            are its flex-wrap children (design: 'Analyst-group new user
            added.jpg'), so the box grows and wraps as chips are added. */}
        <div
          data-testid="group-member-chip-input"
          onClick={() => {
            inputRef.current?.focus();
            // Focus alone doesn't refire onFocus when the input already has
            // it — an explicit click must still reopen an Escape-closed (or
            // post-staging-collapsed) dropdown.
            setIsFocused(true);
          }}
          className={cn(
            'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-3 py-1.5 shadow-xs transition-[color,box-shadow]',
            'has-[input:focus]:border-ring has-[input:focus]:ring-[3px] has-[input:focus]:ring-ring/50',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <GroupMemberStagedRows staging={staging} disabled={disabled} />
          <Input
            ref={inputRef}
            id="group-member-search-input"
            data-testid="group-member-search-input"
            type="text"
            placeholder={staging.staged.length === 0 ? 'Type or paste emails…' : ''}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setDupNotice(null); // stale hint must not outlive new typing
              setIsFocused(true); // typing reopens a closed dropdown
            }}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            autoComplete="off"
            className="h-6 min-w-[120px] flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
        </div>

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

      {dupNotice && (
        <p data-testid="group-member-dup-hint" className="text-xs text-muted-foreground">
          {dupNotice}
        </p>
      )}

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
