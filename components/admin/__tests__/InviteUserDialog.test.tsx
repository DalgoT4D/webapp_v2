/**
 * Admin InviteUserDialog — invites into a specific org (org id threaded through).
 * Focuses on the client-side validation gate; the invite/cap behavior itself is
 * covered by the backend suite.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InviteUserDialog } from '@/components/admin/InviteUserDialog';
import * as useAdminPortal from '@/hooks/api/useAdminPortal';

jest.mock('@/hooks/api/useAdminPortal');
jest.mock('@/hooks/api/useUserManagement', () => ({
  useRoles: () => ({ roles: [{ uuid: 'role-guest', name: 'Guest', slug: 'guest' }] }),
}));

const mockInvite = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  jest.clearAllMocks();
  (useAdminPortal.useAdminOrgUserActions as jest.Mock).mockReturnValue({
    inviteUser: mockInvite,
    changeRole: jest.fn(),
    deactivateUser: jest.fn(),
    reactivateUser: jest.fn(),
    removeUser: jest.fn(),
    cancelInvitation: jest.fn(),
  });
});

function renderDialog() {
  return render(
    <InviteUserDialog open onOpenChange={jest.fn()} orgId={42} onSuccess={jest.fn()} />
  );
}

describe('Admin InviteUserDialog', () => {
  it('blocks submission and shows errors when email and role are empty', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByTestId('admin-invite-submit'));

    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Role is required')).toBeInTheDocument();
    expect(mockInvite).not.toHaveBeenCalled();
  });

  it('rejects an invalid email format without calling the invite hook', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByTestId('admin-invite-email-input'), 'not-an-email');
    await user.click(screen.getByTestId('admin-invite-submit'));

    expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    expect(mockInvite).not.toHaveBeenCalled();
  });
});
