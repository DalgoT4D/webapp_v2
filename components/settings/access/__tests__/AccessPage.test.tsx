import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccessPage from '../AccessPage';
import { useRbac, PERMISSIONS, ROLES, type Permission, type Role } from '@/lib/rbac';

const mockReplace = jest.fn();
let mockSearch = '';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/settings/access',
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ trackFeatureView: jest.fn(), trackEvent: jest.fn() }));

jest.mock('@/components/settings/user-management/UserManagement', () => ({
  __esModule: true,
  default: ({ showInviteDialog }: { showInviteDialog: boolean }) => (
    <div data-testid="people-panel">{showInviteDialog ? 'invite-dialog-open' : 'people'}</div>
  ),
}));
jest.mock('@/components/settings/groups/UserGroups', () => ({
  __esModule: true,
  default: ({ showCreateDialog }: { showCreateDialog: boolean }) => (
    <div data-testid="groups-panel">{showCreateDialog ? 'create-dialog-open' : 'groups'}</div>
  ),
}));
jest.mock('@/components/settings/access-management/AccessManagement', () => ({
  __esModule: true,
  default: () => <div data-testid="roles-panel">roles</div>,
}));

const mockUseRbac = useRbac as jest.Mock;

function setRbac({
  role = ROLES.ADMIN,
  permissions = [PERMISSIONS.CAN_CREATE_INVITATION, PERMISSIONS.CAN_MANAGE_USER_GROUPS],
}: { role?: Role; permissions?: Permission[] } = {}) {
  mockUseRbac.mockReturnValue({
    role,
    isLoaded: true,
    hasRole: (target: Role | Role[]) =>
      Array.isArray(target) ? target.includes(role) : target === role,
    hasPermission: (p: Permission) => permissions.includes(p),
    hasAnyPermission: (ps: Permission[]) => ps.some((p) => permissions.includes(p)),
    hasAllPermissions: (ps: Permission[]) => ps.every((p) => permissions.includes(p)),
  });
}

describe('AccessPage (Settings → Access)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearch = '';
  });

  it('shows heading, subtitle and all three tabs for an admin, defaulting to People', () => {
    setRbac({ role: ROLES.ADMIN });
    render(<AccessPage />);

    expect(screen.getByRole('heading', { name: 'Access' })).toBeInTheDocument();
    expect(
      screen.getByText('Manage users and set organization level permission defaults')
    ).toBeInTheDocument();
    expect(screen.getByTestId('access-tab-people')).toBeInTheDocument();
    expect(screen.getByTestId('access-tab-groups')).toBeInTheDocument();
    expect(screen.getByTestId('access-tab-roles')).toBeInTheDocument();
    expect(screen.getByTestId('people-panel')).toBeInTheDocument();
  });

  it('shows only the Groups tab for an analyst and defaults to it', () => {
    setRbac({ role: ROLES.ANALYST, permissions: [PERMISSIONS.CAN_MANAGE_USER_GROUPS] });
    render(<AccessPage />);

    expect(screen.queryByTestId('access-tab-people')).not.toBeInTheDocument();
    expect(screen.queryByTestId('access-tab-roles')).not.toBeInTheDocument();
    expect(screen.getByTestId('access-tab-groups')).toBeInTheDocument();
    expect(screen.getByTestId('groups-panel')).toBeInTheDocument();
  });

  it('sends an analyst deep-linking to a hidden tab to Groups instead of an error', () => {
    mockSearch = 'tab=people';
    setRbac({ role: ROLES.ANALYST, permissions: [PERMISSIONS.CAN_MANAGE_USER_GROUPS] });
    render(<AccessPage />);

    expect(screen.getByTestId('groups-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('people-panel')).not.toBeInTheDocument();
  });

  it('lands an admin deep-link ?tab=roles on the Roles tab', () => {
    mockSearch = 'tab=roles';
    setRbac({ role: ROLES.ADMIN });
    render(<AccessPage />);

    expect(screen.getByTestId('roles-panel')).toBeInTheDocument();
  });

  it('falls back to the first visible tab for an unknown ?tab value', () => {
    mockSearch = 'tab=bogus';
    setRbac({ role: ROLES.ADMIN });
    render(<AccessPage />);

    expect(screen.getByTestId('people-panel')).toBeInTheDocument();
  });

  it('swaps the header button with the tab: INVITE USER → CREATE GROUP → none', async () => {
    const user = userEvent.setup();
    setRbac({ role: ROLES.SUPER_ADMIN });
    render(<AccessPage />);

    // People tab: invite button only
    expect(screen.getByTestId('invite-user-button')).toBeInTheDocument();
    expect(screen.queryByTestId('groups-create-btn')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('access-tab-groups'));
    expect(screen.getByTestId('groups-create-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('invite-user-button')).not.toBeInTheDocument();
    expect(mockReplace).toHaveBeenCalledWith('/settings/access?tab=groups', { scroll: false });

    await user.click(screen.getByTestId('access-tab-roles'));
    expect(screen.queryByTestId('invite-user-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('groups-create-btn')).not.toBeInTheDocument();
  });

  it('disables INVITE USER without can_create_invitation and CREATE GROUP without can_manage_user_groups', async () => {
    const user = userEvent.setup();
    setRbac({ role: ROLES.ADMIN, permissions: [] });
    render(<AccessPage />);

    expect(screen.getByTestId('invite-user-button')).toBeDisabled();
    await user.click(screen.getByTestId('access-tab-groups'));
    expect(screen.getByTestId('groups-create-btn')).toBeDisabled();
  });

  it('opens the invite dialog in the People panel from the header button', async () => {
    const user = userEvent.setup();
    setRbac({ role: ROLES.ADMIN });
    render(<AccessPage />);

    await user.click(screen.getByTestId('invite-user-button'));
    expect(screen.getByTestId('people-panel')).toHaveTextContent('invite-dialog-open');
  });

  it('opens the create-group dialog in the Groups panel from the header button', async () => {
    const user = userEvent.setup();
    setRbac({ role: ROLES.ADMIN });
    render(<AccessPage />);

    await user.click(screen.getByTestId('access-tab-groups'));
    await user.click(screen.getByTestId('groups-create-btn'));
    expect(screen.getByTestId('groups-panel')).toHaveTextContent('create-dialog-open');
  });
});
