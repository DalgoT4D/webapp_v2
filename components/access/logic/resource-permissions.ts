import { PERMISSIONS, type Permission } from '@/lib/rbac';

/** Resources whose pages combine a role slug with the row's `access_level`. */
export type PermissionResource = 'chart' | 'dashboard' | 'report';

/** What the user's role allows for a resource type — the same for every row. */
export interface RolePermissions {
  canView: boolean;
  canCreate: boolean;
  canDelete: boolean;
}

type HasPermission = (permission: Permission) => boolean;

interface RoleSlugs {
  /** null = no role gate (reports: opening one is not role-gated today). */
  view: Permission | null;
  create: Permission;
  delete: Permission;
}

/**
 * Role slugs per resource. Reports have no slugs of their own and reuse the dashboard ones.
 * Read at call time (not a module-level table) so tests that partially mock `@/lib/rbac` can still load this file.
 */
function getRoleSlugs(resource: PermissionResource): RoleSlugs {
  switch (resource) {
    case 'chart':
      return {
        view: PERMISSIONS.CAN_VIEW_CHARTS,
        create: PERMISSIONS.CAN_CREATE_CHARTS,
        delete: PERMISSIONS.CAN_DELETE_CHARTS,
      };
    case 'dashboard':
      return {
        view: PERMISSIONS.CAN_VIEW_DASHBOARDS,
        create: PERMISSIONS.CAN_CREATE_DASHBOARDS,
        delete: PERMISSIONS.CAN_DELETE_DASHBOARDS,
      };
    case 'report':
      return {
        view: null,
        create: PERMISSIONS.CAN_CREATE_DASHBOARDS,
        delete: PERMISSIONS.CAN_DELETE_DASHBOARDS,
      };
  }
}

export function getRolePermissions(
  resource: PermissionResource,
  hasPermission: HasPermission
): RolePermissions {
  const slugs = getRoleSlugs(resource);
  return {
    canView: slugs.view === null ? true : hasPermission(slugs.view),
    canCreate: hasPermission(slugs.create),
    canDelete: hasPermission(slugs.delete),
  };
}

/**
 * Edit on this specific row. The backend returns 'edit' for admin/super-admin, the owner,
 * direct/group Edit grants and Internal-mode edit defaults. Gates edit, share, email PDF
 * and comment moderation — the role slug is deliberately not ANDed in.
 */
export function hasEditAccess(accessLevel: string | null | undefined): boolean {
  return accessLevel === 'edit';
}

/**
 * Delete in a list row.
 * LIST-DRIFT: reports also require Edit on the row; charts and dashboards check only the role slug.
 */
export function canDeleteListRow(
  resource: PermissionResource,
  roleCanDelete: boolean,
  accessLevel: string | null | undefined
): boolean {
  return resource === 'report' ? roleCanDelete && hasEditAccess(accessLevel) : roleCanDelete;
}
