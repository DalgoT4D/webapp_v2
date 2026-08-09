'use client';

/**
 * Trial lifecycle nudges — fire on an exact number of days REMAINING in the trial (see
 * TRIAL_NUDGE_DAYS), regardless of onboarding-flow progress. Mounted via NudgeCenter.
 *
 * 7 days left is the halfway "let's get your data flowing" prompt. 1 and 0 days left — the
 * second-last and last days — both show the "almost over" upgrade modal, deliberately as two
 * separate nudges: dismissal is keyed per day, so closing it with 1 day left still lets the
 * final-day one land.
 *
 * Every day count comes from the org plan's own end_date (currentuserv2 `plan_end_date`), the
 * same date the backend's lifecycle emails and expired-trial reaper work from.
 *
 * Dismissing is per session, per org and per day — unlike the flow-resume nudge, this isn't
 * meant to nag every session, just to land once on that specific day.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import {
  FREE_TRIAL_PLAN_NAME,
  TRIAL_NUDGE_DAYS,
  type TrialNudgeDay,
  trialDaysRemaining,
  markTrialDayNudgeDismissed,
  hasTrialDayNudgeDismissed,
} from '@/constants/trial';
import { TwoPaneNudgeDialog } from './two-pane-nudge-dialog';

const ILLUSTRATION_SRC = '/branding/trial-countdown-illustration.jpg';

export function TrialDayNudgeModal() {
  const router = useRouter();
  const getCurrentOrgUser = useAuthStore((s) => s.getCurrentOrgUser);
  const orgUser = getCurrentOrgUser();
  const orgSlug =
    orgUser?.subscription_plan === FREE_TRIAL_PLAN_NAME ? (orgUser.org?.slug ?? null) : null;
  const planEndDate = orgUser?.plan_end_date ?? null;
  // Starts null so nothing flashes open before this effect can check sessionStorage — a
  // browser-only API, unavailable during server render.
  const [day, setDay] = useState<TrialNudgeDay | null>(null);

  useEffect(() => {
    if (!orgSlug || !planEndDate) return;
    // TRIAL_NUDGE_DAYS counts days REMAINING, matching what the copy claims: 7 days left is the
    // halfway nudge, 1 and 0 are the last two days. `trialDaysRemaining` is unclamped, so an
    // expired trial goes negative and matches nothing rather than sticking on the day-0 nudge.
    const daysLeft = trialDaysRemaining(planEndDate);
    const candidate = TRIAL_NUDGE_DAYS.find((d) => d === daysLeft);
    setDay(
      candidate !== undefined && !hasTrialDayNudgeDismissed(orgSlug, candidate) ? candidate : null
    );
  }, [orgSlug, planEndDate]);

  if (day === null || !orgSlug || !planEndDate) return null;

  // Closing is the ONLY thing that suppresses this for the session — a reload before closing
  // deliberately brings it back, because the user hasn't acknowledged it yet.
  const dismiss = () => {
    markTrialDayNudgeDismissed(orgSlug, day);
    setDay(null);
  };

  if (day === 7) {
    return (
      <TwoPaneNudgeDialog
        onOpenChange={(open) => !open && dismiss()}
        title="7 days left. Let's get your data flowing."
        body="You have seven days left to see Dalgo in action. Let's get some numbers on the board so you can actually see the value."
        ctaLabel="Start with sample data"
        onCta={() => {
          dismiss();
          useInsightWalkthroughStore.getState().start(orgSlug);
          useInsightWalkthroughStore.getState().chooseSample();
          router.push('/kpis?create=true');
        }}
        imageSrc={ILLUSTRATION_SRC}
        testId="trial-nudge-7d-modal"
      />
    );
  }

  // 1 and 0 days left share this modal — the deletion date is what changes meaning between them
  // (tomorrow vs today), and the date is spelled out rather than described, so one copy holds.
  // It is the plan's real end_date, not an arithmetic guess: this is the one line of copy that
  // makes the user a promise about when their data disappears.
  const expiry = new Date(planEndDate);

  return (
    <TwoPaneNudgeDialog
      onOpenChange={(open) => !open && dismiss()}
      title="Your trial is almost over."
      body={`On ${format(expiry, 'MMMM d, yyyy')}, your account will be deleted. Secure your full licence now to keep your data syncing seamlessly and your dashboards active.`}
      ctaLabel="Upgrade"
      onCta={() => {
        dismiss();
        router.push('/settings/billing');
      }}
      imageSrc={ILLUSTRATION_SRC}
      testId={`trial-nudge-${day}d-modal`}
    />
  );
}
