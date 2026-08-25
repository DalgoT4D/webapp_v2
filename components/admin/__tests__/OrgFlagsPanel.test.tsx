/**
 * OrgFlagsPanel — the Flags tab for a single org: every catalog flag with its
 * current on/off state for that org, toggleable independently.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrgFlagsPanel } from '@/components/admin/OrgFlagsPanel';
import * as useAdminPortal from '@/hooks/api/useAdminPortal';

jest.mock('@/hooks/api/useAdminPortal');

const ORG_ID = 42;

const catalog = [
  { flag_name: 'REPORTS', description: 'Enable reports feature' },
  { flag_name: 'DATA_QUALITY', description: 'Elementary data quality reports' },
];

const mockMutate = jest.fn().mockResolvedValue(undefined);
const mockSetOrgFlag = jest.fn().mockResolvedValue({ REPORTS: true, DATA_QUALITY: false });

beforeEach(() => {
  jest.clearAllMocks();
  (useAdminPortal.useAdminFlagCatalog as jest.Mock).mockReturnValue({
    catalog,
    isLoading: false,
  });
  (useAdminPortal.useAdminOrgFlags as jest.Mock).mockReturnValue({
    flags: { REPORTS: true, DATA_QUALITY: false },
    isLoading: false,
    mutate: mockMutate,
  });
  (useAdminPortal.useAdminFlagActions as jest.Mock).mockReturnValue({
    setOrgFlag: mockSetOrgFlag,
    clearOrgFlag: jest.fn(),
    bulkSetFlag: jest.fn(),
  });
});

describe('OrgFlagsPanel', () => {
  it('renders as a table with a header row for Flag, Description, and Status', () => {
    render(<OrgFlagsPanel orgId={ORG_ID} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Flag' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Description' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
  });

  it('renders a row per catalog flag with its current on/off state for this org', () => {
    render(<OrgFlagsPanel orgId={ORG_ID} />);

    const reportsRow = screen.getByTestId('org-flag-row-REPORTS');
    expect(reportsRow).toHaveAttribute('data-slot', 'table-row');

    expect(screen.getByTestId('org-flag-switch-REPORTS')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByTestId('org-flag-switch-DATA_QUALITY')).toHaveAttribute(
      'data-state',
      'unchecked'
    );
    expect(screen.getByText('Elementary data quality reports')).toBeInTheDocument();
  });

  it('pairs each toggle with an accessible label naming the flag', () => {
    render(<OrgFlagsPanel orgId={ORG_ID} />);

    expect(screen.getByLabelText('REPORTS')).toBe(screen.getByTestId('org-flag-switch-REPORTS'));
    expect(screen.getByLabelText('DATA_QUALITY')).toBe(
      screen.getByTestId('org-flag-switch-DATA_QUALITY')
    );
  });

  it('toggling a switch calls setOrgFlag for this org and refreshes', async () => {
    const user = userEvent.setup();
    render(<OrgFlagsPanel orgId={ORG_ID} />);

    await user.click(screen.getByTestId('org-flag-switch-DATA_QUALITY'));

    await waitFor(() => expect(mockSetOrgFlag).toHaveBeenCalledWith(ORG_ID, 'DATA_QUALITY', true));
    expect(mockMutate).toHaveBeenCalled();
  });

  it('shows an empty-state row when the catalog has no flags', () => {
    (useAdminPortal.useAdminFlagCatalog as jest.Mock).mockReturnValue({
      catalog: [],
      isLoading: false,
    });

    render(<OrgFlagsPanel orgId={ORG_ID} />);

    expect(screen.getByText('No feature flags available.')).toBeInTheDocument();
  });
});
