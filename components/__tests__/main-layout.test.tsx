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
  it('hides the Data section for the member role', () => {
    const items = getNavItems('/', false, () => false, undefined, ROLES.MEMBER);
    const dataItem = items.find((item) => item.title === 'Data');
    expect(dataItem?.hide).toBe(true);
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

  it('hides Billing and User Management for analyst role', () => {
    const items = getNavItems('/', false, () => false, undefined, ROLES.ANALYST);
    const settings = items.find((i) => i.title === 'Settings');
    const billing = settings?.children?.find((c) => c.title === 'Billing');
    const userMgmt = settings?.children?.find((c) => c.title === 'User Management');
    expect(billing?.hide).toBe(true);
    expect(userMgmt?.hide).toBe(true);
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
    expect(settings?.children?.find((c) => c.title === 'Billing')?.hide).toBeFalsy();
  });

  it('shows Data, Billing, and User Management for super-admin', () => {
    const items = getNavItems('/', false, () => false, undefined, ROLES.SUPER_ADMIN);
    expect(items.find((i) => i.title === 'Data')?.hide).toBeFalsy();
    const settings = items.find((i) => i.title === 'Settings');
    expect(settings?.children?.find((c) => c.title === 'Billing')?.hide).toBeFalsy();
    expect(settings?.children?.find((c) => c.title === 'User Management')?.hide).toBeFalsy();
  });
});
