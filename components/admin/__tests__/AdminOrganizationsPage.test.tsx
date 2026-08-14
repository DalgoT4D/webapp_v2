/**
 * AdminOrganizationsPage tests — the org list: rendering and the search filter.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminOrganizationsPage from '@/app/admin/organizations/page';
import * as useAdminPortal from '@/hooks/api/useAdminPortal';

jest.mock('@/hooks/api/useAdminPortal');

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const orgs = [
  { id: 1, name: 'Akshara', slug: 'akshara', base_plan: 'Dalgo', user_count: 5 },
  { id: 2, name: 'Bhumi', slug: 'bhumi', base_plan: 'Free Trial', user_count: 2 },
];

const mockMutate = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  jest.clearAllMocks();
  (useAdminPortal.useAdminOrgs as jest.Mock).mockReturnValue({
    orgs,
    isLoading: false,
    mutate: mockMutate,
  });
  (useAdminPortal.useAdminOrgActions as jest.Mock).mockReturnValue({
    createOrg: jest.fn(),
    updateOrg: jest.fn(),
  });
});

describe('AdminOrganizationsPage', () => {
  it('renders a row per org', () => {
    render(<AdminOrganizationsPage />);
    expect(screen.getByText('Akshara')).toBeInTheDocument();
    expect(screen.getByText('Bhumi')).toBeInTheDocument();
  });

  it('filters the list by the search box', async () => {
    const user = userEvent.setup();
    render(<AdminOrganizationsPage />);
    await user.type(screen.getByPlaceholderText('Search by name or slug'), 'bhumi');
    expect(screen.queryByText('Akshara')).not.toBeInTheDocument();
    expect(screen.getByText('Bhumi')).toBeInTheDocument();
  });
});
