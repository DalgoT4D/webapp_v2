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

  it('hides Billing but shows Access for analyst role', () => {
    const items = getNavItems('/', false, () => false, undefined, ROLES.ANALYST);
    const settings = items.find((i) => i.title === 'Settings');
    const billing = settings?.children?.find((c) => c.title === 'Billing');
    const access = settings?.children?.find((c) => c.title === 'Access');
    expect(billing?.hide).toBe(true);
    // Analysts can open Settings → Access for the Groups tab (DATA_SECTION_ROLES)
    expect(access?.hide).toBeFalsy();
  });

  it('hides Access for the member role', () => {
    const items = getNavItems('/', false, () => false, undefined, ROLES.MEMBER);
    const settings = items.find((i) => i.title === 'Settings');
    const access = settings?.children?.find((c) => c.title === 'Access');
    expect(access?.hide).toBe(true);
  });

  it('has a single Access entry instead of the three legacy settings links', () => {
    const items = getNavItems('/', false, () => false, undefined, ROLES.ADMIN);
    const settings = items.find((i) => i.title === 'Settings');
    const titles = settings?.children?.map((c) => c.title) ?? [];
    expect(titles).toContain('Access');
    expect(titles).not.toContain('User Management');
    expect(titles).not.toContain('Groups');
    expect(titles).not.toContain('Access Management');
    expect(settings?.children?.find((c) => c.title === 'Access')?.href).toBe('/settings/access');
  });

  it('shows all items for the admin role', () => {
    const items = getNavItems('/', false, () => false, undefined, ROLES.ADMIN);
    expect(items.find((i) => i.title === 'Impact')?.hide).toBeFalsy();
    expect(items.find((i) => i.title === 'Data')?.hide).toBeFalsy();
    const settings = items.find((i) => i.title === 'Settings');
    expect(settings?.children?.find((c) => c.title === 'Billing')?.hide).toBeFalsy();
  });

  it('shows Data, Billing, and Access for super-admin', () => {
    const items = getNavItems('/', false, () => false, undefined, ROLES.SUPER_ADMIN);
    expect(items.find((i) => i.title === 'Data')?.hide).toBeFalsy();
    const settings = items.find((i) => i.title === 'Settings');
    expect(settings?.children?.find((c) => c.title === 'Billing')?.hide).toBeFalsy();
    expect(settings?.children?.find((c) => c.title === 'Access')?.hide).toBeFalsy();
  });
});
