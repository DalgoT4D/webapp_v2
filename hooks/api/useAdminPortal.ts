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
  is_active: boolean;
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
 * Identity for the admin portal's independent session, read by AdminGuard.
 *
 * Reachable only with the admin_access_token cookie, so a missing or expired
 * admin session comes back as an error with no data — which the guard treats the
 * same as "not an admin". isPlatformAdmin is therefore false until proven true.
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
    error,
    mutate,
  };
}

/**
 * Fetch platform-wide counts for the admin dashboard.
 *
 * Calls the cross-org admin endpoint directly (org id is not in the header for
 * admin routes — the platform-admin guard authorizes it). See
 * features/admin-portal/v1/plan.md §4.5.
 */
export function useAdminStats() {
  const { data, error, isLoading, mutate } = useSWR<AdminStats>('/api/v1/admin/stats', apiGet);

  return {
    stats: data,
    isLoading,
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
    error,
    mutate,
  };
}

/** Create / edit / deactivate / reactivate actions for orgs. */
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

  const deactivateOrg = async (orgId: number): Promise<AdminOrg> => {
    try {
      const org = (await apiPost(`/api/v1/admin/orgs/${orgId}/deactivate`, {})) as AdminOrg;
      toastSuccess.generic('Organization deactivated');
      return org;
    } catch (error: any) {
      toastError.api(error, 'Failed to deactivate organization');
      throw error;
    }
  };

  const reactivateOrg = async (orgId: number): Promise<AdminOrg> => {
    try {
      const org = (await apiPost(`/api/v1/admin/orgs/${orgId}/reactivate`, {})) as AdminOrg;
      toastSuccess.generic('Organization reactivated');
      return org;
    } catch (error: any) {
      toastError.api(error, 'Failed to reactivate organization');
      throw error;
    }
  };

  return { createOrg, updateOrg, deactivateOrg, reactivateOrg };
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
  /** per-org active flag (OrgUser.is_active) — NOT the global User.is_active */
  is_active: boolean;
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

/** List an org's members (with per-org status) plus its pending invitations. */
export function useAdminOrgUsers(orgId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<AdminOrgUsers>(
    orgId != null ? `/api/v1/admin/orgs/${orgId}/users` : null,
    apiGet
  );

  return {
    users: data?.users,
    invitations: data?.invitations,
    isLoading,
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

/** Invite / change-role / (de)activate / remove / cancel-invite for an org's users. */
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

  const deactivateUser = async (orgId: number, orgUserId: number): Promise<void> => {
    try {
      await apiPost(`/api/v1/admin/orgs/${orgId}/users/${orgUserId}/deactivate`, {});
      toastSuccess.generic('User deactivated in this organization');
    } catch (error: any) {
      toastError.api(error, 'Failed to deactivate user');
      throw error;
    }
  };

  const reactivateUser = async (orgId: number, orgUserId: number): Promise<void> => {
    try {
      await apiPost(`/api/v1/admin/orgs/${orgId}/users/${orgUserId}/reactivate`, {});
      toastSuccess.generic('User reactivated in this organization');
    } catch (error: any) {
      toastError.api(error, 'Failed to reactivate user');
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
    deactivateUser,
    reactivateUser,
    removeUser,
    cancelInvitation,
  };
}
