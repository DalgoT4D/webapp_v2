import useSWR from 'swr';
import { apiGet } from '@/lib/api';

export interface AdminStats {
  total_orgs: number;
  total_users: number;
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
