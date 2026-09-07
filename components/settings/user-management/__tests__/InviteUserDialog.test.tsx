import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InviteUserDialog } from '../InviteUserDialog';
import { ROLES } from '@/lib/rbac';

const mockInviteUser = jest.fn();
const mockMutate = jest.fn();
const mockGetCurrentOrgUser = jest.fn();

const RBAC_ROLES = [
  { uuid: 'uuid-admin', slug: ROLES.ADMIN, name: 'Admin' },
  { uuid: 'uuid-analyst', slug: ROLES.ANALYST, name: 'Analyst' },
  { uuid: 'uuid-member', slug: ROLES.MEMBER, name: 'Member' },
];

jest.mock('@/hooks/api/useUserManagement', () => ({
  useRoles: jest.fn(() => ({ roles: RBAC_ROLES })),
  useInvitationActions: jest.fn(() => ({ inviteUser: mockInviteUser })),
  useInvitations: jest.fn(() => ({ mutate: mockMutate })),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { getCurrentOrgUser: typeof mockGetCurrentOrgUser }) => unknown) =>
    selector({ getCurrentOrgUser: mockGetCurrentOrgUser }),
}));

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/constants/analytics', () => ({ ANALYTICS_EVENTS: { USER_INVITED: 'user_invited' } }));

describe('InviteUserDialog — RBAC v2 role dropdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: current user is admin so full picker is available
    mockGetCurrentOrgUser.mockReturnValue({ new_role_slug: ROLES.ADMIN });
  });

  it('renders exactly the role options provided by useRoles (admin, analyst, member)', async () => {
    render(<InviteUserDialog open={true} onOpenChange={jest.fn()} />);

    const trigger = screen.getByTestId('invite-role-select');
    await userEvent.click(trigger);

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('Admin')).toBeInTheDocument();
    expect(within(listbox).getByText('Analyst')).toBeInTheDocument();
    expect(within(listbox).getByText('Member')).toBeInTheDocument();
    expect(within(listbox).getAllByRole('option')).toHaveLength(3);
    expect(within(listbox).queryByText('Super Admin')).not.toBeInTheDocument();
    expect(within(listbox).queryByText('Pipeline Manager')).not.toBeInTheDocument();
    expect(within(listbox).queryByText('Account Manager')).not.toBeInTheDocument();
  });

  it('submits invitation with selected role uuid', async () => {
    mockInviteUser.mockResolvedValue(undefined);
    render(<InviteUserDialog open={true} onOpenChange={jest.fn()} />);

    await userEvent.type(screen.getByTestId('invite-email-input'), 'new@ngo.org');

    const trigger = screen.getByTestId('invite-role-select');
    await userEvent.click(trigger);

    const listbox = screen.getByRole('listbox');
    await userEvent.click(within(listbox).getByText('Analyst'));

    await userEvent.click(screen.getByTestId('invite-submit-button'));

    expect(mockInviteUser).toHaveBeenCalledWith({
      invited_email: 'new@ngo.org',
      invited_role_uuid: 'uuid-analyst',
    });
  });

  it('locks role to Member for analyst inviters', () => {
    mockGetCurrentOrgUser.mockReturnValue({ new_role_slug: ROLES.ANALYST });
    render(<InviteUserDialog open={true} onOpenChange={jest.fn()} />);

    // Trigger is disabled — analysts can't change the role
    expect(screen.getByTestId('invite-role-select')).toBeDisabled();
    // Explanatory hint is shown
    expect(screen.getByText(/only invite users as Member/i)).toBeInTheDocument();
  });

  it('locks role to Member for member inviters', () => {
    mockGetCurrentOrgUser.mockReturnValue({ new_role_slug: ROLES.MEMBER });
    render(<InviteUserDialog open={true} onOpenChange={jest.fn()} />);

    expect(screen.getByTestId('invite-role-select')).toBeDisabled();
    expect(screen.getByText(/only invite users as Member/i)).toBeInTheDocument();
  });

  it('auto-selects the Member role uuid for non-admin inviters on submit', async () => {
    mockGetCurrentOrgUser.mockReturnValue({ new_role_slug: ROLES.ANALYST });
    mockInviteUser.mockResolvedValue(undefined);

    render(<InviteUserDialog open={true} onOpenChange={jest.fn()} />);
    await userEvent.type(screen.getByTestId('invite-email-input'), 'invitee@ngo.org');
    await userEvent.click(screen.getByTestId('invite-submit-button'));

    expect(mockInviteUser).toHaveBeenCalledWith({
      invited_email: 'invitee@ngo.org',
      invited_role_uuid: 'uuid-member',
    });
  });
});
