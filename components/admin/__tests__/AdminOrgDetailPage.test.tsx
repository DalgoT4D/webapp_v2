/**
 * AdminOrganizationDetailPage — the Overview / Users / Flags tabs for one org.
 *
 * Scoped to the tab analytics: tabs are local state, so the automatic
 * `feature:viewed` that fires on navigation does NOT fire when a tab is switched.
 * rules/analytics.md requires an explicit trackFeatureView in the tab onChange, the
 * way ingest / notifications / explore / user-management / transform already do.
 * The Flags tab in particular is new, and was shipping uninstrumented.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminOrganizationDetailPage from '@/app/admin/organizations/[id]/page';
import * as useAdminPortal from '@/hooks/api/useAdminPortal';
import { FEATURES } from '@/constants/analytics';

jest.mock('@/hooks/api/useAdminPortal');

const mockTrackFeatureView = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackFeatureView: (...args: unknown[]) => mockTrackFeatureView(...args),
  trackEvent: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: '42' }),
  useRouter: () => ({ push: jest.fn() }),
}));

// The tab bodies fetch their own data; this file is about the tab analytics only.
jest.mock('@/components/admin/OrgUsersTable', () => ({
  OrgUsersTable: () => <div data-testid="org-users-table" />,
}));
jest.mock('@/components/admin/OrgFlagsPanel', () => ({
  OrgFlagsPanel: () => <div data-testid="org-flags-panel" />,
}));

const org = {
  id: 42,
  name: 'Akshara',
  slug: 'akshara',
  viz_url: null,
  base_plan: 'Dalgo',
  user_count: 5,
};

beforeEach(() => {
  jest.clearAllMocks();
  (useAdminPortal.useAdminOrg as jest.Mock).mockReturnValue({
    org,
    isLoading: false,
    mutate: jest.fn(),
  });
  (useAdminPortal.useAdminOrgActions as jest.Mock).mockReturnValue({
    createOrg: jest.fn(),
    updateOrg: jest.fn(),
    deleteOrg: jest.fn(),
  });
});

describe('AdminOrganizationDetailPage tab analytics', () => {
  it('does not fire a tab view on first render — navigation already reported it', () => {
    render(<AdminOrganizationDetailPage />);

    expect(mockTrackFeatureView).not.toHaveBeenCalled();
  });

  it('reports the Flags tab when it is opened', async () => {
    const user = userEvent.setup({ delay: null });
    render(<AdminOrganizationDetailPage />);

    await user.click(screen.getByTestId('org-tab-flags'));

    expect(mockTrackFeatureView).toHaveBeenCalledWith(FEATURES.ADMIN_ORGANIZATIONS, {
      tab: 'flags',
    });
  });

  it('reports the Users tab when it is opened', async () => {
    const user = userEvent.setup({ delay: null });
    render(<AdminOrganizationDetailPage />);

    await user.click(screen.getByTestId('org-tab-users'));

    expect(mockTrackFeatureView).toHaveBeenCalledWith(FEATURES.ADMIN_ORGANIZATIONS, {
      tab: 'users',
    });
  });

  it('reports each switch, so tab dwell can be segmented rather than collapsed', async () => {
    const user = userEvent.setup({ delay: null });
    render(<AdminOrganizationDetailPage />);

    await user.click(screen.getByTestId('org-tab-flags'));
    await user.click(screen.getByTestId('org-tab-overview'));

    expect(mockTrackFeatureView).toHaveBeenCalledTimes(2);
    expect(mockTrackFeatureView).toHaveBeenLastCalledWith(FEATURES.ADMIN_ORGANIZATIONS, {
      tab: 'overview',
    });
  });
});
