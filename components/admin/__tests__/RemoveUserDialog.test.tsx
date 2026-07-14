/**
 * RemoveUserDialog — the safety guardrail for the destructive, cascading remove
 * action. The non-negotiable requirement (plan.md §4.6): the real removal-impact
 * counts MUST be fetched and shown BEFORE the user can confirm removal. These
 * tests prove the confirm cannot fire without the impact data present.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RemoveUserDialog } from '@/components/admin/RemoveUserDialog';
import * as useAdminPortal from '@/hooks/api/useAdminPortal';

jest.mock('@/hooks/api/useAdminPortal');

const mockRemoveUser = jest.fn().mockResolvedValue(undefined);
const mockGetRemovalImpact = useAdminPortal.getRemovalImpact as jest.Mock;

const orgUser = {
  orguser_id: 7,
  email: 'priya@akshara.org',
  new_role_slug: 'guest',
  is_active: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRemoveUser.mockResolvedValue(undefined);
  (useAdminPortal.useAdminOrgUserActions as jest.Mock).mockReturnValue({
    removeUser: mockRemoveUser,
    inviteUser: jest.fn(),
    changeRole: jest.fn(),
    deactivateUser: jest.fn(),
    reactivateUser: jest.fn(),
    cancelInvitation: jest.fn(),
  });
});

function renderDialog() {
  return render(
    <RemoveUserDialog
      open
      onOpenChange={jest.fn()}
      orgId={42}
      orgUser={orgUser}
      onSuccess={jest.fn()}
    />
  );
}

describe('RemoveUserDialog', () => {
  it('fetches and displays the real removal-impact counts when opened', async () => {
    mockGetRemovalImpact.mockResolvedValue({
      dashboards_orphaned: 3,
      charts_orphaned: 5,
      reports_orphaned: 2,
    });

    renderDialog();

    expect(mockGetRemovalImpact).toHaveBeenCalledWith(42, 7);
    await waitFor(() => expect(screen.getByTestId('removal-impact-summary')).toBeInTheDocument());
    expect(screen.getByTestId('removal-impact-dashboards').textContent).toContain('3');
    expect(screen.getByTestId('removal-impact-charts').textContent).toContain('5');
    expect(screen.getByTestId('removal-impact-reports').textContent).toContain('2');
  });

  it('CANNOT submit removal while the impact is still loading (confirm disabled, no call)', async () => {
    // a promise that never resolves — impact never arrives
    mockGetRemovalImpact.mockReturnValue(new Promise(() => {}));

    renderDialog();

    const confirm = screen.getByTestId('remove-user-confirm');
    expect(confirm).toBeDisabled();
    // even a forced click must not trigger the removal
    fireEvent.click(confirm);
    expect(mockRemoveUser).not.toHaveBeenCalled();
  });

  it('CANNOT submit removal if the impact fetch fails (confirm stays disabled, no call)', async () => {
    mockGetRemovalImpact.mockRejectedValue(new Error('network down'));

    renderDialog();

    await waitFor(() => expect(screen.getByTestId('removal-impact-error')).toBeInTheDocument());
    const confirm = screen.getByTestId('remove-user-confirm');
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(mockRemoveUser).not.toHaveBeenCalled();
  });

  it('allows removal only after the counts are shown, then calls removeUser', async () => {
    mockGetRemovalImpact.mockResolvedValue({
      dashboards_orphaned: 1,
      charts_orphaned: 0,
      reports_orphaned: 0,
    });

    renderDialog();

    // wait until the impact summary is on screen — the gate is open
    await waitFor(() => expect(screen.getByTestId('removal-impact-summary')).toBeInTheDocument());
    const confirm = screen.getByTestId('remove-user-confirm');
    expect(confirm).toBeEnabled();

    await userEvent.click(confirm);
    expect(mockRemoveUser).toHaveBeenCalledWith(42, 7);
  });
});
