import { renderHook } from '@testing-library/react';
import { useResourcePermissions } from '@/components/access/hooks/useResourcePermissions';

jest.mock('@/lib/rbac', () => {
  const actual = jest.requireActual('@/lib/rbac');
  return {
    ...actual,
    useRbac: () => ({
      hasPermission: (permission: string) =>
        permission === actual.PERMISSIONS.CAN_DELETE_DASHBOARDS,
    }),
  };
});

describe('useResourcePermissions', () => {
  it('combines the role slugs with the row access level', () => {
    const { result } = renderHook(() => useResourcePermissions('report', 'view'));
    expect(result.current).toEqual({
      canView: true,
      canCreate: false,
      canDelete: true,
      hasEditAccess: false,
    });
  });

  it('without an access level, hasEditAccess is false', () => {
    const { result } = renderHook(() => useResourcePermissions('dashboard'));
    expect(result.current.hasEditAccess).toBe(false);
    expect(result.current.canDelete).toBe(true);
  });
});
