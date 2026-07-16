'use client';

/**
 * Create-group member picker: one search input mixing org users, groups,
 * and typed/pasted emails, staged as chips inside the input container.
 * Staging a GROUP means "add its current active members" (flattened at
 * submit by GroupFormDialog), not a group grant. Unknown emails stage as
 * invites; one invite-role choice applies to the whole batch.
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

/** A principal already on the group (edit mode only) — fed into the dup
 * guard so an existing member shows "Added" instead of being offered again. */
export interface ExistingMemberRef {
  key: string;
  email?: string;
}

/** Radix fires Escape in the capture phase before any input-level handler,
 * so GroupFormDialog must ask the typeahead first. Returns true if it
 * consumed the Escape (caller preventDefaults to keep the dialog open). */
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
  // Dropdown visibility: opened by focus/click/typing, closed by outside
  // blur, Escape, or staging an email (the open list would otherwise cover
  // the invite-role block and footer buttons).
  const [isFocused, setIsFocused] = useState(false);
  // Inline "already added" hint — a repeat pick must never be silently swallowed.
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

  // Users and groups interleaved alphabetically — deliberately not
  // ShareModal's groups-first bucketing.
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
      // Collapse the dropdown so it stops covering the invite-role block and
      // footer buttons (typing or clicking reopens it).
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
        {/* The bordered "input" is this div — chips and the real <input> are
            its flex-wrap children, so the box grows as chips are added. */}
        <div
          data-testid="group-member-chip-input"
          onClick={() => {
            inputRef.current?.focus();
            // focus() doesn't refire onFocus when the input already has it —
            // a click must still reopen an Escape-closed dropdown.
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
