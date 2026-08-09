import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format } from 'date-fns';
import { FREE_TRIAL_PLAN_NAME, TRIAL_PERIOD_DAYS } from '@/constants/trial';
import { TrialDayNudgeModal } from '../trial-day-nudge-modal';

// ============ Mocks ============

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
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
 * A plan end_date leaving exactly `daysLeft` whole days on the clock.
 *
 * Half a day is added so the window lands mid-day rather than exactly on the boundary, where a
 * floor is one tick away from flipping. Negative values put the end date in the past.
 */
function planEndDateWithDaysLeft(daysLeft: number): Date {
  return new Date(Date.now() + (daysLeft + 0.5) * MS_PER_DAY);
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
  });

  describe('which day it fires on', () => {
    it.each([1, 0])('shows the "almost over" modal with %i days left', async (daysLeft) => {
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

    it.each([8, 6, 2])('stays away on a non-nudge day (%i days left)', async (daysLeft) => {
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
      setTrialOrg(0, 'Enterprise');

      render(<TrialDayNudgeModal />);

      await settle();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('copy', () => {
    it('names the real deletion date', async () => {
      setTrialOrg(1);

      render(<TrialDayNudgeModal />);

      expect(
        await screen.findByText(
          `On ${expiryTextFor(1)}, your account will be deleted. Secure your full licence now to keep your data syncing seamlessly and your dashboards active.`
        )
      ).toBeInTheDocument();
    });

    it('offers a Book a call link', async () => {
      setTrialOrg(1);

      render(<TrialDayNudgeModal />);

      const link = await screen.findByTestId('trial-nudge-1d-modal-book-a-call');
      expect(link).toHaveTextContent('Book a call');
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  describe('dismissal', () => {
    it('sends Upgrade to billing and closes', async () => {
      setTrialOrg(0);
      render(<TrialDayNudgeModal />);
      const cta = await screen.findByTestId('trial-nudge-0d-modal-cta');

      await userEvent.click(cta);

      expect(mockPush).toHaveBeenCalledWith('/settings/billing');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('records nothing until the user closes it', async () => {
      // A reload before closing deliberately shows it again — the user hasn't acknowledged it,
      // and on the last two days that message is worth repeating.
      setTrialOrg(0);

      render(<TrialDayNudgeModal />);
      await screen.findByTestId('trial-nudge-0d-modal');

      expect(sessionStorage.length).toBe(0);
    });

    it('records the dismissal in sessionStorage, not localStorage', async () => {
      // The nudge must come back when the user opens Dalgo again, but must NOT come back on a
      // reload within the same session — that is exactly sessionStorage's lifetime.
      setTrialOrg(0);
      render(<TrialDayNudgeModal />);
      await screen.findByTestId('trial-nudge-0d-modal');

      await userEvent.keyboard('{Escape}');

      await waitFor(() =>
        expect(sessionStorage.getItem(`dalgo_trial_day_nudge_dismissed_0_${ORG_SLUG}`)).toBe('1')
      );
      expect(localStorage.length).toBe(0);
    });

    it('stays shut for the rest of the session once dismissed', async () => {
      setTrialOrg(0);
      sessionStorage.setItem(`dalgo_trial_day_nudge_dismissed_0_${ORG_SLUG}`, '1');

      render(<TrialDayNudgeModal />);

      await settle();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('still shows on the last day after being dismissed on the second-last one', async () => {
      // Separate keys per day, deliberately — the final day is the one that matters most.
      setTrialOrg(0);
      sessionStorage.setItem(`dalgo_trial_day_nudge_dismissed_1_${ORG_SLUG}`, '1');

      render(<TrialDayNudgeModal />);

      expect(await screen.findByTestId('trial-nudge-0d-modal')).toBeInTheDocument();
    });
  });
});
