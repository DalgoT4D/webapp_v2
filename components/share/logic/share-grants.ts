import type { TypeaheadSuggestion } from '@/components/ui/principal-typeahead';
import type { OwnerInfo } from '@/hooks/api/useAccess';
import type { AccessLevel, AddGrantsPayload, PrincipalType, ShareRow } from '@/types/access';
import type { PersonRow } from '@/types/user-management';
import type { GroupListRow } from '@/types/user-groups';

/** A person, group or not-yet-registered email staged in the Share modal; granted on SHARE. */
export interface StagedChip {
  key: string;
  label: string;
  kind: 'user' | 'group' | 'email';
  principal_type: PrincipalType | null; // null for pending emails
  principal_id: number | null;
  email: string | null;
  access_level: AccessLevel;
}

export interface ActiveUser {
  orguser_id: number;
  role_name: string;
}

/** Order of access levels; a cascade-only row can only be raised above its inherited level. */
export const LEVEL_RANK: Record<string, number> = { no_access: 0, view: 1, edit: 2 };

// Typeahead caps: at most this many people and groups are suggested at once.
const MAX_USER_SUGGESTIONS = 6;
const MAX_GROUP_SUGGESTIONS = 4;

/** Existing shared principals (skipped/disabled in suggestions): `user:<id>`, `group:<id>`, `email:<lower>`. */
export function buildCurrentPrincipalKeys(shares: ShareRow[] | undefined): Set<string> {
  const set = new Set<string>();
  (shares ?? []).forEach((s) => {
    if (s.principal_type === 'user' && s.principal_id != null) set.add(`user:${s.principal_id}`);
    if (s.principal_type === 'group' && s.principal_id != null) set.add(`group:${s.principal_id}`);
    if (s.email) set.add(`email:${s.email.toLowerCase()}`);
  });
  return set;
}

/**
 * "People with access" order: groups, then direct user shares, then pending-email invites
 * (the owner is rendered separately above). Preserves original order within each bucket.
 */
export function sortSharesForDisplay(shares: ShareRow[] | undefined): ShareRow[] {
  const rank = (s: ShareRow): number => {
    if (s.status === 'pending') return 2;
    if (s.principal_type === 'group') return 0;
    return 1;
  };
  return [...(shares ?? [])].sort((a, b) => rank(a) - rank(b));
}

/** Active org members with an orguser id, keyed by lower-cased email. */
export function buildActiveUserByEmail(people: PersonRow[] | undefined): Map<string, ActiveUser> {
  const m = new Map<string, ActiveUser>();
  people?.forEach((p) => {
    if (p.status === 'active' && p.orguser_id != null) {
      m.set(p.email.toLowerCase(), { orguser_id: p.orguser_id, role_name: p.role_name });
    }
  });
  return m;
}

interface ShareSuggestionInput {
  query: string;
  people: PersonRow[] | undefined;
  groups: GroupListRow[] | undefined;
  chippedKeys: Set<string>;
  currentPrincipals: Set<string>;
  owner: OwnerInfo | null;
}

/**
 * Typeahead rows. Empty query → all eligible people and groups; typing narrows by substring.
 * The owner and people who already have access stay listed but disabled, with the reason.
 */
export function buildShareSuggestions({
  query,
  people,
  groups,
  chippedKeys,
  currentPrincipals,
  owner,
}: ShareSuggestionInput): TypeaheadSuggestion[] {
  const q = query.trim().toLowerCase();
  const userMatches = (people ?? [])
    .filter(
      (p) =>
        p.status === 'active' &&
        p.orguser_id != null &&
        !chippedKeys.has(`user:${p.orguser_id}`) &&
        p.email.toLowerCase().includes(q)
    )
    .slice(0, MAX_USER_SUGGESTIONS)
    .map((p) => ({
      kind: 'user' as const,
      id: p.orguser_id!,
      label: p.email,
      badge: p.role_name,
      isOwner: owner != null && p.orguser_id === owner.orguser_id,
      alreadyShared: currentPrincipals.has(`user:${p.orguser_id}`),
    }));
  const groupMatches = (groups ?? [])
    .filter((g) => !chippedKeys.has(`group:${g.id}`) && g.name.toLowerCase().includes(q))
    .slice(0, MAX_GROUP_SUGGESTIONS)
    .map((g) => ({
      kind: 'group' as const,
      id: g.id,
      label: g.name,
      badge: 'Group',
      isOwner: false,
      alreadyShared: currentPrincipals.has(`group:${g.id}`),
    }));
  return [...userMatches, ...groupMatches].map((s) => ({
    kind: s.kind,
    id: s.id,
    label: s.label,
    badge: s.isOwner ? 'Owner' : s.badge,
    disabled: s.isOwner || s.alreadyShared,
    disabledReason: s.isOwner
      ? 'Already the owner — has full access'
      : s.alreadyShared
        ? 'Already has access'
        : undefined,
  }));
}

/** SHARE body: people/groups as principals, emails as pending grants, invite role only when emails are staged. */
export function buildAddGrantsPayload(
  chips: StagedChip[],
  inviteRoleUuid: string
): AddGrantsPayload {
  const hasPendingChips = chips.some((c) => c.kind === 'email');
  return {
    principals: chips
      .filter((c) => c.principal_type != null && c.principal_id != null)
      .map((c) => ({
        principal_type: c.principal_type as PrincipalType,
        principal_id: c.principal_id as number,
        access_level: c.access_level,
      })),
    pending_grants: chips
      .filter((c) => c.kind === 'email')
      .map((c) => ({ email: c.email as string, access_level: c.access_level })),
    invite_role_uuid: hasPendingChips ? inviteRoleUuid : null,
  };
}

/** Bold line of the "not on Dalgo yet" warning. */
export function describePendingEmails(chips: StagedChip[]): string {
  const emailChips = chips.filter((c) => c.kind === 'email');
  return emailChips.length === 1
    ? `${emailChips[0]?.email} isn't on Dalgo yet.`
    : `${emailChips.length} emails aren't on Dalgo yet.`;
}

/** Testid suffix of a "People with access" row: its share id, or `inherited-<type>-<id>` for cascade rows. */
export function getShareRowKey(share: ShareRow): string {
  return `${share.share_id ?? `inherited-${share.principal_type}-${share.principal_id}`}`;
}

export function cascadeBlockMessage(share: ShareRow): string {
  const titles = share.cascade_sources?.map((cs) => cs.dashboard_title).join(', ') || 'a dashboard';
  return `Access on this resource is inherited from: ${titles} — change permissions from there`;
}

/** Cascade-only row: only an upgrade is allowed, so same-or-lower levels are blocked. */
export function isCascadeDowngrade(share: ShareRow, level: AccessLevel): boolean {
  return share.share_id === null && LEVEL_RANK[level] <= LEVEL_RANK[share.access_level];
}

/** The signed-in user's own user row ("You" pill). */
export function isOwnShare(share: ShareRow, currentEmail: string | undefined): boolean {
  return (
    share.principal_type === 'user' &&
    share.email != null &&
    share.email.toLowerCase() === currentEmail?.toLowerCase()
  );
}

/** "Transfer ownership" is offered to owners/admins on a user row with Edit. */
export function canOfferTransfer(share: ShareRow, isOwnerOrAdmin: boolean): boolean {
  return (
    isOwnerOrAdmin &&
    share.principal_type === 'user' &&
    share.principal_id != null &&
    share.access_level === 'edit'
  );
}

/** A row's level select is disabled while that row (or, for a cascade row, its principal) is updating. */
export function isShareRowBusy(share: ShareRow, rowBusyId: number | null): boolean {
  return (
    rowBusyId != null &&
    (rowBusyId === share.share_id || (share.share_id === null && rowBusyId === share.principal_id))
  );
}
