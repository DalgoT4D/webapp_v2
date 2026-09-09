import { getNavItems } from '@/components/main-layout';
import { ROLES } from '@/lib/rbac';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    currentOrg: null,
    getCurrentOrgUser: jest.fn(() => null),
  })),
}));

jest.mock('@/hooks/api/useFeatureFlags', () => ({
  useFeatureFlags: jest.fn(() => ({
    isFeatureFlagEnabled: jest.fn(() => false),
  })),
  FeatureFlagKeys: {
    REPORTS: 'reports',
    DATA_QUALITY: 'data_quality',
    USAGE_DASHBOARD: 'usage_dashboard',
  },
}));

jest.mock('@/hooks/api/useTransform', () => ({
  TransformTypeEnum: { UI: 'ui', DBT: 'dbt' },
  useTransformType: jest.fn(() => ({ transformType: undefined })),
}));

jest.mock('@/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: jest.fn(() => ({
    isDesktop: true,
    isMobile: false,
    isTablet: false,
  })),
}));

jest.mock('@/components/header', () => ({
  Header: () => null,
}));

describe('getNavItems', () => {
  it('shows the Data section for the member role (with Metrics + Alerts children)', () => {
    // Per resource-sharing spec §"Metrics & Alerts Governance": Members see the
    // Data parent, with only Metrics + Alerts as visible children (staff-only
    // children carry their own visibleToRoles).
    const items = getNavItems('/', false, () => false, undefined, ROLES.MEMBER);
    const dataItem = items.find((item) => item.title === 'Data');
    expect(dataItem?.hide).toBeFalsy();
  });

  it('shows Impact and KPIs for all roles including member', () => {
    for (const role of [ROLES.MEMBER, ROLES.ANALYST, ROLES.ADMIN]) {
      const items = getNavItems('/', false, () => false, undefined, role);
      expect(items.find((i) => i.title === 'Impact')?.hide).toBeFalsy();
      expect(items.find((i) => i.title === 'KPIs')?.hide).toBeFalsy();
    }
  });

  it('shows Dashboards, Charts, and Alerts for all roles including member', () => {
    const items = getNavItems('/', false, () => false, undefined, ROLES.MEMBER);
    expect(items.find((i) => i.title === 'Dashboards')?.hide).toBeFalsy();
    expect(items.find((i) => i.title === 'Charts')?.hide).toBeFalsy();
    expect(items.find((i) => i.title === 'Alerts')?.hide).toBeFalsy();
  });

  it('shows the Data section for the analyst role', () => {
    const items = getNavItems('/', false, () => false, undefined, ROLES.ANALYST);
    expect(items.find((i) => i.title === 'Data')?.hide).toBeFalsy();
  });

  it('shows the Access page for analyst role (Analysts can view/manage groups & floors)', () => {
    // Old test asserted "User Management" hidden for Analyst; that item was
    // renamed to "Access" and gated on ACCESS_PAGE_ROLES (includes Analyst)
    // as part of the resource-sharing feature.
    const items = getNavItems('/', false, () => false, undefined, ROLES.ANALYST);
    const settings = items.find((i) => i.title === 'Settings');
    const access = settings?.children?.find((c) => c.title === 'Access');
    expect(access).toBeDefined();
  });

  it('shows the Settings → Warehouse item for data roles but hides it for member', () => {
    for (const role of [ROLES.ANALYST, ROLES.ADMIN, ROLES.SUPER_ADMIN]) {
      const settings = getNavItems('/', false, () => false, undefined, role).find(
        (i) => i.title === 'Settings'
      );
      const warehouse = settings?.children?.find((c) => c.title === 'Warehouse');
      expect(warehouse?.href).toBe('/settings/warehouse');
      expect(warehouse?.hide).toBeFalsy();
    }
    const memberSettings = getNavItems('/', false, () => false, undefined, ROLES.MEMBER).find(
      (i) => i.title === 'Settings'
    );
    expect(memberSettings?.children?.find((c) => c.title === 'Warehouse')?.hide).toBe(true);
  });

  it('marks the Warehouse item active on /settings/warehouse', () => {
    const settings = getNavItems(
      '/settings/warehouse',
      false,
      () => false,
      undefined,
      ROLES.ADMIN
    ).find((i) => i.title === 'Settings');
    expect(settings?.children?.find((c) => c.title === 'Warehouse')?.isActive).toBe(true);
  });

  it('shows all items for the admin role', () => {
    const items = getNavItems('/', false, () => false, undefined, ROLES.ADMIN);
    expect(items.find((i) => i.title === 'Impact')?.hide).toBeFalsy();
    expect(items.find((i) => i.title === 'Data')?.hide).toBeFalsy();
    const settings = items.find((i) => i.title === 'Settings');
    expect(settings?.children?.find((c) => c.title === 'User Management')?.hide).toBeFalsy();
  });

  it('shows Data and User Management for super-admin', () => {
    const items = getNavItems('/', false, () => false, undefined, ROLES.SUPER_ADMIN);
    expect(items.find((i) => i.title === 'Data')?.hide).toBeFalsy();
    const settings = items.find((i) => i.title === 'Settings');
    expect(settings?.children?.find((c) => c.title === 'User Management')?.hide).toBeFalsy();
  });
});
