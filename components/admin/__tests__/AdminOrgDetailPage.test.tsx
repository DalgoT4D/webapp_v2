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
import type { AdminOrg } from '@/hooks/api/useAdminPortal';
import { ANALYTICS_EVENTS, FEATURES } from '@/constants/analytics';

jest.mock('@/hooks/api/useAdminPortal');

const mockTrackFeatureView = jest.fn();
const mockTrackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackFeatureView: (...args: unknown[]) => mockTrackFeatureView(...args),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
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

const org: AdminOrg = {
  id: 42,
  name: 'Akshara',
  slug: 'akshara',
  viz_url: null,
  base_plan: 'Dalgo',
  user_count: 5,
};

let mockUpdateOrg: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateOrg = jest.fn().mockResolvedValue(org);
  (useAdminPortal.useAdminOrg as jest.Mock).mockReturnValue({
    org,
    isLoading: false,
    mutate: jest.fn(),
  });
  (useAdminPortal.useAdminOrgActions as jest.Mock).mockReturnValue({
    createOrg: jest.fn(),
    updateOrg: mockUpdateOrg,
    deleteOrg: jest.fn(),
  });
});

/** Open the Overview edit form. */
const startEditing = async (user: ReturnType<typeof userEvent.setup>) => {
  render(<AdminOrganizationDetailPage />);
  await user.click(screen.getByTestId('edit-org-button'));
};

describe('AdminOrganizationDetailPage edit form', () => {
  // A cleared name used to be sent as `undefined`, which the backend reads as "leave
  // unchanged": the save appeared to succeed and the old name reappeared, with nothing
  // on screen saying why.
  it('refuses to save a cleared name and says so', async () => {
    const user = userEvent.setup({ delay: null });
    await startEditing(user);

    await user.clear(screen.getByLabelText('Name'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(mockUpdateOrg).not.toHaveBeenCalled();
  });

  // type="url" on an input outside a <form> is never checked by the browser, so any
  // string reached the API.
  it('rejects a visualization URL that is not a real URL', async () => {
    const user = userEvent.setup({ delay: null });
    await startEditing(user);

    await user.type(screen.getByLabelText('Visualization URL'), 'superset.example.org');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      screen.getByText('Enter a full URL, e.g. https://superset.example.org')
    ).toBeInTheDocument();
    expect(mockUpdateOrg).not.toHaveBeenCalled();
  });

  it('saves valid changes and reports the update', async () => {
    const user = userEvent.setup({ delay: null });
    await startEditing(user);

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Akshara Foundation');
    await user.type(screen.getByLabelText('Visualization URL'), 'https://superset.example.org');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(mockUpdateOrg).toHaveBeenCalledWith(42, {
      name: 'Akshara Foundation',
      viz_url: 'https://superset.example.org',
      base_plan: 'Dalgo',
    });
    expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.ADMIN_ORG_UPDATED, {
      base_plan: 'Dalgo',
    });
  });

  it('leaves the optional visualization URL out when it is blank', async () => {
    const user = userEvent.setup({ delay: null });
    await startEditing(user);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(mockUpdateOrg).toHaveBeenCalledWith(42, {
      name: 'Akshara',
      viz_url: undefined,
      base_plan: 'Dalgo',
    });
  });

  it('discards unsaved edits and their errors on Cancel', async () => {
    const user = userEvent.setup({ delay: null });
    await startEditing(user);

    await user.clear(screen.getByLabelText('Name'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Name is required')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByTestId('edit-org-button'));

    expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Akshara');
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

  it('brings Overview forward when Edit is pressed from another tab', async () => {
    // The Edit button sits in the page header, outside the tabs, but the form it opens
    // lives in Overview: from the Users tab it used to make the header buttons vanish
    // and change nothing else, with no sign of what was being edited.
    const user = userEvent.setup({ delay: null });
    render(<AdminOrganizationDetailPage />);

    await user.click(screen.getByTestId('org-tab-users'));
    expect(screen.getByTestId('org-tab-users')).toHaveAttribute('data-state', 'active');

    await user.click(screen.getByTestId('edit-org-button'));

    expect(screen.getByTestId('org-tab-overview')).toHaveAttribute('data-state', 'active');
    expect(screen.getByLabelText('Name')).toHaveValue('Akshara');
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
