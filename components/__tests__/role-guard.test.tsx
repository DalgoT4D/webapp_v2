import { render, screen } from '@testing-library/react';
import { RoleGuard } from '@/components/role-guard';

const mockGetCurrentOrgUser = jest.fn();

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn((selector) => {
    const state = { getCurrentOrgUser: mockGetCurrentOrgUser };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

describe('RoleGuard', () => {
  it('renders children when role is in allowedRoles', () => {
    mockGetCurrentOrgUser.mockReturnValue({ new_role_slug: 'analyst' });
    render(
      <RoleGuard allowedRoles={['admin', 'analyst']}>
        <div data-testid="content">page</div>
      </RoleGuard>
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('shows NoAccess when role is not in allowedRoles', () => {
    mockGetCurrentOrgUser.mockReturnValue({ new_role_slug: 'member' });
    render(
      <RoleGuard allowedRoles={['admin']}>
        <div data-testid="content">page</div>
      </RoleGuard>
    );
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    expect(screen.getByTestId('no-access')).toBeInTheDocument();
  });

  it('shows NoAccess for analyst on admin-only pages', () => {
    mockGetCurrentOrgUser.mockReturnValue({ new_role_slug: 'analyst' });
    render(
      <RoleGuard allowedRoles={['admin']}>
        <div data-testid="content">billing</div>
      </RoleGuard>
    );
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    expect(screen.getByTestId('no-access')).toBeInTheDocument();
  });
});
