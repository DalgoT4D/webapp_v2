'use client';

import React from 'react';
import { NoAccess } from '@/components/no-access';
import { useAuthStore } from '@/stores/authStore';

// ============================================================================
// Roles — mirrors DDP_backend/seed/001_roles.json
// ============================================================================

export const ROLES = {
  SUPER_ADMIN: 'super-admin',
  ADMIN: 'admin',
  ANALYST: 'analyst',
  MEMBER: 'member',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Common role groupings — single source of truth for menu/page allow-lists.
// Member is never listed; they only see view-only pages that gate via permissions.
export const ADMIN_ROLES: Role[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN];
export const DATA_SECTION_ROLES: Role[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ANALYST];
export const ACCESS_PAGE_ROLES: Role[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ANALYST];

// ============================================================================
// Permissions — mirrors DDP_backend/seed/002_permissions.json (85 slugs)
// ============================================================================

export const PERMISSIONS = {
  // Sources
  CAN_VIEW_SOURCES: 'can_view_sources',
  CAN_VIEW_SOURCE: 'can_view_source',
  CAN_CREATE_SOURCE: 'can_create_source',
  CAN_EDIT_SOURCE: 'can_edit_source',
  CAN_DELETE_SOURCE: 'can_delete_source',

  // Warehouses
  CAN_VIEW_WAREHOUSES: 'can_view_warehouses',
  CAN_VIEW_WAREHOUSE: 'can_view_warehouse',
  CAN_CREATE_WAREHOUSE: 'can_create_warehouse',
  CAN_EDIT_WAREHOUSE: 'can_edit_warehouse',
  CAN_DELETE_WAREHOUSES: 'can_delete_warehouses',
  CAN_VIEW_WAREHOUSE_DATA: 'can_view_warehouse_data',

  // Connections
  CAN_VIEW_CONNECTIONS: 'can_view_connections',
  CAN_VIEW_CONNECTION: 'can_view_connection',
  CAN_CREATE_CONNECTION: 'can_create_connection',
  CAN_EDIT_CONNECTION: 'can_edit_connection',
  CAN_DELETE_CONNECTION: 'can_delete_connection',
  CAN_RESET_CONNECTION: 'can_reset_connection',
  CAN_SYNC_SOURCES: 'can_sync_sources',

  // Pipelines
  CAN_VIEW_PIPELINE_OVERVIEW: 'can_view_pipeline_overview',
  CAN_VIEW_PIPELINES: 'can_view_pipelines',
  CAN_VIEW_PIPELINE: 'can_view_pipeline',
  CAN_CREATE_PIPELINE: 'can_create_pipeline',
  CAN_EDIT_PIPELINE: 'can_edit_pipeline',
  CAN_DELETE_PIPELINE: 'can_delete_pipeline',
  CAN_RUN_PIPELINE: 'can_run_pipeline',

  // dbt workspace + models + operations
  CAN_VIEW_DBT_WORKSPACE: 'can_view_dbt_workspace',
  CAN_CREATE_DBT_WORKSPACE: 'can_create_dbt_workspace',
  CAN_EDIT_DBT_WORKSPACE: 'can_edit_dbt_workspace',
  CAN_DELETE_DBT_WORKSPACE: 'can_delete_dbt_workspace',
  CAN_CREATE_DBT_DOCS: 'can_create_dbt_docs',
  CAN_VIEW_DBT_MODELS: 'can_view_dbt_models',
  CAN_CREATE_DBT_MODEL: 'can_create_dbt_model',
  CAN_EDIT_DBT_MODEL: 'can_edit_dbt_model',
  CAN_DELETE_DBT_MODEL: 'can_delete_dbt_model',
  CAN_VIEW_DBT_OPERATION: 'can_view_dbt_operation',
  CAN_EDIT_DBT_OPERATION: 'can_edit_dbt_operation',
  CAN_DELETE_DBT_OPERATION: 'can_delete_dbt_operation',

  // Org tasks + master tasks
  CAN_VIEW_MASTER_TASKS: 'can_view_master_tasks',
  CAN_VIEW_MASTER_TASK: 'can_view_master_task',
  CAN_VIEW_ORGTASKS: 'can_view_orgtasks',
  CAN_CREATE_ORGTASK: 'can_create_orgtask',
  CAN_DELETE_ORGTASK: 'can_delete_orgtask',
  CAN_RUN_ORGTASK: 'can_run_orgtask',
  CAN_VIEW_TASK_PROGRESS: 'can_view_task_progress',

  // Org + org users + invitations
  CAN_CREATE_ORG: 'can_create_org',
  CAN_VIEW_ORGUSERS: 'can_view_orgusers',
  CAN_CREATE_ORGUSER: 'can_create_orguser',
  CAN_EDIT_ORGUSER: 'can_edit_orguser',
  CAN_DELETE_ORGUSER: 'can_delete_orguser',
  CAN_EDIT_ORGUSER_ROLE: 'can_edit_orguser_role',
  CAN_VIEW_INVITATIONS: 'can_view_invitations',
  CAN_CREATE_INVITATION: 'can_create_invitation',
  CAN_EDIT_INVITATION: 'can_edit_invitation',
  CAN_DELETE_INVITATION: 'can_delete_invitation',
  CAN_RESEND_EMAIL_VERIFICATION: 'can_resend_email_verification',
  CAN_VIEW_USER_GROUPS: 'can_view_user_groups',
  CAN_CREATE_USER_GROUP: 'can_create_user_group',
  CAN_EDIT_USER_GROUP: 'can_edit_user_group',
  CAN_DELETE_USER_GROUP: 'can_delete_user_group',
  CAN_MANAGE_ACCESS_DEFAULTS: 'can_manage_access_defaults',

  // Org-level settings
  CAN_VIEW_USAGE_DASHBOARD: 'can_view_usage_dashboard',
  CAN_VIEW_FLAGS: 'can_view_flags',
  CAN_EDIT_LLM_SETTINGS: 'can_edit_llm_settings',
  CAN_EDIT_ORG_NOTIFICATION_SETTINGS: 'can_edit_org_notification_settings',
  CAN_INITIATE_ORG_PLAN_UPGRADE: 'can_initiate_org_plan_upgrade',
  CAN_REQUEST_LLM_ANALYSIS_FEATURE: 'can_request_llm_analysis_feature',
  CAN_ACCEPT_TNC: 'can_accept_tnc',
  PUBLIC: 'public',

  // Dashboards
  CAN_VIEW_DASHBOARDS: 'can_view_dashboards',
  CAN_CREATE_DASHBOARDS: 'can_create_dashboards',
  CAN_EDIT_DASHBOARDS: 'can_edit_dashboards',
  CAN_DELETE_DASHBOARDS: 'can_delete_dashboards',
  CAN_SHARE_DASHBOARDS: 'can_share_dashboards',
  CAN_MANAGE_ORG_DEFAULT_DASHBOARD: 'can_manage_org_default_dashboard',

  // Charts
  CAN_VIEW_CHARTS: 'can_view_charts',
  CAN_CREATE_CHARTS: 'can_create_charts',
  CAN_EDIT_CHARTS: 'can_edit_charts',
  CAN_DELETE_CHARTS: 'can_delete_charts',

  // Metrics
  CAN_VIEW_METRICS: 'can_view_metrics',
  CAN_CREATE_METRICS: 'can_create_metrics',
  CAN_EDIT_METRICS: 'can_edit_metrics',
  CAN_DELETE_METRICS: 'can_delete_metrics',

  // KPIs
  CAN_VIEW_KPIS: 'can_view_kpis',
  CAN_CREATE_KPIS: 'can_create_kpis',
  CAN_EDIT_KPIS: 'can_edit_kpis',
  CAN_DELETE_KPIS: 'can_delete_kpis',

  // Alerts
  CAN_VIEW_ALERTS: 'can_view_alerts',
  CAN_CREATE_ALERTS: 'can_create_alerts',
  CAN_EDIT_ALERTS: 'can_edit_alerts',
  CAN_DELETE_ALERTS: 'can_delete_alerts',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ============================================================================
// Hook — the single way the rest of the app reads RBAC
// ============================================================================

export interface UseRbac {
  role: Role | null;
  // false while the auth store has no org user yet (login/org data still loading)
  isLoaded: boolean;
  hasRole: (target: Role | Role[]) => boolean;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
}

export function useRbac(): UseRbac {
  const getCurrentOrgUser = useAuthStore((state) => state.getCurrentOrgUser);
  const user = getCurrentOrgUser();

  // Memoized so the helpers keep a stable identity across re-renders — consumers
  // put hasPermission in useEffect/useCallback dependency arrays
  return React.useMemo(() => {
    const role = (user?.new_role_slug as Role | undefined) ?? null;
    const grantedSlugs = new Set<string>((user?.permissions ?? []).map((p) => p.slug));

    const hasRole = (target: Role | Role[]): boolean => {
      if (role === null) return false;
      return Array.isArray(target) ? target.includes(role) : role === target;
    };

    const hasPermission = (permission: Permission): boolean => grantedSlugs.has(permission);
    const hasAnyPermission = (permissions: Permission[]): boolean =>
      permissions.some((p) => grantedSlugs.has(p));
    const hasAllPermissions = (permissions: Permission[]): boolean =>
      permissions.every((p) => grantedSlugs.has(p));

    return {
      role,
      isLoaded: user !== null && user !== undefined,
      hasRole,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
    };
  }, [user]);
}

// ============================================================================
// Guards
// ============================================================================

interface RoleGuardProps {
  roles: Role | Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Page-level role gate. Use for menu items and full-page access.
// Default fallback is the <NoAccess /> screen; pass `fallback={null}` to hide silently.
export function RoleGuard({ roles, children, fallback = <NoAccess /> }: RoleGuardProps) {
  const { isLoaded, hasRole } = useRbac();
  // Wait until auth has loaded before rendering the fallback to avoid a flash —
  // but once loaded, a user without a role gets the fallback, not a blank page.
  if (!isLoaded) return null;
  if (!hasRole(roles)) return <>{fallback}</>;
  return <>{children}</>;
}

interface PermissionGuardProps {
  permission: Permission | Permission[];
  mode?: 'all' | 'any';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Action-level permission gate. Use for buttons, menu actions, table rows.
// Default fallback is null — the action just disappears for users without the permission.
export function PermissionGuard({
  permission,
  mode = 'all',
  children,
  fallback = null,
}: PermissionGuardProps) {
  const { hasAllPermissions, hasAnyPermission } = useRbac();
  const list = Array.isArray(permission) ? permission : [permission];
  const ok = mode === 'all' ? hasAllPermissions(list) : hasAnyPermission(list);
  return ok ? <>{children}</> : <>{fallback}</>;
}
