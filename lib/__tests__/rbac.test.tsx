import { render, renderHook, screen } from '@testing-library/react';
import {
  ADMIN_ROLES,
  DATA_SECTION_ROLES,
  PERMISSIONS,
  PermissionGuard,
  ROLES,
  RoleGuard,
  useRbac,
} from '@/lib/rbac';

const mockGetCurrentOrgUser = jest.fn();

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn((selector) => {
    const state = { getCurrentOrgUser: mockGetCurrentOrgUser };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

function setUser(role: string | null, permissionSlugs: string[] = []) {
  mockGetCurrentOrgUser.mockReturnValue(
    role
      ? {
          new_role_slug: role,
          permissions: permissionSlugs.map((slug) => ({ slug, name: slug })),
        }
      : null
  );
}

describe('useRbac', () => {
  it('returns the role slug and matches single roles', () => {
    setUser(ROLES.ANALYST);
    const { result } = renderHook(() => useRbac());
    expect(result.current.role).toBe(ROLES.ANALYST);
    expect(result.current.hasRole(ROLES.ANALYST)).toBe(true);
    expect(result.current.hasRole(ROLES.ADMIN)).toBe(false);
  });

  it('matches roles via array', () => {
    setUser(ROLES.ADMIN);
    const { result } = renderHook(() => useRbac());
    expect(result.current.hasRole([ROLES.ADMIN, ROLES.SUPER_ADMIN])).toBe(true);
    expect(result.current.hasRole([ROLES.ANALYST, ROLES.MEMBER])).toBe(false);
  });

  it('returns false for hasRole when no user is loaded', () => {
    setUser(null);
    const { result } = renderHook(() => useRbac());
    expect(result.current.role).toBeNull();
    expect(result.current.hasRole(ROLES.ADMIN)).toBe(false);
  });

  it('checks single, any, and all permissions', () => {
    setUser(ROLES.ANALYST, [PERMISSIONS.CAN_VIEW_CHARTS, PERMISSIONS.CAN_CREATE_CHARTS]);
    const { result } = renderHook(() => useRbac());
    expect(result.current.hasPermission(PERMISSIONS.CAN_VIEW_CHARTS)).toBe(true);
    expect(result.current.hasPermission(PERMISSIONS.CAN_DELETE_CHARTS)).toBe(false);
    expect(
      result.current.hasAnyPermission([PERMISSIONS.CAN_DELETE_CHARTS, PERMISSIONS.CAN_VIEW_CHARTS])
    ).toBe(true);
    expect(
      result.current.hasAllPermissions([PERMISSIONS.CAN_VIEW_CHARTS, PERMISSIONS.CAN_CREATE_CHARTS])
    ).toBe(true);
    expect(
      result.current.hasAllPermissions([PERMISSIONS.CAN_VIEW_CHARTS, PERMISSIONS.CAN_DELETE_CHARTS])
    ).toBe(false);
  });

  it('treats a user with no permissions array as having no permissions', () => {
    mockGetCurrentOrgUser.mockReturnValue({ new_role_slug: ROLES.MEMBER, permissions: undefined });
    const { result } = renderHook(() => useRbac());
    expect(result.current.hasPermission(PERMISSIONS.CAN_VIEW_CHARTS)).toBe(false);
  });

  it('returns stable helper identities across re-renders for the same user', () => {
    setUser(ROLES.ANALYST, [PERMISSIONS.CAN_VIEW_CHARTS]);
    const { result, rerender } = renderHook(() => useRbac());
    const first = result.current;
    rerender();
    expect(result.current.hasPermission).toBe(first.hasPermission);
    expect(result.current.hasRole).toBe(first.hasRole);
    expect(result.current.hasAnyPermission).toBe(first.hasAnyPermission);
    expect(result.current.hasAllPermissions).toBe(first.hasAllPermissions);
  });
});

describe('RoleGuard', () => {
  it('renders children when the user has an allowed role', () => {
    setUser(ROLES.ANALYST);
    render(
      <RoleGuard roles={DATA_SECTION_ROLES}>
        <div data-testid="content">page</div>
      </RoleGuard>
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('renders <NoAccess /> by default when the user lacks the role', () => {
    setUser(ROLES.MEMBER);
    render(
      <RoleGuard roles={ADMIN_ROLES}>
        <div data-testid="content">billing</div>
      </RoleGuard>
    );
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    expect(screen.getByTestId('no-access')).toBeInTheDocument();
  });

  it('renders the supplied fallback instead of NoAccess', () => {
    setUser(ROLES.MEMBER);
    render(
      <RoleGuard roles={ADMIN_ROLES} fallback={<div data-testid="custom-fallback" />}>
        <div data-testid="content">billing</div>
      </RoleGuard>
    );
    expect(screen.queryByTestId('no-access')).not.toBeInTheDocument();
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
  });

  it('admits super-admin to admin-only sections', () => {
    setUser(ROLES.SUPER_ADMIN);
    render(
      <RoleGuard roles={ADMIN_ROLES}>
        <div data-testid="content">billing</div>
      </RoleGuard>
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('renders nothing while the user is still loading (no role)', () => {
    setUser(null);
    const { container } = render(
      <RoleGuard roles={ADMIN_ROLES}>
        <div data-testid="content">billing</div>
      </RoleGuard>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the fallback when the user is loaded but has no role (not a blank page)', () => {
    mockGetCurrentOrgUser.mockReturnValue({ new_role_slug: null, permissions: [] });
    render(
      <RoleGuard roles={ADMIN_ROLES}>
        <div data-testid="content">billing</div>
      </RoleGuard>
    );
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    expect(screen.getByTestId('no-access')).toBeInTheDocument();
  });
});

describe('PERMISSIONS — sharing slugs', () => {
  it('exposes the can_share_* slugs for reports, alerts, metrics, and kpis', () => {
    expect(PERMISSIONS.CAN_SHARE_REPORTS).toBe('can_share_reports');
    expect(PERMISSIONS.CAN_SHARE_ALERTS).toBe('can_share_alerts');
    expect(PERMISSIONS.CAN_SHARE_METRICS).toBe('can_share_metrics');
    expect(PERMISSIONS.CAN_SHARE_KPIS).toBe('can_share_kpis');
  });
});

describe('PERMISSIONS — user groups slugs', () => {
  it('exposes can_view_user_groups and can_manage_user_groups', () => {
    expect(PERMISSIONS.CAN_VIEW_USER_GROUPS).toBe('can_view_user_groups');
    expect(PERMISSIONS.CAN_MANAGE_USER_GROUPS).toBe('can_manage_user_groups');
  });
});

describe('PermissionGuard', () => {
  it('renders children when the permission is granted', () => {
    setUser(ROLES.ANALYST, [PERMISSIONS.CAN_CREATE_CHARTS]);
    render(
      <PermissionGuard permission={PERMISSIONS.CAN_CREATE_CHARTS}>
        <button data-testid="new-chart">New chart</button>
      </PermissionGuard>
    );
    expect(screen.getByTestId('new-chart')).toBeInTheDocument();
  });

  it('renders nothing when the permission is missing (default fallback)', () => {
    setUser(ROLES.MEMBER, [PERMISSIONS.CAN_VIEW_CHARTS]);
    const { container } = render(
      <PermissionGuard permission={PERMISSIONS.CAN_CREATE_CHARTS}>
        <button data-testid="new-chart">New chart</button>
      </PermissionGuard>
    );
    expect(screen.queryByTestId('new-chart')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('honors mode="any" — passes if at least one permission is granted', () => {
    setUser(ROLES.ANALYST, [PERMISSIONS.CAN_EDIT_CHARTS]);
    render(
      <PermissionGuard
        mode="any"
        permission={[PERMISSIONS.CAN_CREATE_CHARTS, PERMISSIONS.CAN_EDIT_CHARTS]}
      >
        <button data-testid="action">Action</button>
      </PermissionGuard>
    );
    expect(screen.getByTestId('action')).toBeInTheDocument();
  });

  it('honors mode="all" — blocks if any permission is missing', () => {
    setUser(ROLES.ANALYST, [PERMISSIONS.CAN_EDIT_CHARTS]);
    render(
      <PermissionGuard
        mode="all"
        permission={[PERMISSIONS.CAN_CREATE_CHARTS, PERMISSIONS.CAN_EDIT_CHARTS]}
      >
        <button data-testid="action">Action</button>
      </PermissionGuard>
    );
    expect(screen.queryByTestId('action')).not.toBeInTheDocument();
  });

  it('renders the supplied fallback when blocked', () => {
    setUser(ROLES.MEMBER);
    render(
      <PermissionGuard
        permission={PERMISSIONS.CAN_CREATE_CHARTS}
        fallback={<span data-testid="fallback" />}
      >
        <button data-testid="action">Action</button>
      </PermissionGuard>
    );
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });
});
