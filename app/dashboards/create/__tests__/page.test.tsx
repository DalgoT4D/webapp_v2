import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';

const createDashboard = jest.fn();
const replace = jest.fn();
const push = jest.fn();
const trackEvent = jest.fn();
let hasCreatePermission = true;

jest.mock('@/hooks/api/useDashboards', () => ({
  createDashboard: (...args: unknown[]) => createDashboard(...args),
}));
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace, push }) }));
jest.mock('@/lib/toast', () => ({
  toastSuccess: { created: jest.fn() },
  toastError: { create: jest.fn() },
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));
jest.mock('@/lib/rbac', () => ({
  PERMISSIONS: { CAN_CREATE_DASHBOARDS: 'can_create_dashboards' },
  useRbac: () => ({ hasPermission: () => hasCreatePermission }),
}));

import CreateDashboardPage from '../page';

describe('CreateDashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasCreatePermission = true;
    createDashboard.mockResolvedValue({ id: 42 });
  });

  // Regression: a state flag here reads its initial value on StrictMode's second
  // mount-effect pass, so the page POSTed twice and created two dashboards.
  it('creates exactly one dashboard under StrictMode double-invoked effects', async () => {
    render(
      <StrictMode>
        <CreateDashboardPage />
      </StrictMode>
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboards/42/edit?new=true'));
    expect(createDashboard).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('redirects to the dashboard list when creation fails', async () => {
    createDashboard.mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <StrictMode>
        <CreateDashboardPage />
      </StrictMode>
    );

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboards'));
    expect(createDashboard).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not create a dashboard without the create permission', async () => {
    hasCreatePermission = false;

    render(
      <StrictMode>
        <CreateDashboardPage />
      </StrictMode>
    );

    expect(await screen.findByText('Access Denied')).toBeInTheDocument();
    expect(createDashboard).not.toHaveBeenCalled();
  });
});
