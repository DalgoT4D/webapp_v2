import { useRbac } from '@/lib/rbac';
import {
  getRolePermissions,
  hasEditAccess,
  type PermissionResource,
  type RolePermissions,
} from '@/components/access/logic/resource-permissions';

export interface ResourcePermissions extends RolePermissions {
  hasEditAccess: boolean;
}

/** Role permissions for a resource type, plus Edit on one row when its `access_level` is given. */
export function useResourcePermissions(
  resource: PermissionResource,
  accessLevel?: string | null
): ResourcePermissions {
  const { hasPermission } = useRbac();
  return {
    ...getRolePermissions(resource, hasPermission),
    hasEditAccess: hasEditAccess(accessLevel),
  };
}
