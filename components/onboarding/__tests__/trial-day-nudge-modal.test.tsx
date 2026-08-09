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

/** created_at that puts today exactly `elapsed` whole days after signup. */
function createdAtDaysAgo(elapsed: number): string {
  const created = new Date();
  created.setDate(created.getDate() - elapsed);
  return created.toISOString();
}

function setTrialOrg(elapsedDays: number, plan: string = FREE_TRIAL_PLAN_NAME) {
  mockOrgUser = {
    subscription_plan: plan,
    org: { slug: ORG_SLUG, created_at: createdAtDaysAgo(elapsedDays) },
  };
}

/** The deletion date the copy should name: signup + the full trial length. */
function expiryTextFor(elapsedDays: number): string {
  const expiry = new Date(createdAtDaysAgo(elapsedDays));
  expiry.setDate(expiry.getDate() + TRIAL_PERIOD_DAYS);
  return format(expiry, 'MMMM d, yyyy');
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
    it.each([13, 14])('shows the "almost over" modal on elapsed day %i', async (elapsed) => {
      setTrialOrg(elapsed);

      render(<TrialDayNudgeModal />);

      expect(await screen.findByText('Your trial is almost over.')).toBeInTheDocument();
      expect(screen.getByTestId(`trial-day${elapsed}-nudge-modal`)).toBeInTheDocument();
    });

    it('shows the halfway modal on elapsed day 7, not the end-of-trial one', async () => {
      setTrialOrg(7);

      render(<TrialDayNudgeModal />);

      expect(await screen.findByTestId('trial-day7-nudge-modal')).toBeInTheDocument();
      expect(screen.queryByText('Your trial is almost over.')).not.toBeInTheDocument();
    });

    it.each([6, 8, 12])('stays away on a non-nudge day (%i)', async (elapsed) => {
      setTrialOrg(elapsed);

      render(<TrialDayNudgeModal />);

      await settle();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('stays away once the trial has already run out', async () => {
      // Regression guard: elapsed used to be derived from trialDaysRemaining(), which clamps
      // at 0 — so day 20 still read as day 14 and this modal never stopped firing.
      setTrialOrg(20);

      render(<TrialDayNudgeModal />);

      await settle();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('stays away for a paid org', async () => {
      setTrialOrg(14, 'Enterprise');

      render(<TrialDayNudgeModal />);

      await settle();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('copy', () => {
    it('names the real deletion date', async () => {
      setTrialOrg(13);

      render(<TrialDayNudgeModal />);

      expect(
        await screen.findByText(
          `On ${expiryTextFor(13)}, your account will be deleted. Secure your full licence now to keep your data syncing seamlessly and your dashboards active.`
        )
      ).toBeInTheDocument();
    });

    it('offers a Book a call link', async () => {
      setTrialOrg(13);

      render(<TrialDayNudgeModal />);

      const link = await screen.findByTestId('trial-day13-nudge-modal-book-a-call');
      expect(link).toHaveTextContent('Book a call');
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  describe('dismissal', () => {
    it('sends Upgrade to billing and closes', async () => {
      setTrialOrg(14);
      render(<TrialDayNudgeModal />);
      const cta = await screen.findByTestId('trial-day14-nudge-modal-cta');

      await userEvent.click(cta);

      expect(mockPush).toHaveBeenCalledWith('/settings/billing');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('records nothing until the user closes it', async () => {
      // A reload before closing deliberately shows it again — the user hasn't acknowledged it,
      // and on the last two days that message is worth repeating.
      setTrialOrg(14);

      render(<TrialDayNudgeModal />);
      await screen.findByTestId('trial-day14-nudge-modal');

      expect(sessionStorage.length).toBe(0);
    });

    it('records the dismissal in sessionStorage, not localStorage', async () => {
      // The nudge must come back when the user opens Dalgo again, but must NOT come back on a
      // reload within the same session — that is exactly sessionStorage's lifetime.
      setTrialOrg(14);
      render(<TrialDayNudgeModal />);
      await screen.findByTestId('trial-day14-nudge-modal');

      await userEvent.keyboard('{Escape}');

      await waitFor(() =>
        expect(sessionStorage.getItem(`dalgo_trial_day_nudge_dismissed_14_${ORG_SLUG}`)).toBe('1')
      );
      expect(localStorage.length).toBe(0);
    });

    it('stays shut for the rest of the session once dismissed', async () => {
      setTrialOrg(14);
      sessionStorage.setItem(`dalgo_trial_day_nudge_dismissed_14_${ORG_SLUG}`, '1');

      render(<TrialDayNudgeModal />);

      await settle();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('still shows on the last day after being dismissed on the second-last one', async () => {
      // Separate keys per day, deliberately — the final day is the one that matters most.
      setTrialOrg(14);
      sessionStorage.setItem(`dalgo_trial_day_nudge_dismissed_13_${ORG_SLUG}`, '1');

      render(<TrialDayNudgeModal />);

      expect(await screen.findByTestId('trial-day14-nudge-modal')).toBeInTheDocument();
    });
  });
});
