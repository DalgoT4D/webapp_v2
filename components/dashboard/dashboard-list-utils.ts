import type { Dashboard } from '@/hooks/api/useDashboards';
import { audienceLabels, LEVEL_LABELS } from '@/lib/access-labels';

// Labels for the non-private general-access audiences, shown as a badge on the
// dashboards list (Task 6b: general_audience/general_level/is_owner/is_creator
// were added to DashboardResponse). "private" gets its own dedicated badge
// instead — see renderDashboardTableRow. admins/analysts_plus reuse the same
// wording as ShareModal/BulkShareDialog/AccessManagement; "all_users" keeps a
// deliberately shorter abbreviation to fit the badge.
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
 * the bare audience label when general_level is null/absent (older DTOs).
 */
export function audienceBadgeTitle(audienceLabel: string, level?: string | null): string {
  const levelLabel = level ? GENERAL_LEVEL_LABELS[level] : undefined;
  return levelLabel ? `${audienceLabel} · ${levelLabel}` : audienceLabel;
}

/**
 * True when the viewer can see this dashboard only because of a grant or a
 * general-access widening — i.e. they neither own it nor created it. Drives
 * the "Shared with you" badge and the matching list filter.
 */
export function isSharedWithViewer(dashboard: Pick<Dashboard, 'is_owner' | 'is_creator'>): boolean {
  return !(dashboard.is_owner ?? false) && !(dashboard.is_creator ?? false);
}
