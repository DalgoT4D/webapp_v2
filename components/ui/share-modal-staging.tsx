'use client';

/**
 * ShareModal's unified add-people flow (Phase C of the sharing design
 * alignment): ONE search input that mixes org users, groups, and free-typed
 * emails; picked entries become STAGED rows (staged ≠ applied); the modal
 * footer's SHARE button commits every staged row in one action.
 *
 * Split out of share-modal.tsx so neither file balloons past the repo's
 * ~300-lines-per-component guidance. The staged STATE lives in
 * `useShareStaging` (called by ShareModal so the footer button can reach
 * `commit`); the data-fetching search UI lives in `ShareAddPeopleSearch`
 * (mounted only inside the open dialog, so the users/groups fetches never
 * fire from list pages that keep a closed ShareModal mounted).
 */

import React, {
  useState,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { AlertTriangle, Mail, User, UsersRound, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toastSuccess, toastError, toastInfo } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import {
  addGrant,
  type AccessGrant,
  type AccessLevel,
  type InviteRoleSlug,
  type ShareableResourceType,
  type ResourceAccessOverview,
} from '@/hooks/api/useResourceAccess';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useUserGroups, type UserGroup } from '@/hooks/api/useUserGroups';
import type { OrgUser } from '@/stores/authStore';
import { ADMIN_ROLES, useRbac } from '@/lib/rbac';
import {
  EMAIL_REGEX,
  splitEmailTokens,
  roleTagLabel,
  dedupeStage,
  principalRowIcon,
  PermissionSelect,
  SearchResultButton,
  INVITE_ROLE_OPTIONS,
  type PrincipalEntryKind,
} from '@/components/ui/principal-search-shared';

// Re-exported for share-modal.tsx / share-modal-staging.test.tsx — moved to
// principal-search-shared.tsx (shared with the Create-group typeahead) but
// this stays the public import path for existing consumers.
export { EMAIL_REGEX, splitEmailTokens, roleTagLabel, INVITE_ROLE_OPTIONS };

// A SHARE commit sends one POST per staged row (an email row can trigger a
// backend invitation — user creation + an outbound email). Small-batch
// concurrency instead of firing all of them at once keeps that load, and
// the org's mail-sending rate, bounded — considerate of slow-connection
// NGO users and shared org mail infrastructure alike.
export const GRANT_COMMIT_BATCH_SIZE = 5;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

// ---- Staged entries ----

export type StagedEntryKind = PrincipalEntryKind;

/**
 * - `staged`  — will be applied by SHARE
 * - `failed`  — a SHARE attempt failed; stays staged (with `error`) for retry
 * - `invalid` — not a valid email address; never sent, kept visible inline
 * - `already` — this principal already has access; never sent, marked inline
 */
export type StagedEntryStatus = 'staged' | 'failed' | 'invalid' | 'already';

export interface StagedEntry {
  /** Stable identity: `user-{orguserId}` / `group-{groupId}` / `email-{email}`. */
  key: string;
  kind: StagedEntryKind;
  /** What the row shows: the person's email or the group's name. */
  label: string;
  /** The row's tag: the user's role, `Group`, or `New` for fresh emails. */
  tag: string;
  principalId?: number;
  /** Lowercased — the backend lowercases emails too. Set for user/email kinds. */
  email?: string;
  permission: AccessLevel;
  status: StagedEntryStatus;
  error?: string;
}

const COMMITTABLE_STATUSES: StagedEntryStatus[] = ['staged', 'failed'];

function isCommittable(entry: StagedEntry): boolean {
  return COMMITTABLE_STATUSES.includes(entry.status);
}

// ---- Commit result plumbing ----

interface CommitResult {
  key: string;
  grant: AccessGrant | null;
  error: string | null;
}

/** Drops entries that succeeded (they now show as real grant rows), flips
 * sent-but-failed entries to 'failed' with the error, and leaves untouched
 * anything not part of this commit (invalid / already-has-access rows). */
function mergeCommitResults(entries: StagedEntry[], results: CommitResult[]): StagedEntry[] {
  const resultByKey = new Map(results.map((r) => [r.key, r]));
  return entries.reduce<StagedEntry[]>((acc, entry) => {
    const result = resultByKey.get(entry.key);
    if (!result) {
      acc.push(entry);
    } else if (result.error) {
      acc.push({ ...entry, status: 'failed', error: result.error });
    }
    return acc;
  }, []);
}

/** Builds the "N shared · N invited · N failed" summary and picks which
 * toast flavor fits (all-success / all-failure / mixed). */
function summarizeCommitResults(results: CommitResult[]) {
  const sharedCount = results.filter((r) => r.grant?.status === 'active').length;
  const invitedCount = results.filter((r) => r.grant?.status === 'pending').length;
  const failedCount = results.filter((r) => r.error).length;

  const parts: string[] = [];
  if (sharedCount > 0) parts.push(`${sharedCount} shared`);
  if (invitedCount > 0) parts.push(`${invitedCount} invited`);
  if (failedCount > 0) parts.push(`${failedCount} failed`);

  const toastKind: 'success' | 'error' | 'info' =
    failedCount === 0 ? 'success' : sharedCount + invitedCount === 0 ? 'error' : 'info';

  return { sharedCount, invitedCount, failedCount, summary: parts.join(' · '), toastKind };
}

// ---- The staging hook (state + SHARE commit) ----

export interface UseShareStagingArgs {
  entityType: ShareableResourceType | null;
  entityId: number;
  /** Staged state is scratch space: closing the modal discards it. */
  isOpen: boolean;
  onCommitted: () => void;
}

/** What the search box's residual-text flush hands back to `commit`:
 * the entries it just staged, or `null` when the text held invalid tokens —
 * the commit must then abort so the inline error rows are seen. */
export type ResidualFlushResult = StagedEntry[] | null;

export interface ShareStaging {
  staged: StagedEntry[];
  /** Adds entries, deduping against already-staged keys AND emails. */
  stage: (entries: StagedEntry[]) => void;
  remove: (key: string) => void;
  setPermission: (key: string, permission: AccessLevel) => void;
  inviteRole: InviteRoleSlug;
  setInviteRole: (role: InviteRoleSlug) => void;
  commit: () => Promise<void>;
  isCommitting: boolean;
  /** Rows SHARE would apply — drives the footer button's disabled state. */
  committableCount: number;
  /** Committable email-kind rows — drives the invite-role block. */
  stagedEmailCount: number;
  /** True while the search box holds typed-but-unstaged text. Keeps the
   * footer SHARE button enabled so clicking it can flush that text into
   * the batch instead of silently discarding it. */
  hasPendingInput: boolean;
  setHasPendingInput: (has: boolean) => void;
  /** The search box registers how to flush its residual text at SHARE time
   * (tokenize → validate → stage). Pass null to unregister on unmount. */
  registerResidualFlush: (flush: (() => ResidualFlushResult) | null) => void;
}

export function useShareStaging({
  entityType,
  entityId,
  isOpen,
  onCommitted,
}: UseShareStagingArgs): ShareStaging {
  const [staged, setStaged] = useState<StagedEntry[]>([]);
  const [inviteRole, setInviteRole] = useState<InviteRoleSlug>('member');
  const [isCommitting, setIsCommitting] = useState(false);
  const [hasPendingInput, setHasPendingInput] = useState(false);
  // Ref (not state): the double-submit guard must trip on the SECOND of two
  // same-tick clicks, before any isCommitting re-render lands.
  const commitInFlightRef = useRef(false);
  const residualFlushRef = useRef<(() => ResidualFlushResult) | null>(null);

  const registerResidualFlush = useCallback((flush: (() => ResidualFlushResult) | null) => {
    residualFlushRef.current = flush;
  }, []);

  // Staged ≠ applied: closing the modal throws the scratchpad away.
  useEffect(() => {
    if (!isOpen) {
      setStaged([]);
      setInviteRole('member');
      setHasPendingInput(false);
    }
  }, [isOpen]);

  const stage = useCallback((entries: StagedEntry[]) => {
    setStaged((prev) => dedupeStage(prev, entries));
  }, []);

  const remove = useCallback((key: string) => {
    setStaged((prev) => prev.filter((entry) => entry.key !== key));
  }, []);

  const setPermission = useCallback((key: string, permission: AccessLevel) => {
    setStaged((prev) =>
      prev.map((entry) => (entry.key === key ? { ...entry, permission } : entry))
    );
  }, []);

  const commitOne = useCallback(
    async (entry: StagedEntry): Promise<CommitResult> => {
      if (!entityType) return { key: entry.key, grant: null, error: 'No resource type' };
      try {
        const grant = await addGrant(
          entityType,
          entityId,
          entry.kind === 'group'
            ? {
                principal_type: 'group',
                principal_id: entry.principalId as number,
                permission: entry.permission,
              }
            : entry.kind === 'user'
              ? {
                  principal_type: 'user',
                  principal_id: entry.principalId as number,
                  permission: entry.permission,
                }
              : {
                  principal_type: 'user',
                  email: entry.email as string,
                  permission: entry.permission,
                  // Only consulted by the backend on the unknown-email
                  // invite path (Phase C3); Member unless an admin chose more.
                  invite_role: inviteRole,
                }
        );
        return { key: entry.key, grant: grant ?? null, error: null };
      } catch (error) {
        return {
          key: entry.key,
          grant: null,
          error: error instanceof Error ? error.message : 'Failed to share',
        };
      }
    },
    [entityType, entityId, inviteRole]
  );

  const commit = useCallback(async () => {
    // Double-submit guard: the disabled-button re-render alone can't stop a
    // second same-tick invoke (double click, Enter+click).
    if (commitInFlightRef.current || !entityType) return;

    // Flush typed-but-unstaged search text into the batch first — an email
    // typed without Enter must not be silently discarded. Invalid text
    // aborts the whole commit; the flush staged it as inline-error rows.
    const flushed = residualFlushRef.current ? residualFlushRef.current() : [];
    if (flushed === null) return;
    const stagedKeys = new Set(staged.map((e) => e.key));
    const stagedEmails = new Set(staged.map((e) => e.email).filter(Boolean));
    const flushedTargets = flushed.filter(
      (e) => isCommittable(e) && !stagedKeys.has(e.key) && !(e.email && stagedEmails.has(e.email))
    );

    const targets = [...staged.filter(isCommittable), ...flushedTargets];
    if (targets.length === 0) return;

    commitInFlightRef.current = true;
    setIsCommitting(true);
    try {
      // Small-batch concurrency, not one big Promise.all — a 30-row commit
      // would otherwise fire 30 simultaneous invite emails/POSTs at once.
      const results: CommitResult[] = [];
      for (const batch of chunk(targets, GRANT_COMMIT_BATCH_SIZE)) {
        results.push(...(await Promise.all(batch.map(commitOne))));
      }

      setStaged((prev) => mergeCommitResults(prev, results));

      const targetByKey = new Map(targets.map((t) => [t.key, t]));
      const successes = results.filter((r) => r.error === null);
      // Fire on the success path only, and count actual applies — not
      // attempts that 400'd (rules/analytics.md; no emails/ids — no PII).
      let emailSuccessCount = 0;
      for (const result of successes) {
        const entry = targetByKey.get(result.key);
        if (!entry) continue;
        if (entry.kind === 'email') {
          emailSuccessCount += 1;
        } else {
          trackEvent(ANALYTICS_EVENTS.SHARING_GRANT_ADDED, {
            entity_type: entityType,
            principal_type: entry.kind,
          });
        }
      }
      if (emailSuccessCount > 0) {
        trackEvent(ANALYTICS_EVENTS.SHARING_EMAIL_INVITE_SENT, {
          entity_type: entityType,
          count: emailSuccessCount,
        });
      }
      if (successes.length > 0) {
        onCommitted();
      }

      const { summary, toastKind } = summarizeCommitResults(results);
      if (toastKind === 'success') toastSuccess.generic(summary);
      else if (toastKind === 'error') toastError.api(summary);
      else toastInfo.generic(summary);
    } finally {
      commitInFlightRef.current = false;
      setIsCommitting(false);
    }
  }, [staged, entityType, commitOne, onCommitted]);

  const committableCount = useMemo(() => staged.filter(isCommittable).length, [staged]);
  const stagedEmailCount = useMemo(
    () => staged.filter((e) => e.kind === 'email' && isCommittable(e)).length,
    [staged]
  );

  return {
    staged,
    stage,
    remove,
    setPermission,
    inviteRole,
    setInviteRole,
    commit,
    isCommitting,
    committableCount,
    stagedEmailCount,
    hasPendingInput,
    setHasPendingInput,
    registerResidualFlush,
  };
}

// ---- The search + staged-rows UI ----

/** Escape layering (ShareModal wires this into DialogContent's
 * onEscapeKeyDown): Radix listens for Escape on the document in the CAPTURE
 * phase, so an input-level keydown handler can never intercept it — the
 * dialog must ask the search box first. Returns true when the dropdown was
 * open and consumed the Escape (caller must then preventDefault so the
 * dialog survives, keeping staged rows intact); false lets the dialog close
 * as usual. Mirrors GroupMemberSearchHandle (group-member-typeahead.tsx). */
export interface ShareAddPeopleSearchHandle {
  closeDropdownIfOpen: () => boolean;
}

interface ShareAddPeopleSearchProps {
  access: ResourceAccessOverview;
  staging: ShareStaging;
  ref?: React.Ref<ShareAddPeopleSearchHandle>;
}

const STATUS_NOTES: Partial<Record<StagedEntryStatus, string>> = {
  invalid: 'Not a valid email address',
  already: 'Already has access',
};

/** Staged rows get one extra treatment ShareModal alone needs: an
 * unknown-email row (kind === 'email' is always a not-yet-on-Dalgo address —
 * see buildEmailEntries/stageEmailTokens below, the only producers of that
 * kind) shows an amber warning badge instead of the plain icon (design:
 * "resource sharing New users" frame). Kept LOCAL rather than folded into
 * the shared `principalRowIcon` so the Create-group dialog's staged rows
 * (group-member-staged-rows.tsx, which also calls principalRowIcon) are
 * untouched. */
function stagedRowIcon(kind: StagedEntryKind) {
  if (kind === 'email') {
    return (
      <span
        data-testid="share-staged-email-warning-icon"
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-orange-100"
      >
        <AlertTriangle className="h-3 w-3 text-orange-600" />
      </span>
    );
  }
  return principalRowIcon(kind);
}

/** Free-typed/pasted tokens → entries: valid unknown emails become email
 * entries, emails matching an org member become that member, invalid tokens
 * become inline-rejected rows (exactly the old invite panel's chip behavior). */
function buildEmailEntries(
  tokens: string[],
  orgUsers: OrgUser[] | undefined,
  grantedEmails: Set<string>
): StagedEntry[] {
  const usersByEmail = new Map(
    (orgUsers || [])
      .filter((u) => typeof u.orguser_id === 'number')
      .map((u) => [u.email.toLowerCase(), u])
  );
  const entries: StagedEntry[] = [];
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
        permission: 'view',
        status: grantedEmails.has(email) ? 'already' : 'staged',
      });
    } else {
      const invalid = !EMAIL_REGEX.test(email);
      entries.push({
        key: `email-${email}`,
        kind: 'email',
        label: email,
        tag: 'New',
        email,
        permission: 'view',
        status: invalid ? 'invalid' : grantedEmails.has(email) ? 'already' : 'staged',
      });
    }
  }
  return entries;
}

export function ShareAddPeopleSearch({ access, staging, ref }: ShareAddPeopleSearchProps) {
  const [query, setQuery] = useState('');
  // Drives the dropdown: focusing the EMPTY input browses all groups + org
  // members (discoverability — the user shouldn't have to guess a name).
  const [isFocused, setIsFocused] = useState(false);
  const { users: orgUsers } = useUsers();
  // The grants capability is a given here — this component only mounts
  // inside the (capability-gated) People section for sharers.
  const { data: groups } = useUserGroups(true);
  const { hasRole } = useRbac();
  const isAdmin = hasRole(ADMIN_ROLES);

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

  const grantedEmails = useMemo(
    () =>
      new Set(
        [...(access.owner ? [access.owner.email] : []), ...access.grants.map((g) => g.email)]
          .filter((e): e is string => Boolean(e))
          .map((e) => e.toLowerCase())
      ),
    [access.owner, access.grants]
  );

  const grantedGroupIds = useMemo(
    () =>
      new Set(access.grants.filter((g) => g.principal_type === 'group').map((g) => g.principal_id)),
    [access.grants]
  );

  const stagedKeys = useMemo(() => new Set(staging.staged.map((e) => e.key)), [staging.staged]);
  const stagedEmails = useMemo(
    () => new Set(staging.staged.map((e) => e.email).filter(Boolean)),
    [staging.staged]
  );

  const trimmed = query.trim();
  const q = trimmed.toLowerCase();

  // Org members without a resolved orguser_id (shouldn't happen post-6b, but
  // the field is optional on the wire) are excluded rather than offered as
  // an unusable candidate — same rule as the old picker. An empty query
  // matches EVERYONE — that's the browse-on-focus list.
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

  // Offer "Invite {email}" only for a valid email that isn't an org member
  // (members are already listed above as user matches).
  const emailCandidate =
    q && EMAIL_REGEX.test(q) && !(orgUsers || []).some((u) => u.email.toLowerCase() === q)
      ? q
      : null;

  const stageUser = useCallback(
    (orguserId: number, email: string, roleSlug: string | undefined) => {
      const lower = email.toLowerCase();
      staging.stage([
        {
          key: `user-${orguserId}`,
          kind: 'user',
          label: lower,
          tag: roleTagLabel(roleSlug),
          principalId: orguserId,
          email: lower,
          permission: 'view',
          status: grantedEmails.has(lower) ? 'already' : 'staged',
        },
      ]);
      setQuery('');
    },
    [staging, grantedEmails]
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
          permission: 'view',
          status: grantedGroupIds.has(groupId) ? 'already' : 'staged',
        },
      ]);
      setQuery('');
    },
    [staging, grantedGroupIds]
  );

  const stageEmailTokens = useCallback(
    (tokens: string[]) => {
      staging.stage(buildEmailEntries(tokens, orgUsers, grantedEmails));
      setQuery('');
    },
    [orgUsers, grantedEmails, staging]
  );

  // ---- Residual typed text (never silently dropped) ----

  // SHARE-time flush: whatever is still typed in the box goes through the
  // same tokenize/validate/stage path; `null` back means invalid tokens were
  // found — commit aborts so their inline error rows are seen.
  const { registerResidualFlush, setHasPendingInput } = staging;
  const flushResidual = useCallback((): ResidualFlushResult => {
    if (!trimmed) return [];
    const entries = buildEmailEntries(splitEmailTokens(trimmed), orgUsers, grantedEmails);
    staging.stage(entries);
    setQuery('');
    return entries.some((e) => e.status === 'invalid') ? null : entries;
  }, [trimmed, orgUsers, grantedEmails, staging]);

  useEffect(() => {
    registerResidualFlush(flushResidual);
    return () => registerResidualFlush(null);
  }, [registerResidualFlush, flushResidual]);

  // Lets the footer SHARE button stay enabled while text sits unstaged in
  // the box — otherwise the flush above could never run from its click.
  useEffect(() => {
    setHasPendingInput(Boolean(trimmed));
  }, [setHasPendingInput, trimmed]);
  useEffect(() => () => setHasPendingInput(false), [setHasPendingInput]);

  // Blur staging (parity with the old email panel): email-looking residual
  // text stages when focus leaves the search area. relatedTarget guard: a
  // dropdown pick moves focus WITHIN the container — don't close or stage
  // mid-pick, or the clicked option would unmount before its click lands.
  const handleContainerBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      setIsFocused(false);
      // Non-email text (a half-typed search) stays put — it's a query, not
      // an address.
      if (trimmed.includes('@')) {
        stageEmailTokens(splitEmailTokens(trimmed));
      }
    },
    [trimmed, stageEmailTokens]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData('text');
      // Only intercept pastes that look like emails — pasting a plain name
      // should just fill the search box.
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
      // Email-looking input stages as emails; otherwise Enter picks the
      // single unambiguous typeahead match.
      if (trimmed.includes('@')) {
        stageEmailTokens(splitEmailTokens(trimmed));
        return;
      }
      if (userMatches.length === 1 && groupMatches.length === 0) {
        const u = userMatches[0];
        stageUser(u.orguser_id as number, u.email, u.new_role_slug);
      } else if (groupMatches.length === 1 && userMatches.length === 0) {
        stageGroup(groupMatches[0].id, groupMatches[0].name);
      }
    },
    [trimmed, stageEmailTokens, userMatches, groupMatches, stageUser, stageGroup]
  );

  const stagedEmailEntries = staging.staged.filter((e) => e.kind === 'email' && isCommittable(e));

  return (
    <div className="space-y-2" data-testid="share-staging-area">
      <Label htmlFor="share-search-input" className="text-sm font-medium">
        Search for people, group or add emails
      </Label>
      {/* Focus/blur on the wrapper (not the input) keeps the dropdown open
          while focus moves onto one of its options — the relatedTarget
          check in handleContainerBlur. */}
      <div className="relative" onFocus={() => setIsFocused(true)} onBlur={handleContainerBlur}>
        <Input
          id="share-search-input"
          data-testid="share-search-input"
          type="text"
          placeholder="Type or paste emails…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsFocused(true); // typing reopens a dropdown closed by Escape
          }}
          // The input already has DOM focus after an Escape-close (only our
          // isFocused flag flipped, not the browser's focus target) — a click
          // there fires no fresh focus event, so it needs its own explicit
          // reopen (mirrors GroupMemberSearch's chip-input onClick).
          onClick={() => setIsFocused(true)}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          disabled={staging.isCommitting}
          autoComplete="off"
        />

        {isFocused && (
          <SearchResultsDropdown
            q={q}
            emailCandidate={emailCandidate}
            userMatches={userMatches}
            groupMatches={groupMatches}
            stagedKeys={stagedKeys}
            stagedEmails={stagedEmails}
            grantedEmails={grantedEmails}
            grantedGroupIds={grantedGroupIds}
            onPickUser={stageUser}
            onPickGroup={stageGroup}
            onPickEmail={(email) => stageEmailTokens([email])}
          />
        )}
      </div>

      {staging.staged.length > 0 && (
        // Scrolls internally when many rows are staged (design: "resource
        // sharing- scrollable list of user to share" — the third row is cut
        // off behind a scrollbar rather than growing the modal).
        <div className="max-h-44 space-y-2 overflow-y-auto" data-testid="share-staged-rows">
          {staging.staged.map((entry) => (
            <StagedRowView key={entry.key} entry={entry} staging={staging} />
          ))}
        </div>
      )}

      {stagedEmailEntries.length > 0 && (
        <InviteRoleBlock
          stagedEmailEntries={stagedEmailEntries}
          staging={staging}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

// ---- Presentational pieces (split out per the ~300-line component rule) ----

interface SearchResultsDropdownProps {
  q: string;
  emailCandidate: string | null;
  userMatches: OrgUser[];
  groupMatches: UserGroup[];
  stagedKeys: Set<string>;
  stagedEmails: Set<string | undefined>;
  grantedEmails: Set<string>;
  grantedGroupIds: Set<number | null>;
  onPickUser: (orguserId: number, email: string, roleSlug: string | undefined) => void;
  onPickGroup: (groupId: number, name: string) => void;
  onPickEmail: (email: string) => void;
}

/** The typeahead/browse dropdown. With nothing typed it lists ALL groups
 * first, then ALL org members (Figma's scrollable share list — the user
 * shouldn't have to guess a name); a typed query filters both and keeps
 * people, the common case, on top. */
function SearchResultsDropdown({
  q,
  emailCandidate,
  userMatches,
  groupMatches,
  stagedKeys,
  stagedEmails,
  grantedEmails,
  grantedGroupIds,
  onPickUser,
  onPickGroup,
  onPickEmail,
}: SearchResultsDropdownProps) {
  const userItems = userMatches.map((u) => {
    const lower = u.email.toLowerCase();
    const alreadyStaged = stagedKeys.has(`user-${u.orguser_id}`) || stagedEmails.has(lower);
    return (
      <SearchResultButton
        key={`user-${u.orguser_id}`}
        testId={`share-search-user-${u.orguser_id}`}
        icon={<User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
        label={u.email}
        tag={roleTagLabel(u.new_role_slug)}
        alreadyStaged={alreadyStaged}
        hasAccess={grantedEmails.has(lower)}
        onPick={() => onPickUser(u.orguser_id as number, u.email, u.new_role_slug)}
      />
    );
  });

  const groupItems = groupMatches.map((g) => (
    <SearchResultButton
      key={`group-${g.id}`}
      testId={`share-search-group-${g.id}`}
      icon={<UsersRound className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
      label={g.name}
      tag="Group"
      alreadyStaged={stagedKeys.has(`group-${g.id}`)}
      hasAccess={grantedGroupIds.has(g.id)}
      onPick={() => onPickGroup(g.id, g.name)}
    />
  ));

  return (
    <div
      data-testid="share-search-results"
      // OVERLAY, not in-flow: anchored to the input's `relative` wrapper so
      // opening it never grows the modal — with ~10 org members an in-flow
      // list pushed the SHARE footer off a 720px-tall viewport. bg + border
      // + shadow keep the modal content underneath from bleeding through.
      className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
    >
      {q ? (
        <>
          {userItems}
          {groupItems}
        </>
      ) : (
        <>
          {groupItems}
          {userItems}
        </>
      )}

      {emailCandidate && (
        <SearchResultButton
          testId="share-search-add-email"
          icon={<Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
          label={`Invite ${emailCandidate}`}
          tag="New"
          alreadyStaged={false}
          hasAccess={false}
          onPick={() => onPickEmail(emailCandidate)}
        />
      )}

      {userMatches.length === 0 && groupMatches.length === 0 && !emailCandidate && (
        <div data-testid="share-search-empty" className="px-3 py-2 text-sm text-muted-foreground">
          Search for people, group or add emails
        </div>
      )}
    </div>
  );
}

interface StagedRowViewProps {
  entry: StagedEntry;
  staging: ShareStaging;
}

function StagedRowView({ entry, staging }: StagedRowViewProps) {
  const note = entry.error ?? STATUS_NOTES[entry.status];
  const isErrorish = entry.status === 'invalid' || entry.status === 'failed';
  return (
    <div
      data-testid={`share-staged-row-${entry.key}`}
      data-status={entry.status}
      // Full-width light-gray rounded row (design: "resource sharing New
      // users"/"resource sharing- user added" — every staged row, not just
      // unknown-email ones, sits in this muted pill before SHARE applies it;
      // committed People-with-access rows below stay plain, no fill).
      className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm"
    >
      <span className="flex-1 truncate inline-flex items-center gap-1.5 min-w-0">
        {stagedRowIcon(entry.kind)}
        <span className={cn('truncate', isErrorish && 'text-destructive')}>{entry.label}</span>
        {note && (
          <span
            className={cn(
              'text-xs flex-shrink-0',
              isErrorish ? 'text-destructive' : 'text-muted-foreground'
            )}
            title={note}
          >
            {note}
          </span>
        )}
      </span>
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Frames show role/Group tags on staged people/groups but NO tag on
            unknown-email rows ("resource sharing New users" — amber icon
            carries that state alone). */}
        {entry.kind !== 'email' && <Badge variant="secondary">{entry.tag}</Badge>}
        {isCommittable(entry) && (
          <PermissionSelect
            testId={`share-staged-permission-${entry.key}`}
            ariaLabel={`Permission for ${entry.label}`}
            value={entry.permission}
            onValueChange={(value) => staging.setPermission(entry.key, value as AccessLevel)}
            disabled={staging.isCommitting}
          />
        )}
        <button
          type="button"
          data-testid={`share-staged-remove-${entry.key}`}
          onClick={() => staging.remove(entry.key)}
          disabled={staging.isCommitting}
          className="p-1 hover:text-destructive"
          aria-label={`Remove ${entry.label}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

interface InviteRoleBlockProps {
  stagedEmailEntries: StagedEntry[];
  staging: ShareStaging;
  isAdmin: boolean;
}

/** The unknown-email notice: an amber warning callout (design: "resource
 * sharing New users" frame), styled to match the Create-group dialog's
 * equivalent notice (group-member-invite-role-block.tsx's recent polish)
 * so the two flows read as one system. Admins additionally get an "Invite
 * new users as" labeled field — a full-width Select (Member/Analyst/Admin)
 * BELOW the callout, not inside it, per the same frame; non-admins get a
 * plain locked sentence inside the callout and no dropdown at all (design:
 * 'Member -resource sharing-2.jpg') — they can only ever invite at Member,
 * mirroring the backend's 403 on non-admin invite_role escalation (Phase
 * C3), so there's nothing for them to pick. */
function InviteRoleBlock({ stagedEmailEntries, staging, isAdmin }: InviteRoleBlockProps) {
  return (
    <div data-testid="share-invite-role-block" className="space-y-2">
      <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-xs">
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-orange-600" />
        <div className="flex-1 space-y-1">
          <p data-testid="share-invite-role-copy" className="font-semibold text-red-800">
            {stagedEmailEntries.length === 1
              ? `${stagedEmailEntries[0].label} isn't on Dalgo yet.`
              : `${stagedEmailEntries.length} people aren't on Dalgo yet.`}
          </p>
          <p className="text-orange-800">
            {isAdmin
              ? 'Assign new invites role before sharing the resource.'
              : stagedEmailEntries.length === 1
                ? 'New member will be invited as member.'
                : 'New members will be invited as members.'}
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="space-y-1.5">
          <Label htmlFor="share-invite-role" className="text-sm font-medium">
            Invite new users as
          </Label>
          <Select
            value={staging.inviteRole}
            onValueChange={(value) => staging.setInviteRole(value as InviteRoleSlug)}
          >
            <SelectTrigger
              id="share-invite-role"
              data-testid="share-invite-role"
              className="w-full"
              disabled={staging.isCommitting}
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
      )}
    </div>
  );
}
