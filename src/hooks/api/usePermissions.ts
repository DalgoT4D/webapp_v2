import { useAuthStore } from '@/stores/authStore';

export interface Permission {
  slug: string;
  name: string;
}

export function useUserPermissions(): {
  permissions: Permission[];
  hasPermission: (permissionSlug: string) => boolean;
  hasAnyPermission: (permissionSlugs: string[]) => boolean;
  hasAllPermissions: (permissionSlugs: string[]) => boolean;
  isLoading: boolean;
} {
  const { getCurrentOrgUser } = useAuthStore();
  const currentOrgUser = getCurrentOrgUser();

  const permissions: Permission[] = currentOrgUser?.permissions || [];

  const hasPermission = (permissionSlug: string): boolean => {
    return permissions.some((permission) => permission.slug === permissionSlug);
  };

  const hasAnyPermission = (permissionSlugs: string[]): boolean => {
    return permissionSlugs.some((slug) => hasPermission(slug));
  };

  const hasAllPermissions = (permissionSlugs: string[]): boolean => {
    return permissionSlugs.every((slug) => hasPermission(slug));
  };

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isLoading: false, // Since we're using existing auth store data
  };
}

export default useUserPermissions;
