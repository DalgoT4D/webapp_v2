import { render, screen } from '@testing-library/react';
import { DataSectionGuard } from '@/components/data-section-guard';

const mockGetCurrentOrgUser = jest.fn();

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn((selector) => {
    const state = { getCurrentOrgUser: mockGetCurrentOrgUser };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

describe('DataSectionGuard', () => {
  it('renders children for analyst role', () => {
    mockGetCurrentOrgUser.mockReturnValue({ new_role_slug: 'analyst' });
    render(
      <DataSectionGuard>
        <div data-testid="content">page content</div>
      </DataSectionGuard>
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.queryByTestId('no-access')).not.toBeInTheDocument();
  });

  it('shows NoAccess for member role', () => {
    mockGetCurrentOrgUser.mockReturnValue({ new_role_slug: 'member' });
    render(
      <DataSectionGuard>
        <div data-testid="content">page content</div>
      </DataSectionGuard>
    );
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    expect(screen.getByTestId('no-access')).toBeInTheDocument();
  });
});
