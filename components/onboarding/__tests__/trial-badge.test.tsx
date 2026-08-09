import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet, mockApiPost } from '@/test-utils/api';
import { FREE_TRIAL_PLAN_NAME, TRIAL_PERIOD_DAYS } from '@/constants/trial';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { TrialBadge } from '../trial-badge';

// ============ Mocks ============

const mockTrackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

const mockToastError = jest.fn();
jest.mock('@/lib/toast', () => ({
  toastError: { api: (...args: unknown[]) => mockToastError(...args) },
}));

let mockPermissions: string[] = ['can_initiate_org_plan_upgrade'];
jest.mock('@/lib/rbac', () => ({
  ...jest.requireActual('@/lib/rbac'),
  useRbac: () => ({ hasPermission: (slug: string) => mockPermissions.includes(slug) }),
}));

let mockOrgUser: Record<string, unknown> | null = null;
jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ getCurrentOrgUser: () => mockOrgUser }),
}));

// ============ Helpers ============

const ORG_PLAN_URL = '/api/orgpreferences/org-plan';

const MS_PER_DAY = 86_400_000;

/**
 * A plan end_date that leaves exactly `days` whole days on the clock.
 *
 * Half a day is added so the window lands mid-day rather than exactly on the boundary, where a
 * floor is one tick away from flipping. Negative values put the end date in the past.
 */
function planEndDateWithDaysLeft(days: number): string {
  return new Date(Date.now() + (days + 0.5) * MS_PER_DAY).toISOString();
}

function setOrgUser({
  plan = FREE_TRIAL_PLAN_NAME,
  daysLeft = 7,
}: { plan?: string; daysLeft?: number } = {}) {
  mockOrgUser = {
    subscription_plan: plan,
    org: { slug: 'trial-org' },
    plan_start_date: new Date(
      Date.now() - (TRIAL_PERIOD_DAYS - daysLeft) * MS_PER_DAY
    ).toISOString(),
    plan_end_date: planEndDateWithDaysLeft(daysLeft),
  };
}

function setOrgPlan({ upgradeRequested = false }: { upgradeRequested?: boolean } = {}) {
  mockApiGet.mockImplementation((url: string) => {
    if (url === ORG_PLAN_URL) {
      return Promise.resolve({
        success: true,
        res: { base_plan: FREE_TRIAL_PLAN_NAME, upgrade_requested: upgradeRequested },
      });
    }
    return Promise.resolve({});
  });
}

const renderBadge = () => render(<TrialBadge />, { wrapper: TestWrapper });

beforeEach(() => {
  jest.clearAllMocks();
  mockPermissions = ['can_initiate_org_plan_upgrade'];
  setOrgUser();
  setOrgPlan();
});

// ============ Rendering ============

describe('TrialBadge rendering', () => {
  it('renders the countdown and CTA for a free-trial org', async () => {
    renderBadge();

    expect(await screen.findByTestId('trial-subscribe-cta')).toHaveTextContent('Subscribe Now');
    expect(screen.getByTestId('trial-days-badge')).toHaveTextContent('7 days left');
  });

  it('renders nothing for a paid org and never fetches the plan', () => {
    setOrgUser({ plan: 'Dalgo' });

    renderBadge();

    expect(screen.queryByTestId('trial-days-badge')).not.toBeInTheDocument();
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('singularises the countdown on the second-to-last day', async () => {
    setOrgUser({ daysLeft: 1 });
    renderBadge();
    await screen.findByTestId('trial-subscribe-cta');
    expect(screen.getByTestId('trial-days-badge')).toHaveTextContent('1 day left');
  });

  it('shows "Last day today" once no whole days remain', async () => {
    setOrgUser({ daysLeft: 0 });
    renderBadge();
    await screen.findByTestId('trial-subscribe-cta');
    expect(screen.getByTestId('trial-days-badge')).toHaveTextContent('Last day today');
  });

  it('distinguishes an already-expired trial from the last day', async () => {
    setOrgUser({ daysLeft: -3 });
    renderBadge();
    await screen.findByTestId('trial-subscribe-cta');
    // The reaper runs on a schedule, so a trial can sit past its end_date for a while. Saying
    // "Last day today" then would be a lie the old created_at math told, because it clamped.
    expect(screen.getByTestId('trial-days-badge')).toHaveTextContent('Trial ended');
  });

  it('renders nothing when the org has no plan window at all', () => {
    mockOrgUser = { subscription_plan: FREE_TRIAL_PLAN_NAME, org: { slug: 'trial-org' } };

    renderBadge();

    expect(screen.queryByTestId('trial-days-badge')).not.toBeInTheDocument();
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('hides the CTA from users without the upgrade permission', async () => {
    mockPermissions = [];

    renderBadge();

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith(ORG_PLAN_URL));
    expect(screen.getByTestId('trial-days-badge')).toHaveTextContent('7 days left');
    expect(screen.queryByTestId('trial-subscribe-cta')).not.toBeInTheDocument();
  });

  it('shows an inert "Request sent" once the org has already requested', async () => {
    setOrgPlan({ upgradeRequested: true });

    renderBadge();

    expect(await screen.findByTestId('trial-request-sent-label')).toHaveTextContent('Request sent');
    expect(screen.queryByTestId('trial-subscribe-cta')).not.toBeInTheDocument();
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});

// ============ Request flow ============

describe('TrialBadge subscription request flow', () => {
  it('confirms, sends, then shows the success modal and flips the pill', async () => {
    const user = userEvent.setup();
    mockApiPost.mockResolvedValue({ success: true, already_requested: false });

    renderBadge();
    await user.click(await screen.findByTestId('trial-subscribe-cta'));

    // confirm step first — nothing is sent yet
    expect(screen.getByTestId('subscription-confirm-modal')).toBeInTheDocument();
    expect(mockApiPost).not.toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.SUBSCRIPTION_REQUEST_OPENED, {
      days_left: 7,
    });

    // the revalidation after the POST must see the org as having requested
    setOrgPlan({ upgradeRequested: true });
    await user.click(screen.getByTestId('subscription-confirm-button'));

    expect(await screen.findByTestId('subscription-sent-modal')).toBeInTheDocument();
    expect(mockApiPost).toHaveBeenCalledTimes(1);
    expect(mockApiPost).toHaveBeenCalledWith(`${ORG_PLAN_URL}/upgrade`, {});
    expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.SUBSCRIPTION_REQUEST_SENT, {
      days_left: 7,
      already_requested: false,
    });
    expect(await screen.findByTestId('trial-request-sent-label')).toBeInTheDocument();
  });

  it('cancelling the confirm modal sends nothing', async () => {
    const user = userEvent.setup();

    renderBadge();
    await user.click(await screen.findByTestId('trial-subscribe-cta'));
    await user.click(screen.getByTestId('subscription-cancel-button'));

    await waitFor(() =>
      expect(screen.queryByTestId('subscription-confirm-modal')).not.toBeInTheDocument()
    );
    expect(mockApiPost).not.toHaveBeenCalled();
    expect(screen.getByTestId('trial-subscribe-cta')).toBeInTheDocument();
  });

  it('keeps the confirm modal open and toasts when the request fails', async () => {
    const user = userEvent.setup();
    mockApiPost.mockRejectedValue(new Error('SES down'));

    renderBadge();
    await user.click(await screen.findByTestId('trial-subscribe-cta'));
    await user.click(screen.getByTestId('subscription-confirm-button'));

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(screen.getByTestId('subscription-confirm-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('subscription-sent-modal')).not.toBeInTheDocument();
    // still retryable — the button is live again
    expect(screen.getByTestId('subscription-confirm-button')).toBeEnabled();
    expect(mockTrackEvent).not.toHaveBeenCalledWith(
      ANALYTICS_EVENTS.SUBSCRIPTION_REQUEST_SENT,
      expect.anything()
    );
  });

  it('reports already_requested when the backend says the request was a replay', async () => {
    const user = userEvent.setup();
    mockApiPost.mockResolvedValue({ success: true, already_requested: true });

    renderBadge();
    await user.click(await screen.findByTestId('trial-subscribe-cta'));
    await user.click(screen.getByTestId('subscription-confirm-button'));

    expect(await screen.findByTestId('subscription-sent-modal')).toBeInTheDocument();
    expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.SUBSCRIPTION_REQUEST_SENT, {
      days_left: 7,
      already_requested: true,
    });
  });
});
