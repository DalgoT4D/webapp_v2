import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format } from 'date-fns';
import { FREE_TRIAL_PLAN_NAME, TRIAL_PERIOD_DAYS } from '@/constants/trial';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { TrialDayNudgeModal } from '../trial-day-nudge-modal';

// ============ Mocks ============

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockTrackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

const mockToastError = jest.fn();
jest.mock('@/lib/toast', () => ({
  toastError: { api: (...args: unknown[]) => mockToastError(...args) },
}));

const mockRequestPlanUpgrade = jest.fn();
const mockMutateOrgPlan = jest.fn();
// The header pill reads this same hook/SWR key — mocking the hook stands in for that shared
// cache, and `mutate` being called is what keeps the two surfaces in the same state.
let mockUpgradeRequested = false;
jest.mock('@/hooks/api/useOrgPlan', () => ({
  useOrgPlan: () => ({
    orgPlan: { upgrade_requested: mockUpgradeRequested },
    mutate: (...args: unknown[]) => mockMutateOrgPlan(...args),
  }),
  requestPlanUpgrade: (...args: unknown[]) => mockRequestPlanUpgrade(...args),
}));

let mockOrgUser: Record<string, unknown> | null = null;
// Selector form — the component calls useAuthStore((s) => s.getCurrentOrgUser).
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: unknown) => unknown) => {
    const state = { getCurrentOrgUser: () => mockOrgUser };
    return selector ? selector(state) : state;
  },
}));

// ============ Helpers ============

const ORG_SLUG = 'org-a';
const MS_PER_DAY = 86_400_000;

/**
 * A plan end_date that reads as exactly `daysLeft` days left, counted inclusive of today the
 * way `trialDaysRemaining` (ceil) does.
 *
 * Half a day is shaved off so the window lands mid-day rather than exactly on the boundary,
 * where the ceil is one tick away from flipping. Values <= 0 put the end date in the past.
 */
function planEndDateWithDaysLeft(daysLeft: number): Date {
  return new Date(Date.now() + (daysLeft - 0.5) * MS_PER_DAY);
}

function setTrialOrg(daysLeft: number, plan: string = FREE_TRIAL_PLAN_NAME) {
  mockOrgUser = {
    subscription_plan: plan,
    org: { slug: ORG_SLUG },
    plan_start_date: new Date(
      Date.now() - (TRIAL_PERIOD_DAYS - daysLeft) * MS_PER_DAY
    ).toISOString(),
    plan_end_date: planEndDateWithDaysLeft(daysLeft).toISOString(),
  };
}

/** The deletion date the copy should name: the plan's own end_date, verbatim. */
function expiryTextFor(daysLeft: number): string {
  return format(planEndDateWithDaysLeft(daysLeft), 'MMMM d, yyyy');
}

/** Nothing is expected to open — let the mount effect run before asserting absence. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('TrialDayNudgeModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    mockOrgUser = null;
    mockUpgradeRequested = false;
  });

  describe('which day it fires on', () => {
    it.each([2, 1])('shows the "almost over" modal with %i days left', async (daysLeft) => {
      setTrialOrg(daysLeft);

      render(<TrialDayNudgeModal />);

      expect(await screen.findByText('Your trial is almost over.')).toBeInTheDocument();
      expect(screen.getByTestId(`trial-nudge-${daysLeft}d-modal`)).toBeInTheDocument();
    });

    it('shows the halfway modal with 7 days left, not the end-of-trial one', async () => {
      setTrialOrg(7);

      render(<TrialDayNudgeModal />);

      expect(await screen.findByTestId('trial-nudge-7d-modal')).toBeInTheDocument();
      expect(screen.queryByText('Your trial is almost over.')).not.toBeInTheDocument();
    });

    it.each([9, 6, 3])('stays away on a non-nudge day (%i days left)', async (daysLeft) => {
      setTrialOrg(daysLeft);

      render(<TrialDayNudgeModal />);

      await settle();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('stays away once the trial has already run out', async () => {
      // Regression guard: the day count must NOT be clamped at 0, or an expired org whose
      // reaper hasn't run yet keeps matching the final-day nudge forever.
      setTrialOrg(-6);

      render(<TrialDayNudgeModal />);

      await settle();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('fires off the plan window, not a fixed 14 days from signup', async () => {
      // An admin-shortened trial: 7 days total, 1 day left. Counting 14 days from the start
      // date would put this on elapsed day 6 and show nothing.
      const end = planEndDateWithDaysLeft(1);
      mockOrgUser = {
        subscription_plan: FREE_TRIAL_PLAN_NAME,
        org: { slug: ORG_SLUG },
        plan_start_date: new Date(end.getTime() - 7 * MS_PER_DAY).toISOString(),
        plan_end_date: end.toISOString(),
      };

      render(<TrialDayNudgeModal />);

      expect(await screen.findByTestId('trial-nudge-1d-modal')).toBeInTheDocument();
    });

    it('stays away when the org has no plan window', async () => {
      mockOrgUser = { subscription_plan: FREE_TRIAL_PLAN_NAME, org: { slug: ORG_SLUG } };

      render(<TrialDayNudgeModal />);

      await settle();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('stays away for a paid org', async () => {
      setTrialOrg(1, 'Enterprise');

      render(<TrialDayNudgeModal />);

      await settle();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('copy', () => {
    it('uses the neutral trial-ending illustration instead of a static countdown', async () => {
      setTrialOrg(1);

      render(<TrialDayNudgeModal />);

      const modal = await screen.findByTestId('trial-nudge-1d-modal');
      const imageSrc = modal.querySelector('img')?.getAttribute('src') ?? '';
      expect(decodeURIComponent(imageSrc)).toContain(
        '/branding/trial-ending-soon-illustration.jpg'
      );
    });

    it('names the real deletion date', async () => {
      setTrialOrg(1);

      render(<TrialDayNudgeModal />);

      expect(
        await screen.findByText(
          `On ${expiryTextFor(1)}, your account will be deleted. Secure your full licence now to keep your data syncing seamlessly and your dashboards active.`
        )
      ).toBeInTheDocument();
    });

    it('offers a "Book a call with us" link', async () => {
      setTrialOrg(1);

      render(<TrialDayNudgeModal />);

      const link = await screen.findByTestId('trial-nudge-1d-modal-book-a-call');
      expect(link).toHaveTextContent('Book a call with us');
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  describe('dismissal', () => {
    it('sends the subscription request from Subscribe Now, in place', async () => {
      // The Settings → Billing page this used to route to no longer exists, so the nudge owns
      // the same one-per-org request the header pill makes — under the same words.
      mockRequestPlanUpgrade.mockResolvedValue({ already_requested: false });
      setTrialOrg(1);
      render(<TrialDayNudgeModal />);

      const cta = await screen.findByTestId('trial-nudge-1d-modal-cta');
      expect(cta).toHaveTextContent('Subscribe Now');
      await userEvent.click(cta);

      // the nudge itself is gone, replaced by the confirm step — nothing has been sent yet
      expect(screen.queryByTestId('trial-nudge-1d-modal')).not.toBeInTheDocument();
      expect(mockRequestPlanUpgrade).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();

      await userEvent.click(await screen.findByTestId('subscription-confirm-button'));

      await waitFor(() => expect(mockRequestPlanUpgrade).toHaveBeenCalled());
      expect(await screen.findByTestId('subscription-sent-modal')).toBeInTheDocument();
      expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.SUBSCRIPTION_REQUEST_SENT, {
        days_left: 1,
        already_requested: false,
        source: 'trial_nudge',
      });
    });

    it('revalidates the org plan so the header pill flips too', async () => {
      mockRequestPlanUpgrade.mockResolvedValue({ already_requested: false });
      setTrialOrg(1);
      render(<TrialDayNudgeModal />);

      await userEvent.click(await screen.findByTestId('trial-nudge-1d-modal-cta'));
      await userEvent.click(await screen.findByTestId('subscription-confirm-button'));

      // Same SWR key as the header badge, so revalidating here is what puts both surfaces in
      // the "Request sent" state without a reload.
      await waitFor(() => expect(mockMutateOrgPlan).toHaveBeenCalled());
    });

    it('goes inert once the org has already requested, from either surface', async () => {
      mockUpgradeRequested = true;
      setTrialOrg(1);
      render(<TrialDayNudgeModal />);

      const cta = await screen.findByTestId('trial-nudge-1d-modal-cta');
      expect(cta).toHaveTextContent('Request sent');
      expect(cta).toBeDisabled();

      await userEvent.click(cta);

      expect(mockRequestPlanUpgrade).not.toHaveBeenCalled();
      expect(screen.queryByTestId('subscription-confirm-modal')).not.toBeInTheDocument();
    });

    it('keeps the confirm step open when the request fails', async () => {
      mockRequestPlanUpgrade.mockRejectedValue(new Error('boom'));
      setTrialOrg(1);
      render(<TrialDayNudgeModal />);

      await userEvent.click(await screen.findByTestId('trial-nudge-1d-modal-cta'));
      await userEvent.click(await screen.findByTestId('subscription-confirm-button'));

      await waitFor(() => expect(mockToastError).toHaveBeenCalled());
      // still on the confirm step, so the user can retry without reopening anything
      expect(screen.getByTestId('subscription-confirm-modal')).toBeInTheDocument();
      expect(screen.queryByTestId('subscription-sent-modal')).not.toBeInTheDocument();
    });

    it('records nothing until the user closes it', async () => {
      // A reload before closing deliberately shows it again — the user hasn't acknowledged it,
      // and on the last two days that message is worth repeating.
      setTrialOrg(1);

      render(<TrialDayNudgeModal />);
      await screen.findByTestId('trial-nudge-1d-modal');

      expect(sessionStorage.length).toBe(0);
    });

    it('records the dismissal in sessionStorage, not localStorage', async () => {
      // The nudge must come back when the user opens Dalgo again, but must NOT come back on a
      // reload within the same session — that is exactly sessionStorage's lifetime.
      setTrialOrg(1);
      render(<TrialDayNudgeModal />);
      await screen.findByTestId('trial-nudge-1d-modal');

      await userEvent.keyboard('{Escape}');

      await waitFor(() =>
        expect(sessionStorage.getItem(`dalgo_trial_day_nudge_dismissed_1_${ORG_SLUG}`)).toBe('1')
      );
      expect(localStorage.length).toBe(0);
    });

    it('stays shut for the rest of the session once dismissed', async () => {
      setTrialOrg(1);
      sessionStorage.setItem(`dalgo_trial_day_nudge_dismissed_1_${ORG_SLUG}`, '1');

      render(<TrialDayNudgeModal />);

      await settle();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('still shows on the last day after being dismissed on the second-last one', async () => {
      // Separate keys per day, deliberately — the final day is the one that matters most.
      setTrialOrg(1);
      sessionStorage.setItem(`dalgo_trial_day_nudge_dismissed_2_${ORG_SLUG}`, '1');

      render(<TrialDayNudgeModal />);

      expect(await screen.findByTestId('trial-nudge-1d-modal')).toBeInTheDocument();
    });
  });
});
