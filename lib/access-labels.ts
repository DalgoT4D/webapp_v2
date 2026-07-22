import type {
  AccessAudience,
  AccessLevel,
  RolePermissionLevel,
  ShareableResourceType,
} from '@/hooks/api/useResourceAccess';

/**
 * Single source of truth for the audience/level vocabulary across every
 * sharing surface — per-surface copies drifted apart before. ShareModal's
 * wording is canonical.
 */
export const AUDIENCE_ORDER: AccessAudience[] = ['private', 'admins', 'analysts_plus', 'all_users'];

/** `orgName` interpolates the "all_users" copy; callers without one get the
 * "your organization" fallback. */
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

/** Vocabulary for the per-role permission model — the Roles table and
 * ShareModal's General-access rows use this exact 3-state wording. */
export const ROLE_LEVEL_ORDER: RolePermissionLevel[] = ['none', 'view', 'edit'];

export const ROLE_LEVEL_LABELS: Record<RolePermissionLevel, string> = {
  none: 'No access',
  view: 'Can View',
  edit: 'Can Edit',
};

/** Human noun per rtype for prose. Mirrors the backend's NOUN_BY_RTYPE —
 * keep the casing in sync (only "KPI" differs from the raw rtype string). */
export const RESOURCE_NOUNS: Record<ShareableResourceType, string> = {
  dashboard: 'dashboard',
  report: 'report',
  alert: 'alert',
  metric: 'metric',
  kpi: 'KPI',
  chart: 'chart',
};

/** Human label for an org-role slug (e.g. "org-admin" -> "Org Admin"). */
export function formatRoleLabel(roleSlug: string): string {
  return roleSlug.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
