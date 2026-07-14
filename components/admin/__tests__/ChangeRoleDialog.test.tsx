/**
 * Admin ChangeRoleDialog — preselects the user's current role and submits the
 * new role scoped to the org. The role-cap-skip behavior is a backend concern;
 * here we verify the dialog wires the org id + orguser id + role uuid through.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangeRoleDialog } from '@/components/admin/ChangeRoleDialog';
import * as useAdminPortal from '@/hooks/api/useAdminPortal';

jest.mock('@/hooks/api/useAdminPortal');
jest.mock('@/hooks/api/useUserManagement', () => ({
  useRoles: () => ({
    roles: [
      { uuid: 'role-guest', name: 'Guest', slug: 'guest' },
      { uuid: 'role-analyst', name: 'Analyst', slug: 'analyst' },
    ],
  }),
}));

const mockChangeRole = jest.fn().mockResolvedValue(undefined);

const orgUser = {
  orguser_id: 7,
  email: 'priya@akshara.org',
  new_role_slug: 'guest',
  is_active: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  (useAdminPortal.useAdminOrgUserActions as jest.Mock).mockReturnValue({
    inviteUser: jest.fn(),
    changeRole: mockChangeRole,
    deactivateUser: jest.fn(),
    reactivateUser: jest.fn(),
    removeUser: jest.fn(),
    cancelInvitation: jest.fn(),
  });
});

describe('Admin ChangeRoleDialog', () => {
  it('preselects the current role and submits it with the org + user ids', async () => {
    const user = userEvent.setup();
    render(
      <ChangeRoleDialog
        open
        onOpenChange={jest.fn()}
        orgId={42}
        orgUser={orgUser}
        onSuccess={jest.fn()}
      />
    );

    // the current role (guest) is preselected by the effect, so Save is enabled
    const save = screen.getByTestId('admin-change-role-submit');
    await waitFor(() => expect(save).toBeEnabled());

    await user.click(save);
    expect(mockChangeRole).toHaveBeenCalledWith(42, 7, 'role-guest');
  });
});
