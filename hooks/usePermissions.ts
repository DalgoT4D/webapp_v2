import { useAuthStore } from '@/stores/authStore';
import { useMemo } from 'react';

/**
 * Hook to check user permissions for the current organization
 */
export const usePermissions = () => {
  const { getCurrentOrgUser } = useAuthStore();
  const currentOrgUser = getCurrentOrgUser();

  const hasPermission = useMemo(() => {
    return (permissionSlug: string): boolean => {
      if (!currentOrgUser?.permissions) {
        return false;
      }

      return currentOrgUser.permissions.some((permission) => permission.slug === permissionSlug);
    };
  }, [currentOrgUser?.permissions]);

  const hasAnyPermission = useMemo(() => {
    return (permissionSlugs: string[]): boolean => {
      return permissionSlugs.some((slug) => hasPermission(slug));
    };
  }, [hasPermission]);

  const hasAllPermissions = useMemo(() => {
    return (permissionSlugs: string[]): boolean => {
      return permissionSlugs.every((slug) => hasPermission(slug));
    };
  }, [hasPermission]);

  const isAccountManager = useMemo(() => {
    return currentOrgUser?.new_role_slug === 'account-manager';
  }, [currentOrgUser?.new_role_slug]);

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAccountManager,
    permissions: currentOrgUser?.permissions || [],
    roleSlug: currentOrgUser?.new_role_slug,
  };
};
