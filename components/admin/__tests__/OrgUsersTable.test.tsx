/**
 * OrgUsersTable — the admin Users tab: members (with per-org status + actions)
 * and pending invitations (with cancel). Verifies rendering and that the row
 * actions call the org-parameterized hooks with the org id threaded through.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrgUsersTable } from '@/components/admin/OrgUsersTable';
import * as useAdminPortal from '@/hooks/api/useAdminPortal';

jest.mock('@/hooks/api/useAdminPortal');
// the dialogs pull roles from useUserManagement; stub it so they render inertly
jest.mock('@/hooks/api/useUserManagement', () => ({
  useRoles: () => ({ roles: [{ uuid: 'r1', name: 'Guest', slug: 'guest' }] }),
}));

const ORG_ID = 42;

const users = [
  { orguser_id: 1, email: 'active@akshara.org', new_role_slug: 'account-manager', is_active: true },
  { orguser_id: 2, email: 'off@akshara.org', new_role_slug: 'guest', is_active: false },
];
const invitations = [
  {
    id: 9,
    invited_email: 'pending@akshara.org',
    invited_role_slug: 'guest',
    invited_on: '2026-07-14',
  },
];

const mockMutate = jest.fn().mockResolvedValue(undefined);
const mockDeactivate = jest.fn().mockResolvedValue(undefined);
const mockReactivate = jest.fn().mockResolvedValue(undefined);
const mockCancel = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  jest.clearAllMocks();
  (useAdminPortal.useAdminOrgUsers as jest.Mock).mockReturnValue({
    users,
    invitations,
    isLoading: false,
    mutate: mockMutate,
  });
  (useAdminPortal.useAdminOrgUserActions as jest.Mock).mockReturnValue({
    inviteUser: jest.fn(),
    changeRole: jest.fn(),
    deactivateUser: mockDeactivate,
    reactivateUser: mockReactivate,
    removeUser: jest.fn(),
    cancelInvitation: mockCancel,
  });
});

describe('OrgUsersTable', () => {
  it('renders a member row per user with role and per-org status', () => {
    render(<OrgUsersTable orgId={ORG_ID} />);
    expect(screen.getByText('active@akshara.org')).toBeInTheDocument();
    expect(screen.getByText('off@akshara.org')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('account-manager')).toBeInTheDocument();
  });

  it('lists pending invitations with a cancel action', () => {
    render(<OrgUsersTable orgId={ORG_ID} />);
    expect(screen.getByText('pending@akshara.org')).toBeInTheDocument();
    expect(screen.getByTestId('org-invite-cancel-9')).toBeInTheDocument();
  });

  it('deactivates an active member via the row action (org id threaded through)', async () => {
    const user = userEvent.setup();
    render(<OrgUsersTable orgId={ORG_ID} />);
    await user.click(screen.getByTestId('org-user-toggle-1'));
    expect(mockDeactivate).toHaveBeenCalledWith(ORG_ID, 1);
    await waitFor(() => expect(mockMutate).toHaveBeenCalled());
  });

  it('reactivates an inactive member via the row action', async () => {
    const user = userEvent.setup();
    render(<OrgUsersTable orgId={ORG_ID} />);
    await user.click(screen.getByTestId('org-user-toggle-2'));
    expect(mockReactivate).toHaveBeenCalledWith(ORG_ID, 2);
  });

  it('cancels a pending invitation scoped to this org', async () => {
    const user = userEvent.setup();
    render(<OrgUsersTable orgId={ORG_ID} />);
    await user.click(screen.getByTestId('org-invite-cancel-9'));
    expect(mockCancel).toHaveBeenCalledWith(ORG_ID, 9);
  });

  it('opens the remove dialog which fetches impact before allowing removal', async () => {
    const mockGetImpact = useAdminPortal.getRemovalImpact as jest.Mock;
    mockGetImpact.mockReturnValue(new Promise(() => {})); // never resolves
    const user = userEvent.setup();
    render(<OrgUsersTable orgId={ORG_ID} />);

    await user.click(screen.getByTestId('org-user-remove-1'));
    // the impact fetch fires for the right (org, user) and the confirm is gated off
    await waitFor(() => expect(mockGetImpact).toHaveBeenCalledWith(ORG_ID, 1));
    expect(screen.getByTestId('remove-user-confirm')).toBeDisabled();
  });
});
