import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestWrapper } from '@/test-utils/render';
import { FREE_TRIAL_PLAN_NAME } from '@/constants/trial';
import { ResourceSharingNoticeCarousel } from '../resource-sharing-notice-carousel';

// ============ Mocks ============

jest.mock('swr', () => ({
  ...jest.requireActual('swr'),
  mutate: jest.fn(() => Promise.resolve()),
}));

const apiPut = jest.fn(() => Promise.resolve({}));
jest.mock('@/lib/api', () => ({
  apiPut: (...args: unknown[]) => apiPut(...args),
}));

const trackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

jest.mock('@/stores/authStore', () => ({ useAuthStore: jest.fn() }));
import { useAuthStore, type OrgUser } from '@/stores/authStore';

// ============ Helpers ============

const setOrgUsers = jest.fn();

function buildOrgUser(overrides: Partial<OrgUser> = {}): OrgUser {
  return {
    user_id: 1,
    email: 'priya@ngo.org',
    org: { slug: 'test-org', name: 'Test Org', viz_url: '' },
    active: true,
    new_role_slug: 'analyst',
    permissions: [],
    has_seen_resource_sharing_notice: false,
    ...overrides,
  };
}

function setupAuthStore(orgUser: OrgUser | null) {
  const state = {
    orgUsers: orgUser ? [orgUser] : [],
    selectedOrgSlug: orgUser ? orgUser.org.slug : null,
    setOrgUsers,
  };
  (useAuthStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: typeof state) => unknown) => selector(state)
  );
}

const renderCarousel = () =>
  render(
    <TestWrapper>
      <ResourceSharingNoticeCarousel />
    </TestWrapper>
  );

// ============ Tests ============

describe('ResourceSharingNoticeCarousel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the carousel when the user has not seen the notice', () => {
    setupAuthStore(buildOrgUser({ has_seen_resource_sharing_notice: false }));
    renderCarousel();

    expect(screen.getByTestId('resource-sharing-notice-modal')).toBeInTheDocument();
    expect(screen.getByText("We've changed how sharing works")).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('trial_onboarding:resource_sharing_notice_viewed', {
      role: 'analyst',
    });
  });

  it('does not show the carousel when the user has already seen it', () => {
    setupAuthStore(buildOrgUser({ has_seen_resource_sharing_notice: true }));
    renderCarousel();

    expect(screen.queryByTestId('resource-sharing-notice-modal')).not.toBeInTheDocument();
  });

  it('never shows for a free-trial org, and marks nothing as seen', () => {
    // Trial workspaces start on the resource-sharing model; the notice, tracking flag,
    // and API write are all suppressed so the notice survives a later conversion.
    setupAuthStore(
      buildOrgUser({
        has_seen_resource_sharing_notice: false,
        subscription_plan: FREE_TRIAL_PLAN_NAME,
      })
    );
    renderCarousel();

    expect(screen.queryByTestId('resource-sharing-notice-modal')).not.toBeInTheDocument();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(apiPut).not.toHaveBeenCalled();
    expect(setOrgUsers).not.toHaveBeenCalled();
  });

  it('still shows for a paid org', () => {
    setupAuthStore(
      buildOrgUser({ has_seen_resource_sharing_notice: false, subscription_plan: 'Dalgo' })
    );
    renderCarousel();

    expect(screen.getByTestId('resource-sharing-notice-modal')).toBeInTheDocument();
  });

  it('walks Admin -> Analyst -> Member then persists the flag on continue', async () => {
    const user = userEvent.setup();
    setupAuthStore(buildOrgUser({ has_seen_resource_sharing_notice: false }));
    renderCarousel();

    // Step 1: Admin detail, only Next shown
    expect(
      screen.getByText(/you retain ultimate oversight allowing you to view, transfer or restrict/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('resource-sharing-notice-back')).not.toBeInTheDocument();
    // Docs link is Member-only
    expect(
      screen.queryByRole('link', { name: /read the full guide on access/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId('resource-sharing-notice-next'));
    // Step 2: Analyst detail, Back appears
    expect(
      screen.getByText(/sharing a dashboard automatically shares the charts inside it/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('resource-sharing-notice-back')).toBeInTheDocument();

    await user.click(screen.getByTestId('resource-sharing-notice-next'));
    // Step 3: Member detail, Continue replaces Next
    expect(screen.getByText(/focused view of the data that matters to you/i)).toBeInTheDocument();
    expect(screen.queryByTestId('resource-sharing-notice-next')).not.toBeInTheDocument();
    // Member step links to the access docs in a new tab
    const docLink = screen.getByRole('link', { name: /read the full guide on access/i });
    expect(docLink).toHaveAttribute('href', 'https://docs.dalgo.org/settings/access/');
    expect(docLink).toHaveAttribute('target', '_blank');

    await user.click(screen.getByTestId('resource-sharing-notice-continue'));

    expect(apiPut).toHaveBeenCalledWith('/api/v1/organizations/user_self/', {
      toupdate_email: 'priya@ngo.org',
      has_seen_resource_sharing_notice: true,
    });
    expect(setOrgUsers).toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith('trial_onboarding:resource_sharing_notice_dismissed', {
      step: 3,
      completed: true,
    });

    await waitFor(() =>
      expect(screen.queryByTestId('resource-sharing-notice-modal')).not.toBeInTheDocument()
    );
  });
});
