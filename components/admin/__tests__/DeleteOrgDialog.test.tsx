/**
 * DeleteOrgDialog — the safety guardrail for the destructive, hard-CASCADE delete
 * action. The non-negotiable requirement (mirrors RemoveUserDialog's plan.md §4.6
 * guardrail): the real deletion-impact counts MUST be fetched and shown BEFORE the
 * admin can confirm deletion. These tests prove the confirm cannot fire without the
 * impact data present.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteOrgDialog } from '@/components/admin/DeleteOrgDialog';
import * as useAdminPortal from '@/hooks/api/useAdminPortal';
import type { AdminOrg } from '@/hooks/api/useAdminPortal';

jest.mock('@/hooks/api/useAdminPortal');

const mockDeleteOrg = jest.fn().mockResolvedValue(undefined);
const mockGetOrgDeletionImpact = useAdminPortal.getOrgDeletionImpact as jest.Mock;

const org: AdminOrg = {
  id: 42,
  name: 'Akshara',
  slug: 'akshara',
  viz_url: null,
  base_plan: 'Free Trial',
  user_count: 3,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteOrg.mockResolvedValue(undefined);
  (useAdminPortal.useAdminOrgActions as jest.Mock).mockReturnValue({
    createOrg: jest.fn(),
    updateOrg: jest.fn(),
    deleteOrg: mockDeleteOrg,
  });
});

function renderDialog() {
  return render(<DeleteOrgDialog open onOpenChange={jest.fn()} org={org} onSuccess={jest.fn()} />);
}

describe('DeleteOrgDialog', () => {
  it('fetches and displays the real deletion-impact counts when opened', async () => {
    mockGetOrgDeletionImpact.mockResolvedValue({
      user_count: 3,
      warehouse_count: 1,
      connection_count: 2,
      pipeline_count: 4,
      dashboard_count: 5,
      chart_count: 6,
      report_count: 7,
    });

    renderDialog();

    expect(mockGetOrgDeletionImpact).toHaveBeenCalledWith(42);
    await waitFor(() =>
      expect(screen.getByTestId('org-deletion-impact-summary')).toBeInTheDocument()
    );
    expect(screen.getByTestId('org-deletion-impact-users').textContent).toContain('3');
    expect(screen.getByTestId('org-deletion-impact-warehouses').textContent).toContain('1');
    expect(screen.getByTestId('org-deletion-impact-connections').textContent).toContain('2');
    expect(screen.getByTestId('org-deletion-impact-pipelines').textContent).toContain('4');
    expect(screen.getByTestId('org-deletion-impact-dashboards').textContent).toContain('5');
    expect(screen.getByTestId('org-deletion-impact-charts').textContent).toContain('6');
    expect(screen.getByTestId('org-deletion-impact-reports').textContent).toContain('7');
  });

  it('CANNOT submit deletion while the impact is still loading (confirm disabled, no call)', async () => {
    // a promise that never resolves — impact never arrives
    mockGetOrgDeletionImpact.mockReturnValue(new Promise(() => {}));

    renderDialog();

    const confirm = screen.getByTestId('delete-org-confirm');
    expect(confirm).toBeDisabled();
    // even a forced click must not trigger the deletion
    fireEvent.click(confirm);
    expect(mockDeleteOrg).not.toHaveBeenCalled();
  });

  it('CANNOT submit deletion if the impact fetch fails (confirm stays disabled, no call)', async () => {
    mockGetOrgDeletionImpact.mockRejectedValue(new Error('network down'));

    renderDialog();

    await waitFor(() =>
      expect(screen.getByTestId('org-deletion-impact-error')).toBeInTheDocument()
    );
    const confirm = screen.getByTestId('delete-org-confirm');
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(mockDeleteOrg).not.toHaveBeenCalled();
  });

  it('allows deletion only after the counts are shown, then calls deleteOrg', async () => {
    mockGetOrgDeletionImpact.mockResolvedValue({
      user_count: 1,
      warehouse_count: 0,
      connection_count: 0,
      pipeline_count: 0,
      dashboard_count: 0,
      chart_count: 0,
      report_count: 0,
    });

    renderDialog();

    // wait until the impact summary is on screen — the gate is open
    await waitFor(() =>
      expect(screen.getByTestId('org-deletion-impact-summary')).toBeInTheDocument()
    );
    const confirm = screen.getByTestId('delete-org-confirm');
    expect(confirm).toBeEnabled();

    await userEvent.click(confirm);
    expect(mockDeleteOrg).toHaveBeenCalledWith(42);
  });
});
