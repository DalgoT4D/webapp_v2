import type {
  AccessAudience,
  AccessLevel,
  RolePermissionLevel,
  ShareableResourceType,
} from '@/hooks/api/useResourceAccess';

/**
 * Single source of truth for the audience/level vocabulary shown across every
 * sharing surface: ShareModal, BulkShareDialog, the AccessManagement org-defaults
 * settings page, and the dashboard-list audience badge. Previously each of
 * these had its own copy of these strings and they drifted apart (e.g. the
 * settings page said "Private"/"Analysts and above"/"View" while everywhere
 * else said "Restricted"/"Analysts and up"/"Viewer" for the exact same
 * backend enum value) — see the resource-sharing final-review M1/M2 findings.
 * ShareModal's wording is the canonical one (it's what users see most).
 */
export const AUDIENCE_ORDER: AccessAudience[] = ['private', 'admins', 'analysts_plus', 'all_users'];

/**
 * `orgName` interpolates the "all_users" copy on per-resource share surfaces
 * that know the org's real name (ShareModal). Callers without one (the
 * org-defaults settings page, BulkShareDialog) get the "your organization"
 * fallback.
 */
export function audienceLabels(orgName?: string): Record<AccessAudience, string> {
  return {
    private: 'Restricted (only people with access)',
    admins: 'Admins only',
    analysts_plus: 'Analysts and up',
    all_users: `Everyone in ${orgName || 'your organization'}`,
  };
}

export const LEVEL_LABELS: Record<AccessLevel, string> = {
  view: 'Viewer',
  edit: 'Editor',
};

/**
 * Vocabulary for the per-role permission model (permission-model rework,
 * D1): the Default-permissions table (Settings > Access > Roles) and the
 * ShareModal General-access section's Analyst/Member rows both use this
 * exact 3-state wording, matching the design's dropdown copy verbatim.
 */
export const ROLE_LEVEL_ORDER: RolePermissionLevel[] = ['none', 'view', 'edit'];

export const ROLE_LEVEL_LABELS: Record<RolePermissionLevel, string> = {
  none: 'No access',
  view: 'Can View',
  edit: 'Can Edit',
};

/**
 * Human noun per rtype for prose like the transfer-ownership sentence
 * ("Ownership of this KPI transfers to …"). Mirrors the backend's
 * NOUN_BY_RTYPE in ddpui/core/sharing/deep_links.py — keep the casing in
 * sync (only "KPI" differs from the raw rtype string).
 */
export const RESOURCE_NOUNS: Record<ShareableResourceType, string> = {
  dashboard: 'dashboard',
  report: 'report',
  alert: 'alert',
  metric: 'metric',
  kpi: 'KPI',
};

/**
 * Human label for an org-role slug (e.g. "org-admin" -> "Org Admin"),
 * shared by every surface that shows a member's role as a badge/tag
 * (Users table, group member rows) — see the F5 gap-analysis finding on
 * per-member role badges in the Groups detail drawer.
 */
export function formatRoleLabel(roleSlug: string): string {
  return roleSlug.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
