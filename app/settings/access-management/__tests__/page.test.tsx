import React from 'react';
import { render, screen } from '@testing-library/react';
import AccessManagementPage from '../page';

const mockGetCurrentOrgUser = jest.fn();

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn((selector) => {
    const state = { getCurrentOrgUser: mockGetCurrentOrgUser };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

jest.mock('@/components/settings/access-management/AccessManagement', () => ({
  __esModule: true,
  default: () => <div data-testid="access-management-page">Access Management</div>,
}));

function setRole(role: string | null) {
  mockGetCurrentOrgUser.mockReturnValue(role ? { new_role_slug: role, permissions: [] } : null);
}

describe('AccessManagementPage (RoleGuard gating)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the Access Management page for an admin', () => {
    setRole('admin');
    render(<AccessManagementPage />);
    expect(screen.getByTestId('access-management-page')).toBeInTheDocument();
  });

  it('renders the Access Management page for a super-admin', () => {
    setRole('super-admin');
    render(<AccessManagementPage />);
    expect(screen.getByTestId('access-management-page')).toBeInTheDocument();
  });

  it('does not render the section for a non-admin (analyst) — shows the no-access screen instead', () => {
    setRole('analyst');
    render(<AccessManagementPage />);
    expect(screen.queryByTestId('access-management-page')).not.toBeInTheDocument();
  });

  it('does not render the section for a member', () => {
    setRole('member');
    render(<AccessManagementPage />);
    expect(screen.queryByTestId('access-management-page')).not.toBeInTheDocument();
  });
});
