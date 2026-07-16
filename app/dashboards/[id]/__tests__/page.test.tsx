/**
 * DashboardViewPage 403 interception: a denied useDashboard renders
 * RequestAccessScreen instead of the dashboard views' own error states.
 * Child views are stubbed — covered by their own suites.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import DashboardViewPage from '../page';
import { useDashboard } from '@/hooks/api/useDashboards';
import { useRbac } from '@/lib/rbac';

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: '7' }),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/hooks/api/useDashboards');
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
jest.mock('@/components/dashboard/dashboard-native-view', () => ({
  DashboardNativeView: () => <div data-testid="stub-native-view" />,
}));
jest.mock('@/components/dashboard/individual-dashboard-view', () => ({
  IndividualDashboardView: () => <div data-testid="stub-superset-view" />,
}));
jest.mock('@/components/sharing/request-access-screen', () => ({
  RequestAccessScreen: ({ rtype, resourceId, resourceLabel }: any) => (
    <div data-testid="stub-request-access-screen">
      {rtype}:{resourceId}:{resourceLabel}
    </div>
  ),
}));

const mockUseDashboard = useDashboard as jest.Mock;
const mockUseRbac = useRbac as jest.Mock;

function setup(overrides: Partial<ReturnType<typeof useDashboard>> = {}) {
  mockUseRbac.mockReturnValue({
    hasPermission: () => true,
    role: 'member',
    isLoaded: true,
    hasRole: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });
  mockUseDashboard.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: undefined,
    mutate: jest.fn(),
    ...overrides,
  });
}

describe('DashboardViewPage — 403 interception', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders RequestAccessScreen when the dashboard fetch 403s', () => {
    const apiError = Object.assign(new Error('You do not have access to this dashboard'), {
      status: 403,
    });
    setup({ isError: apiError });

    render(<DashboardViewPage />);

    expect(screen.getByTestId('stub-request-access-screen')).toHaveTextContent(
      'dashboard:7:dashboard'
    );
    expect(screen.queryByTestId('stub-native-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-superset-view')).not.toBeInTheDocument();
  });

  it('renders the native dashboard view on a normal (non-403) load', () => {
    setup({ data: { dashboard_type: 'native' } as any });

    render(<DashboardViewPage />);

    expect(screen.getByTestId('stub-native-view')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-request-access-screen')).not.toBeInTheDocument();
  });

  it('does not treat a non-403 error (e.g. 404/500) as a request-access case', () => {
    const apiError = Object.assign(new Error('Dashboard not found'), { status: 404 });
    setup({ isError: apiError });

    render(<DashboardViewPage />);

    expect(screen.queryByTestId('stub-request-access-screen')).not.toBeInTheDocument();
  });
});
