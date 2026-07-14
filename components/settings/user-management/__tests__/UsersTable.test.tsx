import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UsersTable } from '../UsersTable';
import { ROLES } from '@/lib/rbac';

const mockUpdateUserRole = jest.fn();
const mockMutate = jest.fn();

const RBAC_ROLES = [
  { uuid: 'uuid-admin', slug: ROLES.ADMIN, name: 'Admin' },
  { uuid: 'uuid-analyst', slug: ROLES.ANALYST, name: 'Analyst' },
  { uuid: 'uuid-member', slug: ROLES.MEMBER, name: 'Member' },
];

const USERS = [
  {
    user_id: 1,
    orguser_id: 11,
    email: 'admin@ngo.org',
    active: true,
    new_role_slug: 'org-admin',
    invited_by: null,
  },
  {
    user_id: 2,
    orguser_id: 12,
    email: 'meera@ngo.org',
    active: true,
    new_role_slug: 'org-analyst',
    invited_by: 'admin@ngo.org',
  },
];

const mockUseUsers = jest.fn(() => ({ users: USERS, isLoading: false, mutate: mockMutate }));

jest.mock('@/hooks/api/useUserManagement', () => ({
  useUsers: () => mockUseUsers(),
  useRoles: jest.fn(() => ({ roles: RBAC_ROLES })),
  useUserActions: jest.fn(() => ({ updateUserRole: mockUpdateUserRole })),
}));

jest.mock('@/lib/rbac', () => ({
  ...jest.requireActual('@/lib/rbac'),
  useRbac: () => ({ hasPermission: () => true }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ getCurrentOrgUser: () => ({ email: 'admin@ngo.org' }) }),
}));

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

describe('UsersTable — Created By column (Phase A / A1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a Created By header', () => {
    render(<UsersTable />);
    expect(screen.getByText('Created By')).toBeInTheDocument();
  });

  it("shows the inviter's avatar initial and email for an invited user", () => {
    render(<UsersTable />);

    const cell = screen.getByTestId('user-created-by-meera@ngo.org');
    expect(cell).toHaveTextContent('admin@ngo.org');
    // avatar circle shows the inviter's first initial, uppercased
    expect(within(cell).getByText('A')).toBeInTheDocument();
  });

  it('shows a dash for a user with no inviter (e.g. the first admin)', () => {
    render(<UsersTable />);

    expect(screen.getByTestId('user-created-by-admin@ngo.org')).toHaveTextContent('—');
  });
});

describe('UsersTable — kebab actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps Edit Role and Delete User inside the kebab dropdown', async () => {
    render(<UsersTable />);

    await userEvent.click(screen.getByTestId('user-actions-meera@ngo.org'));

    expect(screen.getByTestId('edit-role-menu-item-meera@ngo.org')).toBeInTheDocument();
    expect(screen.getByTestId('delete-user-menu-item-meera@ngo.org')).toBeInTheDocument();
  });
});
