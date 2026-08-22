/**
 * FeatureFlagsPage — the portal-wide multi-org view: pick a flag, pick one or more
 * orgs, apply on/off in one action, see a per-org result (which succeeded, which
 * failed) rather than an all-or-nothing outcome.
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

const orgs = [
  { id: 1, name: 'Akshara', slug: 'akshara', viz_url: null, base_plan: 'Dalgo', user_count: 5 },
  { id: 2, name: 'Bhumi', slug: 'bhumi', viz_url: null, base_plan: 'Free Trial', user_count: 2 },
];

const mockBulkSetFlag = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAdminPortal.useAdminFlagCatalog as jest.Mock).mockReturnValue({
    catalog,
    isLoading: false,
  });
  (useAdminPortal.useAdminOrgs as jest.Mock).mockReturnValue({
    orgs,
    isLoading: false,
  });
  (useAdminPortal.useAdminFlagActions as jest.Mock).mockReturnValue({
    setOrgFlag: jest.fn(),
    clearOrgFlag: jest.fn(),
    bulkSetFlag: mockBulkSetFlag,
  });
});

const selectFlagAndOrgs = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByTestId('flag-select'));
  await user.click(await screen.findByText(/REPORTS/));

  await user.click(screen.getByTestId('org-picker-search'));
  const listbox = await screen.findByRole('listbox');
  const akshara = await screen.findByText('Akshara');
  await user.click(akshara);
  const bhumi = await screen.findByText('Bhumi');
  await user.click(bhumi);
  return listbox;
};

describe('FeatureFlagsPage', () => {
  it('applies a flag on for the selected orgs and shows a per-org result', async () => {
    mockBulkSetFlag.mockResolvedValueOnce([
      { org_id: 1, success: true },
      { org_id: 2, success: false },
    ]);
    const user = userEvent.setup();
    render(<FeatureFlagsPage />);

    await selectFlagAndOrgs(user);
    await user.click(screen.getByTestId('flags-turn-on'));

    await waitFor(() => expect(mockBulkSetFlag).toHaveBeenCalledWith('REPORTS', [1, 2], true));
    expect(await screen.findByTestId('flags-result-1')).toHaveTextContent('Succeeded');
    expect(await screen.findByTestId('flags-result-2')).toHaveTextContent('Failed');
  });

  it('disables apply until a flag and at least one org are selected', () => {
    render(<FeatureFlagsPage />);
    expect(screen.getByTestId('flags-turn-on')).toBeDisabled();
    expect(screen.getByTestId('flags-turn-off')).toBeDisabled();
  });
});
