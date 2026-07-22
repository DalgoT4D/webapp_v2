import type { Dashboard } from '@/hooks/api/useDashboards';
import type { RolePermissionLevel } from '@/hooks/api/useResourceAccess';
import { audienceLabels, LEVEL_LABELS, ROLE_LEVEL_LABELS } from '@/lib/access-labels';

// Labels for the non-private general-access badge; "private" gets its own
// dedicated badge. "all_users" keeps a shorter abbreviation to fit the badge.
const SHARED_AUDIENCE_LABELS = audienceLabels();
export const AUDIENCE_BADGE_LABELS: Record<string, string> = {
  admins: SHARED_AUDIENCE_LABELS.admins,
  analysts_plus: SHARED_AUDIENCE_LABELS.analysts_plus,
  all_users: 'Everyone in org',
};

// Same level labels the ShareModal uses; surfaced in the badge tooltip.
export const GENERAL_LEVEL_LABELS: Record<string, string> = LEVEL_LABELS;

/**
 * Tooltip for the audience badge: "Everyone in org · Viewer". Falls back to
 * the bare audience label when the level is null/absent (older DTOs).
 */
export function audienceBadgeTitle(audienceLabel: string, level?: string | null): string {
  const levelLabel = level ? GENERAL_LEVEL_LABELS[level] : undefined;
  return levelLabel ? `${audienceLabel} · ${levelLabel}` : audienceLabel;
}

// Per-role general-access badge. The vocabulary must be honest about BOTH
// roles — analyst_level='none' with member_level='view' means Analysts have
// zero access, so diverging levels get a "custom" badge whose tooltip
// spells out both roles. Both levels null/undefined yields no badge.

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

/** "Analysts: No access · Members: Can View" — always names both roles so a
 * diverging pair can't be misread as uniform org-wide access. */
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
