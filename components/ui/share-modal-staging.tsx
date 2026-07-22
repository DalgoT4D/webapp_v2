'use client';

/**
 * ShareModal's add-people flow: one search box for org users, groups, and
 * typed emails; picks become staged rows that the SHARE button commits
 * together. Split out of share-modal.tsx to keep files small; the search UI
 * is mounted only while the dialog is open, so it never fetches in the background.
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
  type ChartCoverageVerdict,
  type InviteRoleSlug,
  type ShareableResourceType,
  type ResourceAccessOverview,
} from '@/hooks/api/useResourceAccess';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useUserGroups, type UserGroup } from '@/hooks/api/useUserGroups';
import type { OrgUser } from '@/stores/authStore';
import { unionCoverageVerdicts } from '@/components/sharing/coverage-confirm-utils';
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

// Re-exported for existing importers; the implementation lives in
// principal-search-shared.tsx (shared with the Create-group typeahead).
export { EMAIL_REGEX, splitEmailTokens, roleTagLabel, INVITE_ROLE_OPTIONS };

// Resource types where a Member grant/invite is deliberately blocked here,
// mirroring the backend's restriction. Members can still reach these via
// general access or an approved access request.
const MEMBER_GRANTS_DEFERRED_RTYPES: ShareableResourceType[] = ['metric', 'kpi', 'chart'];

export function isMemberGrantsDeferred(entityType: ShareableResourceType | null): boolean {
  return entityType !== null && MEMBER_GRANTS_DEFERRED_RTYPES.includes(entityType);
}

// SHARE sends one POST per staged row (email rows also trigger an invite).
// Sending in small batches instead of all at once keeps load bounded for
// slow connections and the org's mail sending.
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
  /** Backend held this grant behind the broadening warning — nothing
   * written yet. The confirm dialog's YES re-sends it with confirm fields. */
  confirmation?: ChartCoverageVerdict[] | null;
}

/** A staged entry held behind the broadening warning, with its own verdicts —
 * the re-send's extend_chart_ids must be a subset of that grant's warned charts. */
export interface PendingBroadeningEntry {
  entry: StagedEntry;
  verdicts: ChartCoverageVerdict[];
}

/** Drops entries that succeeded, flips failed ones to 'failed' with the
 * error, and leaves anything not part of this commit untouched. */
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

/** Builds the "N shared · N invited · N failed" summary and picks the toast flavor. */
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

/** Result of the residual-text flush: the entries it staged, or null when
 * the text held invalid tokens — commit must then abort so the errors show. */
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
  /** True while the search box holds typed-but-unstaged text — keeps SHARE
   * enabled so the click can flush that text instead of dropping it. */
  hasPendingInput: boolean;
  setHasPendingInput: (has: boolean) => void;
  /** The search box registers how to flush its residual text at SHARE time.
   * Pass null to unregister on unmount. */
  registerResidualFlush: (flush: (() => ResidualFlushResult) | null) => void;
  /** Grants held behind the broadening warning (nothing written yet). Null
   * when nothing is pending; the modal renders BroadeningConfirmDialog off this. */
  pendingBroadening: PendingBroadeningEntry[] | null;
  /** Union of the pending entries' verdicts, deduped by chart — what the
   * confirm dialog lists. */
  broadeningVerdicts: ChartCoverageVerdict[];
  /** YES: re-sends every held grant with its own `extend_chart_ids` plus `proceed`. */
  confirmBroadening: () => Promise<void>;
  /** CANCEL: nothing commits; the rows stay staged for editing/removal. */
  cancelBroadening: () => void;
}

// Default invite role is Member, except on member-grants-deferred types
// (metric/kpi) where Member isn't offered — Analyst is the floor there.
function defaultInviteRole(entityType: ShareableResourceType | null): InviteRoleSlug {
  return isMemberGrantsDeferred(entityType) ? 'analyst' : 'member';
}

export function useShareStaging({
  entityType,
  entityId,
  isOpen,
  onCommitted,
}: UseShareStagingArgs): ShareStaging {
  const [staged, setStaged] = useState<StagedEntry[]>([]);
  const [inviteRole, setInviteRole] = useState<InviteRoleSlug>(() => defaultInviteRole(entityType));
  const [isCommitting, setIsCommitting] = useState(false);
  const [hasPendingInput, setHasPendingInput] = useState(false);
  // Grants held behind the broadening warning after a SHARE commit; one
  // aggregated confirm prompt covers the whole batch.
  const [pendingBroadening, setPendingBroadening] = useState<PendingBroadeningEntry[] | null>(null);
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
      setInviteRole(defaultInviteRole(entityType));
      setHasPendingInput(false);
      setPendingBroadening(null);
    }
  }, [isOpen, entityType]);

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
    async (
      entry: StagedEntry,
      confirmFields?: { extend_chart_ids?: number[]; proceed?: boolean }
    ): Promise<CommitResult> => {
      if (!entityType) return { key: entry.key, grant: null, error: 'No resource type' };
      try {
        const basePayload =
          entry.kind === 'group'
            ? {
                principal_type: 'group' as const,
                principal_id: entry.principalId as number,
                permission: entry.permission,
              }
            : entry.kind === 'user'
              ? {
                  principal_type: 'user' as const,
                  principal_id: entry.principalId as number,
                  permission: entry.permission,
                }
              : {
                  principal_type: 'user' as const,
                  email: entry.email as string,
                  permission: entry.permission,
                  // Only used by the backend on the unknown-email invite
                  // path; Member unless an admin chose something else.
                  invite_role: inviteRole,
                };
        const result = await addGrant(entityType, entityId, {
          ...basePayload,
          ...(confirmFields ?? {}),
        });
        // A dashboard grant that would widen access past an inner chart's
        // own permissions comes back requires_confirmation with nothing
        // written — held for confirm, not a success.
        if (result.requires_confirmation) {
          return {
            key: entry.key,
            grant: null,
            error: null,
            confirmation: result.under_covering_charts,
          };
        }
        return { key: entry.key, grant: result.grant ?? null, error: null };
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

  // Shared by commit() and confirmBroadening(): merges decided results
  // (success/failure only) into staged rows, fires analytics, toasts a summary.
  const finalizeDecidedResults = useCallback(
    (results: CommitResult[], targets: StagedEntry[]) => {
      if (results.length === 0) return;
      setStaged((prev) => mergeCommitResults(prev, results));

      const targetByKey = new Map(targets.map((t) => [t.key, t]));
      const successes = results.filter((r) => r.error === null);
      // Counts only successful applies, not 400s. No emails/IDs sent — avoids PII.
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
    },
    [entityType, onCommitted]
  );

  const commit = useCallback(async () => {
    // Double-submit guard: a disabled-button re-render can't stop a second
    // same-tick invoke (double click, Enter+click).
    if (commitInFlightRef.current || !entityType) return;

    // Flush typed-but-unstaged search text first — an email typed without
    // Enter must not be dropped. Invalid text aborts the whole commit.
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
      // Small batches, not one big Promise.all — a 30-row commit would
      // otherwise fire 30 simultaneous POSTs/invite emails.
      const results: CommitResult[] = [];
      for (const batch of chunk(targets, GRANT_COMMIT_BATCH_SIZE)) {
        results.push(...(await Promise.all(batch.map((entry) => commitOne(entry)))));
      }

      // Grants held behind the broadening warning are neither success nor
      // failure — they stay staged, and one confirm prompt covers the batch.
      const targetByKey = new Map(targets.map((t) => [t.key, t]));
      const held: PendingBroadeningEntry[] = [];
      const decided: CommitResult[] = [];
      for (const result of results) {
        const entry = targetByKey.get(result.key);
        if (result.confirmation && entry) {
          held.push({ entry, verdicts: result.confirmation });
        } else {
          decided.push(result);
        }
      }
      if (held.length > 0) {
        setPendingBroadening(held);
      }
      finalizeDecidedResults(decided, targets);
    } finally {
      commitInFlightRef.current = false;
      setIsCommitting(false);
    }
  }, [staged, entityType, commitOne, finalizeDecidedResults]);

  // YES on the broadening prompt: re-send every held grant with its own
  // extendable charts (extend_chart_ids must be a subset of the charts
  // warned for that grant) plus `proceed`.
  const confirmBroadening = useCallback(async () => {
    if (commitInFlightRef.current || !pendingBroadening) return;
    commitInFlightRef.current = true;
    setIsCommitting(true);
    try {
      const results = await Promise.all(
        pendingBroadening.map(async ({ entry, verdicts }) => {
          const extendIds = verdicts
            .filter((v) => v.extendable && v.viewer_can_edit)
            .map((v) => v.chart_id);
          const result = await commitOne(entry, {
            ...(extendIds.length > 0 ? { extend_chart_ids: extendIds } : {}),
            proceed: true,
          });
          // A confirmed re-send must decide — a second confirmation would
          // loop forever, so fail the row loudly instead.
          return result.confirmation
            ? { ...result, confirmation: null, error: 'Could not confirm this share' }
            : result;
        })
      );
      setPendingBroadening(null);
      finalizeDecidedResults(
        results,
        pendingBroadening.map((p) => p.entry)
      );
    } finally {
      commitInFlightRef.current = false;
      setIsCommitting(false);
    }
  }, [pendingBroadening, commitOne, finalizeDecidedResults]);

  // CANCEL: nothing was written; the rows stay staged for editing/removal.
  const cancelBroadening = useCallback(() => setPendingBroadening(null), []);

  // Union of every held grant's verdicts, deduped by chart — the same chart
  // can appear for several principals.
  const broadeningVerdicts = useMemo(
    () =>
      pendingBroadening ? unionCoverageVerdicts(pendingBroadening.map((p) => p.verdicts)) : [],
    [pendingBroadening]
  );

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
    pendingBroadening,
    broadeningVerdicts,
    confirmBroadening,
    cancelBroadening,
  };
}

// ---- The search + staged-rows UI ----

/** Radix fires Escape in the capture phase before any input-level handler,
 * so ShareModal must ask this first. Returns true if it consumed Escape
 * (caller then preventDefaults to keep the dialog open); false lets the
 * dialog close as usual. */
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

/** Unknown-email rows show an amber warning icon instead of the plain one.
 * Kept local rather than folded into principalRowIcon so the Create-group
 * dialog's staged rows are unaffected. */
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

/** Converts typed/pasted tokens into entries: an email matching an org
 * member becomes that member, an unknown valid email becomes an email
 * entry, and an invalid token becomes an inline-rejected row. */
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
  // Focusing the empty input browses all groups + org members, so the user
  // doesn't have to guess a name.
  const [isFocused, setIsFocused] = useState(false);
  const { users: orgUsers } = useUsers();
  // Always enabled: this component only mounts inside the capability-gated
  // People section.
  const { data: groups } = useUserGroups(true);
  const { hasRole } = useRbac();
  const isAdmin = hasRole(ADMIN_ROLES);
  const memberGrantsDeferred = isMemberGrantsDeferred(access.resource_type);

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

  // Users without a resolved orguser_id are excluded rather than shown as
  // an unusable candidate. Empty query matches everyone (browse-on-focus).
  // Member-role users are hidden entirely on member-grants-deferred types,
  // since a direct grant to them would just 400.
  const userMatches = useMemo(
    () =>
      (orgUsers || []).filter(
        (u) =>
          typeof u.orguser_id === 'number' &&
          (!q || u.email.toLowerCase().includes(q)) &&
          (!memberGrantsDeferred || u.new_role_slug !== 'member')
      ),
    [orgUsers, q, memberGrantsDeferred]
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

  // SHARE-time flush: leftover typed text goes through the same
  // tokenize/validate/stage path; null back means invalid tokens — commit aborts.
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

  // Email-looking text stages when focus leaves the search area. The
  // relatedTarget guard skips focus moves within the container — closing
  // mid-pick would unmount the clicked option before its click lands.
  const handleContainerBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      setIsFocused(false);
      // Non-email text stays put — it's a search query, not an address.
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
          while focus moves onto one of its options. */}
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
          // After an Escape-close the input still has DOM focus, so a click
          // fires no focus event — it needs its own explicit reopen.
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
        // Scrolls internally when many rows are staged, rather than growing
        // the modal.
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
          memberGrantsDeferred={memberGrantsDeferred}
        />
      )}
    </div>
  );
}

// ---- Presentational pieces ----

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

/** Typeahead/browse dropdown. Empty query lists all groups then all org
 * members; a typed query filters both and puts people (the common case) on top. */
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
      // Overlay, not in-flow: an in-flow list would grow the modal and push
      // the SHARE footer off short viewports.
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
      // Muted pill marks a row as staged-not-applied; committed rows below
      // stay plain.
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
        {/* No tag on unknown-email rows — the amber icon carries that state. */}
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
  /** On member-grants-deferred types, Member isn't offered as an invite
   * role and the non-admin copy explains invites aren't possible yet. */
  memberGrantsDeferred: boolean;
}

/** Amber callout for unknown emails. Admins also get an invite-role Select;
 * non-admins can only invite at Member (or not at all on deferred types).
 * Presentational only — the backend is the enforcement layer. */
function InviteRoleBlock({
  stagedEmailEntries,
  staging,
  isAdmin,
  memberGrantsDeferred,
}: InviteRoleBlockProps) {
  const roleOptions = memberGrantsDeferred
    ? INVITE_ROLE_OPTIONS.filter((option) => option.value !== 'member')
    : INVITE_ROLE_OPTIONS;

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
          <p data-testid="share-invite-role-note" className="text-orange-800">
            {isAdmin
              ? memberGrantsDeferred
                ? 'New users can only be invited as Analyst or Admin for this type right now.'
                : 'Assign new invites role before sharing the resource.'
              : memberGrantsDeferred
                ? "New users can't be invited directly for this type yet — ask an admin, or share it with an existing org member instead."
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
              {roleOptions.map((option) => (
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
