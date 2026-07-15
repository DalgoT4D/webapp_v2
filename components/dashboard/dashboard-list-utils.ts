import type { Dashboard } from '@/hooks/api/useDashboards';
import type { RolePermissionLevel } from '@/hooks/api/useResourceAccess';
import { audienceLabels, LEVEL_LABELS, ROLE_LEVEL_LABELS } from '@/lib/access-labels';

// Labels for the non-private general-access badge shown on the dashboards
// list. "private" gets its own dedicated badge instead — see
// renderDashboardTableRow. "analysts_plus"/"all_users" reuse the same wording
// as ShareModal/BulkShareDialog/AccessManagement where it still applies;
// "all_users" keeps a deliberately shorter abbreviation to fit the badge.
const SHARED_AUDIENCE_LABELS = audienceLabels();
export const AUDIENCE_BADGE_LABELS: Record<string, string> = {
  admins: SHARED_AUDIENCE_LABELS.admins,
  analysts_plus: SHARED_AUDIENCE_LABELS.analysts_plus,
  all_users: 'Everyone in org',
};

// Same level labels the ShareModal uses (its read-only General-access summary
// renders "{audience} · {level}"); surfaced here in the audience badge tooltip.
export const GENERAL_LEVEL_LABELS: Record<string, string> = LEVEL_LABELS;

/**
 * Tooltip for the audience badge: "Everyone in org · Viewer". Falls back to
 * the bare audience label when the level is null/absent (older DTOs).
 */
export function audienceBadgeTitle(audienceLabel: string, level?: string | null): string {
  const levelLabel = level ? GENERAL_LEVEL_LABELS[level] : undefined;
  return levelLabel ? `${audienceLabel} · ${levelLabel}` : audienceLabel;
}

// ---------------------------------------------------------------------------
// D1 per-role general-access badge (dashboards-list, replaces the old
// general_audience/general_level derivation above for DashboardResponse
// consumers). analyst_level/member_level are each independently
// "none"/"view"/"edit", set by the backend's per-role access_resolver -- the
// badge vocabulary has to be honest about BOTH roles rather than collapsing
// to whichever is higher (that was the old tiered-model behavior, where any
// Member access implied every org member, Analysts included, could see the
// resource; per-role, that's no longer true -- analyst_level='none' with
// member_level='view' means Analysts have ZERO access):
//   - both "none"                    -> the dedicated Private badge (kind "private")
//   - both >= "view" AND equal       -> "Everyone in org · {level}" (kind "everyone")
//   - only analyst_level >= "view"   -> the analysts-scoped badge (kind "analysts"),
//     accurate on its own since Members truly have none
//   - levels diverge (including one   -> a per-role badge (kind "custom") whose
//     role being "none" while the        tooltip always spells out both roles
//     other is not)                      explicitly, e.g. "Analysts: No access
//                                         · Members: Can View"
// Both null/undefined (predates general-access config, or an anonymous
// public-view caller) yields no badge at all -- same as the old null-audience
// case.
// ---------------------------------------------------------------------------

export type GeneralAccessBadgeKind = 'private' | 'analysts' | 'everyone' | 'custom';

export interface GeneralAccessBadge {
  kind: GeneralAccessBadgeKind;
  /** Undefined for "private" -- that badge's copy ("Private") is fixed, not derived. */
  label?: string;
  /** The level to surface in the tooltip via audienceBadgeTitle; only set for "everyone"/"analysts". */
  level?: RolePermissionLevel;
  /** Precomputed full tooltip for "custom", spelling out both roles explicitly. */
  tooltip?: string;
}

/** "Analysts: No access · Members: Can View" -- always names both roles, so a
 * diverging pair (including one role at "none") can never be misread as
 * uniform org-wide access. */
export function perRoleBadgeTooltip(
  analystLevel: RolePermissionLevel,
  memberLevel: RolePermissionLevel
): string {
  return `Analysts: ${ROLE_LEVEL_LABELS[analystLevel]} · Members: ${ROLE_LEVEL_LABELS[memberLevel]}`;
}

export function deriveGeneralAccessBadge(
  analystLevel: RolePermissionLevel | null | undefined,
  memberLevel: RolePermissionLevel | null | undefined
): GeneralAccessBadge | null {
  const analystAbsent = analystLevel === null || analystLevel === undefined;
  const memberAbsent = memberLevel === null || memberLevel === undefined;
  if (analystAbsent && memberAbsent) return null;

  const analyst = analystLevel ?? 'none';
  const member = memberLevel ?? 'none';

  if (analyst === 'none' && member === 'none') {
    return { kind: 'private' };
  }
  if (analyst === member) {
    return { kind: 'everyone', label: AUDIENCE_BADGE_LABELS.all_users, level: analyst };
  }
  if (member === 'none') {
    return { kind: 'analysts', label: AUDIENCE_BADGE_LABELS.analysts_plus, level: analyst };
  }
  return {
    kind: 'custom',
    label: 'Custom access',
    tooltip: perRoleBadgeTooltip(analyst, member),
  };
}

/**
 * True when the viewer can see this dashboard only because of a grant or a
 * general-access widening — i.e. they neither own it nor created it. Drives
 * the "Shared with you" badge and the matching list filter.
 */
export function isSharedWithViewer(dashboard: Pick<Dashboard, 'is_owner' | 'is_creator'>): boolean {
  return !(dashboard.is_owner ?? false) && !(dashboard.is_creator ?? false);
}
