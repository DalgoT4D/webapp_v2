import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PeopleTable } from '../PeopleTable';
import { ROLES, PERMISSIONS } from '@/lib/rbac';

const mockUpdateUserRole = jest.fn();
const mockDeleteUser = jest.fn();
const mockResendInvitation = jest.fn();
const mockDeleteInvitation = jest.fn();
const mockMutateUsers = jest.fn();
const mockMutateInvitations = jest.fn();

const RBAC_ROLES = [
  { uuid: 'uuid-admin', slug: ROLES.ADMIN, name: 'Admin' },
  { uuid: 'uuid-analyst', slug: ROLES.ANALYST, name: 'Analyst' },
  { uuid: 'uuid-pipeline', slug: 'pipeline-manager', name: 'Pipeline Manager' },
];

const USERS = [
  {
    user_id: 1,
    orguser_id: 11,
    email: 'admin@ngo.org',
    active: true,
    new_role_slug: ROLES.ADMIN,
    invited_by: null,
  },
  {
    user_id: 2,
    orguser_id: 12,
    email: 'meera@ngo.org',
    active: true,
    new_role_slug: 'pipeline-manager',
    invited_by: 'admin@ngo.org',
  },
];

const INVITATIONS = [
  {
    id: 101,
    invited_email: 'zubin@ngo.org',
    invited_role: { uuid: 'uuid-pipeline', name: 'Pipeline Manager' },
    invited_on: '2026-01-01T00:00:00Z',
  },
];

const mockUseUsers = jest.fn(() => ({ users: USERS, isLoading: false, mutate: mockMutateUsers }));
const mockUseInvitations = jest.fn(() => ({
  invitations: INVITATIONS,
  isLoading: false,
  mutate: mockMutateInvitations,
}));

jest.mock('@/hooks/api/useUserManagement', () => ({
  useUsers: () => mockUseUsers(),
  useInvitations: () => mockUseInvitations(),
  useRoles: jest.fn(() => ({ roles: RBAC_ROLES })),
  useUserActions: jest.fn(() => ({
    updateUserRole: mockUpdateUserRole,
    deleteUser: mockDeleteUser,
  })),
  useInvitationActions: jest.fn(() => ({
    resendInvitation: mockResendInvitation,
    deleteInvitation: mockDeleteInvitation,
  })),
}));

let mockPermissions: string[] = [
  PERMISSIONS.CAN_VIEW_INVITATIONS,
  PERMISSIONS.CAN_EDIT_ORGUSER,
  PERMISSIONS.CAN_DELETE_ORGUSER,
  PERMISSIONS.CAN_RESEND_EMAIL_VERIFICATION,
  PERMISSIONS.CAN_DELETE_INVITATION,
];

jest.mock('@/lib/rbac', () => ({
  ...jest.requireActual('@/lib/rbac'),
  useRbac: () => ({ hasPermission: (p: string) => mockPermissions.includes(p) }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ getCurrentOrgUser: () => ({ email: 'admin@ngo.org' }) }),
}));

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

describe('PeopleTable — merged rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissions = [
      PERMISSIONS.CAN_VIEW_INVITATIONS,
      PERMISSIONS.CAN_EDIT_ORGUSER,
      PERMISSIONS.CAN_DELETE_ORGUSER,
      PERMISSIONS.CAN_RESEND_EMAIL_VERIFICATION,
      PERMISSIONS.CAN_DELETE_INVITATION,
    ];
    mockUseUsers.mockReturnValue({ users: USERS, isLoading: false, mutate: mockMutateUsers });
    mockUseInvitations.mockReturnValue({
      invitations: INVITATIONS,
      isLoading: false,
      mutate: mockMutateInvitations,
    });
  });

  it('renders one table with both active users and pending invitations', () => {
    render(<PeopleTable />);

    expect(screen.getByText('meera@ngo.org')).toBeInTheDocument();
    expect(screen.getByText('zubin@ngo.org')).toBeInTheDocument();
    // no secondary Users/Pending tabs anywhere in this view
    expect(screen.queryByTestId('tab-users')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-pending')).not.toBeInTheDocument();
  });

  it('shows a person icon for active rows and an envelope icon for pending rows', () => {
    render(<PeopleTable />);

    expect(screen.getByTestId('row-icon-meera@ngo.org')).toHaveAttribute('data-icon', 'user');
    expect(screen.getByTestId('row-icon-zubin@ngo.org')).toHaveAttribute('data-icon', 'mail');
  });

  it('shows the invited role for a pending row', () => {
    render(<PeopleTable />);

    const row = screen.getByText('zubin@ngo.org').closest('tr') as HTMLElement;
    expect(within(row).getByText('Pipeline Manager')).toBeInTheDocument();
  });

  it("shows the inviter's avatar initial and email for an active invited user", () => {
    render(<PeopleTable />);

    const cell = screen.getByTestId('user-created-by-meera@ngo.org');
    expect(cell).toHaveTextContent('admin@ngo.org');
    expect(within(cell).getByText('A')).toBeInTheDocument();
  });

  it('shows a dash for an active user with no inviter (e.g. the first admin)', () => {
    render(<PeopleTable />);

    expect(screen.getByTestId('user-created-by-admin@ngo.org')).toHaveTextContent('—');
  });

  it("shows the current admin's email as Created By for a pending row (invitations list is always self-sent)", () => {
    render(<PeopleTable />);

    expect(screen.getByTestId('invitation-created-by-101')).toHaveTextContent('admin@ngo.org');
  });
});

describe('PeopleTable — per-state action menus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gives an active row Edit Role and Delete User', async () => {
    render(<PeopleTable />);

    await userEvent.click(screen.getByTestId('user-actions-meera@ngo.org'));

    expect(screen.getByTestId('edit-role-menu-item-meera@ngo.org')).toBeInTheDocument();
    expect(screen.getByTestId('delete-user-menu-item-meera@ngo.org')).toBeInTheDocument();
  });

  it('gives a pending row Resend and Delete (invitation actions), not user actions', async () => {
    render(<PeopleTable />);

    await userEvent.click(screen.getByTestId('invitation-actions-101'));

    expect(screen.getByTestId('resend-invitation-101')).toBeInTheDocument();
    expect(screen.getByTestId('delete-invitation-101')).toBeInTheDocument();
  });

  it('disables the kebab for the signed-in user\'s own active row', () => {
    render(<PeopleTable />);

    expect(screen.queryByTestId('user-actions-admin@ngo.org')).not.toBeInTheDocument();
  });
});

describe('PeopleTable — sort over the merged set', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sorts by Email across both active and pending rows', async () => {
    render(<PeopleTable />);

    // Default sort is Email asc; one click flips to desc.
    await userEvent.click(screen.getByTestId('sort-email-button'));

    const emails = screen.getAllByRole('row').slice(1).map((row) => row.textContent);
    // desc order: zubin, meera, admin
    expect(emails[0]).toContain('zubin@ngo.org');
    expect(emails[2]).toContain('admin@ngo.org');
  });

  it('sorts by Role across both active and pending rows', async () => {
    render(<PeopleTable />);

    await userEvent.click(screen.getByTestId('sort-role-button'));

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('admin@ngo.org'); // "Admin" sorts before "Pipeline Manager"
  });

  it('sorts by Created By across both active and pending rows', async () => {
    render(<PeopleTable />);

    await userEvent.click(screen.getByTestId('sort-createdBy-button'));

    // admin@ngo.org (no inviter, dash) should sort before rows with an inviter
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('admin@ngo.org');
  });
});

describe('PeopleTable — filters over the merged set', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters by email across active and pending rows', async () => {
    render(<PeopleTable />);

    await userEvent.click(screen.getByTestId('filter-email-button'));
    await userEvent.type(screen.getByLabelText('Filter by Email'), 'zubin');

    expect(screen.getByText('zubin@ngo.org')).toBeInTheDocument();
    expect(screen.queryByText('meera@ngo.org')).not.toBeInTheDocument();
  });

  it('filters by role across active and pending rows', async () => {
    render(<PeopleTable />);

    await userEvent.click(screen.getByTestId('filter-role-button'));
    await userEvent.click(screen.getByLabelText('Pipeline Manager'));

    // both meera (active, pipeline-manager) and zubin (pending, Pipeline Manager) match;
    // admin's own row (role "Admin") is filtered out. Note admin@ngo.org still appears as
    // meera's inviter text in the Created By cell, so assert on the row testid, not the text.
    expect(screen.getByText('meera@ngo.org')).toBeInTheDocument();
    expect(screen.getByText('zubin@ngo.org')).toBeInTheDocument();
    expect(screen.queryByTestId('user-created-by-admin@ngo.org')).not.toBeInTheDocument();
  });
});

describe('PeopleTable — RBAC gating of invitations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUsers.mockReturnValue({ users: USERS, isLoading: false, mutate: mockMutateUsers });
    mockUseInvitations.mockReturnValue({
      invitations: INVITATIONS,
      isLoading: false,
      mutate: mockMutateInvitations,
    });
  });

  it('omits pending invitations entirely when the viewer lacks can_view_invitations', () => {
    mockPermissions = [PERMISSIONS.CAN_EDIT_ORGUSER, PERMISSIONS.CAN_DELETE_ORGUSER];
    render(<PeopleTable />);

    expect(screen.queryByText('zubin@ngo.org')).not.toBeInTheDocument();
    expect(screen.getByText('meera@ngo.org')).toBeInTheDocument();
  });
});

describe('PeopleTable — empty state (no other users AND no pending invitations)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissions = [
      PERMISSIONS.CAN_VIEW_INVITATIONS,
      PERMISSIONS.CAN_EDIT_ORGUSER,
      PERMISSIONS.CAN_DELETE_ORGUSER,
      PERMISSIONS.CAN_RESEND_EMAIL_VERIFICATION,
      PERMISSIONS.CAN_DELETE_INVITATION,
    ];
  });

  it('shows "No people yet" when there are no other active users and no pending invitations', () => {
    mockUseUsers.mockReturnValue({ users: [USERS[0]], isLoading: false, mutate: mockMutateUsers });
    mockUseInvitations.mockReturnValue({ invitations: [], isLoading: false, mutate: mockMutateInvitations });

    render(<PeopleTable />);

    expect(screen.getByTestId('users-empty-state')).toBeInTheDocument();
    expect(screen.getByText('No people yet')).toBeInTheDocument();
  });

  it('does NOT show the empty state when a pending invitation exists, even with no other active users', () => {
    mockUseUsers.mockReturnValue({ users: [USERS[0]], isLoading: false, mutate: mockMutateUsers });
    mockUseInvitations.mockReturnValue({
      invitations: INVITATIONS,
      isLoading: false,
      mutate: mockMutateInvitations,
    });

    render(<PeopleTable />);

    expect(screen.queryByTestId('users-empty-state')).not.toBeInTheDocument();
    expect(screen.getByText('zubin@ngo.org')).toBeInTheDocument();
  });

  it('does NOT show the empty state when another active user exists, even with no pending invitations', () => {
    mockUseUsers.mockReturnValue({ users: USERS, isLoading: false, mutate: mockMutateUsers });
    mockUseInvitations.mockReturnValue({ invitations: [], isLoading: false, mutate: mockMutateInvitations });

    render(<PeopleTable />);

    expect(screen.queryByTestId('users-empty-state')).not.toBeInTheDocument();
    expect(screen.getByText('meera@ngo.org')).toBeInTheDocument();
  });

  it('calls onInviteClick from the empty-state CTA', async () => {
    mockUseUsers.mockReturnValue({ users: [USERS[0]], isLoading: false, mutate: mockMutateUsers });
    mockUseInvitations.mockReturnValue({ invitations: [], isLoading: false, mutate: mockMutateInvitations });
    const onInviteClick = jest.fn();

    render(<PeopleTable onInviteClick={onInviteClick} />);

    await userEvent.click(screen.getByTestId('users-empty-invite-btn'));
    expect(onInviteClick).toHaveBeenCalled();
  });
});
