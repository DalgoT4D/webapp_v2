import type { Dashboard } from '@/hooks/api/useDashboards';

// Labels for the non-private general-access audiences, shown as a badge on the
// dashboards list (Task 6b: general_audience/general_level/is_owner/is_creator
// were added to DashboardResponse). "private" gets its own dedicated badge
// instead — see renderDashboardTableRow.
export const AUDIENCE_BADGE_LABELS: Record<string, string> = {
  admins: 'Admins only',
  analysts_plus: 'Analysts and up',
  all_users: 'Everyone in org',
};

/**
 * True when the viewer can see this dashboard only because of a grant or a
 * general-access widening — i.e. they neither own it nor created it. Drives
 * the "Shared with you" badge and the matching list filter.
 */
export function isSharedWithViewer(dashboard: Pick<Dashboard, 'is_owner' | 'is_creator'>): boolean {
  return !(dashboard.is_owner ?? false) && !(dashboard.is_creator ?? false);
}
