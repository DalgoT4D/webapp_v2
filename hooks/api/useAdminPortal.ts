import useSWR from 'swr';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { toast } from 'sonner';

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
      toast.success('Organization created');
      return org;
    } catch (error: any) {
      toast.error(error.message || 'Failed to create organization');
      throw error;
    }
  };

  const updateOrg = async (orgId: number, data: UpdateAdminOrgForm): Promise<AdminOrg> => {
    try {
      const org = (await apiPut(`/api/v1/admin/orgs/${orgId}`, data)) as AdminOrg;
      toast.success('Organization updated');
      return org;
    } catch (error: any) {
      toast.error(error.message || 'Failed to update organization');
      throw error;
    }
  };

  const deactivateOrg = async (orgId: number): Promise<AdminOrg> => {
    try {
      const org = (await apiPost(`/api/v1/admin/orgs/${orgId}/deactivate`, {})) as AdminOrg;
      toast.success('Organization deactivated');
      return org;
    } catch (error: any) {
      toast.error(error.message || 'Failed to deactivate organization');
      throw error;
    }
  };

  const reactivateOrg = async (orgId: number): Promise<AdminOrg> => {
    try {
      const org = (await apiPost(`/api/v1/admin/orgs/${orgId}/reactivate`, {})) as AdminOrg;
      toast.success('Organization reactivated');
      return org;
    } catch (error: any) {
      toast.error(error.message || 'Failed to reactivate organization');
      throw error;
    }
  };

  return { createOrg, updateOrg, deactivateOrg, reactivateOrg };
}
