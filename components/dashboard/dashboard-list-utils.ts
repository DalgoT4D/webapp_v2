import type { Dashboard } from '@/hooks/api/useDashboards';
import type { RolePermissionLevel } from '@/hooks/api/useResourceAccess';
import { audienceLabels, LEVEL_LABELS } from '@/lib/access-labels';

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
// "none"/"view"/"edit" -- this collapses that pair back down to the single
// badge the list row shows, keeping the existing badge vocabulary:
//   - both "none"                -> the dedicated Private badge (kind "private")
//   - member_level >= "view"     -> "Everyone in org" (kind "everyone"),
//     since any Member access means every org member (Analysts included) can
//     see it; the tooltip shows the HIGHER of the two levels
//   - only analyst_level >= "view" -> the analysts-scoped badge (kind "analysts")
// Both null/undefined (predates general-access config, or an anonymous
// public-view caller) yields no badge at all -- same as the old null-audience
// case.
// ---------------------------------------------------------------------------

const ROLE_LEVEL_RANK: Record<RolePermissionLevel, number> = { none: 0, view: 1, edit: 2 };

function higherRoleLevel(a: RolePermissionLevel, b: RolePermissionLevel): RolePermissionLevel {
  return ROLE_LEVEL_RANK[a] >= ROLE_LEVEL_RANK[b] ? a : b;
}

export type GeneralAccessBadgeKind = 'private' | 'analysts' | 'everyone';

export interface GeneralAccessBadge {
  kind: GeneralAccessBadgeKind;
  /** Undefined for "private" -- that badge's copy ("Private") is fixed, not derived. */
  label?: string;
  /** The level to surface in the tooltip; omitted for "private". */
  level?: RolePermissionLevel;
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
  if (member !== 'none') {
    return {
      kind: 'everyone',
      label: AUDIENCE_BADGE_LABELS.all_users,
      level: higherRoleLevel(analyst, member),
    };
  }
  return { kind: 'analysts', label: AUDIENCE_BADGE_LABELS.analysts_plus, level: analyst };
}

/**
 * True when the viewer can see this dashboard only because of a grant or a
 * general-access widening — i.e. they neither own it nor created it. Drives
 * the "Shared with you" badge and the matching list filter.
 */
export function isSharedWithViewer(dashboard: Pick<Dashboard, 'is_owner' | 'is_creator'>): boolean {
  return !(dashboard.is_owner ?? false) && !(dashboard.is_creator ?? false);
}
