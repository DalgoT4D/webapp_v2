/**
 * Admin InviteUserDialog — invites into a specific org (org id threaded through).
 * Focuses on the client-side validation gate; the invite/cap behavior itself is
 * covered by the backend suite.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InviteUserDialog } from '@/components/admin/InviteUserDialog';
import * as useAdminPortal from '@/hooks/api/useAdminPortal';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

jest.mock('@/hooks/api/useAdminPortal');

const mockTrackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));
jest.mock('@/hooks/api/useUserManagement', () => ({
  useRoles: () => ({ roles: [{ uuid: 'role-guest', name: 'Guest', slug: 'guest' }] }),
}));

const mockInvite = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  jest.clearAllMocks();
  (useAdminPortal.useAdminOrgUserActions as jest.Mock).mockReturnValue({
    inviteUser: mockInvite,
    changeRole: jest.fn(),
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
    const user = userEvent.setup({ delay: null });
    renderDialog();

    await user.click(screen.getByTestId('admin-invite-submit'));

    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Role is required')).toBeInTheDocument();
    expect(mockInvite).not.toHaveBeenCalled();
  });

  it('rejects an invalid email format without calling the invite hook', async () => {
    const user = userEvent.setup({ delay: null });
    renderDialog();

    await user.type(screen.getByTestId('admin-invite-email-input'), 'not-an-email');
    await user.click(screen.getByTestId('admin-invite-submit'));

    expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    expect(mockInvite).not.toHaveBeenCalled();
  });

  it('reports the invite on success, by role and never by email', async () => {
    const user = userEvent.setup({ delay: null });
    renderDialog();

    await user.type(screen.getByTestId('admin-invite-email-input'), 'priya@akshara.org');
    await user.click(screen.getByTestId('admin-invite-role-select'));
    await user.click(await screen.findByRole('option', { name: 'Guest' }));
    await user.click(screen.getByTestId('admin-invite-submit'));

    await waitFor(() =>
      expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.ADMIN_USER_INVITED, {
        role: 'guest',
      })
    );
    expect(JSON.stringify(mockTrackEvent.mock.calls)).not.toContain('priya@akshara.org');
  });

  it('does not report an invite that failed', async () => {
    const user = userEvent.setup({ delay: null });
    mockInvite.mockRejectedValueOnce(new Error('backend down'));
    renderDialog();

    await user.type(screen.getByTestId('admin-invite-email-input'), 'priya@akshara.org');
    await user.click(screen.getByTestId('admin-invite-role-select'));
    await user.click(await screen.findByRole('option', { name: 'Guest' }));
    await user.click(screen.getByTestId('admin-invite-submit'));

    await waitFor(() => expect(mockInvite).toHaveBeenCalled());
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});
