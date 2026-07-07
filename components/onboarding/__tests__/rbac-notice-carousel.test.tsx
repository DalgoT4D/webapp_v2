import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestWrapper } from '@/test-utils/render';
import { RbacNoticeCarousel } from '../rbac-notice-carousel';

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
    has_seen_rbac_notice: false,
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
      <RbacNoticeCarousel />
    </TestWrapper>
  );

// ============ Tests ============

describe('RbacNoticeCarousel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the carousel when the user has not seen the notice', () => {
    setupAuthStore(buildOrgUser({ has_seen_rbac_notice: false }));
    renderCarousel();

    expect(screen.getByTestId('rbac-notice-modal')).toBeInTheDocument();
    expect(screen.getByText("We've simplified how access works")).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('onboarding:rbac_notice_viewed', { role: 'analyst' });
  });

  it('does not show the carousel when the user has already seen it', () => {
    setupAuthStore(buildOrgUser({ has_seen_rbac_notice: true }));
    renderCarousel();

    expect(screen.queryByTestId('rbac-notice-modal')).not.toBeInTheDocument();
  });

  it('walks Admin -> Analyst -> Member then persists the flag on continue', async () => {
    const user = userEvent.setup();
    setupAuthStore(buildOrgUser({ has_seen_rbac_notice: false }));
    renderCarousel();

    // Step 1: Admin detail, only Next shown
    expect(
      screen.getByText(/only you or another admin can create, edit or delete them/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('rbac-notice-back')).not.toBeInTheDocument();
    // Docs link is Member-only
    expect(
      screen.queryByRole('link', { name: /read the full guide on roles/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId('rbac-notice-next'));
    // Step 2: Analyst detail, Back appears
    expect(
      screen.getByText(/Editing pipelines, transforms and the warehouse is now view-only/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('rbac-notice-back')).toBeInTheDocument();

    await user.click(screen.getByTestId('rbac-notice-next'));
    // Step 3: Member detail, Continue replaces Next
    expect(screen.getByText(/Renamed from Guest/i)).toBeInTheDocument();
    expect(screen.queryByTestId('rbac-notice-next')).not.toBeInTheDocument();
    // Member step links to the user-management docs in a new tab
    const docLink = screen.getByRole('link', { name: /read the full guide on roles/i });
    expect(docLink).toHaveAttribute('href', 'https://docs.dalgo.org/settings/user-management/');
    expect(docLink).toHaveAttribute('target', '_blank');

    await user.click(screen.getByTestId('rbac-notice-continue'));

    expect(apiPut).toHaveBeenCalledWith('/api/v1/organizations/user_self/', {
      toupdate_email: 'priya@ngo.org',
      has_seen_rbac_notice: true,
    });
    expect(setOrgUsers).toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith('onboarding:rbac_notice_dismissed', {
      step: 3,
      completed: true,
    });

    await waitFor(() => expect(screen.queryByTestId('rbac-notice-modal')).not.toBeInTheDocument());
  });
});
