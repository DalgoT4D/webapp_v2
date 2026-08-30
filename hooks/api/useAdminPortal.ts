import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { toastSuccess, toastError } from '@/lib/toast';

export interface AdminStats {
  total_orgs: number;
  total_users: number;
}

export interface AdminOrg {
  id: number;
  name: string;
  slug: string | null;
  viz_url: string | null;
  base_plan: string | null;
  user_count: number;
}

export interface CreateAdminOrgForm {
  name: string;
  viz_url?: string;
  base_plan?: string;
}

export interface UpdateAdminOrgForm {
  name?: string;
  viz_url?: string;
  base_plan?: string;
}

export interface AdminSession {
  email: string;
  is_platform_admin: boolean;
}

/**
 * Identity for the admin portal, read by AdminGuard.
 *
 * Uses the shared session cookie; the route is gated by @platform_admin_required, so a
 * signed-out visitor (401) and a signed-in non-admin (403) both come back as an error
 * with no data — which the guard treats the same as "not an admin". isPlatformAdmin is
 * therefore false until proven true.
 */
export function useAdminSession() {
  const { data, error, isLoading, mutate } = useSWR<AdminSession>(
    '/api/v1/admin/currentuser',
    apiGet
  );

  return {
    session: data,
    isPlatformAdmin: data ? Boolean(data.is_platform_admin) : false,
    isLoading,
    // `isError` is the repo-wide read-hook contract (rules/api-hooks.md, useCharts /
    // usePipelines); `error` is kept alongside it for the existing callers.
    isError: error,
    error,
    mutate,
  };
}

/**
 * Fetch platform-wide counts for the admin dashboard.
 *
 * Calls the cross-org admin endpoint directly (org id is not in the header for
 * admin routes — the platform-admin guard authorizes it). See
 * features/admin-portal/plan.md §4.5.
 */
export function useAdminStats() {
  const { data, error, isLoading, mutate } = useSWR<AdminStats>('/api/v1/admin/stats', apiGet);

  return {
    stats: data,
    isLoading,
    isError: error,
    error,
    mutate,
  };
}

/** List all orgs (active + inactive) for the admin portal. */
export function useAdminOrgs() {
  const { data, error, isLoading, mutate } = useSWR<AdminOrg[]>('/api/v1/admin/orgs', apiGet);

  return {
    orgs: data,
    isLoading,
    isError: error,
    error,
    mutate,
  };
}

/** Fetch a single org's detail. Pass null to skip (e.g. before the id is known). */
export function useAdminOrg(orgId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<AdminOrg>(
    orgId != null ? `/api/v1/admin/orgs/${orgId}` : null,
    apiGet
  );

  return {
    org: data,
    isLoading,
    isError: error,
    error,
    mutate,
  };
}

/**
 * What deleting an org would destroy (drives the DeleteOrgDialog warning). Unlike
 * RemovalImpact (SET_NULL, content kept), every count here is a hard CASCADE delete.
 */
export interface OrgDeletionImpact {
  user_count: number;
  warehouse_count: number;
  connection_count: number;
  pipeline_count: number;
  dashboard_count: number;
  chart_count: number;
  report_count: number;
}

/**
 * Fetch the deletion impact for an org on demand (not via SWR — it is fetched when
 * the DeleteOrgDialog opens, and must be shown BEFORE deletion is allowed).
 */
export async function getOrgDeletionImpact(orgId: number): Promise<OrgDeletionImpact> {
  return (await apiGet(`/api/v1/admin/orgs/${orgId}/delete-impact`)) as OrgDeletionImpact;
}

/** Create / edit / delete actions for orgs. */
export function useAdminOrgActions() {
  const createOrg = async (data: CreateAdminOrgForm): Promise<AdminOrg> => {
    try {
      const org = (await apiPost('/api/v1/admin/orgs', data)) as AdminOrg;
      toastSuccess.generic('Organization created');
      return org;
    } catch (error: any) {
      toastError.api(error, 'Failed to create organization');
      throw error;
    }
  };

  const updateOrg = async (orgId: number, data: UpdateAdminOrgForm): Promise<AdminOrg> => {
    try {
      const org = (await apiPut(`/api/v1/admin/orgs/${orgId}`, data)) as AdminOrg;
      toastSuccess.generic('Organization updated');
      return org;
    } catch (error: any) {
      toastError.api(error, 'Failed to update organization');
      throw error;
    }
  };

  const deleteOrg = async (orgId: number): Promise<void> => {
    try {
      await apiDelete(`/api/v1/admin/orgs/${orgId}`);
      toastSuccess.generic('Organization deleted');
    } catch (error: any) {
      toastError.api(error, 'Failed to delete organization');
      throw error;
    }
  };

  return { createOrg, updateOrg, deleteOrg };
}

// ===========================================================================
// Users tab (M4) — cross-org user management inside a target org.
// Every path carries the org id in the URL (not the x-dalgo-org header); the
// backend platform-admin guard authorizes it. See plan.md §4.5.
// ===========================================================================

export interface AdminOrgUser {
  orguser_id: number;
  email: string;
  new_role_slug: string | null;
}

export interface AdminInvitation {
  id: number;
  invited_email: string;
  invited_role_slug: string | null;
  invited_on: string;
}

export interface AdminOrgUsers {
  users: AdminOrgUser[];
  invitations: AdminInvitation[];
}

/**
 * What removing a user would orphan (drives the RemoveUserDialog warning).
 * dashboards/charts/reports are all SET_NULL — kept, with the creator link cleared.
 * Nothing is deleted (Access Control v2 switched dashboards/charts from CASCADE to
 * SET_NULL; reports already were).
 */
export interface RemovalImpact {
  dashboards_orphaned: number;
  charts_orphaned: number;
  reports_orphaned: number;
}

export interface AdminInviteUserForm {
  invited_email: string;
  invited_role_uuid: string;
}

/** List an org's members plus its pending invitations. */
export function useAdminOrgUsers(orgId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<AdminOrgUsers>(
    orgId != null ? `/api/v1/admin/orgs/${orgId}/users` : null,
    apiGet
  );

  return {
    users: data?.users,
    invitations: data?.invitations,
    isLoading,
    isError: error,
    error,
    mutate,
  };
}

/**
 * Fetch the removal impact for a user on demand (not via SWR — it is fetched
 * when the RemoveUserDialog opens, and must be shown BEFORE removal is allowed).
 */
export async function getRemovalImpact(orgId: number, orgUserId: number): Promise<RemovalImpact> {
  return (await apiGet(
    `/api/v1/admin/orgs/${orgId}/users/${orgUserId}/removal-impact`
  )) as RemovalImpact;
}

// ===========================================================================
// Feature flags (M3) — per-org on/off. Reuses the org id from the URL, same as
// the Users tab. See features/admin-portal/plan.md §3.3, §4.3.
// ===========================================================================

export interface AdminFeatureFlagCatalogItem {
  flag_name: string;
  description: string;
}

/** The fixed FEATURE_FLAGS registry, served from one source of truth instead of a
 * hand-maintained TS enum. */
export function useAdminFlagCatalog() {
  const { data, error, isLoading } = useSWR<AdminFeatureFlagCatalogItem[]>(
    '/api/v1/admin/flags/catalog',
    apiGet,
    { revalidateOnFocus: false }
  );

  return {
    catalog: data,
    isLoading,
    isError: error,
    error,
  };
}

/** One org's current status for a single flag, as returned by GET /flags/{flag_name}/orgs. */
export interface AdminFlagOrgStatus {
  org_id: number;
  org_name: string;
  enabled: boolean;
}

/** Every org's current status for one flag, for the portal-wide Feature Flags table. */
export function useAdminFlagOrgs(flagName: string | null) {
  const { data, error, isLoading, mutate } = useSWR<AdminFlagOrgStatus[]>(
    flagName ? `/api/v1/admin/flags/${flagName}/orgs` : null,
    apiGet
  );

  return {
    orgFlags: data,
    isLoading,
    isError: error,
    error,
    mutate,
  };
}

/** All flags for one org: global default merged with any org-specific override. */
export function useAdminOrgFlags(orgId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<Record<string, boolean>>(
    orgId != null ? `/api/v1/admin/orgs/${orgId}/flags` : null,
    apiGet
  );

  return {
    flags: data,
    isLoading,
    isError: error,
    error,
    mutate,
  };
}

/**
 * Turn one flag on/off for one org — the only flag write either screen makes. The
 * per-org panel and the portal-wide table are transposes of the same action, so they
 * share this one call.
 *
 * There is deliberately no binding for DELETE /orgs/{id}/flags/{name} (clear the
 * override so the org falls back to the global default): no screen offers it, and an
 * unused binding drifts. The route exists and is tested backend-side — add the hook
 * here when a UI actually needs it.
 */
export function useAdminFlagActions() {
  const setOrgFlag = async (
    orgId: number,
    flagName: string,
    enabled: boolean
  ): Promise<Record<string, boolean>> => {
    try {
      return (await apiPut(`/api/v1/admin/orgs/${orgId}/flags/${flagName}`, {
        enabled,
      })) as Record<string, boolean>;
    } catch (error: any) {
      toastError.api(error, 'Failed to update the flag');
      throw error;
    }
  };

  return { setOrgFlag };
}

/** Invite / change-role / remove / cancel-invite for an org's users. */
export function useAdminOrgUserActions() {
  const inviteUser = async (orgId: number, data: AdminInviteUserForm): Promise<void> => {
    try {
      await apiPost(`/api/v1/admin/orgs/${orgId}/users/invite`, data);
      toastSuccess.generic('Invitation sent');
    } catch (error: any) {
      toastError.api(error, 'Failed to send invitation');
      throw error;
    }
  };

  const changeRole = async (orgId: number, orgUserId: number, roleUuid: string): Promise<void> => {
    try {
      await apiPut(`/api/v1/admin/orgs/${orgId}/users/${orgUserId}/role`, {
        role_uuid: roleUuid,
      });
      toastSuccess.generic('Role updated');
    } catch (error: any) {
      toastError.api(error, 'Failed to update role');
      throw error;
    }
  };

  const removeUser = async (orgId: number, orgUserId: number): Promise<void> => {
    try {
      await apiDelete(`/api/v1/admin/orgs/${orgId}/users/${orgUserId}`);
      toastSuccess.generic('User removed from organization');
    } catch (error: any) {
      toastError.api(error, 'Failed to remove user');
      throw error;
    }
  };

  const cancelInvitation = async (orgId: number, invitationId: number): Promise<void> => {
    try {
      await apiDelete(`/api/v1/admin/orgs/${orgId}/invitations/${invitationId}`);
      toastSuccess.generic('Invitation cancelled');
    } catch (error: any) {
      toastError.api(error, 'Failed to cancel invitation');
      throw error;
    }
  };

  return {
    inviteUser,
    changeRole,
    removeUser,
    cancelInvitation,
  };
}

// ===========================================================================
// Notifications (M2) — broadcast to the whole platform, one org, or several
// orgs at once, with admin-chosen channels. Immediate send only: no scheduling,
// no cancel. See features/admin-portal/plan.md §3.3, §4.3.
// ===========================================================================

/** One broadcast in admin history: audience, channels, time, recipient count
 * only — no read status, no recipient list (plan.md §3.3, §4.3). */
export interface AdminNotification {
  id: number;
  message: string;
  urgent: boolean;
  timestamp: string;
  sent_time: string | null;
  target_org_names: string[] | null;
  send_in_app: boolean;
  send_email: boolean;
  recipient_count: number;
}

export interface AdminNotificationPreview {
  recipient_count: number;
}

export interface CreateAdminNotificationForm {
  message: string;
  email_subject: string;
  urgent?: boolean;
  org_ids?: number[];
  send_in_app?: boolean;
  send_email?: boolean;
}

/** Review sent broadcasts. */
export function useAdminNotifications() {
  const { data, error, isLoading, mutate } = useSWR<AdminNotification[]>(
    '/api/v1/admin/notifications',
    apiGet
  );

  return {
    notifications: data,
    isLoading,
    isError: error,
    error,
    mutate,
  };
}

/** Preview the combined recipient count for an audience, then send. */
export function useAdminNotificationActions() {
  const previewRecipients = async (orgIds?: number[]): Promise<AdminNotificationPreview> => {
    try {
      return (await apiPost('/api/v1/admin/notifications/preview', {
        org_ids: orgIds,
      })) as AdminNotificationPreview;
    } catch (error: any) {
      toastError.api(error, 'Failed to preview recipients');
      throw error;
    }
  };

  const sendNotification = async (
    data: CreateAdminNotificationForm
  ): Promise<AdminNotification> => {
    try {
      const notification = (await apiPost(
        '/api/v1/admin/notifications',
        data
      )) as AdminNotification;
      toastSuccess.generic('Broadcast sent');
      return notification;
    } catch (error: any) {
      toastError.api(error, 'Failed to send broadcast');
      throw error;
    }
  };

  return { previewRecipients, sendNotification };
}
