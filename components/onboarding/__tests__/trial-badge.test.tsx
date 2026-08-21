import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet, mockApiPost } from '@/test-utils/api';
import {
  FREE_TRIAL_PLAN_NAME,
  TRIAL_COUNTDOWN_TICK_MS,
  TRIAL_PERIOD_DAYS,
} from '@/constants/trial';
import { ANALYTICS_EVENTS, SUBSCRIPTION_REQUEST_SOURCES } from '@/constants/analytics';
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
const MS_PER_HOUR = 3_600_000;

/**
 * A plan end_date that reads as exactly `days` days left, counted inclusive of today the way
 * `trialDaysRemaining` (ceil) does.
 *
 * Half a day is shaved off so the window lands mid-day rather than exactly on the boundary,
 * where the ceil is one tick away from flipping. Values <= 0 put the end date in the past.
 */
function planEndDateWithDaysLeft(days: number): string {
  return new Date(Date.now() + (days - 0.5) * MS_PER_DAY).toISOString();
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

/** A trial sitting `hours` from its end_date — i.e. somewhere inside the final day. */
function setOrgUserWithHoursLeft(hours: number) {
  mockOrgUser = {
    subscription_plan: FREE_TRIAL_PLAN_NAME,
    org: { slug: 'trial-org' },
    plan_start_date: new Date(Date.now() - TRIAL_PERIOD_DAYS * MS_PER_DAY).toISOString(),
    plan_end_date: new Date(Date.now() + hours * MS_PER_HOUR).toISOString(),
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

  it('uses the gradient stroke and subtle fill for the trial nudge', async () => {
    renderBadge();

    await screen.findByTestId('trial-subscribe-cta');
    expect(screen.getByTestId('trial-days-badge')).toHaveClass(
      'bg-gradient-to-r',
      'from-primary',
      'to-primary/20',
      'p-[1px]'
    );
    expect(screen.getByTestId('trial-days-badge-surface')).toHaveClass(
      'bg-gradient-to-r',
      'from-background',
      'to-primary/5'
    );
  });

  it('renders nothing for a paid org and never fetches the plan', () => {
    setOrgUser({ plan: 'Dalgo' });

    renderBadge();

    expect(screen.queryByTestId('trial-days-badge')).not.toBeInTheDocument();
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('counts the first day of a 14-day trial as 14 days left, not 13', async () => {
    // Days left include the day the user is on, matching the backend's lifecycle emails
    // (`total_days - floor(elapsed)`). Flooring the remainder here greeted a brand-new trial
    // with "13 days left" an hour after signup.
    setOrgUser({ daysLeft: TRIAL_PERIOD_DAYS });
    renderBadge();
    await screen.findByTestId('trial-subscribe-cta');
    expect(screen.getByTestId('trial-days-badge')).toHaveTextContent('14 days left');
  });

  it('still counts the second-to-last day in days, not hours', async () => {
    setOrgUser({ daysLeft: 2 });
    renderBadge();
    await screen.findByTestId('trial-subscribe-cta');
    expect(screen.getByTestId('trial-days-badge')).toHaveTextContent('2 days left');
  });

  it('counts the final day in hours', async () => {
    // A trial expires at the clock time it was created, so "last day" can mean 20 hours or 20
    // minutes. The hour count is the only thing that tells the user which.
    setOrgUserWithHoursLeft(11);
    renderBadge();
    await screen.findByTestId('trial-subscribe-cta');
    expect(screen.getByTestId('trial-days-badge')).toHaveTextContent('11 hours left');
  });

  it('stops counting hours inside the final one', async () => {
    setOrgUserWithHoursLeft(0.4);
    renderBadge();
    await screen.findByTestId('trial-subscribe-cta');
    expect(screen.getByTestId('trial-days-badge')).toHaveTextContent('Less than an hour left');
  });

  it('re-reads the clock on a timer so an open tab does not freeze the countdown', async () => {
    jest.useFakeTimers();
    try {
      setOrgUserWithHoursLeft(5.5);
      renderBadge();
      expect(screen.getByTestId('trial-days-badge')).toHaveTextContent('6 hours left');

      // Push the clock past two hour boundaries; only the tick can surface that.
      await act(async () => {
        jest.setSystemTime(Date.now() + 2 * MS_PER_HOUR);
        jest.advanceTimersByTime(TRIAL_COUNTDOWN_TICK_MS);
      });

      expect(screen.getByTestId('trial-days-badge')).toHaveTextContent('4 hours left');
    } finally {
      jest.useRealTimers();
    }
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

  it('offers the CTA to users without the upgrade permission too', async () => {
    // Every member of a trial org gets to ask — the request is once-per-org and the backend
    // is what decides, so hiding the button here only hid the trial's one conversion path.
    mockPermissions = [];

    renderBadge();

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith(ORG_PLAN_URL));
    expect(screen.getByTestId('trial-days-badge')).toHaveTextContent('7 days left');
    expect(await screen.findByTestId('trial-subscribe-cta')).toBeInTheDocument();
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
      source: 'header_badge',
    });

    // the revalidation after the POST must see the org as having requested
    setOrgPlan({ upgradeRequested: true });
    await user.click(screen.getByTestId('subscription-confirm-button'));

    expect(await screen.findByTestId('subscription-sent-modal')).toBeInTheDocument();
    // The gradient sits on the inner wrapper, not on DialogContent — tailwind-merge would
    // collapse it into DialogContent's `bg-background` and leave the modal see-through
    // (see the note in subscription-request-modal.tsx).
    expect(screen.getByTestId('subscription-sent-gradient')).toHaveClass(
      'bg-gradient-to-b',
      'from-primary/10',
      'to-background'
    );
    expect(screen.getByTestId('subscription-sent-animation')).toHaveAttribute(
      'src',
      expect.stringContaining('celebration-checkmark.gif')
    );
    expect(mockApiPost).toHaveBeenCalledTimes(1);
    expect(mockApiPost).toHaveBeenCalledWith(`${ORG_PLAN_URL}/upgrade`, {});
    expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.SUBSCRIPTION_REQUEST_SENT, {
      days_left: 7,
      already_requested: false,
      source: 'header_badge',
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

  it('reports cancelling the confirm modal as an abandoned request', async () => {
    const user = userEvent.setup();

    renderBadge();
    await user.click(await screen.findByTestId('trial-subscribe-cta'));
    await user.click(screen.getByTestId('subscription-cancel-button'));

    // Without this, OPENED -> SENT has an invisible drop-off step from this surface.
    expect(mockTrackEvent).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.SUBSCRIPTION_REQUEST_ABANDONED,
      expect.objectContaining({ source: SUBSCRIPTION_REQUEST_SOURCES.HEADER_BADGE })
    );
  });

  it('does not report an abandon after the request was sent', async () => {
    const user = userEvent.setup();
    mockApiPost.mockResolvedValue({ success: true, already_requested: false });

    renderBadge();
    await user.click(await screen.findByTestId('trial-subscribe-cta'));
    await user.click(screen.getByTestId('subscription-confirm-button'));
    expect(await screen.findByTestId('subscription-sent-modal')).toBeInTheDocument();
    // Closing the success screen is not an abandonment.
    await user.keyboard('{Escape}');

    expect(mockTrackEvent).not.toHaveBeenCalledWith(
      ANALYTICS_EVENTS.SUBSCRIPTION_REQUEST_ABANDONED,
      expect.anything()
    );
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
      source: 'header_badge',
    });
  });
});
