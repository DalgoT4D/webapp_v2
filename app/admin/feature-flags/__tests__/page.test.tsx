/**
 * FeatureFlagsPage — the portal-wide feature-flags view: pick a flag, see every
 * org's current status in a table, and flip any org's toggle immediately (no
 * select-then-apply step, no multi-select).
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeatureFlagsPage from '@/app/admin/feature-flags/page';
import * as useAdminPortal from '@/hooks/api/useAdminPortal';

jest.mock('@/hooks/api/useAdminPortal');

const catalog = [
  { flag_name: 'REPORTS', description: 'Enable reports feature' },
  { flag_name: 'DATA_QUALITY', description: 'Elementary data quality reports' },
];

const orgFlags = [
  { org_id: 1, org_name: 'Akshara', enabled: true },
  { org_id: 2, org_name: 'Bhumi', enabled: false },
];

const mockSetOrgFlag = jest.fn();
const mockMutate = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  jest.clearAllMocks();
  mockSetOrgFlag.mockResolvedValue({ REPORTS: true });
  (useAdminPortal.useAdminFlagCatalog as jest.Mock).mockReturnValue({
    catalog,
    isLoading: false,
  });
  (useAdminPortal.useAdminFlagOrgs as jest.Mock).mockReturnValue({
    orgFlags,
    isLoading: false,
    mutate: mockMutate,
  });
  (useAdminPortal.useAdminFlagActions as jest.Mock).mockReturnValue({
    setOrgFlag: mockSetOrgFlag,
    clearOrgFlag: jest.fn(),
  });
});

const selectFlag = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByTestId('flag-select'));
  await user.click(await screen.findByText(/REPORTS/));
};

describe('FeatureFlagsPage', () => {
  it('shows no org table until a flag is chosen', () => {
    render(<FeatureFlagsPage />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders a table row per org with its current status, once a flag is chosen', async () => {
    const user = userEvent.setup();
    render(<FeatureFlagsPage />);

    await selectFlag(user);

    expect(screen.getByTestId('flags-org-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('flags-org-switch-1')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByTestId('flags-org-switch-2')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByText('Akshara')).toBeInTheDocument();
    expect(screen.getByText('Bhumi')).toBeInTheDocument();
  });

  it('toggling a row fires immediately for that org only, with no select-then-apply step', async () => {
    const user = userEvent.setup();
    render(<FeatureFlagsPage />);
    await selectFlag(user);

    await user.click(screen.getByTestId('flags-org-switch-2'));

    await waitFor(() => expect(mockSetOrgFlag).toHaveBeenCalledWith(2, 'REPORTS', true));
    expect(mockSetOrgFlag).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: /apply|turn on|turn off/i })
    ).not.toBeInTheDocument();
  });

  it("a failed toggle surfaces an error on only that org's row, leaving other rows untouched", async () => {
    mockSetOrgFlag.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    render(<FeatureFlagsPage />);
    await selectFlag(user);

    await user.click(screen.getByTestId('flags-org-switch-2'));

    expect(await screen.findByTestId('flags-org-error-2')).toBeInTheDocument();
    expect(screen.queryByTestId('flags-org-error-1')).not.toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('has no multi-select org picker or Apply controls anywhere on the page', async () => {
    const user = userEvent.setup();
    render(<FeatureFlagsPage />);
    await selectFlag(user);

    expect(screen.queryByTestId('org-picker')).not.toBeInTheDocument();
    expect(screen.queryByTestId('flags-turn-on')).not.toBeInTheDocument();
    expect(screen.queryByTestId('flags-turn-off')).not.toBeInTheDocument();
  });
});
