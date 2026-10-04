import { PERMISSIONS, type Permission } from '@/lib/rbac';
import {
  canDeleteListRow,
  getRolePermissions,
  hasEditAccess,
} from '@/components/access/logic/resource-permissions';

const grantOnly =
  (...granted: Permission[]) =>
  (permission: Permission) =>
    granted.includes(permission);

describe('getRolePermissions', () => {
  it('charts use the chart slugs', () => {
    expect(
      getRolePermissions(
        'chart',
        grantOnly(PERMISSIONS.CAN_VIEW_CHARTS, PERMISSIONS.CAN_DELETE_CHARTS)
      )
    ).toEqual({ canView: true, canCreate: false, canDelete: true });
  });

  it('dashboards use the dashboard slugs', () => {
    expect(getRolePermissions('dashboard', grantOnly(PERMISSIONS.CAN_CREATE_DASHBOARDS))).toEqual({
      canView: false,
      canCreate: true,
      canDelete: false,
    });
  });

  it('reports reuse the dashboard create/delete slugs and have no view gate', () => {
    expect(getRolePermissions('report', grantOnly(PERMISSIONS.CAN_DELETE_DASHBOARDS))).toEqual({
      canView: true,
      canCreate: false,
      canDelete: true,
    });
    expect(getRolePermissions('report', grantOnly(PERMISSIONS.CAN_CREATE_CHARTS)).canCreate).toBe(
      false
    );
  });
});

describe('hasEditAccess', () => {
  it("is true only for 'edit'", () => {
    expect(hasEditAccess('edit')).toBe(true);
    expect(hasEditAccess('view')).toBe(false);
    expect(hasEditAccess(undefined)).toBe(false);
    expect(hasEditAccess(null)).toBe(false);
  });
});

describe('canDeleteListRow', () => {
  it('charts and dashboards: the role slug only (row access ignored)', () => {
    expect(canDeleteListRow('chart', true, 'view')).toBe(true);
    expect(canDeleteListRow('dashboard', true, undefined)).toBe(true);
    expect(canDeleteListRow('chart', false, 'edit')).toBe(false);
  });

  it('reports: role slug AND edit on the row (LIST-DRIFT)', () => {
    expect(canDeleteListRow('report', true, 'edit')).toBe(true);
    expect(canDeleteListRow('report', true, 'view')).toBe(false);
    expect(canDeleteListRow('report', false, 'edit')).toBe(false);
  });
});
