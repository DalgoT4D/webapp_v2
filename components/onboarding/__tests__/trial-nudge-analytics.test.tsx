/**
 * Analytics coverage for the trial lifecycle nudges (7 / 2 / 1 days left).
 *
 * These are the most commercially important dialogs in the product and were the least tracked:
 * they rendered with no view event, their ✕ fired nothing, and abandoning the subscribe confirm
 * step was invisible — so "shown → converted" could not be computed for any of them.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FREE_TRIAL_PLAN_NAME, TRIAL_PERIOD_DAYS } from '@/constants/trial';
import { SUBSCRIPTION_REQUEST_SOURCES } from '@/constants/analytics';
import { TrialDayNudgeModal } from '../trial-day-nudge-modal';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockTrackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock('@/lib/toast', () => ({
  toastError: { api: jest.fn() },
}));

const mockRequestPlanUpgrade = jest.fn();
let mockUpgradeRequested = false;
jest.mock('@/hooks/api/useOrgPlan', () => ({
  useOrgPlan: () => ({
    orgPlan: { upgrade_requested: mockUpgradeRequested },
    mutate: jest.fn(),
  }),
  requestPlanUpgrade: (...args: unknown[]) => mockRequestPlanUpgrade(...args),
}));

let mockOrgUser: Record<string, unknown> | null = null;
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: unknown) => unknown) => {
    const state = { getCurrentOrgUser: () => mockOrgUser };
    return selector ? selector(state) : state;
  },
}));

const mockChooseSample = jest.fn();
const mockStart = jest.fn();
jest.mock('@/stores/insightWalkthroughStore', () => ({
  useInsightWalkthroughStore: {
    getState: () => ({
      start: (...args: unknown[]) => mockStart(...args),
      chooseSample: (...args: unknown[]) => mockChooseSample(...args),
    }),
  },
}));

const ORG_SLUG = 'org-a';
const MS_PER_DAY = 86_400_000;

/** A plan end_date reading as exactly `daysLeft` days left, the way trialDaysRemaining ceils. */
function setTrialOrg(daysLeft: number) {
  mockOrgUser = {
    subscription_plan: FREE_TRIAL_PLAN_NAME,
    org: { slug: ORG_SLUG },
    plan_start_date: new Date(
      Date.now() - (TRIAL_PERIOD_DAYS - daysLeft) * MS_PER_DAY
    ).toISOString(),
    plan_end_date: new Date(Date.now() + (daysLeft - 0.5) * MS_PER_DAY).toISOString(),
  };
}

/** Only the calls for one event name — the component fires several across a flow. */
function callsFor(event: string): unknown[][] {
  return mockTrackEvent.mock.calls.filter((call) => call[0] === event);
}

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  mockUpgradeRequested = false;
  mockOrgUser = null;
  mockRequestPlanUpgrade.mockResolvedValue({ already_requested: false });
});

describe('nudge view', () => {
  it.each([7, 2, 1])('reports the %sd nudge being shown, with its day', async (daysLeft) => {
    setTrialOrg(daysLeft);
    render(<TrialDayNudgeModal />);

    await waitFor(() =>
      expect(screen.getByTestId(`trial-nudge-${daysLeft}d-modal`)).toBeInTheDocument()
    );
    expect(mockTrackEvent).toHaveBeenCalledWith('trial:nudge_viewed', { day: daysLeft });
  });

  it('reports the view once, not on every re-render', async () => {
    setTrialOrg(7);
    const { rerender } = render(<TrialDayNudgeModal />);
    await waitFor(() => expect(screen.getByTestId('trial-nudge-7d-modal')).toBeInTheDocument());

    rerender(<TrialDayNudgeModal />);
    rerender(<TrialDayNudgeModal />);

    expect(callsFor('trial:nudge_viewed')).toHaveLength(1);
  });

  it('reports nothing on a day with no nudge due', async () => {
    setTrialOrg(5);
    render(<TrialDayNudgeModal />);
    await waitFor(() => expect(screen.queryByTestId('trial-nudge-5d-modal')).toBeNull());
    expect(callsFor('trial:nudge_viewed')).toHaveLength(0);
  });

  it('reports nothing for an already-dismissed day', async () => {
    setTrialOrg(1);
    sessionStorage.setItem(`dalgo_trial_day_nudge_dismissed_1_${ORG_SLUG}`, '1');
    render(<TrialDayNudgeModal />);
    await waitFor(() => expect(screen.queryByTestId('trial-nudge-1d-modal')).toBeNull());
    expect(callsFor('trial:nudge_viewed')).toHaveLength(0);
  });
});

describe('nudge dismissal', () => {
  it('reports a close (the ✕ / Esc) as choice close', async () => {
    setTrialOrg(2);
    render(<TrialDayNudgeModal />);
    await waitFor(() => expect(screen.getByTestId('trial-nudge-2d-modal')).toBeInTheDocument());

    await userEvent.keyboard('{Escape}');

    await waitFor(() =>
      expect(mockTrackEvent).toHaveBeenCalledWith('trial:nudge_dismissed', {
        day: 2,
        choice: 'close',
      })
    );
  });

  it('reports taking the CTA as choice cta, so the two exits are one comparable event', async () => {
    setTrialOrg(2);
    render(<TrialDayNudgeModal />);
    await waitFor(() => expect(screen.getByTestId('trial-nudge-2d-modal')).toBeInTheDocument());

    await userEvent.click(screen.getByTestId('trial-nudge-2d-modal-cta'));

    expect(mockTrackEvent).toHaveBeenCalledWith('trial:nudge_dismissed', {
      day: 2,
      choice: 'cta',
    });
  });

  it('reports exactly one dismissal per nudge, never both choices', async () => {
    setTrialOrg(7);
    render(<TrialDayNudgeModal />);
    await waitFor(() => expect(screen.getByTestId('trial-nudge-7d-modal')).toBeInTheDocument());

    await userEvent.click(screen.getByTestId('trial-nudge-7d-modal-cta'));

    expect(callsFor('trial:nudge_dismissed')).toHaveLength(1);
  });
});

describe('7-day nudge attribution', () => {
  it('starts the sample walkthrough tagged as coming from the trial nudge', async () => {
    setTrialOrg(7);
    render(<TrialDayNudgeModal />);
    await waitFor(() => expect(screen.getByTestId('trial-nudge-7d-modal')).toBeInTheDocument());

    await userEvent.click(screen.getByTestId('trial-nudge-7d-modal-cta'));

    // Without the entry, a walkthrough begun here is indistinguishable from one begun in the
    // getting-started widget or the post-tour modal.
    expect(mockChooseSample).toHaveBeenCalledWith({ entry: 'trial_nudge' });
  });
});

describe('subscribe abandonment', () => {
  it('reports abandoning the confirm step, with the days left and the surface', async () => {
    setTrialOrg(2);
    render(<TrialDayNudgeModal />);
    await waitFor(() => expect(screen.getByTestId('trial-nudge-2d-modal')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('trial-nudge-2d-modal-cta'));
    await waitFor(() =>
      expect(screen.getByTestId('subscription-confirm-modal')).toBeInTheDocument()
    );

    await userEvent.click(screen.getByTestId('subscription-cancel-button'));

    expect(mockTrackEvent).toHaveBeenCalledWith('trial:subscription_request_abandoned', {
      days_left: 2,
      source: SUBSCRIPTION_REQUEST_SOURCES.TRIAL_NUDGE,
    });
  });

  it('does NOT report an abandon when the request was actually sent', async () => {
    setTrialOrg(1);
    render(<TrialDayNudgeModal />);
    await waitFor(() => expect(screen.getByTestId('trial-nudge-1d-modal')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('trial-nudge-1d-modal-cta'));
    await waitFor(() =>
      expect(screen.getByTestId('subscription-confirm-modal')).toBeInTheDocument()
    );

    await userEvent.click(screen.getByTestId('subscription-confirm-button'));
    await waitFor(() => expect(mockRequestPlanUpgrade).toHaveBeenCalled());
    // Closing the success screen is not an abandonment.
    await userEvent.keyboard('{Escape}');

    expect(callsFor('trial:subscription_request_abandoned')).toHaveLength(0);
  });
});
