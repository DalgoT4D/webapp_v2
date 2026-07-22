import React from 'react';
import { render, screen } from '@testing-library/react';
import SettingsAccessPage from '../page';

const mockGetCurrentOrgUser = jest.fn();

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn((selector) => {
    const state = { getCurrentOrgUser: mockGetCurrentOrgUser };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

jest.mock('@/components/settings/access/AccessPage', () => ({
  __esModule: true,
  default: () => <div data-testid="access-page">Access</div>,
}));

function setRole(role: string | null) {
  mockGetCurrentOrgUser.mockReturnValue(role ? { new_role_slug: role, permissions: [] } : null);
}

describe('SettingsAccessPage (RoleGuard gating)', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['admin', 'super-admin', 'analyst'])('renders the Access page for %s', (role) => {
    setRole(role);
    render(<SettingsAccessPage />);
    expect(screen.getByTestId('access-page')).toBeInTheDocument();
  });

  it('does not render for a member — shows the no-access screen instead', () => {
    setRole('member');
    render(<SettingsAccessPage />);
    expect(screen.queryByTestId('access-page')).not.toBeInTheDocument();
  });
});
