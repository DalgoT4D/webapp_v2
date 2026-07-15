'use client';

/**
 * The Create-group dialog's member picker: ONE search input mixing org
 * users, groups, and free-typed/pasted emails — the same unified typeahead
 * pattern as ShareModal's (design: 'group creation-1.jpg' — label "Add
 * people, groups, or paste emails", placeholder "Type or paste emails…").
 * Reuses ShareModal's generic parsing/dropdown-row pieces
 * (principal-search-shared.tsx); staging state lives in
 * group-member-staging.ts (split out per the repo's ~300-lines guidance).
 * Staging a GROUP here means "add its current active members" (flattened at
 * submit time by GroupFormDialog), not a group grant — group members have
 * no per-row permission control.
 *
 * Dropdown ordering deliberately differs from ShareModal's (which buckets
 * groups-then-users): the design shows users and groups interleaved
 * alphabetically, so this list is one alphabetically-sorted merge instead.
 *
 * Unknown emails stage as an invite entry -- Member only. Unlike the share
 * modal, there is no admin role-escalation picker here: no reviewed design
 * screen (including the Analyst one showing a staged unknown email) shows a
 * role dropdown for group invites, so every group invite lands at Member
 * (see the batch-2b report for the screens checked).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Mail, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  EMAIL_REGEX,
  splitEmailTokens,
  roleTagLabel,
  principalRowIcon,
  SearchResultButton,
} from '@/components/ui/principal-search-shared';
import {
  buildEmailEntries,
  type GroupMemberStaging,
} from '@/components/settings/groups/group-member-staging';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useUserGroups, type UserGroup } from '@/hooks/api/useUserGroups';
import type { OrgUser } from '@/stores/authStore';

interface GroupMemberSearchProps {
  staging: GroupMemberStaging;
  disabled?: boolean;
}

export function GroupMemberSearch({ staging, disabled }: GroupMemberSearchProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const { users: orgUsers } = useUsers();
  const { data: groups } = useUserGroups(true);

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
  const combinedMatches = useMemo(() => {
    type Row =
      | { kind: 'user'; sortKey: string; user: OrgUser }
      | { kind: 'group'; sortKey: string; group: UserGroup };
    const rows: Row[] = [
      ...userMatches.map(
        (user): Row => ({ kind: 'user', sortKey: user.email.toLowerCase(), user })
      ),
      ...groupMatches.map(
        (group): Row => ({ kind: 'group', sortKey: group.name.toLowerCase(), group })
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
          <div
            data-testid="group-member-search-results"
            className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
          >
            {combinedMatches.map((row) =>
              row.kind === 'user' ? (
                <SearchResultButton
                  key={`user-${row.user.orguser_id}`}
                  testId={`group-member-search-user-${row.user.orguser_id}`}
                  icon={principalRowIcon('user')}
                  label={row.user.email}
                  tag={roleTagLabel(row.user.new_role_slug)}
                  alreadyStaged={
                    stagedKeys.has(`user-${row.user.orguser_id}`) ||
                    stagedEmails.has(row.user.email.toLowerCase())
                  }
                  hasAccess={false}
                  onPick={() =>
                    stageUser(row.user.orguser_id as number, row.user.email, row.user.new_role_slug)
                  }
                />
              ) : (
                <SearchResultButton
                  key={`group-${row.group.id}`}
                  testId={`group-member-search-group-${row.group.id}`}
                  icon={principalRowIcon('group')}
                  label={row.group.name}
                  tag="Group"
                  alreadyStaged={stagedKeys.has(`group-${row.group.id}`)}
                  hasAccess={false}
                  onPick={() => stageGroup(row.group.id, row.group.name)}
                />
              )
            )}

            {emailCandidate && (
              <SearchResultButton
                testId="group-member-search-add-email"
                icon={<Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                label={`Invite ${emailCandidate}`}
                tag="New"
                alreadyStaged={false}
                hasAccess={false}
                onPick={() => stageEmailTokens([emailCandidate])}
              />
            )}

            {combinedMatches.length === 0 && !emailCandidate && (
              <div
                data-testid="group-member-search-empty"
                className="px-3 py-2 text-sm text-muted-foreground"
              >
                Search for people, a group, or add emails
              </div>
            )}
          </div>
        )}
      </div>

      {staging.staged.length > 0 && (
        <div className="space-y-2" data-testid="group-member-staged-rows">
          {staging.staged.map((entry) => (
            <div
              key={entry.key}
              data-testid={`group-member-staged-row-${entry.key}`}
              data-status={entry.status}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="flex-1 truncate inline-flex items-center gap-1.5 min-w-0">
                {principalRowIcon(entry.kind)}
                <span className={cn('truncate', entry.status === 'invalid' && 'text-destructive')}>
                  {entry.label}
                </span>
                {entry.status === 'invalid' && (
                  <span className="text-xs flex-shrink-0 text-destructive">
                    Not a valid email address
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Badge variant="secondary">{entry.tag}</Badge>
                <button
                  type="button"
                  data-testid={`group-member-staged-remove-${entry.key}`}
                  onClick={() => staging.remove(entry.key)}
                  disabled={disabled}
                  className="p-1 hover:text-destructive"
                  aria-label={`Remove ${entry.label}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {stagedEmailEntries.length > 0 && (
        <div
          data-testid="group-member-invite-hint"
          className="rounded-md border p-3 text-xs text-muted-foreground"
        >
          {stagedEmailEntries.length === 1
            ? `${stagedEmailEntries[0].label} isn't on Dalgo yet. They'll be invited as a Member.`
            : `${stagedEmailEntries.length} people aren't on Dalgo yet. They'll be invited as Members.`}
        </div>
      )}
    </div>
  );
}
